import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;

  return (
    <div className="bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-100 text-center text-xs py-2 px-4 border-b border-amber-200 dark:border-amber-800">
      Connessione assente: i dati verranno salvati non appena torni online.
    </div>
  );
}
