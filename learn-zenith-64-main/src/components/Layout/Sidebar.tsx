// src/components/Layout/Sidebar.tsx
import { NavLink } from "react-router-dom";
import { Home, CreditCard, Calendar, TrendingUp, Lightbulb, Users, Sun, Moon, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  user?: { id?: string; username?: string; email?: string } | null;
  className?: string;
  onRequestClose?: () => void; // for mobile
}

const menuItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: CreditCard, label: "Flashcards", path: "/flashcards" },
  { icon: Calendar, label: "Study Planner", path: "/study-planner" },
  { icon: TrendingUp, label: "Progress Dashboard", path: "/progress-dashboard" },
  { icon: Lightbulb, label: "Knowledge Gaps", path: "/knowledge-gaps" },
  { icon: Users, label: "Group Learning", path: "/group-learning" },
  // Add Study Agent
  { icon: Sun /* choose an icon */, label: "Study Agent", path: "/study-agent" },
];


export function Sidebar({ user, className, onRequestClose }: SidebarProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  return (
    <aside className={cn("w-[200px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col", className)}>
      {/* Logo */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-sidebar-primary">LearnBoost</h1>
        </div>
        {/* optional compact icon for mobile; no handler here */}
      </div>

      {/* User Profile */}
      {user && (
        <div className="px-4 pb-4 mb-2">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 bg-primary">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user.username?.charAt(0)?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1" aria-label="Main navigation">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "w-full flex items-center gap-3 px-3 h-10 rounded-md",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )
              }
              onClick={() => onRequestClose?.()}
              aria-current={(location.pathname === item.path) ? "page" : undefined}
            >
              <Icon className="w-4 h-4" aria-hidden />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 space-y-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsDark((s) => !s)}
          className="w-full justify-start gap-2 text-sidebar-foreground"
          aria-pressed={isDark}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="text-sm">{isDark ? "Light" : "Dark"}</span>
        </Button>
        <div className="text-xs text-muted-foreground px-2">AI Learning Accelerator</div>
      </div>
    </aside>
  );
}
