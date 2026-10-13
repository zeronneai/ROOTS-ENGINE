import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { ClientStyle } from "@/components/ClientStyle";
import { demoWords, DEMO_DURATION } from "@/remotion/demo";
import type { Direction } from "@/lib/edl/build";
import type { Word } from "@/lib/edl/types";

export default async function EstiloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, client, brand, moods } = await loadClient(id);

  // preview con el último video real del cliente, si ya hay
  const { data: last } = await db
    .from("edits")
    .select("transcript, recordings(storage_path)")
    .eq("client_id", id)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tr = last?.transcript as { words: Word[]; duration: number; direction?: Direction } | undefined;
  const rec = last?.recordings as unknown as { storage_path: string } | null;
  const signed = rec ? (await db.storage.from("recordings").createSignedUrl(rec.storage_path, 60 * 60 * 3)).data?.signedUrl : null;
  const real = !!(tr?.words?.length && signed);

  return (
    <>
      <PageTitle kicker="05 · Estilo de edición" title="Cómo se ven tus videos" />
      <ClientStyle
        clientId={id}
        src={real ? signed! : "/demo/sample.mp4"}
        words={real ? tr!.words : demoWords()}
        duration={real ? tr!.duration : DEMO_DURATION}
        direction={real ? tr!.direction ?? null : null}
        hookTitle={real ? null : "El secreto que nadie te dice"}
        niche={client.niche}
        brandAccent={brand.data.visual?.accentColor ?? null}
        handle={client.instagram}
        moods={moods}
        activeMoodId={brand.active_mood_id}
        initial={{ presetId: client.edit_style_id, moodId: brand.active_mood_id, overrides: brand.style_overrides ?? {} }}
        usingRealClip={real}
      />
    </>
  );
}
