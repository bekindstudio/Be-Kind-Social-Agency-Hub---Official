import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Supabase Storage backend for portal file uploads.
 *
 * Replaces the previous Replit-sidecar / Google Cloud Storage implementation.
 * All access goes through the service-role admin client (which bypasses RLS),
 * so the bucket is kept private and is only ever touched by the authenticated
 * Express endpoints in `routes/storage.ts`.
 *
 * Object path contract (unchanged from the GCS version, so DB rows and the
 * frontend keep working):
 *   - storage key inside the bucket:  `uploads/<uuid>`
 *   - "objectPath" stored/sent around: `/objects/uploads/<uuid>`
 *   - public URL the client uses:      `/api/storage/objects/uploads/<uuid>`
 */

const DEFAULT_BUCKET = "portal-files";

export function getBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Memoized so we only hit the list/create endpoints once per warm instance.
let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const admin = getSupabaseAdmin();
    const bucket = getBucketName();
    const { data: existing, error: getErr } = await admin.storage.getBucket(bucket);
    if (existing && !getErr) return;

    const { error: createErr } = await admin.storage.createBucket(bucket, {
      public: false,
    });
    if (createErr) {
      // Another concurrent invocation may have just created it — tolerate that.
      const { data: recheck } = await admin.storage.getBucket(bucket);
      if (!recheck) {
        bucketReady = null; // allow a later retry
        throw new Error(`Impossibile creare il bucket '${bucket}': ${createErr.message}`);
      }
    }
  })();
  return bucketReady;
}

/** `/objects/uploads/<id>` (or a raw `uploads/<id>`) -> `uploads/<id>` storage key. */
function objectPathToStorageKey(objectPath: string): string {
  let p = objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
  if (p.startsWith("objects/")) p = p.slice("objects/".length);
  if (!p || p.includes("..")) {
    throw new ObjectNotFoundError();
  }
  return p;
}

export class ObjectStorageService {
  /**
   * Create a one-shot signed upload URL the browser PUTs the file to directly,
   * keeping large uploads off the Vercel Function (4.5 MB request-body limit).
   * Returns the same `{ uploadURL, objectPath }` shape the previous impl did.
   */
  async createUpload(): Promise<{ uploadURL: string; objectPath: string }> {
    await ensureBucket();
    const admin = getSupabaseAdmin();
    const bucket = getBucketName();
    const storageKey = `uploads/${randomUUID()}`;

    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUploadUrl(storageKey);
    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
    }

    return { uploadURL: data.signedUrl, objectPath: `/objects/${storageKey}` };
  }

  /** Download the raw bytes of an object (used by the API download route and Drive sync). */
  async getObjectBytes(
    objectPath: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const admin = getSupabaseAdmin();
    const bucket = getBucketName();
    const storageKey = objectPathToStorageKey(objectPath);

    const { data, error } = await admin.storage.from(bucket).download(storageKey);
    if (error || !data) {
      throw new ObjectNotFoundError();
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const contentType = data.type || "application/octet-stream";
    return { buffer, contentType };
  }

  /** Best-effort removal of a stored object. Never throws. */
  async deleteObject(objectPath: string): Promise<void> {
    try {
      const admin = getSupabaseAdmin();
      const bucket = getBucketName();
      const storageKey = objectPathToStorageKey(objectPath);
      await admin.storage.from(bucket).remove([storageKey]);
    } catch {
      // swallow — deletion is best-effort cleanup
    }
  }
}
