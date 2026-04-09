import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, useAuth, useClerk } from "@clerk/react";
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
import { AiChatProvider } from "@/components/ai-chat/AiChatContext";
import { AiFloatingButton } from "@/components/ai-chat/AiFloatingButton";
import { AiChatPanel } from "@/components/ai-chat/AiChatPanel";

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

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// Invalidate React Query cache when user changes
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// Full-page login screen shown to unauthenticated users
function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <img
            src="/logo-bekind.png"
            alt="Be Kind Social Agency HUB"
            className="h-28 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <p className="text-sm text-muted-foreground">Be Kind Social Agency HUB</p>
        </div>
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          appearance={{
            variables: {
              colorPrimary: "hsl(83, 28%, 42%)",
              colorBackground: "#ffffff",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
            },
          }}
        />
      </div>
    </div>
  );
}

// Gate that redirects to /sign-in if the user is not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(83,15%,96%)]">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo-bekind.png"
            alt="Be Kind Social Agency HUB"
            className="h-12 object-contain opacity-60"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}

function AuthenticatedAiWidgets() {
  const { isSignedIn } = useAuth();
  if (!isSignedIn) return null;
  return (
    <>
      <AiFloatingButton />
      <AiChatPanel mode="drawer" />
    </>
  );
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Redirect to="/sign-in" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
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
    </ClerkProvider>
  );
}

function MissingClerkConfig() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Missing Clerk configuration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This app requires <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code> to run.
        </p>
        <div className="mt-4 rounded-lg bg-muted p-4">
          <pre className="text-xs whitespace-pre-wrap leading-relaxed">{`Create a file: artifacts/agency-portal/.env.local

VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
# Optional:
# VITE_CLERK_PROXY_URL=...
`}</pre>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          After setting it, restart the dev server.
        </p>
      </div>
    </div>
  );
}

function App() {
  if (!clerkPubKey) {
    return <MissingClerkConfig />;
  }

  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
