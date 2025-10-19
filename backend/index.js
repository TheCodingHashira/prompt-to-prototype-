// index.js
// LearnBoost JSON-file backend (single-file)
// - Stores data in ./data/*.json (no DB)
// - JWT auth for protected routes (except /api/auth/* and /api/mock/*)
// - Detailed request logging to terminal (Authorization header REDACTED)
// - Mock endpoints that serve JSON files and a clickable UI to simulate frontend requests
//
// NOTE: This implementation stores passwords in raw/plain text as requested.
// WARNING: Not for production. For production, hash passwords, secure JWT secret, and use a real DB.

const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
require("dotenv").config(); // ✅ load .env before using GOOGLE_API_KEY or JWT_SECRET

const agentRoutes = require("./routes/agent");
const generatorRoutes = require("./routes/generator");


const roomsRoutes = require("./routes/rooms");




const app = express();
const PORT = process.env.PORT || 3001;
const API_PREFIX = "/api";
const DATA_DIR = path.join(__dirname, "data");
const JWT_SECRET = process.env.LEARNBOOST_JWT_SECRET || "learnboost_dev_secret";
const JWT_EXPIRES_IN = "7d"; // token lifespan

// ✅ Enable CORS and JSON parsing BEFORE any routes
app.use(cors());
app.use(express.json({ limit: "10mb" }));


// near other requires
const knowledgeTestsRoutes = require("./routes/knowledgeTests");
// after body parser / before auth middleware or after existing mounts — any order similar to other routes:
app.use("/api/knowledge-tests", knowledgeTestsRoutes);









// ✅ Mount routes after body parser
app.use("/api/agent", agentRoutes);
app.use("/api/generator", generatorRoutes);
app.use("/api/group-learning", roomsRoutes);

const ocrRoutes = require("./routes/ocr");
// ...
app.use("/api/ocr", ocrRoutes);



// --------------------- Helpers ---------------------
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Could not create data directory:", err.message);
    throw err;
  }
}


function nowIso() {
  return new Date().toISOString();
}

function shortId(prefix = "") {
  // small readable ids: prefix_xxxxx
  return `${prefix}${uuidv4().split("-")[0]}`;
}

function redactAuth(headers = {}) {
  const copy = { ...headers };
  if (copy.authorization) copy.authorization = "[REDACTED]";
  return copy;
}

async function readJsonFile(filename) {
  const p = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(p, "utf8");
    if (!raw || !raw.trim()) {
      // try to return empty object
      return {};
    }
    return JSON.parse(raw);
  } catch (err) {
    // bubble up
    throw err;
  }
}

async function writeJsonFile(filename, data) {
  const p = path.join(DATA_DIR, filename);
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(p, content, "utf8");
}

// Get list of JSON files present in data directory
async function listJsonFiles() {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter((f) => f.endsWith(".json"));
  } catch (err) {
    return [];
  }
}

// --------------------- Logging middleware ---------------------
// Logs every request with timestamp, method, url, safe headers, query, and body (if present)
// Authorization header is redacted
app.use(async (req, res, next) => {
  const ts = nowIso();
  // ensure body parsed before logging body (express.json already used)
  const safeHeaders = redactAuth(req.headers);
  console.log("==================================================");
  console.log(`${ts}  --> ${req.method} ${req.originalUrl}`);
  console.log("Headers:", JSON.stringify(safeHeaders, null, 2));
  if (Object.keys(req.query || {}).length) {
    console.log("Query:", JSON.stringify(req.query, null, 2));
  }
  // Print body for non-GET or if GET with body (rare)
  if (req.method !== "GET" && req.body && Object.keys(req.body).length) {
    console.log("Body:", JSON.stringify(req.body, null, 2));
  }
  console.log("==================================================");
  next();
});

