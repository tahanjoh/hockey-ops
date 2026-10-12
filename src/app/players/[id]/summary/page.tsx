import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { summarizeGames, videoLinks, type SummaryGame } from "@/lib/hockey/playerSummary";

export default async function PlayerSummaryPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const date = (value?: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
  const from = date(filters.from);
  const to = date(filters.to);
  const invalidRange = !!(from && to && from > to);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error: membershipError } = await supabase.from("player_memberships").select("player_id").eq("user_id", user.id).eq("player_id", id).maybeSingle();
  if (membershipError) throw new Error(membershipError.message);
  if (!membership) redirect("/");
  const { data: player, error: playerError } = await supabase.from("players").select("first_name, last_name").eq("id", id).single();
  if (playerError || !player) redirect("/");
  // Wildcards allow this page to work before and after optional video columns are added.
  let query = supabase.from("games").select("*, game_events(*)").eq("player_id", id).eq("status", "completed").order("game_date", { ascending: false });
  if (from) query = query.gte("game_date", from);
  if (to) query = query.lte("game_date", to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const games = (data ?? []) as SummaryGame[];
  const stats = summarizeGames(games);
  const clips = games.flatMap(game => [
    ...videoLinks(game).map(link => ({ ...link, game, label: "Game video" })),
    ...(game.game_events ?? []).flatMap(event => videoLinks(event).map(link => ({ ...link, game, label: `${event.event_type.replaceAll("_", " ")}${event.period ? ` · ${event.period === 4 ? "OT" : `P${event.period}`}` : ""}` }))),
  ]);
  const cards = [["Games", stats.games], ["Goals", stats.goals], ["Assists", stats.assists], ["Points", stats.points], ["Shots", stats.shots], ["Shots on goal", stats.sog], ["Avg impact", stats.averageImpact?.toFixed(1) ?? "—"], ["Shooting %", stats.shooting === null ? "—" : `${stats.shooting.toFixed(1)}%`]];
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
    <Link href="/" className="text-sm font-semibold text-gray-500">← Players</Link>
    <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">Player Summary</p>
    <h1 className="mt-1 text-3xl font-bold">{player.first_name} {player.last_name}</h1>
    <p className="mt-2 text-sm text-gray-500">Collective stats and videos from completed games.</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold underline"><Link href={`/players/${id}/games`}>Game History</Link><Link href={`/games/new?player=${id}`}>Start Game</Link></div>
    <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <label className="text-sm font-semibold">From<input type="date" name="from" defaultValue={from} className="mt-1 block rounded-lg border p-2" /></label>
      <label className="text-sm font-semibold">Through<input type="date" name="to" defaultValue={to} className="mt-1 block rounded-lg border p-2" /></label>
      <button className="rounded-lg bg-black px-4 py-2 font-semibold text-white">Apply</button>
      <Link href={`/players/${id}/summary`} className="px-2 py-2 text-sm underline">All games</Link>
    </form>
    {invalidRange && <p role="alert" className="mt-3 text-sm text-red-700">From must be on or before Through.</p>}
    {!games.length && <p className="mt-6 rounded-2xl border p-5 text-gray-500">No completed games{from || to ? " in this date range" : " yet"}.</p>}
    <section aria-label="Totals" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{cards.map(([label, value]) => <div key={label} className="rounded-2xl bg-gray-100 p-4 text-center"><div className="text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-gray-600">{label}</div></div>)}</section>
    <p className="mt-3 text-sm text-gray-600">Team record: {stats.wins} W · {stats.losses} L · {stats.ties} T · Points/game: {stats.games ? (stats.points / stats.games).toFixed(2) : "—"}</p>
    <section className="mt-8"><h2 className="text-xl font-bold">All tracked stats</h2><div className="mt-3 overflow-x-auto rounded-2xl border"><table className="w-full text-sm"><thead><tr className="bg-gray-100 text-left"><th className="p-3">Stat</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Per game</th></tr></thead><tbody>{stats.details.map(([label, value]) => <tr key={label} className="border-t"><th className="p-3 text-left font-medium">{label}</th><td className="p-3 text-right">{value}</td><td className="p-3 text-right">{stats.games ? (value / stats.games).toFixed(2) : "—"}</td></tr>)}</tbody></table></div><p className="mt-2 text-xs text-gray-500">Shots include goals, shots on goal and missed shots. On-ice goals for include goals and assists, matching game results.</p></section>
    <section className="mt-8"><h2 className="text-xl font-bold">Video library <span className="text-sm font-normal text-gray-500">({clips.length})</span></h2><div className="mt-3 space-y-3">{clips.length ? clips.map((clip, index) => <article key={`${clip.game.id}-${index}`} className="rounded-2xl border p-4"><Link href={`/games/${clip.game.id}/results`} className="font-bold">vs {clip.game.opponent}</Link><p className="mt-1 text-sm capitalize text-gray-500">{clip.game.game_date} · {clip.label}</p><a href={clip.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white">{clip.title} ↗</a></article>) : <p className="rounded-2xl border p-5 text-sm text-gray-500">No saved video links for these games yet.</p>}</div></section>
  </main>;
}
