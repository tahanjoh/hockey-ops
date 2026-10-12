"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InviteWelcome({ invitationId }: { invitationId: string | null }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const destination = invitationId ? `/sharing?invitation=${encodeURIComponent(invitationId)}` : "/sharing";
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) { setChecking(false); setMessage("We couldn’t check your session. You can sign in below or refresh this page."); }
    }, 15000);
    async function checkAccount() {
      try {
        // Browser initialization also handles confirmation codes before getUser resolves.
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (user) { router.replace(destination); router.refresh(); }
        else { setChecking(false); }
      } catch {
        if (active) { setChecking(false); setMessage("Could not check your session. Please refresh and try again."); }
      } finally { window.clearTimeout(timer); }
    }
    void checkAccount();
    return () => { active = false; window.clearTimeout(timer); };
  }, [destination, router, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    const accountEmail = email.trim();
    if (mode === "signup" && password.length < 8) {
      setMessage("Use at least 8 characters for your password."); return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: accountEmail, password });
        if (error) { setMessage(error.message); return; }
        router.replace(destination); router.refresh();
      } else {
        const callback = new URL("/invite", window.location.origin);
        if (invitationId) callback.searchParams.set("invitation", invitationId);
        const { data, error } = await supabase.auth.signUp({
          email: accountEmail, password,
          options: { emailRedirectTo: callback.toString() },
        });
        if (error) { setMessage(error.message); return; }
        if (data.session) { router.replace(destination); router.refresh(); }
        else { setConfirmationSent(true); setPassword(""); }
      }
    } catch { setMessage("Could not complete that request. Please try again."); }
    finally { setBusy(false); }
  }

  if (checking) return <main className="mx-auto flex min-h-screen max-w-md items-center px-6"><p role="status">Opening your invitation…</p></main>;

  return <main className="mx-auto min-h-screen max-w-md px-5 py-8">
    <div className="rounded-2xl bg-[#06152d] p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200">Hockey Ops</p>
      <h1 className="mt-3 text-3xl font-bold">You’re invited.</h1>
      <p className="mt-3 text-sm leading-6 text-slate-200">Share a player’s performance, follow their games, and record games together.</p>
    </div>
    {confirmationSent ? <section className="mt-6 rounded-2xl border p-5">
      <h2 className="text-xl font-bold">Check your email</h2>
      <p className="mt-3 break-words text-sm text-gray-600">Check <strong>{email.trim()}</strong> for a confirmation email. Open the newest link in this browser to return to your invitation.</p>
      <p className="mt-3 text-sm text-gray-600">If this email already has an account, sign in instead. Your invitation will still be waiting.</p>
      <button type="button" onClick={() => { setConfirmationSent(false); setMode("signin"); setMessage(""); }} className="mt-5 w-full rounded-xl bg-black px-4 py-3 font-semibold text-white">Continue to Sign In</button>
    </section> : <section className="mt-6 rounded-2xl border p-5">
      <h2 className="text-xl font-bold">{mode === "signup" ? "Create your account" : "Sign in to accept"}</h2>
      <p className="mt-2 text-sm text-gray-600">Use the email address that received the invitation. After signing in, choose Accept to access the shared player.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="invite-email" className="mb-2 block text-sm font-semibold">Email</label>
          <input id="invite-email" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required disabled={busy} className="w-full rounded-xl border px-4 py-3 text-base" />
        </div>
        <div>
          <label htmlFor="invite-password" className="mb-2 block text-sm font-semibold">{mode === "signup" ? "Create a password" : "Password"}</label>
          <div className="relative">
            <input id="invite-password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required disabled={busy} className="w-full rounded-xl border px-4 py-3 pr-16 text-base" />
            <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium">{showPassword ? "Hide" : "Show"}</button>
          </div>
          {mode === "signup" && <p className="mt-2 text-xs text-gray-500">At least 8 characters.</p>}
        </div>
        {mode === "signin" && <Link href="/forgot-password" className="inline-block text-sm underline">Forgot password?</Link>}
        <button disabled={busy} className="w-full rounded-xl bg-[#06152d] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Please wait…" : mode === "signup" ? "Create Account" : "Sign In"}</button>
      </form>
      <div className="mt-5 border-t pt-4 text-center text-sm">
        <span>{mode === "signup" ? "Already have an account? " : "New to Hockey Ops? "}</span>
        <button type="button" disabled={busy} onClick={() => { setMode(value => value === "signup" ? "signin" : "signup"); setMessage(""); setPassword(""); }} className="font-semibold underline">{mode === "signup" ? "Sign In" : "Create Account"}</button>
      </div>
    </section>}
    <p role="status" aria-live="polite" className="mt-4 text-sm text-gray-600">{message}</p>
  </main>;
}
