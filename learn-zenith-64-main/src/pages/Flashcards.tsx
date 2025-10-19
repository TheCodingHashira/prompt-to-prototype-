import { useEffect, useState } from "react";
import { PageLayout } from "@/components/Layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { flashcardsApi } from "@/lib/api";
import { Volume2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Flashcards() {
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCard, setNewCard] = useState({ question: "", answer: "" });

  useEffect(() => {
    loadFlashcards();
  }, []);

  const loadFlashcards = async () => {
    try {
      const data = await flashcardsApi.getAll();
      setFlashcards(data.cards);
    } catch (error) {
      console.error("Failed to load flashcards:", error);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = (remembered: boolean) => {
    if (flashcards.length === 0) return;
    
    // Review the card
    flashcardsApi.review(flashcards[currentIndex].id, { remembered });
    
    setIsFlipped(false);
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handleAddCard = async () => {
    if (!newCard.question || !newCard.answer) {
      toast.error("Please fill in both question and answer");
      return;
    }

    try {
      await flashcardsApi.create(newCard);
      toast.success("Flashcard created!");
      setDialogOpen(false);
      setNewCard({ question: "", answer: "" });
      loadFlashcards();
    } catch (error) {
      toast.error("Failed to create flashcard");
    }
  };

  const currentCard = flashcards[currentIndex];
  const progress = flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0;

  return (
    <PageLayout onFabClick={() => setDialogOpen(true)}>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm text-muted-foreground">Home &gt; Flashcards</div>
              <h1 className="text-3xl font-bold mt-1">Flashcards</h1>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add New Flashcard</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Flashcard</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Question</Label>
                    <Input
                      id="question"
                      value={newCard.question}
                      onChange={(e) => setNewCard({ ...newCard, question: e.target.value })}
                      placeholder="What is the time complexity of binary search?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="answer">Answer</Label>
                    <Input
                      id="answer"
                      value={newCard.answer}
                      onChange={(e) => setNewCard({ ...newCard, answer: e.target.value })}
                      placeholder="O(log n)"
                    />
                  </div>
                  <Button onClick={handleAddCard} className="w-full">Create Flashcard</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Flashcard Display */}
        {flashcards.length > 0 ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-lg font-semibold">Current Deck</div>
            
            {/* Card */}
            <Card
              className="h-96 cursor-pointer transition-all duration-300 hover:shadow-xl"
              onClick={handleFlip}
            >
              <CardContent className="flex items-center justify-center h-full p-12">
                <div className="text-center space-y-4">
                  {!isFlipped ? (
                    <p className="text-2xl font-medium">{currentCard.question}</p>
                  ) : (
                    <p className="text-2xl font-medium">{currentCard.answer}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Controls */}
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                variant="default"
                onClick={handleFlip}
                className="px-8"
              >
                Flip
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleNext(true)}
                disabled={!isFlipped}
              >
                Remembered
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleNext(false)}
                disabled={!isFlipped}
              >
                Review Again
              </Button>
              <Button size="lg" variant="ghost">
                <Volume2 className="w-5 h-5" />
                Voice
              </Button>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-center text-muted-foreground">
                {progress.toFixed(0)}% completed
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No flashcards yet. Create your first one!</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
