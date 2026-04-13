import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tasks from "@/pages/tasks";
import Team from "@/pages/team";
import Chat from "@/pages/chat";
import Files from "@/pages/files";
import Quotes from "@/pages/quotes";
import Contracts from "@/pages/contracts";
import ContractsNew from "@/pages/contracts-new";
import ContractsTemplates from "@/pages/contracts-templates";
import ContractsClassic from "@/pages/contracts-classic";
import Settings from "@/pages/settings";
import AiAssistant from "@/pages/ai-assistant";
import Tools from "@/pages/tools";
import BriefPage from "@/pages/tools/BriefPage";
import EditorialPlanBuilder from "@/pages/editorial-plan-builder";
import TimeTracker from "@/pages/time-tracker";
import CalendarPage from "@/pages/tools/CalendarPage";
import EventsPage from "@/pages/tools/EventsPage";
import CompetitorsPage from "@/pages/tools/CompetitorsPage";
import AnalyticsPage from "@/pages/tools/AnalyticsPage";
import ReportsPage from "@/pages/tools/ReportsPage";
import CaptionAiPage from "@/pages/tools/CaptionAiPage";
import Trash from "@/pages/trash";
import NotFound from "@/pages/not-found";
import SignInPage from "@/pages/sign-in";
import AuthCallbackPage from "@/pages/auth-callback";
import { AiChatProvider } from "@/components/ai-chat/AiChatContext";
import { AiFloatingButton } from "@/components/ai-chat/AiFloatingButton";
import { AiChatPanel } from "@/components/ai-chat/AiChatPanel";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
import { AUTH_DISABLED as authDisabled } from "@/config/auth-mode";
import { AutoSaveProvider } from "@/context/AutoSaveContext";
import { ClientProvider, useClientContext } from "@/context/ClientContext";
import { Layout } from "@/components/layout/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function SessionQueryInvalidator() {
  const { session } = useSupabaseAuth();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const id = session?.user?.id ?? null;
    if (prevRef.current !== undefined && prevRef.current !== id) {
      qc.clear();
    }
    prevRef.current = id;
  }, [session?.user?.id, qc]);

  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authDisabled: off, session, loading } = useSupabaseAuth();
  if (off) return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      </div>
    );
  }
  if (!session) {
    return <Redirect to="/sign-in" />;
  }
  return <>{children}</>;
}

function RequireActiveClient({ children }: { children: React.ReactNode }) {
  const { activeClient } = useClientContext();
  if (!activeClient) {
    return (
      <Layout>
        <div className="p-8">
          <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center">
            <h2 className="text-lg font-semibold">Seleziona un cliente</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              I tool operano su un contesto cliente centrale. Seleziona un cliente dal selettore in alto per continuare.
            </p>
          </div>
        </div>
      </Layout>
    );
  }
  return <>{children}</>;
}

function AuthenticatedAiWidgets() {
  const { authDisabled: off, session } = useSupabaseAuth();
  if (off || session) {
    return (
      <>
        <AiFloatingButton />
        <AiChatPanel mode="drawer" />
      </>
    );
  }
  return null;
}

