"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Settings, Menu, LogOut, User, BookOpen, Code, FileCode, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { getDocsUrl } from "@/lib/docs/webapp-url";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [docsModeEnabled, setDocsModeEnabled] = useState(false);

  useEffect(() => {
    // Read from localStorage on mount
    try {
      const stored = localStorage.getItem("vexa-docs-mode");
      if (stored) {
        const parsed = JSON.parse(stored);
        setDocsModeEnabled(parsed?.state?.enabled ?? false);
      }
    } catch {
      // Ignore errors
    }

    // Listen for changes
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem("vexa-docs-mode");
        if (stored) {
          const parsed = JSON.parse(stored);
          setDocsModeEnabled(parsed?.state?.enabled ?? false);
        }
      } catch {
        // Ignore errors
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const toggleDocsMode = () => {
    const newValue = !docsModeEnabled;
    setDocsModeEnabled(newValue);
    try {
      const stored = localStorage.getItem("vexa-docs-mode");
      const existing = stored ? JSON.parse(stored) : {};
      localStorage.setItem(
        "vexa-docs-mode",
        JSON.stringify({
          ...existing,
          state: { enabled: newValue },
        })
      );
      // Trigger custom event for same-tab updates
      window.dispatchEvent(new CustomEvent("vexa-docs-mode-change"));
    } catch {
      // Ignore errors
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="shrink-0 z-50 w-full border-b bg-background">
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold group">
          <Logo size="md" showText={false} className="group-hover:scale-105 transition-transform" />
          <span className="hidden sm:inline-block">Amebo Dashboard</span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" fill="white" />
                <span className="sr-only">User menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user && (
                <>
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-medium">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
