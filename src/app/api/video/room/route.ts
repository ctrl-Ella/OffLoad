import { MediaMode } from "@vonage/video";
import { NextRequest, NextResponse } from "next/server";
import { makeRoomTicket, parseRoomTicket, videoClient } from "@/lib/video-room";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let input: unknown;
  try { input = await request.json(); } catch { input = {}; }
  const ticket = typeof input === "object" && input !== null && "ticket" in input && typeof input.ticket === "string" ? input.ticket : undefined;
  const name = typeof input === "object" && input !== null && "name" in input && typeof input.name === "string" ? input.name.slice(0, 40) : "Invitado";
  try {
    const { applicationId, client } = await videoClient();
    let sessionId: string;
    let roomTicket = ticket;
    if (ticket) {
      const parsed = parseRoomTicket(ticket);
      if (!parsed) return NextResponse.json({ error: "El enlace de la llamada ha caducado o no es válido." }, { status: 400 });
      sessionId = parsed;
    } else {
      const session = await client.video.createSession({ mediaMode: MediaMode.ROUTED });
      sessionId = session.sessionId;
      roomTicket = makeRoomTicket(sessionId);
    }
    const token = client.video.generateClientToken(sessionId, { role: "publisher", expireTime: Math.floor(Date.now() / 1000) + 60 * 60, data: `name=${name.replace(/[=&]/g, "")}` });
    return NextResponse.json({ applicationId, sessionId, token, ticket: roomTicket }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error && /configurado|secreto/.test(error.message) ? error.message : "No se pudo abrir la sala de Vonage.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
