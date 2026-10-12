"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Player = { id: string; name: string };
type Invite = { id: string; player_id: string; player_name: string; email: string; status: string; expires_at: string; membership_added?: boolean };
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
      if (!user) { router.replace("/login"); return; }
      const { data, error } = await supabase.rpc("hockey_sharing_context");
      if (!active) return;
      if (error) {
        setMessage("Sharing is unavailable. Apply the player sharing migration, then refresh this page.");
      } else {
        const next = data as Context;
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
      const { error } = await supabase.rpc(name, args);
      if (error) { setMessage(error.message); return; }
      const { data, error: refreshError } = await supabase.rpc("hockey_sharing_context");
      if (refreshError) { setMessage(`${success} Refresh the page to see the updated list.`); return; }
      const next = data as Context;
      setContext(next);
      setPlayerId(current => next.players.some(p => p.id === current) ? current : next.players[0]?.id ?? "");
      setMessage(success);
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
        {!context.incoming.length && <p className="mt-2 text-sm text-gray-500">No pending invitations for your verified email.</p>}
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
          void mutate("hockey_invite_parent", { p_player: playerId, p_email: email.trim() }, "Invitation created. Ask them to sign in with that email and open Share Player to accept.");
        }}>
          <label className="block text-sm font-semibold" htmlFor="shared-player">Player</label>
          <select id="shared-player" value={playerId} onChange={event => setPlayerId(event.target.value)} disabled={busy} className="w-full rounded-xl border px-3 py-3">{context.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
          <label className="block text-sm font-semibold" htmlFor="parent-email">Parent’s email</label>
          <input id="parent-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="w-full rounded-xl border px-3 py-3" />
          <p className="text-sm text-gray-500">Use the email for their Hockey Ops account. They can create an account after you invite them. Invitations expire in 7 days. No email is sent.</p>
          <button disabled={busy || !playerId} className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : "Create Invitation"}</button>
        </form> : <p className="mt-2 text-sm text-gray-500">Accept an invitation to see your shared player here.</p>}
      </section>
      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="text-lg font-bold">Access you’ve shared</h2>
        {!context.outgoing.length && <p className="mt-2 text-sm text-gray-500">You haven’t shared any players yet.</p>}
        {context.outgoing.map(invite => <div key={invite.id} className="mt-4 border-t pt-3">
          <p className="font-semibold">{invite.player_name}</p><p className="break-all text-sm">{invite.email}</p>
          <p className="mt-1 text-sm capitalize text-gray-500">{invite.status === "pending" && new Date(invite.expires_at) < new Date() ? "Expired" : invite.status}</p>
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
