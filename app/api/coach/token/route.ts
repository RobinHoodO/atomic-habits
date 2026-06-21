import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Mints a short-lived WebRTC conversation token for the ElevenLabs coach.
// The API key stays server-side; only the token reaches the browser.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.COACH_AGENT_ID;
  if (!key || !agentId) {
    return NextResponse.json({ error: "coach not configured" }, { status: 500 });
  }

  const r = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
    { headers: { "xi-api-key": key } },
  );
  if (!r.ok) {
    return NextResponse.json({ error: "token request failed" }, { status: 502 });
  }
  const { token } = await r.json();
  if (!token) {
    return NextResponse.json({ error: "no token from upstream" }, { status: 502 });
  }
  return NextResponse.json({ token });
}
