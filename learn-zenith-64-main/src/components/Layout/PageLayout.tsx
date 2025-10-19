import { Sidebar } from "./Sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
  onFabClick?: () => void;
}

export function PageLayout({ children, onFabClick }: PageLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">{children}</main>

      {onFabClick && (
        <Button
          size="lg"
          onClick={onFabClick}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}
    </div>
  );
}
