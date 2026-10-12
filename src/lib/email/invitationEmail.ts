import "server-only";

type EmailInput = { to: string; playerName: string; inviterName: string; expiresAt: string };
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}
export function invitationEmailSettings() {
  const apiKey = process.env.SMTP2GO_API_KEY?.trim();
  const sender = process.env.HOCKEYOPS_EMAIL_FROM?.trim();
  const site = new URL(process.env.HOCKEYOPS_SITE_URL || "https://hockeyops.judcotech.com");
  if (!apiKey || !sender || /[\r\n]/.test(sender)) throw new Error("Invitation email is not configured.");
  if (site.protocol !== "https:" && !(site.protocol === "http:" && ["localhost", "127.0.0.1"].includes(site.hostname))) {
    throw new Error("Invalid invitation site URL.");
  }
  if (site.username || site.password) throw new Error("Invalid invitation site URL.");
  return { apiKey, sender, url: new URL("/sharing", site.origin).toString() };
}

export async function sendPlayerInvitation(input: EmailInput): Promise<string | null> {
  const { apiKey, sender, url } = invitationEmailSettings();
  const player = input.playerName.replace(/[\r\n]/g, " ").slice(0, 160);
  const inviter = input.inviterName.replace(/[\r\n]/g, " ").slice(0, 100);
  const expires = new Date(input.expiresAt).toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const text = `${inviter} invited you to share ${player}'s profile in Hockey Ops.\n\nView performance, see game results, and enter games using your own account.\n\nOpen invitation: ${url}\n\nSign in or create an account using ${input.to}, confirm your email, then choose Accept. This invitation expires ${expires}.\n\nIf you weren't expecting this invitation, you can ignore it.\nHockey Ops · JudcoTech`;
  const html = `<div style="background:#06152d;padding:32px 16px;font-family:Arial,sans-serif"><div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;padding:28px"><p style="color:#64748b;font-size:12px;font-weight:bold;letter-spacing:2px">HOCKEY OPS</p><h1 style="color:#06152d;font-size:26px">You're invited to share a player</h1><p>${escapeHtml(inviter)} invited you to share <strong>${escapeHtml(player)}</strong>'s profile.</p><p>View performance, see game results, and enter games using your own account.</p><p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#06152d;color:white;padding:14px 22px;border-radius:10px;text-decoration:none;display:inline-block">Open Invitation</a></p><p>Sign in or create an account using <strong>${escapeHtml(input.to)}</strong>, confirm your email, then choose <strong>Accept</strong>.</p><p style="color:#64748b;font-size:13px">Expires ${escapeHtml(expires)}. If you weren't expecting this invitation, you can ignore it.</p><p style="color:#64748b;font-size:12px">Hockey Ops · JudcoTech</p></div></div>`;
  const response = await fetch("https://api.smtp2go.com/v3/email/send", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": apiKey },
    body: JSON.stringify({ sender, to: [input.to], subject: `You're invited to share ${player} in Hockey Ops`, text_body: text, html_body: html }),
  });
  const payload = await response.json() as { data?: { succeeded?: number; failed?: number; failures?: unknown[]; error?: string; email_id?: string } };
  if (!response.ok || payload.data?.succeeded !== 1 || payload.data.failed !== 0 || payload.data.error || payload.data.failures?.length) {
    // Do not expose raw provider replies (which can include addresses or configuration).
    throw new Error("The email provider did not accept this invitation.");
  }
  return payload.data.email_id || null;
}
