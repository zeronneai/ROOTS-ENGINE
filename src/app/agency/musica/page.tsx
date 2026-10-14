export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageTitle, TopBar } from "@/components/Shell";
import { MusicLibrary, type TrackView } from "@/components/music/MusicLibrary";

export default async function MusicaPage() {
  await requireAgency();
  const db = supabaseAdmin();
  const [{ data: tracks, error }, { data: clients }] = await Promise.all([
    db.from("music_tracks").select("*").order("created_at", { ascending: false }),
    db.from("clients").select("id, name"),
  ]);
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const views: TrackView[] = await Promise.all(
    (tracks ?? []).map(async (t) => ({
      id: t.id,
      title: t.title,
      moods: t.moods ?? [],
      energy: t.energy,
      client: t.client_id ? names.get(t.client_id) ?? "cliente" : null,
      url: (await db.storage.from("brand").createSignedUrl(t.path, 60 * 60 * 2)).data?.signedUrl ?? null,
    })),
  );
  return (
    <>
      <TopBar right={<Link href="/agency" className="btn btn-ghost !py-1.5 text-xs">← Clientes</Link>} />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
        <PageTitle kicker="Solo agencia" title="Música" />
        <p className="text-sm text-muted">
          Canciones para el auto-editor. La IA escoge la que va con cada video según la marca y la energía. Usa música libre de
          derechos (YouTube Audio Library, Pixabay Music, Epidemic Sound o Artlist con licencia): las canciones comerciales pueden
          hacer que Instagram o TikTok silencien el video.
        </p>
        {error ? (
          <div className="card p-6 text-sm text-muted">Falta activar la música en la base de datos (migración 0011).</div>
        ) : (
          <MusicLibrary tracks={views} />
        )}
      </main>
    </>
  );
}
