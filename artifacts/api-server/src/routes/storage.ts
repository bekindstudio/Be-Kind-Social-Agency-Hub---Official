import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody } from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/supabaseStorage";
import { getUserId } from "../lib/access-control";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/storage/drive/status", async (req: Request, res: Response) => {
  const uid = getUserId(req as any);
  if (!uid) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }
  const enabled = ["1", "true", "yes", "on"].includes((process.env.GOOGLE_DRIVE_SYNC_ENABLED ?? "").trim().toLowerCase());
  const rootFolderConfigured = Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim());
  const serviceAccountConfigured = Boolean(
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim(),
  );
  const sections = (process.env.GOOGLE_DRIVE_SYNC_SECTIONS ?? "files")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  res.json({
    enabled,
    rootFolderConfigured,
    serviceAccountConfigured,
    sections,
    ready: enabled && rootFolderConfigured && serviceAccountConfigured,
  });
});

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const uid = getUserId(req as any);
  if (!uid) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { uploadURL, objectPath } = await objectStorageService.createUpload();
    res.json({ uploadURL, objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve a private object from Supabase Storage. The portal is an internal team
 * workspace where files are shared, so any authenticated user may read; the
 * service-role client (which bypasses RLS) fetches the bytes server-side and we
 * stream them back same-origin. Pass `?download=<name>` to force a download
 * with that filename.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      res.status(401).json({ error: "Non autenticato" });
      return;
    }

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const { buffer, contentType } = await objectStorageService.getObjectBytes(objectPath);

    const downloadName = typeof req.query.download === "string" ? req.query.download : null;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (downloadName) {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(downloadName).replace(/%20/g, " ")}"`,
      );
    }
    res.status(200).send(buffer);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
