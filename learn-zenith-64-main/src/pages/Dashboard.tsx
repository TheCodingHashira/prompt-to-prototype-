import { useEffect, useState } from "react";
import { PageLayout } from "@/components/Layout/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardApi, aiCoachApi, notificationsApi } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, TrendingUp, Award, Users, Calendar, CreditCard, Lightbulb } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [overviewData, insightsData, notifData] = await Promise.all([
        dashboardApi.getOverview(),
        aiCoachApi.getInsights(),
        notificationsApi.get(),
      ]);
      setOverview(overviewData);
      setInsights(insightsData);
      setNotifications(notifData.notifications.filter((n) => !n.read).slice(0, 4));
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    }
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  };

  return (
    <PageLayout>
      <div className="p-8 space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-4xl font-bold text-primary mb-2">
            Good {getTimeOfDay()}, {user?.username || "Guest"}
          </h1>
          <p className="text-muted-foreground italic">
            "{overview?.motivationalQuote?.text || 'Consistency beats perfection.'}"
          </p>
        </div>

        {/* Progress Circle */}
        <Card className="bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20">
          <CardContent className="flex items-center justify-center py-12">
            <div className="relative w-48 h-48">
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
                  <div className="text-4xl font-bold text-primary">
                    {overview?.weeklyProgress || 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Weekly Goal</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* AI Motivation Coach */}
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-warning" />
                AI Motivation Coach
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{insights?.message || "Keep up the great work!"}</p>
              <div className="grid grid-cols-3 gap-3">
                {insights?.insights?.slice(0, 3).map((insight: any, i: number) => (
                  <div key={i} className="text-center">
                    <div className="text-sm font-semibold text-foreground">{insight.metric}</div>
                    <div className="text-lg font-bold text-warning">{insight.value}</div>
                    <TrendingUp className="w-3 h-3 text-success mx-auto mt-1" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground italic">
                Keep studying consistently to unlock more achievements!
              </p>
            </CardContent>
          </Card>

          {/* Spaced Repetition Reminders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Spaced Repetition Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                  >
                    <div className="font-semibold text-sm text-destructive">{notif.title}</div>
                    <div className="text-xs text-muted-foreground">{notif.message}</div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No pending reviews</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* More Stats */}
        <div className="grid grid-cols-2 gap-4">
          {/* Today's Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Today's Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="text-xs text-muted-foreground">Study Time</div>
                <div className="text-3xl font-bold">42 <span className="text-lg">min</span></div>
                <div className="text-xs text-success">+12% from yesterday</div>
              </div>
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="text-xs text-muted-foreground">Flashcards Reviewed</div>
                <div className="text-3xl font-bold">28</div>
                <div className="text-xs text-success">+8% from yesterday</div>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Weekly Goal</div>
                <Progress value={overview?.weeklyProgress || 0} className="h-2" />
                <div className="text-xs font-semibold">{overview?.weeklyProgress || 0}%</div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Reviewed 15 Math flashcards</div>
                <div className="text-xs text-muted-foreground">2 hours ago</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Completed Physics study session</div>
                <div className="text-xs text-muted-foreground">5 hours ago</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Identified 3 knowledge gaps in CS</div>
                <div className="text-xs text-muted-foreground">1 day ago</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Earned 3-Day Streak badge</div>
                <div className="text-xs text-muted-foreground">2 days ago</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Modules */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Your Learning Modules
          </h2>
          <div className="grid grid-cols-5 gap-4">
            <Link to="/flashcards">
              <Card className="bg-gradient-to-br from-teal-50 to-teal-100/50 border-teal-200 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center mb-2">
                    <CreditCard className="w-5 h-5 text-teal-700" />
                  </div>
                  <CardTitle className="text-sm">Flashcards</CardTitle>
                  <CardDescription className="text-xs">Review, flip, and track your retention.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link to="/study-planner">
              <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center mb-2">
                    <Calendar className="w-5 h-5 text-slate-700" />
                  </div>
                  <CardTitle className="text-sm">Study Planner</CardTitle>
                  <CardDescription className="text-xs">Map out your week with ease.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link to="/progress-dashboard">
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-200 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center mb-2">
                    <TrendingUp className="w-5 h-5 text-yellow-700" />
                  </div>
                  <CardTitle className="text-sm">Progress Dashboard</CardTitle>
                  <CardDescription className="text-xs">Charts, badges, and motivation.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link to="/knowledge-gaps">
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mb-2">
                    <Lightbulb className="w-5 h-5 text-orange-700" />
                  </div>
                  <CardTitle className="text-sm">Knowledge Gaps</CardTitle>
                  <CardDescription className="text-xs">Identify and revise weak spots.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link to="/group-learning">
              <Card className="bg-gradient-to-br from-pink-50 to-pink-100/50 border-pink-200 hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center mb-2">
                    <Users className="w-5 h-5 text-pink-700" />
                  </div>
                  <CardTitle className="text-sm">Group Learning</CardTitle>
                  <CardDescription className="text-xs">Collaborate and share with peers.</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
