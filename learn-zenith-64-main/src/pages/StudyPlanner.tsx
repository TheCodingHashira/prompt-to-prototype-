import { useEffect, useState } from "react";
import { PageLayout } from "@/components/Layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { studyPlannerApi } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function StudyPlanner() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    title: "",
    subject: "",
    duration: 60,
    scheduledAt: "",
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await studyPlannerApi.getCalendar();
      setSessions(data.upcomingSessions || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  };

  const handleAddSession = async () => {
    if (!newSession.title || !newSession.subject || !newSession.scheduledAt) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await studyPlannerApi.createSession({
        ...newSession,
        scheduledAt: new Date(newSession.scheduledAt).toISOString(),
      });
      toast.success("Session added!");
      setDialogOpen(false);
      setNewSession({ title: "", subject: "", duration: 60, scheduledAt: "" });
      loadSessions();
    } catch (error) {
      toast.error("Failed to create session");
    }
  };

  const weekDays = [
    { name: "Mon, Oct 13", date: "2025-10-13" },
    { name: "Tue, Oct 14", date: "2025-10-14" },
    { name: "Wed, Oct 15", date: "2025-10-15" },
    { name: "Thu, Oct 16", date: "2025-10-16" },
    { name: "Fri, Oct 17", date: "2025-10-17" },
    { name: "Sat, Oct 18", date: "2025-10-18" },
    { name: "Sun, Oct 19", date: "2025-10-19" },
  ];

  const getSessionsForDay = (date: string) => {
    return sessions.filter((s) => s.scheduledAt?.startsWith(date));
  };

  return (
    <PageLayout onFabClick={() => setDialogOpen(true)}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">Home &gt; Study Planner</div>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Study Planner</h1>
            <Button onClick={() => setDialogOpen(true)}>+ Add Session</Button>
          </div>
        </div>

        {/* Weekly Plan */}
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Weekly Plan</h2>
            <div className="grid grid-cols-7 gap-4">
              {weekDays.map((day) => {
                const daySessions = getSessionsForDay(day.date);
                return (
                  <Card key={day.date} className="bg-muted/30">
                    <CardContent className="p-4">
                      <div className="font-semibold text-sm mb-3">{day.name}</div>
                      {daySessions.length > 0 ? (
                        <div className="space-y-2">
                          {daySessions.map((session) => (
                            <div
                              key={session.id}
                              className="bg-background p-2 rounded text-xs"
                            >
                              <div className="font-medium">{session.title}</div>
                              <div className="text-muted-foreground">
                                {session.duration} min
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">No sessions</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Add Session Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Study Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Session Title</Label>
                <Input
                  id="title"
                  value={newSession.title}
                  onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                  placeholder="React - Hooks"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={newSession.subject}
                  onChange={(e) => setNewSession({ ...newSession, subject: e.target.value })}
                  placeholder="Frontend Development"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={newSession.duration}
                  onChange={(e) =>
                    setNewSession({ ...newSession, duration: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Scheduled Date & Time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={newSession.scheduledAt}
                  onChange={(e) => setNewSession({ ...newSession, scheduledAt: e.target.value })}
                />
              </div>
              <Button onClick={handleAddSession} className="w-full">
                Add Session
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
