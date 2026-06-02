import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

/**
 * Banner per "Aggiungi a Home" su mobile/desktop (PWA install prompt).
 *
 * Comportamento:
 *  - Android/desktop Chrome/Edge: intercetta beforeinstallprompt e mostra
 *    un bottone "Installa" che chiama prompt().
 *  - iOS Safari: niente beforeinstallprompt, mostra un hint testuale con le
 *    istruzioni manuali "Condividi → Aggiungi a Home".
 *  - Già installata (standalone): non mostra niente.
 *  - Dismiss: localStorage flag con TTL 14gg.
 */
const DISMISS_KEY = "bekind:install-banner-dismissed-at";
const DISMISS_TTL_MS = 14 * 86_400_000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const matchMedia = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as any).standalone === true;
  return Boolean(matchMedia || iosStandalone);
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;

    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBefore as EventListener);

    // iOS: nessun evento. Mostra il banner dopo 8s di permanenza.
    let iosTimer: number | undefined;
    if (isIos()) {
      iosTimer = window.setTimeout(() => setShow(true), 8_000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore as EventListener);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
    setIosHintOpen(false);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      } else {
        dismiss();
      }
      setDeferredPrompt(null);
      return;
    }
    if (isIos()) {
      setIosHintOpen(true);
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 md:left-auto md:right-4 md:bottom-4 md:max-w-sm z-[60] rounded-2xl bg-card border border-card-border shadow-xl p-3 flex items-start gap-3 animate-in slide-in-from-bottom-2">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Smartphone size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Installa BeKind HUB</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {isIos()
              ? "Dal browser Safari, tocca Condividi → 'Aggiungi a Home' per usarlo come app."
              : "Installalo come app sul tuo dispositivo per accesso rapido e icona dedicata."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Download size={12} /> {isIos() ? "Come fare" : "Installa"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:underline"
            >
              Più tardi
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Chiudi"
          onClick={dismiss}
          className="p-1 text-muted-foreground hover:text-foreground shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {iosHintOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setIosHintOpen(false)}>
          <div className="bg-card rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-2">Aggiungi a schermata Home</h3>
            <ol className="text-sm text-muted-foreground space-y-2 mb-4">
              <li>1. In Safari, tocca <strong>Condividi</strong> (l'icona quadrata con freccia in alto).</li>
              <li>2. Scorri e tocca <strong>"Aggiungi a Home"</strong>.</li>
              <li>3. Conferma il nome e tocca <strong>Aggiungi</strong>.</li>
            </ol>
            <p className="text-xs text-muted-foreground mb-3">L'app comparirà sulla Home con la sua icona, esattamente come un'app nativa.</p>
            <button onClick={dismiss} className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold">Ok, capito</button>
          </div>
        </div>
      )}
    </>
  );
}
