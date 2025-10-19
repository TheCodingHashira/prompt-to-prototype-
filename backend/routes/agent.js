// routes/agent.js
// Auto-discover best Gemini Flash model and call generateContent with correct payload.
// Falls back to a local answer when generation fails.
const express = require("express");
const axios = require("axios");
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_API;
if (!GOOGLE_API_KEY) {
  console.warn("⚠️ WARNING: GOOGLE_API_KEY not set — Study Agent will use local fallback.");
}

// Preferred model ordering
const PREFERRED_MODEL_PREFIXES = [
  "gemini-2.0-flash"
];

// Local fallback answers
const FALLBACK_ANSWERS = {
  "Explain recursion simply":
    "Recursion is like standing between two mirrors: each mirror shows the same image again and again. In programming, a function calls itself with a smaller problem until it reaches a simplest case (the base case) and then the answers come back step by step.\n\nQuick tips:\n1) Identify the base case first. 2) Think how the function reduces the problem each call.",
  default:
    "Sorry — the study agent can't reach the AI service right now. Try again later or ask a different question."
};

// Cache selected model so listing isn't done every request
let cachedModel = null;
let cachedSupportsGenerateContent = false;
let modelListAttempted = false;

// Helpers
async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1/models?key=${GOOGLE_API_KEY}`;
  const r = await axios.get(url, { timeout: 10000 });
  return r.data?.models || [];
}

function pickPreferredModel(models) {
  const available = models
    .map((m) => {
      if (!m) return null;
      if (typeof m === "string") return m.includes("/") ? m.split("/").pop() : m;
      if (m.name) {
        const nm = String(m.name);
        return nm.includes("/") ? nm.split("/").pop() : nm;
      }
      return null;
    })
    .filter(Boolean);

  for (const pref of PREFERRED_MODEL_PREFIXES) {
    const found = available.find((a) => a === pref || a.startsWith(pref));
    if (found) return found;
  }
  return available[0] || null;
}

function extractAnswer(body) {
  if (!body) return null;

  const candidates = body.candidates || [];
  if (!candidates.length) return null;

  const parts = candidates.flatMap((c) =>
    c.content?.parts?.map((p) => p.text || "") || []
  );

  const text =
    parts.filter(Boolean).join("\n") ||
    body.output?.[0]?.content?.[0]?.text ||
    body.candidates?.[0]?.content?.[0]?.text ||
    body.candidates?.[0]?.text ||
    null;

  return text ? text.trim() : null;
}


function buildGenerateContentEndpoint(modelName) {
  // modelName should be like "gemini-2.5-flash"
  return `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(modelName)}:generateContent?key=${GOOGLE_API_KEY}`;
}

// System prompt
const SYSTEM_PROMPT = `
You are "StudyAgent" — a friendly and expert tutor who always answers like a teacher for a 10-year-old.
Guidelines:
- under stand language of question and give answer in that language only  .
- Explain in simple, child-friendly terms with short analogies and step-by-step reasoning.
- Use 2–4 mini examples.
- No "As an AI" disclaimers or LLM language.
- End with a "Quick tips:" section with 2 actionable study tips.
Keep answers within  220 words only .
`.trim();

// Route
router.post("/ask", async (req, res) => {
  try {
    console.log(">>> /api/agent/ask headers:", JSON.stringify(req.headers, null, 2));
    console.log(">>> /api/agent/ask raw body (req.body):", JSON.stringify(req.body, null, 2));

    const { question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question (string) is required" });
    }

    // Local fallback if no key present
    if (!GOOGLE_API_KEY) {
      const fallback = FALLBACK_ANSWERS[question] || FALLBACK_ANSWERS.default;
      console.log("Using fallback answer (no API key).");
      return res.status(200).json({ answer: fallback });
    }

    // Discover model if not cached
    if (!modelListAttempted || !cachedModel) {
      try {
        const models = await listModels();
        modelListAttempted = true;
        const picked = pickPreferredModel(models);
        if (picked) {
          cachedModel = picked;
          const modelObj = (models || []).find((m) => {
            const short = typeof m === "string" ? (m.includes("/") ? m.split("/").pop() : m) : (m?.name?.includes("/") ? m.name.split("/").pop() : m?.name);
            return short === picked || m?.name?.endsWith(`/${picked}`);
          });
          if (modelObj && Array.isArray(modelObj.supportedGenerationMethods)) {
            cachedSupportsGenerateContent = modelObj.supportedGenerationMethods.includes("generateContent");
          } else {
            cachedSupportsGenerateContent = true; // assume modern models support it
          }
          console.log("Model selected:", cachedModel, "supportsGenerateContent=", cachedSupportsGenerateContent);
        } else {
          console.warn("No suitable model found when listing models.");
        }
      } catch (err) {
        console.warn("Failed to list models:", err.response?.status || err.message, err.response?.data || "");
      }
    }

    // Prepare prompt text (single content with parts)
    const combinedText = `${SYSTEM_PROMPT}\n\nQuestion: ${question}\n\nAnswer as StudyAgent following the instructions above.`;

    // Try generateContent with the correct payload
    if (cachedModel && cachedSupportsGenerateContent) {
      const endpoint = buildGenerateContentEndpoint(cachedModel);
      const payload = {
        contents: [
          {
            parts: [{ text: combinedText }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 12000
        }
      };

      try {
        const response = await axios.post(endpoint, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 20000
        });

        const answer = extractAnswer(response.data);
        if (answer) {
          console.log(`🧠 StudyAgent: model=${cachedModel} preview:`, answer.slice(0, 120));
          return res.status(200).json({ answer });
        } else {
          console.warn("generateContent returned 2xx but no recognizable text shape.", Object.keys(response.data || {}).slice(0,10));
        }
      } catch (err) {
        console.warn("generateContent call failed:", err.response?.status || err.message, err.response?.data || "");
        const s = err.response?.status;
        if (s === 401 || s === 403 || s === 404) {
          // invalidate cache so user can fix permissions and we can re-check next request
          cachedModel = null;
          modelListAttempted = false;
          cachedSupportsGenerateContent = false;
        }
      }
    }

    // If we couldn't generate an answer, return fallback
    const fallback = FALLBACK_ANSWERS[question] || FALLBACK_ANSWERS.default;
    return res.status(200).json({
      answer: fallback,
      note: "Returned fallback answer because model generation failed or returned unexpected shape."
    });
  } catch (err) {
    console.error("❌ StudyAgent Unexpected Error:", err);
    return res.status(500).json({ error: "Agent request failed", detail: err.message || err });
  }
});

module.exports = router;
