// routes/rooms.js
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();

const DATA_DIR = path.join(__dirname, "..", "data");
const ROOMS_FILE = path.join(DATA_DIR, "rooms.json");

// Ensure data dir exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

// Read rooms.json safely; create if missing
async function readRoomsFile() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(ROOMS_FILE, "utf8");
    if (!raw || !raw.trim()) return { rooms: [] };
    const parsed = JSON.parse(raw);
    // Ensure shape
    if (!parsed || typeof parsed !== "object") return { rooms: [] };
    parsed.rooms = Array.isArray(parsed.rooms) ? parsed.rooms : [];
    return parsed;
  } catch (err) {
    // If file missing, create defaults
    const def = { rooms: [] };
    try {
      await fs.writeFile(ROOMS_FILE, JSON.stringify(def, null, 2), "utf8");
    } catch (e) {
      console.error("Failed to create rooms file:", e);
    }
    return def;
  }
}

async function writeRoomsFile(data) {
  await ensureDataDir();
  // ensure object shape
  const safe = { rooms: Array.isArray(data.rooms) ? data.rooms : [] };
  await fs.writeFile(ROOMS_FILE, JSON.stringify(safe, null, 2), "utf8");
}

function findRoom(data, roomId) {
  return (data.rooms || []).find((r) => String(r.id) === String(roomId));
}

function makeId(prefix = "group_") {
  return `${prefix}${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;
}

// --- Routes ---

// GET /api/group-learning/rooms
// return array of rooms
router.get("/rooms", async (req, res) => {
  try {
    const data = await readRoomsFile();
    return res.json(data.rooms || []);
  } catch (err) {
    console.error("Get rooms error:", err);
    return res.status(500).json({ error: "Could not read rooms" });
  }
});

// POST /api/group-learning/rooms
// create room and write into rooms.json
router.post("/rooms", async (req, res) => {
  try {
    const { title, topic, scheduledAt, duration = 60, maxParticipants = 8 } = req.body || {};
    if (!title || !topic) return res.status(400).json({ error: "title and topic required" });

    const data = await readRoomsFile();
    const id = makeId();
    const createdAt = new Date().toISOString();

    const hostUser = {
      id: (req.user && req.user.id) || "system",
      username: (req.user && req.user.username) || "host",
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent((req.user && req.user.username) || "host")}`
    };

    const newRoom = {
      id,
      title,
      topic,
      description: "",
      host: hostUser,
      scheduledAt: scheduledAt || createdAt,
      duration,
      maxParticipants,
      participants: [],
      cards: [],
      createdAt
    };

    data.rooms = data.rooms || [];
    data.rooms.push(newRoom);
    await writeRoomsFile(data);
    return res.status(201).json(newRoom);
  } catch (err) {
    console.error("Create room error:", err);
    return res.status(500).json({ error: "Could not create room" });
  }
});

// GET /api/group-learning/:roomId
// return single room (including cards)
router.get("/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const data = await readRoomsFile();
    const room = findRoom(data, roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    return res.json(room);
  } catch (err) {
    console.error("Get room error:", err);
    return res.status(500).json({ error: "Could not read room" });
  }
});

// POST /api/group-learning/:roomId/join
// add participant object to room.participants
router.post("/:roomId/join", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { id: bodyId, username: bodyUsername, avatarUrl: bodyAvatar, guestId } = req.body || {};
    const userId = (req.user && req.user.id) || bodyId || guestId || null;
    const username = (req.user && req.user.username) || bodyUsername || `guest_${(userId || "").slice(-6)}` || "guest";
    const avatarUrl = bodyAvatar || (req.user && req.user.avatarUrl) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

    if (!userId) return res.status(400).json({ error: "user id required to join (guestId ok)" });

    const data = await readRoomsFile();
    const room = findRoom(data, roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    room.participants = room.participants || [];
    const already = room.participants.find((p) => String(p.id) === String(userId));
    if (!already) {
      room.participants.push({ id: userId, username, avatarUrl, joinedAt: new Date().toISOString() });
      await writeRoomsFile(data);
    }
    return res.json({ success: true, room });
  } catch (err) {
    console.error("Join room error:", err);
    return res.status(500).json({ error: "Could not join room" });
  }
});

// POST /api/group-learning/:roomId/flashcards/add
// Add a card to room.cards (stored inside rooms.json)
router.post("/:roomId/flashcards/add", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { question, answer, tags = [], difficulty = "easy" } = req.body || {};
    if (!question || !answer) return res.status(400).json({ error: "question and answer required" });

    const data = await readRoomsFile();
    const room = findRoom(data, roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    room.cards = room.cards || [];
    const cardId = `card_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
    const card = {
      id: cardId,
      question,
      answer,
      tags,
      difficulty,
      createdAt: new Date().toISOString(),
      lastReviewed: null,
      nextReviewDate: null
    };

    room.cards.push(card);
    await writeRoomsFile(data);

    return res.status(201).json({ success: true, card });
  } catch (err) {
    console.error("Add room card error:", err);
    return res.status(500).json({ error: "Could not add card to room" });
  }
});

// Optional: get all cards for a room (same as GET /:roomId but kept for explicit endpoint)
router.get("/:roomId/flashcards", async (req, res) => {
  try {
    const { roomId } = req.params;
    const data = await readRoomsFile();
    const room = findRoom(data, roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    return res.json({ cards: room.cards || [] });
  } catch (err) {
    console.error("Get room cards error:", err);
    return res.status(500).json({ error: "Could not read room cards" });
  }
});

module.exports = router;
