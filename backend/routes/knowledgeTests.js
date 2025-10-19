// routes/knowledgeTests.js
const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();
const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "knowledge_tests.json");

// ENV keys
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash";

// helpers
async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify({ tests: [] }, null, 2), "utf8");
  }
}
async function readFile() {
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf8");
  return JSON.parse(raw || '{"tests":[]}');
}
async function writeFile(data) {
  await ensureFile();
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), "utf8");
}

function safelyParseJsonFromText(text) {
  if (!text) return null;
  // Remove code fences
  let t = String(text).replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
  // Try to find first { or [
  const first = t.search(/[\{\[]/);
  if (first >= 0) t = t.slice(first);
  // Trim trailing non-json
  const lastBrace = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (lastBrace >= 0) t = t.slice(0, lastBrace + 1);
  try {
    return JSON.parse(t);
  } catch (err) {
    // fallback: try to extract array-like lines and build minimal structure (not ideal)
    return null;
  }
}

// call Gemini generateContent
async function callGeminiGenerate(promptText, options = {}) {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured");
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(MODEL)}:generateContent?key=${GOOGLE_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: options.maxOutputTokens || 800,
    },
  };
  const resp = await axios.post(endpoint, payload, { headers: { "Content-Type": "application/json" }, timeout: 25000 });
  return resp.data;
}

// ---- list tests
router.get("/", async (req, res) => {
  try {
    const data = await readFile();
    const meta = (data.tests || []).map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt,
      questionCount: (t.questions || []).length,
    }));
    res.json(meta);
  } catch (err) {
    console.error("List tests err:", err);
    res.status(500).json({ error: "Could not read tests" });
  }
});

// ---- create test (generate MCQs via Gemini)
router.post("/", async (req, res) => {
  try {
    const { name, text, requested = 6 } = req.body || {};
    if (!name || !text) return res.status(400).json({ error: "name and text required" });

    // Build a strict prompt asking for JSON output
    const prompt = `
You are an expert teacher. Given the following passage, generate ${requested} multiple-choice questions (MCQs).
Requirements:
- Output ONLY valid JSON (no extra commentary).
- JSON structure must be: { "questions": [ { "prompt": "...", "choices": ["A", "B", "C", "D"], "correctIndex": 1, "id": "q1" }, ... ] }
- Each question should be concise, 4 choices, exactly one correct.
- Keep language simple for learners.
Passage:
"""${text}"""
Return the JSON only.
`;

    let modelResp;
    try {
      modelResp = await callGeminiGenerate(prompt, { maxOutputTokens: 1000 });
    } catch (err) {
      console.error("Gemini failed to generate MCQs:", err.response?.data || err.message);
      return res.status(500).json({ error: "MCQ generation failed" });
    }

    // Try to extract text then parse JSON
    const rawOut =
      modelResp?.candidates?.[0]?.content?.parts?.[0]?.text ||
      modelResp?.output?.[0]?.content?.[0]?.text ||
      (typeof modelResp === "string" ? modelResp : JSON.stringify(modelResp));

    const parsed = safelyParseJsonFromText(rawOut);
    if (!parsed || !Array.isArray(parsed.questions)) {
      console.error("Invalid JSON output from model\nRAW:", rawOut);
      return res.status(500).json({ error: "Invalid JSON output from model" });
    }

    // Normalize questions, add ids
    const questions = parsed.questions.map((q, i) => ({
      id: q.id || `q_${Date.now().toString(36)}_${i}`,
      prompt: q.prompt || q.question || "",
      choices: q.choices || q.options || [],
      correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
    }));

    // Save test in single file
    const data = await readFile();
    const id = `test_${Date.now().toString(36)}_${Math.floor(Math.random()*1000)}`;
    const createdAt = new Date().toISOString();
    const testObj = {
      id,
      name,
      createdAt,
      sourceText: text,
      questions,
      results: [] // store submissions here
    };
    data.tests = data.tests || [];
    data.tests.push(testObj);
    await writeFile(data);

    return res.status(201).json({ id, name, createdAt, questionCount: questions.length });
  } catch (err) {
    console.error("Create test err:", err);
    res.status(500).json({ error: "Could not create test" });
  }
});

// ---- get a single test (with questions + results)
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = await readFile();
    const test = (data.tests || []).find((t) => String(t.id) === String(id));
    if (!test) return res.status(404).json({ error: "Test not found" });
    res.json(test);
  } catch (err) {
    console.error("Get test err:", err);
    res.status(500).json({ error: "Could not read test" });
  }
});

