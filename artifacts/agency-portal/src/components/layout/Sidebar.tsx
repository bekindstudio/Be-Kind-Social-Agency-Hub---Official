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
  Sparkles,
  Moon,
  Sun,
  Wrench,
  Timer,
  LogOut,
  Trash2,
} from "lucide-react";
import logoImg from "/logo-bekind.png";
import { usePortalUser } from "@/hooks/usePortalUser";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useUserRole } from "@/hooks/useUserRole";
import { portalFetch } from "@workspace/api-client-react";

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
  const { user } = usePortalUser();
  const { authDisabled, signOut } = useSupabaseAuth();
  const { hasPermission, loading: roleLoading } = useUserRole();
  const [reportBadge, setReportBadge] = useState(0);
  const [trashBadge, setTrashBadge] = useState(0);

  useEffect(() => {
    portalFetch("/api/reports/counts")
      .then((r) => r.json())
      .then((d) => { setReportBadge((d.in_revisione ?? 0) + (d.approvato ?? 0)); })
      .catch(() => {});
    const interval = setInterval(() => {
      portalFetch("/api/reports/counts").then((r) => r.json()).then((d) => { setReportBadge((d.in_revisione ?? 0) + (d.approvato ?? 0)); }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const load = () => {
      portalFetch("/api/trash/count")
        .then((r) => r.json())
        .then((d) => setTrashBadge(Number(d.count ?? 0)))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 120000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") return location === "/dashboard";
    if (href === "/tools/time-tracker") return location === "/tools/time-tracker";
    if (href === "/tools") {
      return location === "/tools" || location.startsWith("/tools/piano-editoriale");
    }
    if (location === href) return true;
    return location.startsWith(`${href}/`);
  };

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
                  const badge =
                    href === "/reports" && reportBadge > 0
                      ? reportBadge
                      : href === "/trash" && trashBadge > 0
                        ? trashBadge
                        : 0;
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
          <Link href="/trash">
            <div
              className={cn(
                "relative p-2 rounded-lg cursor-pointer transition-colors",
                isActive("/trash")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              title="Cestino"
              aria-label="Cestino"
            >
              <Trash2 size={17} strokeWidth={1.8} />
              {trashBadge > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-amber-500 text-white rounded-full w-4.5 h-4.5 min-w-[18px] flex items-center justify-center px-1">
                  {trashBadge}
                </span>
              )}
            </div>
          </Link>
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
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.emailAddresses?.[0]?.emailAddress ?? (authDisabled ? "Ospite" : "")}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">
                {user?.emailAddresses?.[0]?.emailAddress ?? ""}
              </p>
            </div>
            <ThemeToggle />
            {!authDisabled ? (
              <button
                type="button"
                onClick={() => void signOut()}
                title="Esci"
                className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors shrink-0"
              >
                <LogOut size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
