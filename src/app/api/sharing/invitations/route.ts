import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invitationEmailSettings, sendPlayerInvitation } from "@/lib/email/invitationEmail";

export const runtime = "nodejs";
export const maxDuration = 30;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ error: "Confirm your email first." }, { status: 403 });
  let body: { action?: string; playerId?: string; email?: string; invitationId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || !["create", "resend"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "Invalid invitation action." }, { status: 400 });
  }
  let invitationId: string;
  if (body.action === "create") {
    if (typeof body.playerId !== "string" || !uuid.test(body.playerId) || typeof body.email !== "string" || body.email.length > 254) {
      return NextResponse.json({ error: "Choose a player and enter a valid email." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("hockey_invite_parent", { p_player: body.playerId, p_email: body.email.trim() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invitationId = data as string;
  } else {
    if (typeof body.invitationId !== "string" || !uuid.test(body.invitationId)) return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });
    invitationId = body.invitationId;
  }
  const { data: claim, error: claimError } = await supabase.rpc("hockey_claim_invitation_email", { p_invitation: invitationId });
  if (claimError) {
    const migrationMissing = ["PGRST202", "42883"].includes(claimError.code);
    return NextResponse.json({ invitationId, created: body.action === "create", emailSent: false,
      message: migrationMissing ? "Invitation email setup is incomplete. Apply the email migration; the invitation is saved." : claimError.message,
    }, { status: body.action === "create" ? 200 : 400 });
  }
  const input = claim as { attempt_id: string; email: string; player_name: string; expires_at: string };
  let providerId: string | null = null;
  let sent = false;
  let message = "Invitation saved. Email could not be sent. Check your email settings, then use Resend Email.";
  try {
    invitationEmailSettings();
    const name = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "A parent";
    providerId = await sendPlayerInvitation({ to: input.email, playerName: input.player_name, inviterName: name, expiresAt: input.expires_at, invitationId });
    sent = true;
    message = "Invitation email sent. They can open it and accept after signing in.";
  } catch {
    // Keep the saved invitation; an uncertain network result may still have sent.
    message = "Invitation saved. Email delivery could not be confirmed. Check SMTP2GO activity before retrying with Resend Email.";
  }
  const { error: finishError } = await supabase.rpc("hockey_finish_invitation_email", { p_attempt: input.attempt_id, p_sent: sent, p_provider_id: providerId });
  if (finishError && sent) message = "Email sent, but its status could not be saved. Check SMTP2GO activity before resending.";
  return NextResponse.json({ invitationId, created: body.action === "create", emailSent: sent, message });
}
