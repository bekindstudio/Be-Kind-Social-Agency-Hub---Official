import { useState, useRef } from "react";
import {
  useListFiles,
  useListProjects,
  useCreateFile,
  useDeleteFile,
  getListFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Plus, Trash2, ExternalLink, FileText, Image, FileSpreadsheet, File, Upload, X, Download, Search } from "lucide-react";
import { cn, formatDate, formatFileSize } from "@/lib/utils";
import { usePortalUser } from "@/hooks/usePortalUser";
import { portalFetch } from "@workspace/api-client-react";

function FileIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg") || t.includes("webp") || t.includes("gif") || t.includes("immagine")) return <Image size={20} className="text-pink-500" />;
  if (t.includes("spreadsheet") || t.includes("xlsx") || t.includes("csv") || t.includes("xls")) return <FileSpreadsheet size={20} className="text-emerald-500" />;
  if (t.includes("pdf")) return <FileText size={20} className="text-red-500" />;
  if (t.includes("video") || t.includes("mp4") || t.includes("mov") || t.includes("avi")) return <File size={20} className="text-purple-500" />;
  return <File size={20} className="text-blue-500" />;
}

function detectFileType(name: string, mime: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg"].includes(ext)) return "Immagine";
  if (mime === "application/pdf" || ext === "pdf") return "PDF";
  if (mime.includes("spreadsheet") || ["xlsx","xls","csv"].includes(ext)) return "Spreadsheet";
  if (mime.includes("video") || ["mp4","mov","avi","webm"].includes(ext)) return "Video";
  if (mime.includes("presentation") || ["pptx","ppt"].includes(ext)) return "Presentazione";
  return "Documento";
}

export default function Files() {
  const qc = useQueryClient();
  const { data: files, isLoading } = useListFiles({});
  const { data: projects } = useListProjects({});
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

  const [filterProject, setFilterProject] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlForm, setUrlForm] = useState({ name: "", url: "", type: "Documento", projectId: "" });
  const [selectedProjectForUpload, setSelectedProjectForUpload] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = (files ?? [])
    .filter((f) => !filterProject || String(f.projectId) === filterProject)
    .filter((f) => !searchQuery || String(f?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()));

  const uploaderName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Utente";

  const handleUpload = async (fileList: FileList) => {
    if (fileList.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    const total = fileList.length;
    let completed = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const reqRes = await portalFetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (!reqRes.ok) throw new Error("Upload URL request failed");
        const { uploadURL, objectPath } = await reqRes.json();

        const uploadRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

        const fileUrl = `/api/storage/objects${objectPath}`;
        const fileType = detectFileType(file.name, file.type);

        await createFile.mutateAsync({
          data: {
            name: file.name,
            url: fileUrl,
            type: fileType,
            size: file.size,
            projectId: selectedProjectForUpload ? Number(selectedProjectForUpload) : null,
            uploadedBy: uploaderName,
          },
        });

        completed++;
        setUploadProgress(Math.round((completed / total) * 100));
      } catch (err) {
        console.error(`Upload error for ${file.name}:`, err);
      }
    }

    qc.invalidateQueries({ queryKey: getListFilesQueryKey() });
    setUploading(false);
    setUploadProgress(0);
    setSelectedProjectForUpload("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
  };

  const handleUrlCreate = () => {
    if (!urlForm.name.trim() || !urlForm.url.trim()) return;
    createFile.mutate(
      { data: { name: urlForm.name, url: urlForm.url, type: urlForm.type, size: null, projectId: urlForm.projectId ? Number(urlForm.projectId) : null, uploadedBy: uploaderName } },
      { onSuccess: () => { qc.invalidateQueries({ queryKey: getListFilesQueryKey() }); setShowUrlForm(false); setUrlForm({ name: "", url: "", type: "Documento", projectId: "" }); } }
    );
  };

  const handleDelete = (id: number) => {
    if (!confirm("Eliminare questo file?")) return;
    deleteFile.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListFilesQueryKey() }) });
  };

  const isObjectStorageUrl = (url: string) => url.startsWith("/api/storage/");

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">File</h1>
            <p className="text-muted-foreground text-sm mt-1">{files?.length ?? 0} file condivisi</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowUrlForm(!showUrlForm)} className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80 transition-opacity">
              <ExternalLink size={14} />
              Link esterno
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              <Upload size={16} />
              {uploading ? `Caricamento ${uploadProgress}%` : "Carica File"}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleUpload(e.target.files); e.target.value = ""; }}
        />

        {showUrlForm && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Aggiungi link esterno</h2>
              <button onClick={() => setShowUrlForm(false)} className="p-1 text-muted-foreground hover:text-foreground"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                <input className="w-full mt-1 px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nome file" value={urlForm.name} onChange={(e) => setUrlForm({ ...urlForm, name: e.target.value })} />
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
                  {projectList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleUrlCreate} disabled={createFile.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">Aggiungi</button>
              <button onClick={() => setShowUrlForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:opacity-80">Annulla</button>
            </div>
          </div>
        )}

        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 mb-6 text-center transition-colors cursor-pointer",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className={cn("mx-auto mb-3", dragOver ? "text-primary" : "text-muted-foreground/40")} />
          <p className="text-sm font-medium mb-1">{dragOver ? "Rilascia qui per caricare" : "Trascina i file qui o clicca per sfogliare"}</p>
          <p className="text-xs text-muted-foreground">Supporta qualsiasi tipo di file</p>
          {selectedProjectForUpload === "" && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <label className="text-xs text-muted-foreground">Progetto:</label>
              <select className="px-2 py-1 text-xs border border-input rounded bg-background" value={selectedProjectForUpload} onChange={(e) => setSelectedProjectForUpload(e.target.value)} onClick={(e) => e.stopPropagation()}>
                <option value="">Nessuno</option>
                {projectList.map((p: any) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {uploading && (
          <div className="mb-6">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">Caricamento in corso... {uploadProgress}%</p>
          </div>
        )}

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Cerca file..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <select className="px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">Tutti i progetti</option>
            {projectList.map((p: any) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <File size={40} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium">Nessun file trovato</p>
            <p className="text-xs mt-1">Carica il primo file trascinandolo qui sopra</p>
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
                    {isObjectStorageUrl(f.url) && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Caricato</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{f.uploadedBy}</span>
                  <span>{formatDate(f.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isObjectStorageUrl(f.url) ? (
                    <a href={f.url} download={f.name} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Scarica">
                      <Download size={15} />
                    </a>
                  ) : (
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Apri">
                      <ExternalLink size={15} />
                    </a>
                  )}
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