function HomeRoute() {
  const { authDisabled: off, session, loading } = useSupabaseAuth();
  if (off) return <Redirect to="/dashboard" />;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      </div>
    );
  }
  if (session) return <Redirect to="/dashboard" />;
  return <Redirect to="/sign-in" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      {!authDisabled && <Route path="/sign-in" component={SignInPage} />}
      {!authDisabled && <Route path="/auth/callback" component={AuthCallbackPage} />}
      <Route path="/dashboard">
        <RequireAuth><Dashboard /></RequireAuth>
      </Route>
      <Route path="/trash">
        <RequireAuth><Trash /></RequireAuth>
      </Route>
      <Route path="/clients">
        <RequireAuth><Clients /></RequireAuth>
      </Route>
      <Route path="/clients/:id">
        {(params) => <RequireAuth><ClientDetail id={params.id} /></RequireAuth>}
      </Route>
      <Route path="/projects">
        <RequireAuth><Projects /></RequireAuth>
      </Route>
      <Route path="/projects/:id">
        {(params) => <RequireAuth><ProjectDetail id={params.id} /></RequireAuth>}
      </Route>
      <Route path="/tasks">
        <RequireAuth><Tasks /></RequireAuth>
      </Route>
      <Route path="/team">
        <RequireAuth><Team /></RequireAuth>
      </Route>
      <Route path="/chat">
        <RequireAuth><Chat /></RequireAuth>
      </Route>
      <Route path="/files">
        <RequireAuth><Files /></RequireAuth>
      </Route>
      <Route path="/quotes">
        <RequireAuth><Quotes /></RequireAuth>
      </Route>
      <Route path="/contracts/new">
        <RequireAuth><ContractsNew /></RequireAuth>
      </Route>
      <Route path="/contracts/templates">
        <RequireAuth><ContractsTemplates /></RequireAuth>
      </Route>
      <Route path="/contracts/classic">
        <RequireAuth><ContractsClassic /></RequireAuth>
      </Route>
      <Route path="/contracts">
        <RequireAuth><Contracts /></RequireAuth>
      </Route>
      <Route path="/reports">
        <RequireAuth><Redirect to="/tools/reports" /></RequireAuth>
      </Route>
      <Route path="/ai-assistant">
        <RequireAuth><AiAssistant /></RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth><Settings /></RequireAuth>
      </Route>
      <Route path="/tools">
        <RequireAuth><RequireActiveClient><Tools /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/brief">
        <RequireAuth><RequireActiveClient><BriefPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/piano-editoriale/:id">
        {(params) => <RequireAuth><RequireActiveClient><EditorialPlanBuilder id={params.id} /></RequireActiveClient></RequireAuth>}
      </Route>
      <Route path="/tools/time-tracker">
        <RequireAuth><RequireActiveClient><TimeTracker /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/calendar">
        <RequireAuth><RequireActiveClient><CalendarPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/events">
        <RequireAuth><RequireActiveClient><EventsPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/competitors">
        <RequireAuth><RequireActiveClient><CompetitorsPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/analytics">
        <RequireAuth><RequireActiveClient><AnalyticsPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/reports">
        <RequireAuth><RequireActiveClient><ReportsPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route path="/tools/caption-ai">
        <RequireAuth><RequireActiveClient><CaptionAiPage /></RequireActiveClient></RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ShellWithSession() {
  return (
    <QueryClientProvider client={queryClient}>
      <AutoSaveProvider>
        <SessionQueryInvalidator />
        <ClientProvider>
          <AiChatProvider>
            <TooltipProvider>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
              <Toaster />
            </TooltipProvider>
            <AuthenticatedAiWidgets />
          </AiChatProvider>
        </ClientProvider>
      </AutoSaveProvider>
    </QueryClientProvider>
  );
}

function MissingSupabaseEnv() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md rounded-xl border bg-card p-6 text-sm space-y-2">
        <h1 className="text-lg font-semibold">Configurazione Supabase mancante</h1>
        <p className="text-muted-foreground">
          Sull’API (Render) imposta almeno una di queste coppie:
        </p>
        <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">{`SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=...   # oppure SUPABASE_PUBLISHABLE_KEY (nome nuovo dashboard)

# oppure prefisso PUBLIC_:
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...   # o PUBLIC_SUPABASE_PUBLISHABLE_KEY`}</pre>
        <p className="text-muted-foreground text-xs">
          Opzionale su Vercel: <code className="font-mono">VITE_SUPABASE_URL</code> +{" "}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> o{" "}
          <code className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>. Su Render: anche{" "}
          <code className="font-mono">SUPABASE_JWT_SECRET</code> (JWT Secret del progetto) e{" "}
          <code className="font-mono">DATABASE_URL</code> per il DB.
        </p>
      </div>
    </div>
  );
}

function AppBootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
      <p className="text-sm text-muted-foreground">Caricamento…</p>
    </div>
  );
}

function App() {
  const { authDisabled: off, loading: authLoading, supabaseConfigMissing } = useSupabaseAuth();

  if (!off && authLoading) {
    return <AppBootLoading />;
  }

  if (!off && supabaseConfigMissing) {
    return <MissingSupabaseEnv />;
  }

  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <ShellWithSession />
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
