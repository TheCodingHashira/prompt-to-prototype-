// routes/ocr.js
// Accepts either JSON { imageBase64: "data:..."} or multipart file upload (field "image")
// Tries Gemini (Generative API) to extract text, falls back to tesseract if configured.

const express = require("express");
const axios = require("axios");
const router = express.Router();
const fs = require("fs");
const path = require("path");

// Optional: multer for multipart uploads
const multer = require("multer");
const upload = multer(); // memory storage

// Optional local OCR fallback
let useTesseract = false;
let tesseract;
try {
  tesseract = require("tesseract.js");
  useTesseract = true;
} catch (e) {
  // tesseract.js not installed — ok, Gemini required
  useTesseract = false;
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
const PREFERRED_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash"; // adjust if needed

function stripDataUrlPrefix(dataUrl) {
  if (!dataUrl) return dataUrl;
  const idx = dataUrl.indexOf("base64,");
  if (idx !== -1) return dataUrl.slice(idx + 7);
  return dataUrl;
}

// Helper: call Gemini generateContent for image understanding
async function callGeminiExtractText(base64Image) {
  if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not configured");

  // Construct endpoint — using generateContent
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(PREFERRED_MODEL)}:generateContent?key=${GOOGLE_API_KEY}`;

  // Payload: include an "image" content part (this shape may need adapting with the API version).
  // Many Generative API examples allow contents: [{ image: { imageBytes: "..." }, parts: ... }]
  // If your deployed API expects a different shape, adapt this payload accordingly.
  const payload = {
    // contents: array of inputs with image + optional text instruction
    contents: [
      {
        image: {
          imageBytes: base64Image
        },
        // also include an instruction part to guide the model to "extract text only"
        instructions: {
          // some endpoints support a text/instruction block. If not, the 'parts' below will help.
          // This is a conservative approach; API shapes vary so you may need to adapt.
          text: "Extract and return the text content from the image. Return only plain text — no extra commentary."
        },
        // fallback textual prompt
        parts: [{ text: "Please extract all readable text from the image and return as plain text." }]
      }
    ],
    generationConfig: {
      // reduce verbosity and hallucination
      temperature: 0.0,
      maxOutputTokens: 800
    }
  };

  const resp = await axios.post(endpoint, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 30000,
  });

  // Extract text robustly from possible response shapes
  const data = resp.data || {};
  // common shapes:
  // - data.output[0].content[0].text
  // - data.candidates[0].content[0].text
  // - data.candidates[0].output or data.candidates[0].text
  const candidateText =
    data?.output?.[0]?.content?.[0]?.text ||
    data?.candidates?.[0]?.content?.[0]?.text ||
    data?.candidates?.[0]?.content?.text ||
    data?.candidates?.[0]?.text ||
    data?.output?.[0]?.content?.text ||
    null;

  if (candidateText && typeof candidateText === "string") {
    // Trim and return
    return candidateText.trim();
  }

  // As a fallback, stringify a portion — but prefer to treat as failure so we can try tesseract fallback
  throw new Error("Gemini returned no text in expected response shape");
}

// Helper: tesseract fallback (if installed)
async function tesseractExtract(base64Image) {
  if (!useTesseract) throw new Error("Local OCR not available (tesseract.js not installed)");
  // Write to temp file
  const tmpPath = path.join(__dirname, "..", "tmp_ocr_" + Date.now() + ".png");
  const buffer = Buffer.from(base64Image, "base64");
  fs.writeFileSync(tmpPath, buffer);
  try {
    const { data: { text } } = await tesseract.recognize(tmpPath);
    return text || "";
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  }
}

// Route: POST /api/ocr/extract (accepts JSON { imageBase64 } or form-data file image)
router.post("/extract", upload.single("image"), async (req, res) => {
  try {
    // Accept either JSON payload or multipart file
    let base64 = null;

    if (req.file && req.file.buffer) {
      // multer provided file buffer
      base64 = req.file.buffer.toString("base64");
    } else if (req.body && req.body.imageBase64) {
      base64 = stripDataUrlPrefix(req.body.imageBase64);
    } else {
      return res.status(400).json({ error: "imageBase64 required (body) or file field 'image' in form-data" });
    }

    // Prefer Gemini if key present
    if (GOOGLE_API_KEY) {
      try {
        const text = await callGeminiExtractText(base64);
        return res.json({ text });
      } catch (err) {
        console.warn("Gemini extract failed:", err.message || err.response?.data || err);
        // fall through to tesseract fallback if available
      }
    }

    // Fallback to tesseract.js if configured
    if (useTesseract) {
      try {
        const ttext = await tesseractExtract(base64);
        return res.json({ text: (ttext || "").trim() });
      } catch (err) {
        console.error("Tesseract fallback failed:", err);
        return res.status(500).json({ error: "OCR fallback failed" });
      }
    }

    // If we reach here, we couldn't process
    return res.status(501).json({ error: "OCR not available (Gemini failed or not configured, and local OCR not installed)" });
  } catch (err) {
    console.error("OCR route error:", err?.response?.data || err.message || err);
    return res.status(500).json({ error: "OCR processing failed", detail: err.message || err });
  }
});

module.exports = router;
