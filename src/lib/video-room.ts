import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Vonage } from "@vonage/server-sdk";

const ttl = 2 * 60 * 60;

export async function videoClient() {
  const applicationId = process.env.VONAGE_APPLICATION_ID;
  const path = process.env.VONAGE_PRIVATE_KEY_PATH;
  if (!applicationId || !path) throw new Error("Vonage Video no está configurado.");
  const privateKey = await readFile(path, "utf8");
  return { applicationId, client: new Vonage({ applicationId, privateKey }) };
}

function secret() {
  const value = process.env.VONAGE_API_SECRET;
  if (!value) throw new Error("Falta el secreto de sala.");
  return value;
}

export function makeRoomTicket(sessionId: string) {
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const payload = Buffer.from(JSON.stringify({ sessionId, expiry })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function parseRoomTicket(ticket: string) {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature || payload.length > 4096) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data !== "object" || data === null || !("sessionId" in data) || !("expiry" in data) || typeof data.sessionId !== "string" || typeof data.expiry !== "number" || data.expiry < Math.floor(Date.now() / 1000)) return null;
    return data.sessionId;
  } catch { return null; }
}
