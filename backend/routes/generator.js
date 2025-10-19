// routes/generator.js
const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.warn("⚠️ GOOGLE_API_KEY missing — flashcard generator will return mock data.");
}

// Helper functions
async function readJsonFile(filename) {
  const p = path.join(DATA_DIR, filename);
  try {
    const data = await fs.readFile(p, "utf8");
    return JSON.parse(data);
  } catch {
    return { cards: [] };
  }
}

async function writeJsonFile(filename, data) {
  const p = path.join(DATA_DIR, filename);
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

router.post("/generate", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text (string) is required" });
    }

    if (!GOOGLE_API_KEY) {
      return res.status(200).json({
        cards: [
          { question: "Mock Q1 about text", answer: "Mock Answer 1", tags: ["mock"], difficulty: "easy" },
          { question: "Mock Q2 about text", answer: "Mock Answer 2", tags: ["mock"], difficulty: "medium" },
          { question: "Mock Q3 about text", answer: "Mock Answer 3", tags: ["mock"], difficulty: "hard" },
        ],
        note: "Returned mock flashcards because GOOGLE_API_KEY is not set."
      });
    }

    // Gemini 2.0 Flash model
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

    const prompt = `

You are a helpful study assistant.
Given the following text or topic, create exactly **3 concise flashcards**.
make sure to understand the language and try to make questions on the same language
Each flashcard must be in JSON format like this:
[
  {"question": "...", "answer": "...", "tags": ["topic"], "difficulty": "easy|medium|hard"}
]
Text: """${text}"""
Return ONLY the JSON array, no explanations.
    `.trim();

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
    };

    const response = await axios.post(endpoint, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 20000
    });

    // safer extraction of model text (handle code fences and extra text)
const rawText =
  response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
  response.data?.candidates?.[0]?.text?.trim() ||
  response.data?.output?.[0]?.content?.[0]?.text?.trim() ||
  "[]";

console.log("🔎 Raw model text preview:", rawText.slice(0, 500));

// remove ```json or ``` fences and surrounding whitespace
let cleaned = rawText
  .replace(/```json\s*/i, "")
  .replace(/```/g, "")
  .trim();

// try to extract JSON array between first '[' and last ']'
const firstBracket = cleaned.indexOf("[");
const lastBracket = cleaned.lastIndexOf("]");
if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
  cleaned = cleaned.substring(firstBracket, lastBracket + 1);
}

let cards;
try {
  cards = JSON.parse(cleaned);
  if (!Array.isArray(cards)) throw new Error("Parsed JSON is not an array");
} catch (parseErr) {
  console.warn("⚠️ Gemini returned non-JSON or unparsable JSON. Raw output:", rawText);
  console.warn("⚠️ Cleaned attempt:", cleaned);
  return res.status(500).json({ error: "Invalid JSON output from model", detail: parseErr.message });
}

// Basic validation: each item should have question and answer
const validCards = cards.filter((c) => c && (c.question || c.q) && (c.answer || c.a));
if (!validCards.length) {
  console.warn("⚠️ No valid Q/A pairs found in model output:", cards);
  return res.status(500).json({ error: "Model returned no valid flashcards" });
}

// Normalize field names and append metadata
const flashData = await readJsonFile("flashcards.json").catch(() => ({ cards: [], totalCards: 0 }));
flashData.cards = flashData.cards || [];

const newCards = validCards.map((c, i) => {
  const questionText = c.question || c.q || "";
  const answerText = c.answer || c.a || "";
  const tags = Array.isArray(c.tags) ? c.tags : (c.tags ? [String(c.tags)] : []);
  const difficulty = c.difficulty || "medium";

  return {
    id: `auto_${Date.now()}_${Math.floor(Math.random() * 10000)}_${i}`,
    question: questionText,
    answer: answerText,
    tags,
    difficulty,
    lastReviewed: null,
    nextReviewDate: null,
    createdAt: new Date().toISOString()
  };
});

flashData.cards.push(...newCards);
flashData.totalCards = flashData.cards.length;
flashData.dueForReview = flashData.cards.filter((c) => c.nextReviewDate && new Date(c.nextReviewDate) <= new Date()).length;

await writeJsonFile("flashcards.json", flashData);

console.log(`✅ Appended ${newCards.length} generated cards to flashcards.json`);
return res.status(201).json({ success: true, added: newCards.length, cards: newCards });

  } catch (err) {
    console.error("❌ Flashcard generator error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Flashcard generation failed", detail: err.message });
  }
});

module.exports = router;