// ---- submit answers: grade + store
router.post("/:id/submit", async (req, res) => {
  try {
    const id = req.params.id;
    const { userId = null, answers = [] } = req.body || {};
    const data = await readFile();
    const test = (data.tests || []).find((t) => String(t.id) === String(id));
    if (!test) return res.status(404).json({ error: "Test not found" });

    // Build grading: answers is [{ qId, selectedIndex }]
    const questions = test.questions || [];
    const answersMap = (answers || []).reduce((acc, a) => { acc[a.qId] = a.selectedIndex; return acc; }, {});

    const resultAnswers = questions.map((q) => {
      const selected = typeof answersMap[q.id] === "number" ? answersMap[q.id] : -1;
      const correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
      const correct = selected === correctIndex;
      return {
        qId: q.id,
        prompt: q.prompt,
        selectedIndex: selected,
        correctIndex,
        correct
      };
    });

    const correctCount = resultAnswers.filter((r) => r.correct).length;
    const score = Math.round((correctCount / Math.max(1, questions.length)) * 100);

    const submission = {
      id: `sub_${Date.now().toString(36)}_${Math.floor(Math.random()*1000)}`,
      userId,
      timestamp: new Date().toISOString(),
      score,
      answers: resultAnswers
    };

    test.results = test.results || [];
    test.results.push(submission);
    await writeFile(data);

    return res.json({ submission, score });
  } catch (err) {
    console.error("Submit err:", err);
    res.status(500).json({ error: "Could not submit answers" });
  }
});

// ---- justify mistakes: ask Gemini to explain wrong questions
router.post("/:id/justify", async (req, res) => {
  try {
    const id = req.params.id;
    const { qIds = [], contextNotes = "" } = req.body || {};
    if (!Array.isArray(qIds) || !qIds.length) return res.status(400).json({ error: "qIds required" });

    const data = await readFile();
    const test = (data.tests || []).find((t) => String(t.id) === String(id));
    if (!test) return res.status(404).json({ error: "Test not found" });

    const questions = test.questions.filter((q) => qIds.includes(q.id));

    const prompt = `
You are StudyAgent. For each question and its correct answer given below, write a short (1-2 paragraph) child-friendly explanation why the correct answer is correct and a short tip to remember it.
Return ONLY JSON:
{
  "justifications": [
    { "qId": "...", "explanation": "..." }
  ]
}
Context (extract): ${contextNotes}

Questions:
${questions.map((q) => `QID:${q.id}\nQ:${q.prompt}\nChoices:${JSON.stringify(q.choices)}\nCorrectIndex:${q.correctIndex}`).join("\n\n")}
`;

    let modelResp;
    try {
      modelResp = await callGeminiGenerate(prompt, { maxOutputTokens: 800 });
    } catch (err) {
      console.error("Gemini justify failed:", err.response?.data || err.message);
      return res.status(500).json({ error: "Justify generation failed" });
    }

    const raw = modelResp?.candidates?.[0]?.content?.parts?.[0]?.text ||
      modelResp?.output?.[0]?.content?.[0]?.text || JSON.stringify(modelResp);

    const parsed = safelyParseJsonFromText(raw);
    if (!parsed || !Array.isArray(parsed.justifications)) {
      console.error("Invalid justify JSON from model\nRAW:", raw);
      return res.status(500).json({ error: "Invalid JSON from justification model" });
    }

    // return justifications
    return res.json({ justifications: parsed.justifications });
  } catch (err) {
    console.error("Justify err:", err);
    res.status(500).json({ error: "Could not produce justifications" });
  }
});

// ---- OCR endpoint using Gemini (imageBase64 expected) ----
router.post("/ocr", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });
    if (!GOOGLE_API_KEY) return res.status(501).json({ error: "Gemini API key missing" });

    const base64 = String(imageBase64).split("base64,")[1] || imageBase64;

    // Build a prompt instructing Gemini to extract visible text. Use inline_data part for image
    const payload = {
      contents: [
        {
          parts: [
            { text: "Extract the visible text content from the image and return plain text only." },
            { inline_data: { mime_type: "image/png", data: base64 } }
          ]
        }
      ],
      generationConfig: { maxOutputTokens: 800 }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(MODEL)}:generateContent?key=${GOOGLE_API_KEY}`;
    const resp = await axios.post(endpoint, payload, { headers: { "Content-Type": "application/json" }, timeout: 25000 });

    const extracted =
      resp.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      resp.data?.output?.[0]?.content?.[0]?.text ||
      "";

    res.json({ text: extracted });
  } catch (err) {
    console.error("OCR err:", err.response?.data || err.message);
    res.status(500).json({ error: "OCR failed" });
  }
});

module.exports = router;
