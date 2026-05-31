import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { portalFetch } from "@workspace/api-client-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Sun,
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckSquare,
  Calendar,
  CalendarDays,
  FileSignature,
  Receipt,
  Settings,
  BarChart2,
  HardDrive,
  Plus,
  Trash2,
  UserCog,
  MessageCircle,
  Target,
  FileText,
} from "lucide-react";

/**
 * Command Palette globale (Cmd-K / Ctrl-K).
 * Mostra azioni rapide + jump diretti a clienti, progetti, task.
 * I dati sono caricati lazy quando la palette si apre la prima volta.
 */

type ClientLite = { id: number; name: string };
type ProjectLite = { id: number; name: string; clientName?: string };
type TaskLite = { id: number; title: string; status: string };

const NAV_ACTIONS = [
  { label: "Oggi", icon: Sun, href: "/today", keywords: "today daily focus" },
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", keywords: "home" },
  { label: "Clienti", icon: Users, href: "/clients", keywords: "clients" },
  { label: "Progetti", icon: FolderKanban, href: "/projects", keywords: "projects" },
  { label: "Task", icon: CheckSquare, href: "/tasks", keywords: "todo todos" },
  { label: "Team", icon: UserCog, href: "/team", keywords: "team members" },
  { label: "Chat", icon: MessageCircle, href: "/chat", keywords: "messages" },
  { label: "Calendario editoriale", icon: Calendar, href: "/tools/calendar", keywords: "editorial calendar posts" },
  { label: "Eventi clienti", icon: CalendarDays, href: "/tools/events", keywords: "events" },
  { label: "Brief", icon: FileText, href: "/tools/brief", keywords: "brief" },
  { label: "Competitors", icon: Target, href: "/tools/competitors", keywords: "competitors" },
  { label: "Analytics", icon: BarChart2, href: "/tools/analytics", keywords: "analytics stats" },
  { label: "Report", icon: FileText, href: "/tools/reports", keywords: "reports" },
  { label: "Preventivi", icon: Receipt, href: "/quotes", keywords: "quotes preventivi" },
  { label: "Contratti", icon: FileSignature, href: "/contracts/templates", keywords: "contracts contratti" },
  { label: "Drive", icon: HardDrive, href: "/settings#drive", keywords: "google drive settings" },
  { label: "Impostazioni", icon: Settings, href: "/settings", keywords: "settings configurazione" },
  { label: "Cestino", icon: Trash2, href: "/trash", keywords: "trash cestino deleted" },
];

const CREATE_ACTIONS = [
  { label: "Nuovo Cliente", icon: Plus, href: "/clients?new=1", keywords: "new client cliente onboarding" },
  { label: "Nuovo Progetto", icon: Plus, href: "/projects?new=1", keywords: "new project progetto" },
  { label: "Nuovo Task", icon: Plus, href: "/tasks?new=1", keywords: "new task" },
];

export function CommandPalette() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Apri con Cmd-K / Ctrl-K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const enabled = open;

  const { data: clientsData } = useQuery<ClientLite[]>({
    queryKey: ["cmdk-clients"],
    enabled,
    queryFn: async () => {
      const r = await portalFetch("/api/clients");
      const j = await r.json();
      const arr = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
      return arr.map((c: any) => ({ id: Number(c.id), name: String(c.name) }));
    },
    staleTime: 60_000,
  });

  const { data: projectsData } = useQuery<ProjectLite[]>({
    queryKey: ["cmdk-projects"],
    enabled,
    queryFn: async () => {
      const r = await portalFetch("/api/projects");
      const j = await r.json();
      const arr = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
      return arr.map((p: any) => ({ id: Number(p.id), name: String(p.name), clientName: p.clientName }));
    },
    staleTime: 60_000,
  });

  const { data: tasksData } = useQuery<TaskLite[]>({
    queryKey: ["cmdk-tasks"],
    enabled,
    queryFn: async () => {
      const r = await portalFetch("/api/tasks");
      const j = await r.json();
      const arr = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
      return arr.slice(0, 50).map((t: any) => ({ id: Number(t.id), title: String(t.title), status: String(t.status) }));
    },
    staleTime: 60_000,
  });

  const clients = clientsData ?? [];
  const projects = projectsData ?? [];
  const tasks = tasksData ?? [];

  const go = (href: string) => {
    setOpen(false);
    setSearch("");
    navigate(href);
  };

  const navItems = useMemo(() => [...NAV_ACTIONS, ...CREATE_ACTIONS], []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Cerca clienti, progetti, task, oppure dove andare…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nessun risultato trovato.</CommandEmpty>

        <CommandGroup heading="Azioni rapide">
          {CREATE_ACTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords}`}
                onSelect={() => go(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clienti">
              {clients.map((c) => (
                <CommandItem key={`client-${c.id}`} value={`cliente ${c.name}`} onSelect={() => go(`/clients/${c.id}`)}>
                  <Users className="mr-2 h-4 w-4" />
                  <span>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Progetti">
              {projects.map((p) => (
                <CommandItem key={`project-${p.id}`} value={`progetto ${p.name} ${p.clientName ?? ""}`} onSelect={() => go(`/projects/${p.id}`)}>
                  <FolderKanban className="mr-2 h-4 w-4" />
                  <span>{p.name}</span>
                  {p.clientName && <span className="ml-2 text-xs text-muted-foreground">{p.clientName}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Task recenti">
              {tasks.map((t) => (
                <CommandItem key={`task-${t.id}`} value={`task ${t.title}`} onSelect={() => go(`/tasks?id=${t.id}`)}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  <span className="truncate">{t.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground capitalize">{t.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Vai a">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords}`}
                onSelect={() => go(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

