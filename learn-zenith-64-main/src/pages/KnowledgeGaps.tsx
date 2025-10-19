// src/pages/KnowledgeGaps.tsx
import { useEffect, useState } from "react";
import { PageLayout } from "@/components/Layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Question = { id: string; prompt: string; choices: string[]; correctIndex?: number };
type TestMeta = { id: string; name: string; createdAt: string; questionCount: number; };

export default function KnowledgeGaps() {
  const [tests, setTests] = useState<TestMeta[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [gapOpen, setGapOpen] = useState(false);

  // create form
  const [testName, setTestName] = useState("");
  const [testText, setTestText] = useState("");
  const [creating, setCreating] = useState(false);

  // image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // runner / current test
  const [currentTest, setCurrentTest] = useState<null | any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // knowledge gap justifications
  const [justifications, setJustifications] = useState<{ qId: string; explanation: string }[]>([]);
  const [justifying, setJustifying] = useState(false);

  useEffect(() => { loadTests(); }, []);

  async function loadTests() {
    try {
      const r = await fetch("/api/knowledge-tests");
      if (!r.ok) throw new Error("Failed to load tests");
      const data = await r.json();
      setTests(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Could not load tests");
    }
  }

  // Create test: sends passage to server which asks Gemini to generate MCQs and stores test
  async function createTest() {
    if (!testName.trim() || !testText.trim()) {
      toast.error("Please enter name and paste the text.");
      return;
    }
    setCreating(true);
    try {
      const resp = await fetch("/api/knowledge-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: testName, text: testText, requested: 6 }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || "Failed");
      }
      const created = await resp.json();
      toast.success("Test created");
      setCreateOpen(false);
      setTestName("");
      setTestText("");
      await loadTests();
      openRunner(created.id);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create test");
    } finally {
      setCreating(false);
    }
  }

  async function openRunner(testId: string) {
    try {
      const r = await fetch(`/api/knowledge-tests/${encodeURIComponent(testId)}`);
      if (!r.ok) throw new Error("Failed to fetch test");
      const t = await r.json();
      setCurrentTest(t);
      setAnswers({});
      setLastResult(t.results && t.results.length ? t.results[t.results.length - 1] : null);
      setJustifications([]);
      setRunnerOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not open test");
    }
  }

  async function openGap(testId: string) {
    try {
      const r = await fetch(`/api/knowledge-tests/${encodeURIComponent(testId)}`);
      if (!r.ok) throw new Error("Failed to fetch test");
      const t = await r.json();
      setCurrentTest(t);
      setLastResult(t.results && t.results.length ? t.results[t.results.length - 1] : null);
      setJustifications([]);
      setGapOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not open knowledge gap");
    }
  }

  function setAnswer(qId: string, idx: number) {
    setAnswers((s) => ({ ...s, [qId]: idx }));
  }

  // submit answers to server which will grade and store result
  async function submitAnswers() {
    if (!currentTest) return;
    setSubmitting(true);
    try {
      const payload = {
        userId: null,
        answers: (currentTest.questions || []).map((q: any) => ({ qId: q.id, selectedIndex: answers[q.id] ?? -1 })),
      };
      const r = await fetch(`/api/knowledge-tests/${encodeURIComponent(currentTest.id)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Submit failed");
      }
      const data = await r.json();
      setLastResult(data.submission);
      toast.success(`Submitted — score ${data.score}%`);
      await loadTests();
    } catch (err) {
      console.error(err);
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  function retest() {
    setJustifications([]);
    setLastResult(null);
    setAnswers({});
  }

  // Fill gap: request explanations for wrong q's
  async function fillGap() {
    if (!currentTest) return toast.error("No test selected");
    const latest = lastResult;
    if (!latest) return toast.error("No submission found");
    const wrongQIds = (latest.answers || []).filter((a: any) => !a.correct).map((a: any) => a.qId);
    if (!wrongQIds.length) return toast.success("No mistakes!");
    setJustifying(true);
    try {
      const r = await fetch(`/api/knowledge-tests/${encodeURIComponent(currentTest.id)}/justify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qIds: wrongQIds, contextNotes: currentTest.sourceText || "" }),
      });
      if (!r.ok) throw new Error("Justify failed");
      const data = await r.json();
      setJustifications(data.justifications || []);
      toast.success("Explanations ready");
    } catch (err) {
      console.error(err);
      toast.error("Could not get explanations");
    } finally {
      setJustifying(false);
    }
  }

  // Image OCR during create: send base64 to server to extract text via Gemini
  async function handleUploadImage() {
    if (!imageFile) return toast.error("Choose an image");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || "");
      setOcrLoading(true);
      try {
        const r = await fetch(`/api/knowledge-tests/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || "OCR failed");
        }
        const data = await r.json();
        const extracted = data.text || "";
        if (!extracted) throw new Error("No text extracted");
        setTestText((s) => (s ? s + "\n\n" + extracted : extracted));
        toast.success("Text extracted and appended");
      } catch (err) {
        console.error(err);
        toast.error("OCR failed");
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(imageFile);
  }

  // UI
  return (
    <PageLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Knowledge Tests</h1>
            <p className="text-muted-foreground">Create tests from passages and review mistakes.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)}>+ Create New Test</Button>
            <Button variant="ghost" onClick={() => setGapOpen(true)}>Knowledge Gap</Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {tests.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>{t.questionCount} questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-3">{new Date(t.createdAt).toLocaleString()}</div>
                <div className="flex gap-2">
                  <Button onClick={() => openRunner(t.id)}>Open</Button>
                  <Button variant="outline" onClick={() => openGap(t.id)}>Knowledge Gap</Button>
                  <Button variant="ghost" onClick={() => { navigator.clipboard?.writeText(window.location.href + `/tests/${t.id}`); toast.success("Link copied"); }}>
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl w-full">
          <DialogHeader><DialogTitle>Create new test</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Test name</Label>
              <Input value={testName} onChange={(e: any) => setTestName(e.target.value)} />
            </div>

            <div>
              <Label>Paste passage / lecture notes</Label>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="w-full p-3 rounded border bg-white text-black"
                style={{ minHeight: 160, resize: "vertical" }}
              />
            </div>

            <div className="flex items-center gap-3">
              <div>
                <Label>Upload image (optional OCR)</Label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUploadImage} disabled={!imageFile || ocrLoading}>{ocrLoading ? "Processing..." : "Extract Text"}</Button>
                <Button onClick={createTest} disabled={creating}>{creating ? "Generating..." : "Generate MCQs"}</Button>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">Note: server-side Gemini must be configured (.env GOOGLE_API_KEY).</div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Runner modal */}
      <Dialog open={runnerOpen} onOpenChange={(v) => { if (!v) setCurrentTest(null); }}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader><DialogTitle>{currentTest?.name || "Test"}</DialogTitle></DialogHeader>

          <div className="flex flex-col max-h-[70vh]">
            <div className="overflow-auto p-2 space-y-4">
              {currentTest?.questions?.map((q: any, idx: number) => {
                const userSel = answers[q.id];
                const result = lastResult?.answers?.find((a: any) => a.qId === q.id);
                const correctIndex = result ? result.correctIndex : null;
                return (
                  <Card key={q.id}>
                    <CardContent>
                      <div className="font-semibold mb-2">Q{idx+1}: {q.prompt}</div>
                      <div className="space-y-2">
                        {q.choices.map((c: string, ci: number) => {
                          const isSelected = userSel === ci;
                          const wasCorrect = result ? (ci === result.correctIndex) : false;
                          return (
                            <div key={ci} className={`p-2 rounded ${isSelected ? "bg-primary/10" : ""} ${lastResult && wasCorrect ? "border border-green-500" : ""}`}>
                              <label className="flex items-center gap-2">
                                <input type="radio" name={q.id} checked={!!isSelected} onChange={() => setAnswer(q.id, ci)} />
                                <span>{c}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-2 border-t p-3 bg-surface">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 items-center">
                  <Button onClick={submitAnswers} disabled={submitting}>{submitting ? "Submitting..." : "Submit"}</Button>
                  <Button variant="outline" onClick={() => { setAnswers({}); setJustifications([]); }}>Reset Answers</Button>
                  <Button variant="ghost" onClick={() => { setRunnerOpen(false); setCurrentTest(null); }}>Close</Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {currentTest ? `${Object.keys(answers).length} / ${currentTest.questions.length} answered` : ""}
                </div>
              </div>

              {lastResult && (
                <div className="mt-3 p-3 border rounded bg-muted/5">
                  <div className="font-semibold">Last score: {lastResult.score}%</div>
                  <div className="text-sm mt-2">Mistakes: {(lastResult.answers || []).filter((a: any) => !a.correct).length}</div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Knowledge Gap overlay */}
      <Dialog open={gapOpen} onOpenChange={(v) => { if (!v) { setGapOpen(false); setCurrentTest(null); } }}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader><DialogTitle>Knowledge Gap — {currentTest?.name}</DialogTitle></DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-auto p-2">
            <div>
              <h3 className="font-semibold">1) Original passage</h3>
              <div className="p-3 border rounded bg-[#071018] text-white whitespace-pre-wrap">{currentTest?.sourceText}</div>
            </div>

            <div>
              <h3 className="font-semibold">2) Last result</h3>
              {!lastResult ? (
                <div className="p-3 text-muted-foreground">No submission yet for this test.</div>
              ) : (
                <div className="p-3 border rounded bg-muted/5">
                  <div className="font-semibold">Score: {lastResult.score}%</div>
                  <div className="mt-2">
                    <div className="font-medium">Mistakes:</div>
                    {(lastResult.answers || []).filter((a:any)=>!a.correct).length === 0 ? <div>None</div> : (
                      <ul className="list-disc pl-6">
                        {(lastResult.answers || []).filter((a:any)=>!a.correct).map((m:any, i:number) => (
                          <li key={i} className="mb-2">
                            <div className="font-semibold">{m.prompt}</div>
                            <div className="text-sm text-muted-foreground">Your answer: {m.selectedIndex >= 0 ? (currentTest?.questions.find((q:any)=>q.id===m.qId)?.choices[m.selectedIndex] ?? "N/A") : "No answer"}</div>
                            <div className="text-sm text-success">Correct: {currentTest?.questions.find((q:any)=>q.id===m.qId)?.choices[m.correctIndex] ?? "N/A"}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold">3) Fill the gap</h3>
              <div className="flex gap-2 items-center">
                <Button onClick={fillGap} disabled={justifying || !lastResult}>{justifying ? "Working..." : "Explain mistakes (Fill the gap)"}</Button>
                <Button variant="ghost" onClick={() => setGapOpen(false)}>Close</Button>
              </div>

              {justifications.length > 0 && (
                <div className="mt-3 p-3 border rounded bg-muted/5">
                  <div className="font-semibold">Explanations</div>
                  <ul className="list-disc pl-6 mt-2">
                    {justifications.map((j) => (
                      <li key={j.qId} className="mb-2">
                        <div className="font-medium">{currentTest?.questions.find((q:any)=>q.id===j.qId)?.prompt}</div>
                        <div className="text-sm mt-1">{j.explanation}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
