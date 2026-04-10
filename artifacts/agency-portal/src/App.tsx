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
import Settings from "@/pages/settings";
import Reports from "@/pages/reports";
import AiAssistant from "@/pages/ai-assistant";
import Tools from "@/pages/tools";
import EditorialPlanBuilder from "@/pages/editorial-plan-builder";
import TimeTracker from "@/pages/time-tracker";
import NotFound from "@/pages/not-found";
import SignInPage from "@/pages/sign-in";
import AuthCallbackPage from "@/pages/auth-callback";
import { AiChatProvider } from "@/components/ai-chat/AiChatContext";
import { AiFloatingButton } from "@/components/ai-chat/AiFloatingButton";
import { AiChatPanel } from "@/components/ai-chat/AiChatPanel";
import { useSupabaseAuth } from "@/auth/SupabaseAuthContext";

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
const authDisabled =
  import.meta.env.VITE_AUTH_DISABLED === "true" || import.meta.env.VITE_AUTH_DISABLED === "1";

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
  if (loading) return null;
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
      <Route path="/contracts">
        <RequireAuth><Contracts /></RequireAuth>
      </Route>
      <Route path="/reports">
        <RequireAuth><Reports /></RequireAuth>
      </Route>
      <Route path="/ai-assistant">
        <RequireAuth><AiAssistant /></RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth><Settings /></RequireAuth>
      </Route>
      <Route path="/tools">
        <RequireAuth><Tools /></RequireAuth>
      </Route>
      <Route path="/tools/piano-editoriale/:id">
        {(params) => <RequireAuth><EditorialPlanBuilder id={params.id} /></RequireAuth>}
      </Route>
      <Route path="/tools/time-tracker">
        <RequireAuth><TimeTracker /></RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ShellWithSession() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionQueryInvalidator />
      <AiChatProvider>
        <TooltipProvider>
          <ErrorBoundary>
            <Router />
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
        <AuthenticatedAiWidgets />
      </AiChatProvider>
    </QueryClientProvider>
  );
}

function MissingSupabaseEnv() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md rounded-xl border bg-card p-6 text-sm space-y-2">
        <h1 className="text-lg font-semibold">Configurazione Supabase mancante</h1>
        <p className="text-muted-foreground">
          Aggiungi in <code className="font-mono text-xs">artifacts/agency-portal/.env.local</code>:
        </p>
        <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap">{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}</pre>
        <p className="text-muted-foreground text-xs">
          Su Render imposta <code className="font-mono">SUPABASE_JWT_SECRET</code> (JWT Secret del progetto Supabase) per validare il token in API.
        </p>
      </div>
    </div>
  );
}

function App() {
  const hasSupabaseEnv =
    !!(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim());

  if (!authDisabled && !hasSupabaseEnv) {
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
