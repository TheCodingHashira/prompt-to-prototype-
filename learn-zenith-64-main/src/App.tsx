import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Flashcards from "./pages/Flashcards";
import StudyPlanner from "./pages/StudyPlanner";
import ProgressDashboard from "./pages/ProgressDashboard";
import KnowledgeGaps from "./pages/KnowledgeGaps";
import GroupLearning from "./pages/GroupLearning";
import NotFound from "./pages/NotFound";
import StudyAgent from "./pages/StudyAgent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/study-planner" element={<StudyPlanner />} />
            <Route path="/progress-dashboard" element={<ProgressDashboard />} />
            <Route path="/knowledge-gaps" element={<KnowledgeGaps />} />
            <Route path="/group-learning" element={<GroupLearning />} />
            <Route path="/study-agent" element={<StudyAgent />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
