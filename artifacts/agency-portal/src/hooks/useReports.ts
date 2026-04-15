import { useMemo } from "react";
import { useListClients } from "@workspace/api-client-react";
import { useClientContext } from "@/context/ClientContext";

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
