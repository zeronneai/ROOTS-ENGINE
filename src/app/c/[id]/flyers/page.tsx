import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { Library, StyleRefs, type AssetView } from "@/components/flyers/BrandLibrary";
import { FlyerStudio, type FlyerView } from "@/components/flyers/FlyerStudio";

export default async function FlyersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, client } = await loadClient(id);
  const [{ data: assets, error: aErr }, { data: flyers }] = await Promise.all([
    db.from("brand_assets").select("*").eq("client_id", id).order("created_at"),
    db.from("flyers").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(30),
  ]);

  if (aErr) {
    return (
      <>
        <PageTitle kicker="Flyers con IA" title="Flyers" />
        <div className="card p-6 text-sm text-muted">Falta activar esta sección en la base de datos (migración 0009).</div>
      </>
    );
  }

  const sign = async (path: string | null, download?: string) => {
    if (!path) return null;
    const { data } = await db.storage.from("brand").createSignedUrl(path, 60 * 60 * 2, download ? { download } : undefined);
    return data?.signedUrl ?? null;
  };

  const assetViews: AssetView[] = await Promise.all(
    (assets ?? []).map(async (a) => ({ id: a.id, kind: a.kind, category: a.category, label: a.label, pinned: a.pinned, url: await sign(a.path) })),
  );
  const slug = client.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const flyerViews: FlyerView[] = await Promise.all(
    (flyers ?? []).map(async (f, i) => ({
      id: f.id,
      brief: f.brief,
      format: f.format,
      status: f.status,
      error: f.error,
      asset_ids: f.asset_ids ?? [],
      extra_paths: f.extra_paths ?? [],
      adjust: f.adjust,
      caption: f.caption ?? null,
      url: await sign(f.output_path),
      downloadUrl: await sign(f.output_path, `flyer-${slug}-${(flyers?.length ?? 0) - i}.${f.output_path?.split(".").pop() ?? "png"}`),
    })),
  );
  const style = assetViews.filter((a) => a.kind === "style");
  const library = assetViews.filter((a) => a.kind === "library");

  return (
    <>
      <PageTitle kicker="Flyers con IA" title="Flyers" />
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Nuevo flyer</h2>
        <FlyerStudio clientId={id} library={library} flyers={flyerViews} />
      </section>

      <section className="mt-12 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Tu biblioteca</h2>
          <p className="text-sm text-muted">
            Imágenes que usas seguido: logo, fotos del lugar, de tu equipo o de tus productos. Marca con 📌 las que van en todos los
            flyers, como el logo.
          </p>
        </div>
        <Library clientId={id} items={library} />
      </section>

      <section className="mt-12 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Tu estilo</h2>
          <p className="text-sm text-muted">
            Flyers o diseños que te gustan, tuyos o de otros. La IA toma de aquí los colores, la tipografía y el tipo de composición. Usa
            las 3 más recientes.
          </p>
        </div>
        <StyleRefs clientId={id} items={style} />
      </section>
    </>
  );
}
