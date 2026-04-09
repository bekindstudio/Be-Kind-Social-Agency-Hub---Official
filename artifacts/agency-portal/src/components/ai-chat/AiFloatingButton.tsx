import { Sparkles } from "lucide-react";
import { useAiChat } from "./AiChatContext";

export function AiFloatingButton() {
  const { toggleDrawer, isDrawerOpen } = useAiChat();

  if (isDrawerOpen) return null;

  return (
    <button
      onClick={toggleDrawer}
      className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group print:hidden"
      title="Ask AI"
    >
      <Sparkles size={22} className="group-hover:scale-110 transition-transform" />
    </button>
  );
}
