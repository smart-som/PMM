"use client";

import {
  BarChart3,
  BookOpenText,
  Briefcase,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Radar,
  Route,
  Settings,
  User,
  Wallet,
  Waypoints,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSession } from "@/contexts/session-context";
import { UserRole } from "@/types/app";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const PM_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/pm", icon: LayoutDashboard },
  { label: "Research", href: "/dashboard/pm/research", icon: Radar },
  { label: "PRD Canvas", href: "/dashboard/pm/prd", icon: FileText },
  { label: "Roadmap", href: "/dashboard/pm/roadmap", icon: Waypoints },
  { label: "Analytics", href: "/dashboard/pm/analytics", icon: BarChart3 },
  { label: "Journey Map", href: "/dashboard/pm/journey-map", icon: Route },
  { label: "A/B Testing", href: "/dashboard/pm/ab-testing", icon: FlaskConical },
  { label: "Docs", href: "/docs", icon: BookOpenText },
  { label: "Settings", href: "/dashboard/pm/settings", icon: Settings }
];

const HELPER_NAV: NavItem[] = [
  { label: "Available Gigs", href: "/portal/helper", icon: Briefcase },
  { label: "Earnings Soon", href: "/portal/helper/earnings", icon: Wallet },
  { label: "Profile", href: "/portal/helper/profile", icon: User },
  { label: "Docs", href: "/docs", icon: BookOpenText }
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/pm") {
    return pathname === href;
  }
  if (href === "/dashboard/pm/prd") {
    return pathname.startsWith("/dashboard/pm/prd");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navForRole(role: UserRole | null) {
  if (role === "pm") return PM_NAV;
  if (role === "helper") return HELPER_NAV;
  return [];
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const navItems = navForRole(user?.role ?? null);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 md:grid-cols-[250px_1fr]">
        <aside className="border-r border-border bg-surface p-5 md:sticky md:top-0 md:self-start md:h-screen md:overflow-y-auto">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              OrbitPlus
            </p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {user?.role === "pm"
                ? "PM Workspace"
                : user?.role === "helper"
                  ? "Helper Workspace"
                  : "Workspace"}
            </p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent"
                      : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-border pt-4">
            <div className="mb-3">
              <ThemeToggle />
            </div>
            <p className="text-xs text-muted-foreground">{user?.email ?? "Not signed in"}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </div>
        </aside>

        <section className="bg-background">{children}</section>
      </div>
    </div>
  );
}
