const API_BASE_URL = "https://learnboostback.onrender.com/api";

let authToken: string | null = localStorage.getItem("auth_token");

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
  }
}

export function getAuthToken() {
  return authToken;
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken && !endpoint.startsWith("/auth")) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    fetchApi<{ id: string; username: string; email: string; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    fetchApi<{ id: string; username: string; email: string; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Profile
export const profileApi = {
  get: () =>
    fetchApi<{
      id: string;
      username: string;
      email: string;
      avatarUrl: string;
      streakDays: number;
      totalStudyTime: number;
      joinedAt: string;
    }>("/profile"),
};

// Dashboard
export const dashboardApi = {
  getOverview: () =>
    fetchApi<{
      weeklyProgress: number;
      streakDays: number;
      totalStudyTime: number;
      recentAchievements: Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        earnedAt: string;
      }>;
      motivationalQuote: { text: string; author: string };
    }>("/dashboard/overview"),
};

// Flashcards
export const flashcardsApi = {
  getAll: () =>
    fetchApi<{
      cards: Array<{
        id: string;
        question: string;
        answer: string;
        tags: string[];
        difficulty: string;
        lastReviewed: string | null;
        nextReviewDate: string;
        createdAt: string;
      }>;
      totalCards: number;
      dueForReview: number;
    }>("/flashcards"),
  create: (data: { question: string; answer: string; tags?: string[]; difficulty?: string }) =>
    fetchApi<any>("/flashcards", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  review: (id: string, data: { remembered: boolean; difficulty?: string }) =>
    fetchApi<{ success: boolean; nextReviewDate: string; intervalDays: number }>(
      `/flashcards/${id}/review`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    ),
};

// Study Planner
export const studyPlannerApi = {
  getCalendar: () =>
    fetchApi<{
      currentWeek: {
        startDate: string;
        endDate: string;
        days: Array<{
          date: string;
          studyTime: number;
          completedSessions: number;
          goalsAchieved: boolean;
        }>;
      };
      upcomingSessions: Array<{
        id: string;
        title: string;
        subject: string;
        duration: number;
        scheduledAt: string;
        isCompleted: boolean;
      }>;
    }>("/study-planner/calendar"),
  createSession: (data: {
    title: string;
    subject: string;
    duration: number;
    scheduledAt: string;
    description?: string;
  }) =>
    fetchApi<any>("/study-planner/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Knowledge Gaps
export const knowledgeGapsApi = {
  get: () =>
    fetchApi<{
      gaps: Array<{
        id: string;
        topic: string;
        subject: string;
        confidenceScore: number;
        lastPracticed: string;
        resources: Array<{ title: string; type: string; url: string }>;
      }>;
      suggestedTopics: string[];
    }>("/knowledge-gaps"),
};

// Group Learning
export const groupLearningApi = {
  getSessions: () =>
    fetchApi<{
      upcomingSessions: Array<{
        id: string;
        title: string;
        topic: string;
        host: { id: string; username: string; avatarUrl: string };
        scheduledAt: string;
        duration: number;
        participants: number;
        maxParticipants: number;
        isJoined: boolean;
      }>;
      mySessions: Array<any>;
    }>("/group-learning/sessions"),
  createSession: (data: {
    title: string;
    topic: string;
    description?: string;
    scheduledAt: string;
    duration?: number;
    maxParticipants?: number;
  }) =>
    fetchApi<any>("/group-learning/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// AI Coach
export const aiCoachApi = {
  getInsights: () =>
    fetchApi<{
      message: string;
      insights: Array<{ metric: string; value: string; trend: string }>;
    }>("/ai-coach/insights"),
};

// Notifications
export const notificationsApi = {
  get: () =>
    fetchApi<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        read: boolean;
        createdAt: string;
      }>;
    }>("/notifications"),
};
