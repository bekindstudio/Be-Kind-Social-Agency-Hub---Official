import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileSignature, Check, Loader2, AlertCircle, Download, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { usePortal } from "../PortalContext";
import { usePortalNav } from "../nav";
import { portalGet, portalSend, PortalAuthError } from "../portalApi";
import { T, SERIF } from "../theme";

/**
 * Contratto nel portale cliente: lettura del testo, proposte di modifica
 * (approvate/rifiutate dall'agenzia) e accettazione online con doppia
 * conferma + audit trail lato server (data, IP, user agent, hash del testo).
 * Il PDF si scarica dal contratto renderizzato (stesso motore del cockpit).
 */

type ChangeRequest = { id: number; message: string; status: string; reply: string | null; createdAt: string };
type Contract = {
  id: string; contractNumber: string; serviceType: string; content: string;
  status: string; value: string | null; startDate: string | null; endDate: string | null;
  sentAt: string | null; signedAt: string | null; signedName: string | null;
  changeRequests: ChangeRequest[];
};

const CR_LABEL: Record<string, { label: string; color: string }> = {
  proposta: { label: "In attesa di risposta", color: "#8a6420" },
  accettata: { label: "Accettata", color: "#5f7047" },
  rifiutata: { label: "Non accolta", color: "#a44a33" },
};

