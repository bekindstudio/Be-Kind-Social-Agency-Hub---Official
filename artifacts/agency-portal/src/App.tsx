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
/** Solo demo / emergenza: niente login. Non usare in produzione con dati sensibili. */
const authDisabled =
  import.meta.env.VITE_AUTH_DISABLED === "true" || import.meta.env.VITE_AUTH_DISABLED === "1";

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
  if (authDisabled) return <>{children}</>;

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
  if (authDisabled) {
    return (
      <>
        <AiFloatingButton />
        <AiChatPanel mode="drawer" />
      </>
    );
  }
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
  if (authDisabled) return <Redirect to="/dashboard" />;
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Redirect to="/sign-in" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      {!authDisabled && <Route path="/sign-in/*?" component={SignInPage} />}
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
  const mode = import.meta.env.MODE;
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-xl w-full rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Configurazione Clerk mancante</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nel bundle del sito non c’è <code className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</code>. Di solito non è un errore della chiave in sé: <strong>non è stata letta al momento del build</strong> (Vercel) oppure manca <code className="font-mono">.env.local</code> in locale.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Build: <code className="font-mono">{mode}</code>
        </p>
        <div className="mt-4 rounded-lg bg-muted p-4 space-y-3 text-xs">
          <p className="font-semibold text-foreground">Checklist Vercel (errori frequenti)</p>
          <ol className="list-decimal pl-4 space-y-2 text-muted-foreground">
            <li>
              Nome <strong>esatto</strong>: <code className="font-mono text-foreground">VITE_CLERK_PUBLISHABLE_KEY</code> — non <code className="font-mono">CLERK_PUBLISHABLE_KEY</code> (quello serve solo su <strong>Render</strong> per l’API).
            </li>
            <li>
              Valore = una sola riga, <strong>senza virgolette</strong>, che inizia con <code className="font-mono">pk_test_</code> o <code className="font-mono">pk_live_</code> (Dashboard Clerk → Configure → <strong>API Keys</strong> → <em>Publishable key</em>).
            </li>
            <li>
              Spunta ambienti: almeno <strong>Production</strong> (se apri il dominio principale). Per URL “preview” serve anche <strong>Preview</strong>.
            </li>
            <li>
              Dopo Salva: <strong>Deployments → Redeploy</strong> (o nuovo commit). Senza un <strong>nuovo build</strong> la chiave non entra nel sito.
            </li>
            <li>
              Opzionale: <strong>Redeploy → spunta “Clear cache”</strong> se sospetti un build vecchio.
            </li>
            <li>
              Repository: l’ultimo deploy deve includere il <code className="font-mono">vite.config.ts</code> che legge <code className="font-mono">process.env</code> (commit recente su <code className="font-mono">main</code>).
            </li>
          </ol>
          <p className="font-medium text-foreground pt-2">In locale</p>
          <pre className="whitespace-pre-wrap leading-relaxed bg-background/50 p-2 rounded">{`artifacts/agency-portal/.env.local
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...`}</pre>
          <p className="font-medium text-foreground pt-2">Render (backend) — separato</p>
          <p className="text-muted-foreground">
            Lì servono <code className="font-mono text-foreground">CLERK_PUBLISHABLE_KEY</code> e <code className="font-mono text-foreground">CLERK_SECRET_KEY</code>. Non sostituiscono <code className="font-mono">VITE_*</code> sul frontend.
          </p>
          <p className="font-medium text-foreground pt-2">Solo demo (senza login)</p>
          <pre className="whitespace-pre-wrap leading-relaxed bg-background/50 p-2 rounded">{`VITE_AUTH_DISABLED=true`}</pre>
          <p className="text-amber-700">Non per dati sensibili in pubblico.</p>
        </div>
      </div>
    </div>
  );
}

function AppNoClerkShell() {
  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <QueryClientProvider client={queryClient}>
          <div className="bg-amber-400/90 text-amber-950 text-center text-xs font-medium py-1.5 px-3">
            Modalità senza autenticazione (demo). Non esporre su internet con dati reali senza Clerk o altro login.
          </div>
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
      </WouterRouter>
    </ErrorBoundary>
  );
}

function App() {
  if (authDisabled) {
    return <AppNoClerkShell />;
  }

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
