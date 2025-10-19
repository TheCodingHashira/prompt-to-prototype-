// src/pages/GroupLearning.tsx
import { useEffect, useState } from "react";
import { PageLayout } from "@/components/Layout/PageLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Share2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * GroupLearning page
 * - Single rooms.json backend
 * - Create / Join / Enter
 * - Enter opens modal overlay that shows flashcard deck (flip/remember/review)
 * - Add Question button in modal shows add form (same structure as flashcard form)
 */

// Ensure guest id
function ensureGuestId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem("learnboost_guest_id");
  if (!id) {
    id = `guest_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem("learnboost_guest_id", id);
  }
  return id;
}
const guestId = ensureGuestId();

function getParticipantsCount(participants: any) {
  if (Array.isArray(participants)) return participants.length;
  if (typeof participants === "number") return participants;
  return Number(participants) || 0;
}

export default function GroupLearning() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ title: "", subject: "" });

  // modal overlay state for current room
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(localStorage.getItem("learnboost_current_room") || null);
  const [currentRoomTitle, setCurrentRoomTitle] = useState<string | null>(null);

  // deck state for modal
  const [deck, setDeck] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // add-card form inside modal
  const [showAddForm, setShowAddForm] = useState(false);
  const [cardQuestion, setCardQuestion] = useState("");
  const [cardAnswer, setCardAnswer] = useState("");
  const [addingCard, setAddingCard] = useState(false);

  // joined map local
  const [joinedMap, setJoinedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    // if persisted currentRoomId exists, open modal and load room
    if (currentRoomId) {
      openRoomModal(currentRoomId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- backend calls -----
  async function loadRooms() {
    try {
      const resp = await fetch("/api/group-learning/rooms");
      if (!resp.ok) throw new Error("Failed to load rooms");
      const data = await resp.json();
      setRooms(data || []);

      // compute joinedMap from participants (guestId)
      const jm: Record<string, boolean> = {};
      (data || []).forEach((r: any) => {
        if (Array.isArray(r.participants) && r.participants.some((p: any) => p.id === guestId)) {
          jm[r.id] = true;
        }
      });
      setJoinedMap(jm);
    } catch (err) {
      console.error("loadRooms error", err);
      toast.error("Failed to load rooms");
    }
  }

  async function createRoom() {
    if (!newRoom.title.trim() || !newRoom.subject.trim()) {
      toast.error("Please enter title and subject");
      return;
    }
    setCreatingRoom(true);
    try {
      const resp = await fetch("/api/group-learning/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newRoom.title, topic: newRoom.subject }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create room");
      }
      const created = await resp.json();
      toast.success("Room created");
      setNewRoom({ title: "", subject: "" });
      await loadRooms();
    } catch (err) {
      console.error("createRoom error", err);
      toast.error("Could not create room");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function joinRoom(roomId: string) {
    try {
      const resp = await fetch(`/api/group-learning/${encodeURIComponent(roomId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId, username: `guest_${guestId?.slice(-6)}` }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to join room");
      }
      const payload = await resp.json();
      setJoinedMap((m) => ({ ...m, [roomId]: true }));
      toast.success("Joined room");
      // auto open modal into deck
      openRoomModal(roomId);
      await loadRooms();
    } catch (err) {
      console.error("joinRoom error", err);
      toast.error("Failed to join room");
    }
  }

  async function openRoomModal(roomId: string) {
    try {
      // ensure modal opens in deck view
      setShowAddForm(false);
      const resp = await fetch(`/api/group-learning/${encodeURIComponent(roomId)}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch room");
      }
      const room = await resp.json();
      setDeck(room.cards || []);
      setCurrentIndex(0);
      setIsFlipped(false);
      setCurrentRoomId(room.id);
      setCurrentRoomTitle(room.title || room.topic || "Room");
      setDialogOpen(true);
      // persist current room so refresh returns to it
      localStorage.setItem("learnboost_current_room", room.id);
    } catch (err) {
      console.error("openRoomModal err", err);
      toast.error("Could not open room");
    }
  }

  async function addCardToCurrentRoom() {
    if (!currentRoomId) return toast.error("No room open");
    const q = cardQuestion.trim();
    const a = cardAnswer.trim();
    if (!q || !a) return toast.error("Please fill question & answer");
    setAddingCard(true);
    try {
      const resp = await fetch(`/api/group-learning/${encodeURIComponent(currentRoomId)}/flashcards/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, answer: a }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add card");
      }
      const payload = await resp.json();
      // robust update: prefer returned card, else re-fetch room
      if (payload.card) {
        setDeck((d) => [...d, payload.card]);
      } else if (payload.room && Array.isArray(payload.room.cards)) {
        setDeck(payload.room.cards);
      } else {
        // fallback: load room again
        await openRoomModal(currentRoomId);
      }
      setCardQuestion("");
      setCardAnswer("");
      setShowAddForm(false);
      toast.success("Flashcard added");
      await loadRooms();
    } catch (err) {
      console.error("addCardToCurrentRoom error", err);
      toast.error("Failed to add flashcard");
    } finally {
      setAddingCard(false);
    }
  }

  function leaveRoom() {
    setDialogOpen(false);
    setCurrentRoomId(null);
    setCurrentRoomTitle(null);
    setDeck([]);
    setIsFlipped(false);
    setCurrentIndex(0);
    localStorage.removeItem("learnboost_current_room");
  }

  // Deck controls
  function flipCard() {
    setIsFlipped((s) => !s);
  }
  function nextCard(remembered = true) {
    setIsFlipped(false);
    if (deck.length === 0) return;
    const next = currentIndex < deck.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(next);
  }

  // UI
  return (
    <PageLayout onFabClick={() => setDialogOpen(true)}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">Home &gt; Group Learning</div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Group Learning</h1>
              <p className="text-muted-foreground">Collaborate with peers and review room flashcards</p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>+ Create Room</Button>
          </div>
        </div>

        {/* Rooms grid */}
        <div className="grid grid-cols-3 gap-6">
          {rooms.map((room) => {
            const participantsCount = getParticipantsCount(room.participants);
            const max = room.maxParticipants ?? 8;
            const isJoined = !!joinedMap[room.id];

            return (
              <Card key={room.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{room.title}</CardTitle>
                  <CardDescription>{room.topic}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{participantsCount}/{max} members</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Owner:</span>
                    <Avatar className="w-5 h-5">
                      <AvatarFallback>{(room.host?.username || "H").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span>{room.host?.username || "Host"}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    {!isJoined ? (
                      <Button onClick={() => joinRoom(room.id)} className="flex-1">Join Room</Button>
                    ) : (
                      <Button onClick={() => openRoomModal(room.id)} className="flex-1">Enter</Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => {
                      const url = `${window.location.origin}/group-learning/${room.id}`;
                      navigator.clipboard?.writeText(url);
                      toast.success("Link copied to clipboard");
                    }}>
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Create Room dialog */}
      <Dialog open={dialogOpen && !currentRoomId} onOpenChange={(val) => { if (!val) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a New Study Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Room Name</Label>
              <Input value={newRoom.title} onChange={(e) => setNewRoom({ ...newRoom, title: e.target.value })} />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={newRoom.subject} onChange={(e) => setNewRoom({ ...newRoom, subject: e.target.value })} />
            </div>

            <div className="flex gap-2">
              <Button onClick={createRoom} disabled={creatingRoom}>{creatingRoom ? "Creating..." : "Create Room"}</Button>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Room modal overlay (deck + add form) */}
      <Dialog open={!!currentRoomId && dialogOpen} onOpenChange={(val) => { if (!val) leaveRoom(); }}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader className="flex items-center justify-between">
            <DialogTitle>{currentRoomTitle || "Room Flashcards"}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" onClick={() => setShowAddForm((s) => !s)}>
                <Plus className="w-4 h-4" /> {showAddForm ? "Close Form" : "Add Question"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => leaveRoom()}>Leave Room</Button>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {!showAddForm ? (
              <div>
                {deck.length > 0 ? (
                  <>
                    <div className="h-96 bg-card p-6 rounded-lg flex items-center justify-center">
                      {!isFlipped ? (
                        <div className="text-2xl font-medium text-center">{deck[currentIndex].question}</div>
                      ) : (
                        <div className="text-2xl font-medium text-center">{deck[currentIndex].answer}</div>
                      )}
                    </div>

                    <div className="flex justify-center gap-4 mt-4">
                      <Button onClick={flipCard}>Flip</Button>
                      <Button variant="outline" onClick={() => nextCard(true)} disabled={!isFlipped}>Remembered</Button>
                      <Button variant="outline" onClick={() => nextCard(false)} disabled={!isFlipped}>Review Again</Button>
                    </div>

                    <div className="mt-4">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${((currentIndex + 1) / Math.max(1, deck.length)) * 100}%` }} />
                      </div>
                      <div className="text-sm text-center mt-2">
                        {Math.round(((currentIndex + 1) / Math.max(1, deck.length)) * 100)}% completed
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">No flashcards yet in this room. Click "Add Question" to create one.</div>
                )}
              </div>
            ) : (
              <div className="border p-4 rounded space-y-3">
                <div>
                  <Label>Question</Label>
                  <Input value={cardQuestion} onChange={(e) => setCardQuestion(e.target.value)} />
                </div>
                <div>
                  <Label>Answer</Label>
                  <Input value={cardAnswer} onChange={(e) => setCardAnswer(e.target.value)} />
                </div>

                <div className="flex gap-2">
                  <Button onClick={addCardToCurrentRoom} disabled={addingCard}>{addingCard ? "Adding..." : "Create Question"}</Button>
                  <Button variant="ghost" onClick={() => { setCardQuestion(""); setCardAnswer(""); setShowAddForm(false); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