export function ContractScreen() {
  const { token, onAuthExpired } = usePortal();
  const { pop } = usePortalNav();
  const [contract, setContract] = useState<Contract | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Proposta di modifica
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState("");
  const [proposalBusy, setProposalBusy] = useState(false);
  const [proposalErr, setProposalErr] = useState<string | null>(null);

  // Firma
  const [fullName, setFullName] = useState("");
  const [acceptContract, setAcceptContract] = useState(false);
  const [acceptVexatious, setAcceptVexatious] = useState(false);
  const [signBusy, setSignBusy] = useState(false);
  const [signErr, setSignErr] = useState<string | null>(null);

  const [pdfBusy, setPdfBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await portalGet<{ contract: Contract | null }>(token, "/contract");
      setContract(d.contract);
      setLoad("ready");
    } catch (e) {
      if (e instanceof PortalAuthError) { onAuthExpired(); return; }
      setLoad("error");
    }
  }, [token, onAuthExpired]);

  useEffect(() => { void refresh(); }, [refresh]);

  const sendProposal = async () => {
    if (!contract || proposal.trim().length === 0) return;
    setProposalBusy(true); setProposalErr(null);
    const r = await portalSend<{ error?: string }>(token, `/contract/${contract.id}/change-request`, "POST", { message: proposal.trim() });
    setProposalBusy(false);
    if (!r.ok) { setProposalErr(r.data?.error ?? "Invio non riuscito, riprova"); return; }
    setProposal(""); setProposing(false);
    await refresh();
  };

  const sign = async () => {
    if (!contract) return;
    setSignBusy(true); setSignErr(null);
    const r = await portalSend<{ error?: string }>(token, `/contract/${contract.id}/sign`, "POST", {
      fullName: fullName.trim(), acceptContract, acceptVexatious,
    });
    setSignBusy(false);
    if (!r.ok) { setSignErr(r.data?.error ?? "Firma non riuscita, riprova"); return; }
    await refresh();
  };

  const downloadPdf = async () => {
    if (!contentRef.current || !contract) return;
    setPdfBusy(true);
    try {
      const { exportContractElementToPdf } = await import("@/lib/contract-pdf");
      await exportContractElementToPdf(contentRef.current, `Contratto-${contract.contractNumber}.pdf`);
    } catch { /* il download è best-effort */ }
    setPdfBusy(false);
  };

  if (load === "loading") return <div className="py-20 text-center"><Loader2 className="mx-auto animate-spin" style={{ color: T.sage }} /></div>;
  if (load === "error") return (
    <div className="py-20 text-center flex flex-col items-center">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-6 text-sm font-semibold self-start" style={{ color: T.sage }}><ArrowLeft size={18} /> Home</button>
      <AlertCircle size={30} className="text-amber-500 mb-3" />
      <p className="font-semibold" style={{ color: T.ink }}>Non riusciamo a caricare il contratto</p>
      <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 rounded-xl text-white font-semibold text-sm" style={{ background: T.sage }}>Riprova</button>
    </div>
  );
  if (!contract) return (
    <div className="py-16 text-center">
      <button onClick={pop} className="inline-flex items-center gap-1.5 mb-6 text-sm font-semibold" style={{ color: T.sage }}><ArrowLeft size={18} /> Home</button>
      <FileSignature size={30} className="mx-auto mb-3" style={{ color: T.softMuted }} />
      <p className="font-semibold" style={{ color: T.ink }}>Nessun contratto disponibile</p>
      <p className="text-sm mt-1" style={{ color: T.muted }}>Quando l'agenzia ti invierà un contratto lo troverai qui.</p>
    </div>
  );

  const isSigned = contract.status === "firmato";
  const pendingRequests = contract.changeRequests.filter((r) => r.status === "proposta").length;

  return (
    <div className="pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between mb-4">
        <button onClick={pop} className="p-2 -ml-2 rounded-xl" style={{ color: T.muted }}><ArrowLeft size={20} /></button>
        <button onClick={() => void downloadPdf()} disabled={pdfBusy}
          className="inline-flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50" style={{ color: T.sage }}>
          {pdfBusy ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} PDF
        </button>
      </div>

      <div className="mb-5">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold mb-2 px-3 py-1 rounded-full" style={{ background: T.sageSoft, color: T.sageDark }}>
          <FileSignature size={15} /> Contratto {contract.contractNumber}
        </div>
        <h1 className="text-2xl font-bold leading-tight" style={{ color: T.ink, fontFamily: SERIF }}>
          {isSigned ? "Il tuo contratto firmato" : "Il tuo contratto"}
        </h1>
        {isSigned ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <ShieldCheck size={15} /> Firmato da {contract.signedName} il {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString("it-IT") : ""}
          </p>
        ) : (
          <p className="text-sm mt-1" style={{ color: T.muted }}>Leggilo con calma: puoi proporre modifiche o firmarlo qui sotto.</p>
        )}
      </div>

      {/* Testo del contratto */}
      <div ref={contentRef} className="rounded-2xl p-5 text-[15px] leading-relaxed overflow-x-auto"
        style={{ background: "#ffffff", border: `1px solid ${T.cardBorder}`, color: "#2c2a24" }}
        dangerouslySetInnerHTML={{ __html: contract.content }} />

      {/* Proposte di modifica */}
      {contract.changeRequests.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-bold mb-2" style={{ color: T.ink }}>Le tue proposte di modifica</h2>
          <div className="space-y-2">
            {contract.changeRequests.map((r) => {
              const meta = CR_LABEL[r.status] ?? CR_LABEL.proposta;
              return (
                <div key={r.id} className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs" style={{ color: T.muted }}>{new Date(r.createdAt).toLocaleDateString("it-IT")}</span>
                    <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: T.ink }}>{r.message}</p>
                  {r.reply && (
                    <p className="text-sm mt-2 pl-3 whitespace-pre-wrap" style={{ color: T.muted, borderLeft: `3px solid ${T.cardBorder}` }}>
                      <span className="font-semibold" style={{ color: T.sageDark }}>Risposta dell'agenzia:</span> {r.reply}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!isSigned && (
        <>
          {/* Proponi una modifica */}
          <section className="mt-6">
            {proposing ? (
              <div className="rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
                <p className="font-semibold mb-2" style={{ color: T.ink }}>Cosa vorresti cambiare?</p>
                <textarea value={proposal} onChange={(e) => { setProposal(e.target.value); setProposalErr(null); }}
                  rows={4} placeholder="Descrivi la modifica che proponi (es. il punto del contratto e come lo cambieresti)…"
                  className="w-full resize-y rounded-xl px-3 py-3 text-sm focus:outline-none"
                  style={{ background: T.cream, border: `2px solid ${T.cardBorder}`, color: T.ink }} />
                {proposalErr && <p className="text-sm mt-1 text-red-600">{proposalErr}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => void sendProposal()} disabled={proposalBusy || !proposal.trim()}
                    className="flex-1 py-2.5 rounded-xl text-white font-bold disabled:opacity-50" style={{ background: T.sage }}>
                    {proposalBusy ? "Invio…" : "Invia proposta"}
                  </button>
                  <button onClick={() => { setProposing(false); setProposal(""); }} className="px-4 py-2.5 rounded-xl font-semibold" style={{ border: `2px solid ${T.cardBorder}`, color: T.muted }}>
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setProposing(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold"
                style={{ border: `2px dashed ${T.cardBorder}`, color: T.sageDark, background: T.sageSoft }}>
                <MessageSquarePlus size={17} /> Proponi una modifica
              </button>
            )}
          </section>

          {/* Firma */}
          <section className="mt-6 rounded-2xl p-5" style={{ background: T.card, border: `1px solid ${T.cardBorder}` }}>
            <h2 className="text-lg font-bold mb-1" style={{ color: T.ink }}>Accetta e firma</h2>
            {pendingRequests > 0 ? (
              <p className="text-sm" style={{ color: T.muted }}>
                Hai {pendingRequests === 1 ? "una proposta di modifica" : `${pendingRequests} proposte di modifica`} in attesa di risposta: potrai firmare quando l'agenzia avrà risposto.
              </p>
            ) : (
              <>
                <p className="text-sm mb-4" style={{ color: T.muted }}>
                  Scrivi il tuo nome e cognome e conferma le due caselle. La firma registra data, indirizzo IP e l'impronta del testo accettato.
                </p>
                <input value={fullName} onChange={(e) => { setFullName(e.target.value); setSignErr(null); }}
                  placeholder="Nome e cognome del firmatario"
                  className="w-full rounded-xl px-3 py-3 text-base focus:outline-none mb-3"
                  style={{ background: T.cream, border: `2px solid ${T.cardBorder}`, color: T.ink }} />
                <label className="flex items-start gap-2.5 mb-2 text-sm" style={{ color: T.ink }}>
                  <input type="checkbox" checked={acceptContract} onChange={(e) => setAcceptContract(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6d8150]" />
                  <span>Dichiaro di aver letto e di <strong>accettare integralmente il contratto</strong> sopra riportato.</span>
                </label>
                <label className="flex items-start gap-2.5 mb-4 text-sm" style={{ color: T.ink }}>
                  <input type="checkbox" checked={acceptVexatious} onChange={(e) => setAcceptVexatious(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#6d8150]" />
                  <span><strong>Approvo specificamente</strong>, ai sensi degli artt. 1341-1342 c.c., le clausole indicate nell'apposito elenco in calce al contratto.</span>
                </label>
                {signErr && <p className="text-sm mb-3 text-red-600">{signErr}</p>}
                <button onClick={() => void sign()} disabled={signBusy || !acceptContract || !acceptVexatious || fullName.trim().length < 5}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white text-lg font-bold disabled:opacity-50 active:scale-[.99] transition-transform"
                  style={{ background: T.sage }}>
                  {signBusy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Firma il contratto
                </button>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
