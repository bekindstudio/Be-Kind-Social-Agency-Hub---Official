import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, filesTable, projectsTable } from "@workspace/db";
import {
  CreateFileBody,
  DeleteFileParams,
  ListFilesQueryParams,
} from "@workspace/api-zod";
import { syncFileToGoogleDrive } from "../lib/googleDriveSync";
import { ObjectStorageService } from "../lib/supabaseStorage";
import { getUserId, isEnvAdmin, getAccessibleClientIds } from "../lib/access-control";

const router: IRouter = Router();

// Login obbligatorio su tutti gli endpoint file (path scopato).
router.use("/files", (req, res, next) => {
  if (!getUserId(req)) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
});

/** True se l'utente può accedere al cliente del progetto indicato (file → progetto → cliente). */
async function canAccessProjectClient(userId: string | null | undefined, projectId: number | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (isEnvAdmin(userId)) return true;
  const accessible = await getAccessibleClientIds(userId);
  if (accessible === "all") return true;
  if (projectId == null) return true; // file interno senza progetto → team
  const [p] = await db.select({ clientId: projectsTable.clientId }).from(projectsTable).where(eq(projectsTable.id, projectId));
  const cid = p?.clientId ?? null;
  return cid == null || accessible.includes(cid);
}

router.get("/files", async (req, res): Promise<void> => {
  const query = ListFilesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const files = await db.select().from(filesTable).orderBy(filesTable.createdAt);
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const projectClientMap = new Map(projects.map((p) => [p.id, p.clientId ?? null]));

  // Autorizzazione per-cliente: un file appartiene a un cliente tramite il progetto.
  // I file senza progetto sono "interni" e restano visibili al team.
  const userId = getUserId(req);
  const accessible = isEnvAdmin(userId) ? ("all" as const) : await getAccessibleClientIds(userId as string);
  const accessibleFiles = accessible === "all"
    ? files
    : files.filter((f) => {
        const cid = f.projectId != null ? projectClientMap.get(f.projectId) ?? null : null;
        return cid == null || accessible.includes(cid);
      });

  let result = accessibleFiles.map((f) => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    projectName: f.projectId ? (projectMap.get(f.projectId) ?? null) : null,
  }));

  if (query.data.projectId != null) {
    result = result.filter((f) => f.projectId === query.data.projectId);
  }

  res.json(result);
});

router.post("/files", async (req, res): Promise<void> => {
  const parsed = CreateFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(await canAccessProjectClient(getUserId(req), parsed.data.projectId ?? null))) {
    res.status(403).json({ error: "Accesso negato al progetto" });
    return;
  }
  const [file] = await db.insert(filesTable).values(parsed.data).returning();
  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  // Best effort sync to Google Drive for cloud backup.
  // This must never block primary app flow.
  let driveSync: { synced: boolean; driveFileId?: string; reason?: string } | null = null;
  try {
    driveSync = await syncFileToGoogleDrive({
      fileName: file.name,
      objectUrl: file.url,
      projectId: file.projectId ?? null,
      section: "files",
    });
  } catch (err) {
    req.log.warn({ err, fileId: file.id }, "Google Drive sync failed");
    driveSync = { synced: false, reason: "sync-error" };
  }

  res.status(201).json({
    ...file,
    projectName: file.projectId ? (projectMap.get(file.projectId) ?? null) : null,
    driveSync,
  });
});

router.delete("/files/:id", async (req, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db.select().from(filesTable).where(eq(filesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  if (!(await canAccessProjectClient(getUserId(req), existing.projectId ?? null))) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }
  const [file] = await db.delete(filesTable).where(eq(filesTable.id, params.data.id)).returning();
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  // Best-effort: drop the backing object from storage when it was an uploaded file
  // (external link rows have no object to remove). Never blocks the response.
  if (file.url.startsWith("/api/storage/objects/")) {
    const objectPath = file.url.replace("/api/storage", "");
    void new ObjectStorageService().deleteObject(objectPath);
  }

  res.sendStatus(204);
});

export default router;
