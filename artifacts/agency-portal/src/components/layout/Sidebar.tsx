import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  UserCog,
  MessageCircle,
  Files,
  Settings,
  Receipt,
  FileSignature,
  BarChart2,
  LogOut,
  Sparkles,
  Moon,
  Sun,
  Wrench,
  Timer,
} from "lucide-react";
import logoImg from "/logo-bekind.png";
import { useClerk, useUser } from "@clerk/react";
import { useTheme } from "@/hooks/useTheme";
import { NotificationBell } from "./NotificationBell";
import { useUserRole } from "@/hooks/useUserRole";

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={dark ? "Tema chiaro" : "Tema scuro"}
      className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors shrink-0"
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

const hrefPermissionMap: Record<string, string> = {
  "/clients": "clients",
  "/team": "team",
  "/files": "files",
  "/reports": "reports",
  "/quotes": "quotes",
  "/contracts": "contracts",
  "/settings": "settings",
};

const navGroups = [
  {
    label: "Principale",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clients", label: "Clienti", icon: Users },
      { href: "/projects", label: "Progetti", icon: FolderKanban },
      { href: "/tasks", label: "Task", icon: CheckSquare },
    ],
  },
  {
    label: "Collaborazione",
    items: [
      { href: "/team", label: "Team", icon: UserCog },
      { href: "/chat", label: "Chat", icon: MessageCircle },
      { href: "/files", label: "File", icon: Files },
    ],
  },
  {
    label: "Analisi",
    items: [
      { href: "/reports", label: "Report", icon: BarChart2 },
      { href: "/ai-assistant", label: "AI Assistant", icon: Sparkles },
    ],
  },
  {
    label: "Strumenti",
    items: [
      { href: "/tools", label: "Tools", icon: Wrench },
      { href: "/tools/time-tracker", label: "Time Tracker", icon: Timer },
    ],
  },
  {
    label: "Documentazione",
    items: [
      { href: "/quotes", label: "Preventivi", icon: Receipt },
      { href: "/contracts", label: "Contratti", icon: FileSignature },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { hasPermission, loading: roleLoading } = useUserRole();
  const [reportBadge, setReportBadge] = useState(0);

  useEffect(() => {
    fetch("/api/reports/counts")
      .then((r) => r.json())
      .then((d) => { setReportBadge((d.in_revisione ?? 0) + (d.approvato ?? 0)); })
      .catch(() => {});
    const interval = setInterval(() => {
      fetch("/api/reports/counts").then((r) => r.json()).then((d) => { setReportBadge((d.in_revisione ?? 0) + (d.approvato ?? 0)); }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  return (
    <div className="flex flex-col w-60 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      <div className="px-3 py-5 border-b border-sidebar-border flex items-center justify-center">
        <img
          src={logoImg}
          alt="Be Kind Social Agency HUB"
          className="logo-animate w-full h-auto object-contain"
          style={{ maxHeight: "170px", maxWidth: "220px" }}
        />
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((group, gi) => {
          const visibleItems = roleLoading ? group.items : group.items.filter(({ href }) => {
            const perm = hrefPermissionMap[href];
            return !perm || hasPermission(perm);
          });
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className={cn("mb-2", gi > 0 && "mt-4")}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  const badge = href === "/reports" && reportBadge > 0 ? reportBadge : 0;
                  return (
                    <li key={href}>
                      <Link href={href}>
                        <div
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <Icon size={17} strokeWidth={1.8} />
                          {label}
                          {badge > 0 && (
                            <span className="ml-auto text-[10px] font-bold bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                              {badge}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-1 mb-1">
          <NotificationBell />
          <Link href="/settings" className="flex-1">
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors",
              location === "/settings"
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <Settings size={17} strokeWidth={1.8} />
              Impostazioni
            </div>
          </Link>
        </div>

        {/* User info + logout */}
        <div className="mt-1 pt-2 border-t border-sidebar-border/50">
          <div className="px-3 py-2 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0 overflow-hidden">
              {user?.imageUrl
                ? <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
                : (user?.firstName?.charAt(0) ?? user?.emailAddresses?.[0]?.emailAddress?.charAt(0) ?? "U").toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground/90 truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">
                {user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
            </div>
            <ThemeToggle />
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              title="Esci"
              className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
