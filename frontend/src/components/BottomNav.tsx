"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, History, User } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card/80 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto grid grid-cols-3 px-2 py-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className="flex justify-center py-1">
              <span
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-1.5 rounded-full text-sm transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
