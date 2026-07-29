export type Slot = {
  id: number;
  planId: number;
  platform: string;
  contentType: string;
  publishDate: string | null;
  title: string | null;
  caption: string | null;
  script: string | null;
  visualUrl: string | null;
  visualDescription: string | null;
  status: string;
};
export type Plan = { id: number; month: number; year: number; status: string; packageType: string | null };
export type EditorialData = { plans: Plan[]; slots: Slot[] };

export type TopPost = { thumbnailUrl?: string; mediaUrl?: string; permalink?: string; caption?: string; likes?: number; comments?: number; reach?: number };
export type Report = {
  id: number | string;
  titolo: string;
  period: string | null;
  periodoInizio: string | null;
  periodoFine: string | null;
  status: string;
  riepilogoEsecutivo: string | null;
  analisiInsights: string | null;
  strategiaProssimoPeriodo: string | null;
  kpiSocial: Record<string, unknown> | null;
  kpiMeta: Record<string, unknown> | null;
  kpiGoogle: Record<string, unknown> | null;
  topContenuti: TopPost[] | null;
  pdfUrl: string | null;
  createdAt: string | null;
};

export type Idea = {
  id: number | string; title: string; url: string; platform: string;
  source: string; status: string; category: string | null; notes: string | null; createdAt: string | null;
};
export type PortalEvent = {
  id: string; title: string; date: string; endDate: string | null; type: string; priority: string; note: string | null;
};
export type FileItem = { id: string; name: string; url: string; type: string; createdAt: string | null };
export type FilesData = { driveUrl: string | null; files: FileItem[] };
