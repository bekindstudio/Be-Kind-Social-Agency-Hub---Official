import { JWT } from "google-auth-library";
import { ObjectStorageService } from "./objectStorage";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

const projectFolderCache = new Map<number, string>();

function isTruthyEnv(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function isSectionEnabled(section: string): boolean {
  const raw = process.env.GOOGLE_DRIVE_SYNC_SECTIONS?.trim();
  if (!raw) return true;
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return allowed.has(section.toLowerCase());
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
  if (!email || !privateKey) {
    throw new Error("Google Drive service account non configurato");
  }
  const auth = new JWT({
    email,
    key: normalizePrivateKey(privateKey),
    scopes: [DRIVE_SCOPE],
  });
  const tokenResult = await auth.getAccessToken();
  const token = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!token) throw new Error("Impossibile ottenere access token Google Drive");
  return token;
}

async function driveJson<T>(token: string, url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Drive API error ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

async function ensureProjectFolder(token: string, rootFolderId: string, projectId: number | null): Promise<string> {
  if (!projectId) return rootFolderId;
  const cached = projectFolderCache.get(projectId);
  if (cached) return cached;

  const folderName = `project-${projectId}`;
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = [
    `name='${escapedName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    `'${rootFolderId}' in parents`,
    "trashed=false",
  ].join(" and ");

  type DriveList = { files?: Array<{ id: string }> };
  const list = await driveJson<DriveList>(
    token,
    `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { method: "GET" },
  );
  const existing = list.files?.[0]?.id;
  if (existing) {
    projectFolderCache.set(projectId, existing);
    return existing;
  }

  type DriveFile = { id: string };
  const created = await driveJson<DriveFile>(token, `${DRIVE_API_BASE}/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootFolderId],
    }),
  });
  projectFolderCache.set(projectId, created.id);
  return created.id;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 180);
}

export async function syncFileToGoogleDrive(opts: {
  fileName: string;
  objectUrl: string;
  projectId: number | null;
  section: string;
}): Promise<{ synced: boolean; driveFileId?: string; reason?: string }> {
  if (!isTruthyEnv(process.env.GOOGLE_DRIVE_SYNC_ENABLED)) {
    return { synced: false, reason: "sync-disabled" };
  }
  if (!isSectionEnabled(opts.section)) {
    return { synced: false, reason: "section-not-enabled" };
  }
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (!rootFolderId) {
    return { synced: false, reason: "missing-root-folder" };
  }
  if (!opts.objectUrl.startsWith("/api/storage/objects/")) {
    return { synced: false, reason: "not-object-storage-file" };
  }

  const objectPath = opts.objectUrl.replace("/api/storage", "");
  const objectStorage = new ObjectStorageService();
  const objectFile = await objectStorage.getObjectEntityFile(objectPath);
  const [content] = await objectFile.download();

  const token = await getAccessToken();
  const parentFolderId = await ensureProjectFolder(token, rootFolderId, opts.projectId);

  type DriveFile = { id: string };
  const created = await driveJson<DriveFile>(token, `${DRIVE_API_BASE}/files?supportsAllDrives=true&fields=id`, {
    method: "POST",
    body: JSON.stringify({
      name: sanitizeFileName(opts.fileName),
      parents: [parentFolderId],
    }),
  });

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_BASE}/files/${created.id}?uploadType=media&supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body: content,
    },
  );
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`Upload Google Drive fallito ${uploadRes.status}: ${text.slice(0, 300)}`);
  }

  return { synced: true, driveFileId: created.id };
}
