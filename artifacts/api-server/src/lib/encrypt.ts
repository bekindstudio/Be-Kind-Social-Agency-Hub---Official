import crypto from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY non configurata. " +
      "Generala con: " +
      "node -e \"console.log(require('crypto')" +
      ".randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(key, "hex");
}

const KEY_VERSION =
  process.env.TOKEN_ENCRYPTION_KEY_VERSION || "1";

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    KEY_VERSION,
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decrypt(data: string): string {
  const key = getKey();
  const parts = data.split(":");
  const [_keyVersion, ivHex, tagHex, encHex] =
    parts.length === 4
      ? parts
      : ["legacy", ...parts];

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return (
    decipher.update(enc).toString("utf8") +
    decipher.final("utf8")
  );
}

export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 4 || parts.length === 3;
}
