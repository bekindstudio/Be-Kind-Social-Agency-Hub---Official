import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalFetch, useListClients } from "@workspace/api-client-react";
import { useClientContext } from "@/context/ClientContext";
import type { SavedReport } from "@/components/tools/reports/ReportHistory";
import type { ClientAnalytics } from "@/types/client";
import { mapPayloadToAnalytics, toSavedReport, type ReportHistoryApiRow } from "@/lib/reportUtils";
import { useToast } from "@/hooks/use-toast";

interface ClientOption {
  id: number | string;
  name: string;
}

export function useReports() {
  const { data: clients } = useListClients();
  const { activeClient } = useClientContext();

  const clientList = useMemo(
    () => (Array.isArray(clients) ? (clients as ClientOption[]) : []),
    [clients],
  );

  const activeBackendClientId = useMemo(() => {
    const activeClientName = (activeClient?.name ?? "").trim().toLowerCase();
    const activeClientNumericId = activeClient?.id ? Number(activeClient.id) : NaN;
    const matchedId = (
      clientList.find((client: any) => {
        const byId =
          Number.isFinite(activeClientNumericId) &&
          Number(client?.id) === activeClientNumericId;
        const byName =
          activeClientName.length > 0 &&
          String(client?.name ?? "").trim().toLowerCase() === activeClientName;
        return byId || byName;
      }) as any
    )?.id as number | string | undefined;
    const numeric = Number(matchedId);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [activeClient?.id, activeClient?.name, clientList]);

  return {
    clientList,
    activeBackendClientId,
  };
}

export function useReportsData({
  activeClientId,
  month,
  setReportAnalytics,
  setIsFallbackData,
}: {
  activeClientId: string | undefined;
  month: string;
  setReportAnalytics: (value: ClientAnalytics | null) => void;
  setIsFallbackData: (value: boolean) => void;
}) {
  const { toast } = useToast();

  const selectedClientNumericId = useMemo(() => {
    const raw = Number(activeClientId);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [activeClientId]);

  const historyQuery = useQuery({
    queryKey: ["reports", "history", selectedClientNumericId],
    enabled: selectedClientNumericId != null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!selectedClientNumericId) return [] as SavedReport[];
      const response = await portalFetch(`/api/reports?clientId=${selectedClientNumericId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Impossibile caricare lo storico report");
      }
      const payload = (await response.json()) as ReportHistoryApiRow[];
      return payload.map(toSavedReport);
    },
  });

  const selectedMonthRange = useMemo(() => {
    const [year, monthNum] = month.split("-").map(Number);
    const start = new Date(year, (monthNum ?? 1) - 1, 1);
    const end = new Date(year, monthNum ?? 1, 0);
    return {
      since: start.toISOString().slice(0, 10),
      until: end.toISOString().slice(0, 10),
    };
  }, [month]);

  const syncAndFetchReportMetrics = async () => {
    if (!selectedClientNumericId) return null;
    const qs = new URLSearchParams({
      range: "30d",
      since: selectedMonthRange.since,
      until: selectedMonthRange.until,
      sync: "true",
    });
    await portalFetch(`/api/meta/sync/${selectedClientNumericId}?since=${selectedMonthRange.since}&until=${selectedMonthRange.until}`, {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
    const res = await portalFetch(`/api/meta/insights/${selectedClientNumericId}?${qs.toString()}`, {
      credentials: "include",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(payload?.error ?? "Errore caricamento metriche Meta");
    }
    setIsFallbackData(Boolean((payload as { mock?: boolean } | null)?.mock));
    const mapped = mapPayloadToAnalytics(payload, activeClientId);
    if (mapped) setReportAnalytics(mapped);
    return payload;
  };

  const handleGeneratePreview = async (
    activeClientName: string | undefined,
    setIsGeneratingReport: (value: boolean) => void,
  ) => {
    if (!activeClientName) return;
    setIsGeneratingReport(true);
    try {
      await syncAndFetchReportMetrics();
      toast({ title: "Anteprima aggiornata", description: "Dati aggiornati dal token Meta collegato." });
    } catch (err: any) {
      setIsFallbackData(true);
      toast({
        title: "Anteprima salvata",
        description: err?.message ?? "Aggiornamento Meta non disponibile: uso dati locali.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return {
    selectedClientNumericId,
    selectedMonthRange,
    history: historyQuery.data ?? [],
    syncAndFetchReportMetrics,
    handleGeneratePreview,
  };
}
