import { Layout } from "@/components/layout/Layout";
import { AiChatPanel } from "@/components/ai-chat/AiChatPanel";
import { Sparkles } from "lucide-react";

export default function AiAssistant() {
  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Sparkles size={18} className="text-violet-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Assistente intelligente per il tuo team</p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <AiChatPanel mode="fullpage" />
        </div>
      </div>
    </Layout>
  );
}