// --------------------- Auth middleware ---------------------
function authMiddleware(req, res, next) {

  if (
    req.path.startsWith(API_PREFIX + "/auth/") ||
    req.path.startsWith(API_PREFIX + "/mock") ||
    req.path.startsWith(API_PREFIX + "/agent") ||
    req.path.startsWith(API_PREFIX + "/generator") ||
    req.path.startsWith(API_PREFIX + "/group-learning")
  ) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // contains id, email, username (as we sign)
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
app.use(authMiddleware);

// --------------------- Ensure data directory and defaults ---------------------
(async () => {
  await ensureDataDir();

  // Create some default files if they don't exist yet
  const defaults = {
    "users.json": { users: [] },
    "flashcards.json": { cards: [], totalCards: 0, dueForReview: 0 },
    "dashboard.json": {
      weeklyProgress: 0,
      streakDays: 0,
      totalStudyTime: 0,
      recentAchievements: [],
      motivationalQuote: { text: "", author: "" }
    },
    "study_sessions.json": { currentWeek: {}, upcomingSessions: [] },
    "knowledge_gaps.json": { gaps: [], suggestedTopics: [] },
    "group_sessions.json": { upcomingSessions: [], mySessions: [] },
    "notifications.json": { notifications: [] },
    "ai_insights.json": { message: "Welcome to LearnBoost", insights: [] }
  };

  for (const [fname, def] of Object.entries(defaults)) {
    const p = path.join(DATA_DIR, fname);
    try {
      await fs.access(p);
      // file exists -> skip
    } catch {
      // file missing -> create with default
      try {
        await writeJsonFile(fname, def);
        console.log(`Created default ${fname}`);
      } catch (err) {
        console.error("Failed to write default file:", fname, err.message);
      }
    }
  }
})().catch((err) => {
  console.error("Failed to initialize data directory:", err);
  process.exit(1);
});

// --------------------- AUTH Routes ---------------------
app.post(API_PREFIX + "/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email, password required" });
    }

    const usersData = await readJsonFile("users.json").catch(() => ({ users: [] }));
    const existing = (usersData.users || []).find((u) => u.email === email);
    if (existing) {
      return res.status(409).json({ error: "User already exists with that email" });
    }

    // store raw password as requested (insecure!)
    const id = shortId("user_");
    const newUser = {
      id,
      username,
      email,
      password, // RAW password stored
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
      streakDays: 0,
      totalStudyTime: 0,
      joinedAt: nowIso()
    };

    usersData.users = usersData.users || [];
    usersData.users.push(newUser);
    await writeJsonFile("users.json", usersData);

    const token = jwt.sign({ id: newUser.id, email: newUser.email, username: newUser.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    return res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      token
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post(API_PREFIX + "/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    const usersData = await readJsonFile("users.json").catch(() => ({ users: [] }));
    const user = (usersData.users || []).find((u) => u.email === email && u.password === password);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    return res.status(200).json({
      id: user.id,
      username: user.username,
      email: user.email,
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- PROFILE ---------------------
app.get(API_PREFIX + "/profile", async (req, res) => {
  try {
    const usersData = await readJsonFile("users.json").catch(() => ({ users: [] }));
    const user = (usersData.users || []).find((u) => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const profile = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      streakDays: user.streakDays ?? 0,
      totalStudyTime: user.totalStudyTime ?? 0,
      joinedAt: user.joinedAt
    };
    return res.json(profile);
  } catch (err) {
    console.error("Profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- DASHBOARD ---------------------
app.get(API_PREFIX + "/dashboard/overview", async (req, res) => {
  try {
    const data = await readJsonFile("dashboard.json").catch(() => ({}));
    return res.json(data);
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- FLASHCARDS ---------------------
app.get(API_PREFIX + "/flashcards", async (req, res) => {
  try {
    const data = await readJsonFile("flashcards.json").catch(() => ({ cards: [], totalCards: 0, dueForReview: 0 }));
    return res.json(data);
  } catch (err) {
    console.error("Get flashcards error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post(API_PREFIX + "/flashcards", async (req, res) => {
  try {
    const { question, answer, tags = [], difficulty = "easy" } = req.body || {};
    if (!question || !answer) return res.status(400).json({ error: "question and answer required" });

    const data = await readJsonFile("flashcards.json").catch(() => ({ cards: [], totalCards: 0, dueForReview: 0 }));
    data.cards = data.cards || [];

    const id = shortId("card_");
    const createdAt = nowIso();
    // default nextReviewDate: 6 days from now, midnight UTC
    const nextReviewDate = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString().split("T")[0] + "T00:00:00Z";

    const card = {
      id,
      question,
      answer,
      tags,
      difficulty,
      lastReviewed: null,
      nextReviewDate,
      createdAt
    };

    data.cards.push(card);
    data.totalCards = data.cards.length;
    data.dueForReview = data.cards.filter((c) => c.nextReviewDate && new Date(c.nextReviewDate) <= new Date()).length;

    await writeJsonFile("flashcards.json", data);
    return res.status(201).json(card);
  } catch (err) {
    console.error("Create flashcard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put(API_PREFIX + "/flashcards/:id/review", async (req, res) => {
  try {
    const { id } = req.params;
    const { remembered, difficulty } = req.body || {};

    const data = await readJsonFile("flashcards.json").catch(() => ({ cards: [], totalCards: 0, dueForReview: 0 }));
    data.cards = data.cards || [];
    const card = data.cards.find((c) => c.id === id);
    if (!card) return res.status(404).json({ error: "Card not found" });

    // Simple spaced repetition (naive)
    const intervalDays = remembered ? 10 : 2;
    const nextReview = new Date(Date.now() + intervalDays * 24 * 3600 * 1000);

    card.lastReviewed = nowIso();
    card.nextReviewDate = nextReview.toISOString();
    if (difficulty) card.difficulty = difficulty;

    data.dueForReview = data.cards.filter((c) => c.nextReviewDate && new Date(c.nextReviewDate) <= new Date()).length;
    await writeJsonFile("flashcards.json", data);

    return res.json({
      success: true,
      nextReviewDate: card.nextReviewDate,
      intervalDays
    });
  } catch (err) {
    console.error("Review flashcard error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- STUDY PLANNER ---------------------
app.get(API_PREFIX + "/study-planner/calendar", async (req, res) => {
  try {
    const data = await readJsonFile("study_sessions.json").catch(() => ({ currentWeek: {}, upcomingSessions: [] }));
    return res.json(data);
  } catch (err) {
    console.error("Get calendar error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post(API_PREFIX + "/study-planner/sessions", async (req, res) => {
  try {
    const { title, subject, duration, scheduledAt, description } = req.body || {};
    if (!title || !subject || !duration || !scheduledAt) return res.status(400).json({ error: "missing required fields" });

    const data = await readJsonFile("study_sessions.json").catch(() => ({ currentWeek: {}, upcomingSessions: [] }));
    data.upcomingSessions = data.upcomingSessions || [];

    const id = shortId("sess_");
    const createdAt = nowIso();
    const session = {
      id,
      title,
      subject,
      duration,
      scheduledAt,
      description: description || "",
      isCompleted: false,
      createdAt
    };

    data.upcomingSessions.push(session);
    await writeJsonFile("study_sessions.json", data);
    return res.status(201).json(session);
  } catch (err) {
    console.error("Create session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- KNOWLEDGE GAPS ---------------------
app.get(API_PREFIX + "/knowledge-gaps", async (req, res) => {
  try {
    const data = await readJsonFile("knowledge_gaps.json").catch(() => ({ gaps: [], suggestedTopics: [] }));
    return res.json(data);
  } catch (err) {
    console.error("Knowledge gaps error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- GROUP LEARNING ---------------------
app.get(API_PREFIX + "/group-learning/sessions", async (req, res) => {
  try {
    const data = await readJsonFile("group_sessions.json").catch(() => ({ upcomingSessions: [], mySessions: [] }));
    return res.json(data);
  } catch (err) {
    console.error("Get group sessions error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post(API_PREFIX + "/group-learning/sessions", async (req, res) => {
  try {
    const { title, topic, description, scheduledAt, duration, maxParticipants } = req.body || {};
    if (!title || !topic || !scheduledAt) return res.status(400).json({ error: "missing required fields" });

    const data = await readJsonFile("group_sessions.json").catch(() => ({ upcomingSessions: [], mySessions: [] }));
    data.upcomingSessions = data.upcomingSessions || [];

    const usersData = await readJsonFile("users.json").catch(() => ({ users: [] }));
    const hostUser = (usersData.users || []).find((u) => u.id === req.user.id) || {
      id: req.user.id,
      username: req.user.username,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.user.username)}`
    };

    const id = shortId("group_");
    const createdAt = nowIso();
    const group = {
      id,
      title,
      topic,
      description: description || "",
      host: { id: hostUser.id, username: hostUser.username, avatarUrl: hostUser.avatarUrl },
      scheduledAt,
      duration: duration || 60,
      maxParticipants: maxParticipants || 8,
      participants: [{ id: hostUser.id, username: hostUser.username, avatarUrl: hostUser.avatarUrl }],
      createdAt
    };

    data.upcomingSessions.push(group);
    await writeJsonFile("group_sessions.json", data);
    return res.status(201).json(group);
  } catch (err) {
    console.error("Create group session error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- AI COACH INSIGHTS ---------------------
app.get(API_PREFIX + "/ai-coach/insights", async (req, res) => {
  try {
    const data = await readJsonFile("ai_insights.json").catch(() => ({ message: "", insights: [] }));
    return res.json(data);
  } catch (err) {
    console.error("AI coach error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- NOTIFICATIONS ---------------------
app.get(API_PREFIX + "/notifications", async (req, res) => {
  try {
    const data = await readJsonFile("notifications.json").catch(() => ({ notifications: [] }));
    return res.json(data);
  } catch (err) {
    console.error("Notifications error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// --------------------- MOCK UI & dynamic mock file endpoints ---------------------
app.get(API_PREFIX + "/mock", async (req, res) => {
  // Show clickable links for all .json files in data dir
  const files = await listJsonFiles();
  const links = files
    .map((f) => `<li><a href="${API_PREFIX}/mock/${encodeURIComponent(f)}" target="_blank">${f}</a></li>`)
    .join("\n");
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>LearnBoost Mock Endpoints</title></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial;">
  <h1>Mock JSON endpoints</h1>
  <p>Click any file to fetch its JSON (simulates frontend GET):</p>
  <ul>
    ${links}
  </ul>
  <p>Programmatic list (JSON): <a href="${API_PREFIX}/mock-files">${API_PREFIX}/mock-files</a></p>
  <hr/>
  <p>To simulate a POST (append), use <code>POST ${API_PREFIX}/mock-append/:filename</code> with a JSON body.</p>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.status(200).send(html);
});

app.get(API_PREFIX + "/mock-files", async (req, res) => {
  const files = await listJsonFiles();
  return res.json({ files: files.map((f) => ({ name: f, url: `${API_PREFIX}/mock/${f}` })) });
});

app.get(API_PREFIX + "/mock/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    // Basic security: only allow reading files that exist in data dir and end with .json
    const files = await listJsonFiles();
    if (!files.includes(filename)) {
      return res.status(404).json({ error: "file not available via mock endpoint" });
    }
    const data = await readJsonFile(filename);
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(data);
  } catch (err) {
    console.error("Mock read error:", err);
    return res.status(500).json({ error: "Could not read file", detail: err.message });
  }
});

// Optional: append an object to an array inside a JSON file (simulate POST/save).
// This tries to detect if file content is an object with an array property (like { cards: [] }) and append into first array found.
// If file is an array itself, append into it.
app.post(API_PREFIX + "/mock-append/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const files = await listJsonFiles();
    if (!files.includes(filename)) return res.status(404).json({ error: "file not available" });

    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) return res.status(400).json({ error: "body required" });

    const data = await readJsonFile(filename);

    if (Array.isArray(data)) {
      // append to array
      data.push(payload);
      await writeJsonFile(filename, data);
      return res.status(201).json({ success: true, appendedTo: "array", filename });
    }

    // find first array property
    const arrKey = Object.keys(data).find((k) => Array.isArray(data[k]));
    if (arrKey) {
      // If payload doesn't have id, try to add an id with prefix
      const item = { ...payload };
      if (!item.id) {
        // choose prefix based on key name
        const prefix = arrKey.includes("user") || arrKey.includes("users") ? "user_" : arrKey.includes("card") ? "card_" : "";
        item.id = shortId(prefix);
      }
      data[arrKey].push(item);
      // update counters if present
      if (data.totalCards !== undefined) data.totalCards = (data[arrKey] || []).length;
      await writeJsonFile(filename, data);
      return res.status(201).json({ success: true, appendedTo: arrKey, item });
    }

    // no array found
    return res.status(400).json({ error: "file does not contain an appendable array" });
  } catch (err) {
    console.error("Mock append error:", err);
    return res.status(500).json({ error: "Could not append to file", detail: err.message });
  }
});

// --------------------- Simple health / root ---------------------
app.get("/", (req, res) => {
  res.send(`<html><body>
    <h2>LearnBoost JSON backend</h2>
    <p>Base API: <code>${API_PREFIX}</code></p>
    <ul>
      <li><a href="${API_PREFIX}/mock">${API_PREFIX}/mock</a> — clickable mock UI</li>
      <li><a href="${API_PREFIX}/mock-files">${API_PREFIX}/mock-files</a> — JSON list of files</li>
    </ul>
  </body></html>`);
});

// --------------------- 404 fallback ---------------------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// --------------------- Start server ---------------------
app.listen(PORT, () => {
  console.log(`LearnBoost JSON backend running at http://localhost:${PORT}${API_PREFIX}`);
  console.log(`Open http://localhost:${PORT}${API_PREFIX}/mock to click links to your JSON files`);
});
