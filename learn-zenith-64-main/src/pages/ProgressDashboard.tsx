import { useEffect, useState } from "react";
import { PageLayout } from "@/components/Layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi } from "@/lib/api";
import { TrendingUp, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ProgressDashboard() {
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await dashboardApi.getOverview();
      setOverview(data);
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    }
  };

  const topics = [
    { name: "Math", mastered: 8, pending: 3 },
    { name: "CS", mastered: 10, pending: 2 },
    { name: "Writing", mastered: 5, pending: 4 },
    { name: "Physics", mastered: 6, pending: 5 },
  ];

  return (
    <PageLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="text-sm text-muted-foreground mb-2">Home &gt; Progress Dashboard</div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Progress Dashboard</h1>
          </div>
        </div>

        {/* Progress Circle */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center py-12">
            <div className="relative w-64 h-64">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-muted/20"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(overview?.weeklyProgress || 0) * 2.827}, 282.7`}
                  strokeLinecap="round"
                  className="text-primary"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary">
                    {overview?.weeklyProgress || 0}%
                  </div>
                  <div className="text-muted-foreground mt-2">Weekly Goal</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Weekly Goal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Weekly Goal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-40">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-muted/20"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeDasharray={`${(overview?.weeklyProgress || 0) * 2.827}, 282.7`}
                      strokeLinecap="round"
                      className="text-foreground"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topics Mastered vs Pending */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="w-5 h-5" />
                Topics Mastered vs Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40 flex items-end justify-around gap-2">
                {topics.map((topic) => (
                  <div key={topic.name} className="flex flex-col items-center gap-2 flex-1">
                    <div className="flex flex-col gap-1 w-full">
                      <div
                        className="bg-foreground rounded-t"
                        style={{ height: `${topic.mastered * 8}px` }}
                      />
                      <div
                        className="bg-muted rounded-b"
                        style={{ height: `${topic.pending * 8}px` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">{topic.name}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2">
                🔥 3-Day Streak
              </Badge>
              <Badge className="bg-info/10 text-info hover:bg-info/20 px-4 py-2">
                📚 100 Flashcards Reviewed
              </Badge>
              <Badge className="bg-warning/10 text-warning hover:bg-warning/20 px-4 py-2">
                ⭐ First Week Champion
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quote */}
        <div className="mt-8 text-center">
          <p className="text-lg italic text-muted-foreground">
            "{overview?.motivationalQuote?.text || 'The expert in anything was once a beginner.'}"
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
