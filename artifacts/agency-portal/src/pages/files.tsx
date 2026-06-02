import { useEffect, useMemo, useState } from "react";
import {
  useListFiles,
  useListProjects,
  useCreateFile,
  useDeleteFile,
  getListFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ExternalLink, FileText, Image, FileSpreadsheet, File, X, Search } from "lucide-react";
import { formatDate, formatFileSize } from "@/lib/utils";
import { usePortalUser } from "@/hooks/usePortalUser";
import { useClientContext } from "@/context/ClientContext";

function FileIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("webp") || t.includes("gif") || t.includes("immagine")) return <Image size={20} className="text-pink-500" />;
  if (t.includes("spreadsheet") || t.includes("xlsx") || t.includes("csv") || t.includes("xls")) return <FileSpreadsheet size={20} className="text-emerald-500" />;
  if (t.includes("pdf")) return <FileText size={20} className="text-red-500" />;
  if (t.includes("video") || t.includes("mp4") || t.includes("mov") || t.includes("avi")) return <File size={20} className="text-purple-500" />;
  return <File size={20} className="text-blue-500" />;
}

export default function Files() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeClient } = useClientContext();
  const activeClientNumericId = activeClient?.id ? Number(activeClient.id) : NaN;
  const apiClientId = Number.isFinite(activeClientNumericId) ? activeClientNumericId : null;
  const [filterProject, setFilterProject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlForm, setUrlForm] = useState({ name: "", url: "", type: "Documento", projectId: "" });
  const listFilesQueryParams = filterProject ? { projectId: Number(filterProject) } : {};
  const { data: files, isLoading } = useListFiles(listFilesQueryParams);
  const { data: projects } = useListProjects(apiClientId != null ? { clientId: apiClientId } : {});
  const createFile = useCreateFile();
  const deleteFile = useDeleteFile();
  const { user } = usePortalUser();

  const projectList = Array.isArray(projects)
    ? projects
    : // @ts-expect-error runtime safety for unknown API shape
      Array.isArray(projects?.items)
      ? // @ts-expect-error runtime safety for unknown API shape
        projects.items
      : projects
        ? [projects as any]
        : [];

  const scopedProjectList = useMemo(() => {
    if (!activeClient) return projectList;
    const activeName = activeClient.name.trim().toLowerCase();
    const byName = projectList.filter((p: any) => String(p?.clientName ?? "").trim().toLowerCase() === activeName);
    return byName.length > 0 ? byName : projectList;
  }, [activeClient, projectList]);
  const scopedProjectIds = useMemo(
    () => new Set(scopedProjectList.map((p: any) => Number(p?.id)).filter((id: number) => Number.isFinite(id))),
    [scopedProjectList]
  );

  useEffect(() => {
    if (!filterProject) return;
    if (!scopedProjectList.some((p: any) => String(p?.id) === filterProject)) {
      setFilterProject("");
    }
  }, [filterProject, scopedProjectList]);

  const filtered = (files ?? [])
    .filter((f) => scopedProjectIds.size === 0 || (f.projectId != null && scopedProjectIds.has(Number(f.projectId))))
    .filter((f) => !filterProject || String(f.projectId) === filterProject)
    .filter((f) => !searchQuery || String(f?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()));

  const uploaderName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Utente";

  const handleUrlCreate = () => {
    const name = urlForm.name.trim();
    const rawUrl = urlForm.url.trim();
    if (!name || !rawUrl) {
      toast({ variant: "destructive", title: "Campi obbligatori", description: "Nome e URL sono entrambi richiesti." });
      return;
    }
    // Aggiunge protocollo http:// se l'utente ha incollato un dominio nudo,
    // e blocca URL chiaramente non navigabili (es. "blah blah").
    let normalizedUrl = rawUrl;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    try {
      new URL(normalizedUrl);
    } catch {
      toast({ variant: "destructive", title: "URL non valido", description: "Inserisci un link valido (es. https://drive.google.com/...)." });
      return;
    }
    createFile.mutate(
      { data: { name, url: normalizedUrl, type: urlForm.type, size: null, projectId: urlForm.projectId ? Number(urlForm.projectId) : null, uploadedBy: uploaderName } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListFilesQueryKey() });
          setShowUrlForm(false);
          setUrlForm({ name: "", url: "", type: "Documento", projectId: "" });
          toast({ title: "Link aggiunto" });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Salvataggio non riuscito", description: err?.message ?? "Riprova." });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare questo link?")) return;
    deleteFile.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListFilesQueryKey() }) });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Link & File esterni</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {files?.length ?? 0} link condivisi · per upload binari usa Google Drive del cliente
            </p>
          </div>
          <button onClick={() => setShowUrlForm(!showUrlForm)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <ExternalLink size={16} />
            Collega URL esterno
          </button>
        </div>

        {showUrlForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Aggiungi link esterno</h2>
              <button onClick={() => setShowUrlForm(false)} className="p-1 text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nome del file/link" value={urlForm.name} onChange={(e) => setUrlForm({ ...urlForm, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">URL *</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="https://..." value={urlForm.url} onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={urlForm.type} onChange={(e) => setUrlForm({ ...urlForm, type: e.target.value })}>
                  <option>Documento</option>
                  <option>PDF</option>
                  <option>Immagine</option>
                  <option>Spreadsheet</option>
                  <option>Video</option>
                  <option>Altro</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Progetto</label>
                <select className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background" value={urlForm.projectId} onChange={(e) => setUrlForm({ ...urlForm, projectId: e.target.value })}>
                  <option value="">Nessun progetto</option>
                  {scopedProjectList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleUrlCreate} disabled={createFile.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">Aggiungi</button>
              <button onClick={() => setShowUrlForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
            </div>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Cerca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">Tutti i progetti</option>
            {scopedProjectList.map((p: any) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <ExternalLink size={40} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium">Nessun link trovato</p>
            <p className="text-xs mt-1">Collega URL esterni (Google Drive, Canva, Notion, Figma…) con il pulsante in alto a destra.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((f) => (
              <div key={f.id} className="bg-card border border-card-border rounded-xl p-4 shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileIcon type={f.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{f.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{f.type}</span>
                    {f.size != null && <span className="text-xs text-muted-foreground">· {formatFileSize(f.size)}</span>}
                    {f.projectName && <span className="text-xs text-primary">· {f.projectName}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{f.uploadedBy}</span>
                  <span>{formatDate(f.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Apri">
                    <ExternalLink size={15} />
                  </a>
                  <button onClick={() => handleDelete(f.id)} className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" title="Elimina">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
