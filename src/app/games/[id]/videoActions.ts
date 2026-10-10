"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseVideoUrl } from "@/lib/hockey/videoUrl";

export async function updateActivityVideo(gameId: string, eventId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const videoUrl = parseVideoUrl(String(formData.get("video_url") || ""));
  const { data, error } = await supabase.from("game_events")
    .update({ video_url: videoUrl }).eq("id", eventId)
    .eq("game_id", gameId).eq("created_by", user.id).select("id").single();
  if (error || !data) throw new Error("Could not save this activity's video link.");
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/edit`);
  revalidatePath(`/games/${gameId}/results`);
}
