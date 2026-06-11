import crypto from "crypto";
import { findUserByUuid } from "@/models/user";
import { User } from "@/types/user";

export interface MpTokenPayload {
  user_uuid: string;
  openid?: string;
  iat: number;
  exp: number;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function getMpTokenSecret(): string {
  const secret = process.env.MP_TOKEN_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("MP_TOKEN_SECRET or AUTH_SECRET is not configured");
  }
  return secret;
}

export function createMpToken(payload: Omit<MpTokenPayload, "iat" | "exp">, maxAgeSeconds = 30 * 24 * 60 * 60): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: MpTokenPayload = {
    ...payload,
    iat: now,
    exp: now + maxAgeSeconds,
  };

  const payloadPart = base64url(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac("sha256", getMpTokenSecret())
    .update(payloadPart)
    .digest();

  return `${payloadPart}.${base64url(signature)}`;
}

export function verifyMpToken(token: string): MpTokenPayload | null {
  try {
    const [payloadPart, signaturePart] = token.split(".");
    if (!payloadPart || !signaturePart) return null;

    const expectedSignature = base64url(
      crypto.createHmac("sha256", getMpTokenSecret()).update(payloadPart).digest()
    );

    const provided = Buffer.from(signaturePart);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const payload = JSON.parse(fromBase64url(payloadPart).toString("utf8")) as MpTokenPayload;
    if (!payload.user_uuid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getMpBearerToken(req: Request): string {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.replace("Bearer ", "").trim();
}

export async function getMpUser(req: Request): Promise<User | null> {
  const token = getMpBearerToken(req);
  if (!token) return null;

  const payload = verifyMpToken(token);
  if (!payload) return null;

  return (await findUserByUuid(payload.user_uuid)) || null;
}
