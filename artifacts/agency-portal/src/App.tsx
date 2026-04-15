import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteErrorFallback } from "@/components/shared/RouteErrorFallback";
import { AiChatProvider } from "@/components/ai-chat/AiChatContext";
import { AiFloatingButton } from "@/components/ai-chat/AiFloatingButton";
import { AiChatPanel } from "@/components/ai-chat/AiChatPanel";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";
import { AUTH_DISABLED as authDisabled } from "@/config/auth-mode";
import { AutoSaveProvider } from "@/context/AutoSaveContext";
import { useClientContext } from "@/context/ClientContext";
import { ClientCoreProvider } from "@/context/ClientCoreContext";
import { EditorialProvider } from "@/context/EditorialContext";
import { BriefProvider } from "@/context/BriefContext";
import { Layout } from "@/components/layout/Layout";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Clients = lazy(() => import("@/pages/clients"));
const ClientDetail = lazy(() => import("@/pages/client-detail"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const Tasks = lazy(() => import("@/pages/tasks"));
const Team = lazy(() => import("@/pages/team"));
const Chat = lazy(() => import("@/pages/chat"));
const Files = lazy(() => import("@/pages/files"));
const Quotes = lazy(() => import("@/pages/quotes"));
const Contracts = lazy(() => import("@/pages/contracts"));
const ContractsNew = lazy(() => import("@/pages/contracts-new"));
const ContractsTemplates = lazy(() => import("@/pages/contracts-templates"));
const ContractsClassic = lazy(() => import("@/pages/contracts-classic"));
const Settings = lazy(() => import("@/pages/settings"));
const AiAssistant = lazy(() => import("@/pages/ai-assistant"));
const BriefPage = lazy(() => import("@/pages/tools/BriefPage"));
const EditorialPlanBuilder = lazy(() => import("@/pages/editorial-plan-builder"));
const CalendarPage = lazy(() => import("@/pages/tools/CalendarPage"));
const EventsPage = lazy(() => import("@/pages/tools/EventsPage"));
const CompetitorsPage = lazy(() => import("@/pages/tools/CompetitorsPage"));
const AnalyticsPage = lazy(() => import("@/pages/tools/AnalyticsPage"));
const ReportsPage = lazy(() => import("@/pages/tools/ReportsPage"));
const CaptionAiPage = lazy(() => import("@/pages/tools/CaptionAiPage"));
const ContentIdeasPage = lazy(() => import("@/pages/tools/ContentIdeasPage"));
const Trash = lazy(() => import("@/pages/trash"));
const NotFound = lazy(() => import("@/pages/not-found"));
const SignInPage = lazy(() => import("@/pages/sign-in"));
const AuthCallbackPage = lazy(() => import("@/pages/auth-callback"));

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

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
      <p className="text-sm text-muted-foreground">Caricamento…</p>
    </div>
  );
}

