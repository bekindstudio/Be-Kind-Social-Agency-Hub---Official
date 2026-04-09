import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AiContext {
  type: string;
  data?: any;
}

interface AiChatState {
  isDrawerOpen: boolean;
  openDrawer: (context?: AiContext) => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  context: AiContext | null;
  setContext: (ctx: AiContext | null) => void;
}

const AiChatCtx = createContext<AiChatState | null>(null);

export function AiChatProvider({ children }: { children: ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [context, setContext] = useState<AiContext | null>(null);

  const openDrawer = useCallback((ctx?: AiContext) => {
    if (ctx) setContext(ctx);
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  return (
    <AiChatCtx.Provider value={{ isDrawerOpen, openDrawer, closeDrawer, toggleDrawer, context, setContext }}>
      {children}
    </AiChatCtx.Provider>
  );
}

const noopState: AiChatState = {
  isDrawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  context: null,
  setContext: () => {},
};

export function useAiChat() {
  const ctx = useContext(AiChatCtx);
  return ctx ?? noopState;
}
