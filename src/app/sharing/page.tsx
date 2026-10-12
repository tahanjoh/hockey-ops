"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string };
type Invite = { id: string; player_id: string; player_name: string; email: string; status: string; expires_at: string; membership_added?: boolean; email_status?: "not_sent" | "sending" | "sent" | "failed"; email_sent_at?: string | null };
type Context = { players: Player[]; incoming: Invite[]; outgoing: Invite[] };

export default function SharingPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [context, setContext] = useState<Context>({ players: [], incoming: [], outgoing: [] });
  const [playerId, setPlayerId] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const rawInvitation = new URLSearchParams(window.location.search).get("invitation");
        const validInvitation = rawInvitation && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawInvitation);
        router.replace(validInvitation ? `/invite?invitation=${encodeURIComponent(rawInvitation)}` : "/invite");
        return;
      }
      const { data, error } = await supabase.rpc("hockey_sharing_context");
      if (!active) return;
      if (error) {
        setMessage("Sharing is unavailable. Apply the player sharing migration, then refresh this page.");
      } else {
        const next = data as Context;
        const selectedInvitation = new URLSearchParams(window.location.search).get("invitation");
        if (selectedInvitation) {
          next.incoming = [...next.incoming].sort((a, b) => Number(b.id === selectedInvitation) - Number(a.id === selectedInvitation));
          if (!next.incoming.some(invite => invite.id === selectedInvitation)) {
            setMessage(`Signed in as ${user.email ?? "your account"}. This invitation may already be accepted, expired, or addressed to another email. View Players for accepted access, or switch accounts from the Players page.`);
          }
        }
        setContext(next);
        const requested = new URLSearchParams(window.location.search).get("player");
        setPlayerId(next.players.find(p => p.id === requested)?.id ?? next.players[0]?.id ?? "");
        setReady(true);
      }
    }
    void load().catch(() => { if (active) setMessage("Could not load sharing. Please refresh and try again."); });
    return () => { active = false; };
  }, [router, supabase]);

  async function mutate(name: string, args: Record<string, string>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      // Invitation emails are sent on the server.
      let actionMessage = success;
      if (name === "hockey_invite_parent" || name === "hockey_resend_invitation_email") {
        const response = await fetch("/api/sharing/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(name === "hockey_invite_parent"
            ? { action: "create", playerId: args.p_player, email: args.p_email }
            : { action: "resend", invitationId: args.p_invitation }),
        });
        const result = await response.json() as { message?: string; error?: string; created?: boolean };
        if (!response.ok) { setMessage(result.error || result.message || "Could not send the invitation."); return; }
        actionMessage = result.message || success;
        if (result.created) setEmail("");
      } else {
        const { error } = await supabase.rpc(name, args);
        if (error) { setMessage(error.message); return; }
      }
      if (name === "hockey_accept_invitation") {
        // Reload Players so newly granted membership appears immediately.
        window.location.assign("/");
        return;
      }
      const { data, error: refreshError } = await supabase.rpc("hockey_sharing_context");
      if (refreshError) { setMessage(`${actionMessage} Refresh the page to see the updated list.`); return; }
      const next = data as Context;
      setContext(next);
      setPlayerId(current => next.players.some(p => p.id === current) ? current : next.players[0]?.id ?? "");
      setMessage(actionMessage);
      if (name === "hockey_invite_parent") setEmail("");
      router.refresh();
    } catch { setMessage("Could not complete the request. Refresh to check its status before trying again."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto min-h-screen max-w-md px-4 py-6">
    <Link href="/" className="text-sm font-semibold underline">← Players</Link>
    <h1 className="mt-6 text-3xl font-bold">Share Player</h1>
    <p className="mt-2 text-sm text-gray-600">Share a player with another parent. Both accounts can enter games, edit results, and see the same performance history.</p>
    <p role="status" aria-live="polite" className="mt-4 text-sm">{message || (!ready ? "Loading sharing…" : "")}</p>
    {ready && <>
      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-bold">Invitations for you</h2>
        {!context.incoming.length && <p className="mt-2 text-sm text-gray-500">No invitations waiting for you.</p>}
        {context.incoming.map(invite => <div key={invite.id} className="mt-4 border-t pt-3">
          <p className="font-semibold">{invite.player_name}</p>
          <p className="mt-1 text-sm text-gray-600">Accept to share game entry and results. Expires {new Date(invite.expires_at).toLocaleDateString()}.</p>
          <div className="mt-3 flex gap-3">
            <button disabled={busy} onClick={() => void mutate("hockey_accept_invitation", { p_invitation: invite.id }, "Invitation accepted. The player is now on your Players page.")} className="rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50">Accept</button>
            <button disabled={busy} onClick={() => void mutate("hockey_decline_invitation", { p_invitation: invite.id }, "Invitation declined.")} className="rounded-xl border px-4 py-3 disabled:opacity-50">Decline</button>
          </div>
        </div>)}
      </section>
      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-bold">Invite a parent</h2>
        {context.players.length ? <form className="mt-4 space-y-3" onSubmit={event => {
          event.preventDefault();
          void mutate("hockey_invite_parent", { p_player: playerId, p_email: email.trim() }, "Invitation saved.");
        }}>
          <label className="block text-sm font-semibold" htmlFor="shared-player">Player</label>
          <select id="shared-player" value={playerId} onChange={event => setPlayerId(event.target.value)} disabled={busy} className="w-full rounded-xl border px-3 py-3">{context.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
          <label className="block text-sm font-semibold" htmlFor="parent-email">Parent’s email</label>
          <input id="parent-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="w-full rounded-xl border px-3 py-3" />
          <p className="text-sm text-gray-500">Use the email for their Hockey Ops account. They can create an account after you invite them. Invitations expire in 7 days. We’ll email them a link to sign in and accept.</p>
          <button disabled={busy || !playerId} className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : "Send Invitation"}</button>
        </form> : <p className="mt-2 text-sm text-gray-500">Accept an invitation to see your shared player here.</p>}
      </section>
      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-bold">Invitations you sent</h2>
        {!context.outgoing.length && <p className="mt-2 text-sm text-gray-500">You haven’t sent any invitations yet.</p>}
        {context.outgoing.map(invite => <div key={invite.id} className="mt-4 border-t pt-3">
          <p className="font-semibold">{invite.player_name}</p><p className="break-all text-sm">{invite.email}</p>
          <p className="mt-1 text-sm capitalize text-gray-500">{invite.status === "pending" && new Date(invite.expires_at) < new Date() ? "Expired" : invite.status}</p>
          {invite.status === "pending" && new Date(invite.expires_at) > new Date() && <>
            <p className="mt-2 text-xs text-gray-500">Email: {invite.email_status === "sent" ? "Sent" : invite.email_status === "sending" ? "Sending / awaiting confirmation" : invite.email_status === "failed" ? "Not confirmed — retry available" : "Not sent yet"}</p>
            <button disabled={busy} onClick={() => void mutate("hockey_resend_invitation_email", { p_invitation: invite.id }, "Invitation email sent.")} className="mt-3 mr-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50">Resend Email</button>
          </>}
          {(invite.status === "pending" || (invite.status === "accepted" && invite.membership_added)) && <button disabled={busy} className="mt-3 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50" onClick={() => {
            if (invite.status === "accepted" && !window.confirm(`Remove shared access to ${invite.player_name} for ${invite.email}?`)) return;
            void mutate("hockey_revoke_invitation", { p_invitation: invite.id }, "Invitation or shared access revoked.");
          }}>{invite.status === "accepted" ? "Remove Access" : "Cancel Invitation"}</button>}
          {invite.status === "accepted" && !invite.membership_added && <p className="mt-2 text-xs text-gray-500">This account already had access before accepting this invitation.</p>}
        </div>)}
      </section>
    </>}
  </main>;
}