function RouteBoundary({
  routeKey,
  children,
}: {
  routeKey: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary key={routeKey} fallback={<RouteErrorFallback />}>
      {children}
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Switch>
        <Route path="/">
          <RouteBoundary routeKey="/">
            <HomeRoute />
          </RouteBoundary>
        </Route>
        {!authDisabled && (
          <Route path="/sign-in">
            <RouteBoundary routeKey="/sign-in">
              <SignInPage />
            </RouteBoundary>
          </Route>
        )}
        {!authDisabled && (
          <Route path="/auth/callback">
            <RouteBoundary routeKey="/auth/callback">
              <AuthCallbackPage />
            </RouteBoundary>
          </Route>
        )}
        <Route path="/dashboard">
          <RouteBoundary routeKey="/dashboard">
            <RequireAuth><Dashboard /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/trash">
          <RouteBoundary routeKey="/trash">
            <RequireAuth><Trash /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/clients">
          <RouteBoundary routeKey="/clients">
            <RequireAuth><Clients /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/clients/:id">
          {(params) => (
            <RouteBoundary routeKey={`/clients/${params.id}`}>
              <RequireAuth><ClientDetail id={params.id} /></RequireAuth>
            </RouteBoundary>
          )}
        </Route>
        <Route path="/projects">
          <RouteBoundary routeKey="/projects">
            <RequireAuth><Projects /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/projects/:id">
          {(params) => (
            <RouteBoundary routeKey={`/projects/${params.id}`}>
              <RequireAuth><ProjectDetail id={params.id} /></RequireAuth>
            </RouteBoundary>
          )}
        </Route>
        <Route path="/tasks">
          <RouteBoundary routeKey="/tasks">
            <RequireAuth><Tasks /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/team">
          <RouteBoundary routeKey="/team">
            <RequireAuth><Team /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/chat">
          <RouteBoundary routeKey="/chat">
            <RequireAuth><Chat /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/files">
          <RouteBoundary routeKey="/files">
            <RequireAuth><Files /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/quotes">
          <RouteBoundary routeKey="/quotes">
            <RequireAuth><Quotes /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/contracts/new">
          <RouteBoundary routeKey="/contracts/new">
            <RequireAuth><ContractsNew /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/contracts/templates">
          <RouteBoundary routeKey="/contracts/templates">
            <RequireAuth><ContractsTemplates /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/contracts/classic">
          <RouteBoundary routeKey="/contracts/classic">
            <RequireAuth><ContractsClassic /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/contracts">
          <RouteBoundary routeKey="/contracts">
            <RequireAuth><Contracts /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/reports">
          <RouteBoundary routeKey="/reports">
            <RequireAuth><Redirect to="/tools/reports" /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/ai-assistant">
          <RouteBoundary routeKey="/ai-assistant">
            <RequireAuth><AiAssistant /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/settings">
          <RouteBoundary routeKey="/settings">
            <RequireAuth><Settings /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools">
          <RouteBoundary routeKey="/tools">
            <RequireAuth><Redirect to="/dashboard" /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/brief">
          <RouteBoundary routeKey="/tools/brief">
            <RequireAuth><RequireActiveClient><BriefPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/piano-editoriale/:id">
          {(params) => (
            <RouteBoundary routeKey={`/tools/piano-editoriale/${params.id}`}>
              <RequireAuth><RequireActiveClient><EditorialPlanBuilder id={params.id} /></RequireActiveClient></RequireAuth>
            </RouteBoundary>
          )}
        </Route>
        <Route path="/tools/time-tracker">
          <RouteBoundary routeKey="/tools/time-tracker">
            <RequireAuth><Redirect to="/dashboard" /></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/calendar">
          <RouteBoundary routeKey="/tools/calendar">
            <RequireAuth><RequireActiveClient><CalendarPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/events">
          <RouteBoundary routeKey="/tools/events">
            <RequireAuth><RequireActiveClient><EventsPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/competitors">
          <RouteBoundary routeKey="/tools/competitors">
            <RequireAuth><RequireActiveClient><CompetitorsPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/analytics">
          <RouteBoundary routeKey="/tools/analytics">
            <RequireAuth><RequireActiveClient><AnalyticsPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/reports">
          <RouteBoundary routeKey="/tools/reports">
            <RequireAuth><RequireActiveClient><ReportsPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/caption-ai">
          <RouteBoundary routeKey="/tools/caption-ai">
            <RequireAuth><RequireActiveClient><CaptionAiPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route path="/tools/content-ideas">
          <RouteBoundary routeKey="/tools/content-ideas">
            <RequireAuth><RequireActiveClient><ContentIdeasPage /></RequireActiveClient></RequireAuth>
          </RouteBoundary>
        </Route>
        <Route>
          <RouteBoundary routeKey="/not-found">
            <NotFound />
          </RouteBoundary>
        </Route>
      </Switch>
    </Suspense>
  );
}

function ShellWithSession() {
  return (
    <QueryClientProvider client={queryClient}>
      <AutoSaveProvider>
        <SessionQueryInvalidator />
        <ClientCoreProvider>
          <EditorialProvider>
            <BriefProvider>
              <AiChatProvider>
                <TooltipProvider>
                  <ErrorBoundary>
                    <Router />
                  </ErrorBoundary>
                  <Toaster />
                </TooltipProvider>
                <AuthenticatedAiWidgets />
              </AiChatProvider>
            </BriefProvider>
          </EditorialProvider>
        </ClientCoreProvider>
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
