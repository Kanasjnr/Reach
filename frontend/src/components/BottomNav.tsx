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
    <nav className="fixed inset-x-0 flex justify-center px-4 z-40 bottom-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-1 bg-card border border-border shadow-lg shadow-black/10 rounded-full px-2 py-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className="flex justify-center">
              <span
                className={cn(
                  "flex flex-col items-center gap-1 px-5 py-2 rounded-full text-sm transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="w-6 h-6" />
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
