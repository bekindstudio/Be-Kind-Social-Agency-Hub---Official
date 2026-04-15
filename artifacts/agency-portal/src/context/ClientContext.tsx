import { type ReactNode } from "react";
import type { ClientContextType } from "@/types/client";
import { ClientCoreProvider, useClientCore } from "@/context/ClientCoreContext";
import { EditorialProvider, useEditorial } from "@/context/EditorialContext";
import { BriefProvider, useBrief } from "@/context/BriefContext";

/**
 * Compatibility provider for existing consumers.
 * Keeps the provider stack in the required order:
 * ClientCore -> Editorial -> Brief -> app tree.
 */
export function ClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClientCoreProvider>
      <EditorialProvider>
        <BriefProvider>{children}</BriefProvider>
      </EditorialProvider>
    </ClientCoreProvider>
  );
}

export function useClientContext(): ClientContextType {
  const core = useClientCore();
  const editorial = useEditorial();
  const brief = useBrief();

  return {
    clients: core.clients,
    activeClient: core.activeClient,
    brief: brief.brief,
    briefsByClient: brief.briefsByClient,
    posts: editorial.posts,
    postsByClient: editorial.postsByClient,
    analytics: core.analytics,
    analyticsByClient: core.analyticsByClient,
    competitors: brief.competitors,
    clientEvents: brief.clientEvents,
    allClientEvents: brief.allClientEvents,
    metaAccountId: core.metaAccountId,
    isLoading: core.isLoading,
    setActiveClient: core.setActiveClient,
    updateBrief: brief.updateBrief,
    addPost: editorial.addPost,
    updatePost: editorial.updatePost,
    deletePost: editorial.deletePost,
    addCompetitor: brief.addCompetitor,
    updateCompetitor: brief.updateCompetitor,
    removeCompetitor: brief.removeCompetitor,
    addClientEvent: brief.addClientEvent,
    updateClientEvent: brief.updateClientEvent,
    deleteClientEvent: brief.deleteClientEvent,
    refreshAnalytics: core.refreshAnalytics,
    setMetaAccountId: core.setMetaAccountId,
    createClient: core.createClient,
    importClients: core.importClients,
  };
}

export { useClientCore } from "@/context/ClientCoreContext";
export { useEditorial } from "@/context/EditorialContext";
export { useBrief } from "@/context/BriefContext";
