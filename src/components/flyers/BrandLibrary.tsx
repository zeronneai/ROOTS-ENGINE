"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadBrandImage } from "@/lib/upload-image";
import { addBrandAssetsAction, deleteBrandAssetAction, updateBrandAssetAction } from "@/app/flyer-actions";
import { Spinner } from "../ApiButton";

export type AssetView = {
  id: string;
  kind: "style" | "library";
  category: "logo" | "lugar" | "persona" | "producto" | "otro";
  label: string | null;
  pinned: boolean;
  url: string | null;
};

export const CATEGORY_LABEL: Record<AssetView["category"], string> = {
  logo: "Logo",
  lugar: "Lugar",
  persona: "Persona",
  producto: "Producto",
  otro: "Otro",
};

function Uploader({ clientId, kind, label }: { clientId: string; kind: "style" | "library"; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="grid aspect-square cursor-pointer place-items-center rounded-2xl border border-dashed border-line bg-white p-3 text-center text-xs text-muted hover:border-purple">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        disabled={!!busy}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 12);
          e.target.value = "";
          if (!files.length) return;
          setErr(null);
          try {
            const items = [];
            for (const [i, f] of files.entries()) {
              setBusy(`${i + 1}/${files.length}`);
              const path = await uploadBrandImage(clientId, f, kind === "style" ? "estilo" : "biblioteca");
              const guess = /logo/i.test(f.name) ? "logo" : undefined;
              items.push({ path, kind, category: guess as AssetView["category"] | undefined });
            }
            await addBrandAssetsAction(clientId, items);
            router.refresh();
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy("");
          }
        }}
      />
      {busy ? (
        <span className="flex items-center gap-2"><Spinner /> {busy}</span>
      ) : (
        <span>
          <span className="block text-2xl text-purple">+</span>
          {label}
        </span>
      )}
      {err ? <span className="text-bad">{err}</span> : null}
    </label>
  );
}

export function StyleRefs({ clientId, items }: { clientId: string; items: AssetView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
      {items.map((a) => (
        <div key={a.id} className="group relative aspect-square overflow-hidden rounded-2xl border border-line bg-cream">
          {a.url ? <img src={a.url} alt="" className="h-full w-full object-cover" /> : null}
          <button
            disabled={pending}
            onClick={() => start(async () => { await deleteBrandAssetAction(clientId, a.id); router.refresh(); })}
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-sm text-bad shadow"
            aria-label="Quitar"
          >
            ✕
          </button>
        </div>
      ))}
      <Uploader clientId={clientId} kind="style" label="Agregar referencias" />
    </div>
  );
}

export function Library({ clientId, items }: { clientId: string; items: AssetView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {items.map((a) => (
        <div key={a.id} className={`overflow-hidden rounded-2xl border bg-white ${a.pinned ? "border-purple glow" : "border-line"}`}>
          <div className="relative aspect-square bg-cream">
            {a.url ? <img src={a.url} alt="" className={`h-full w-full ${a.category === "logo" ? "object-contain p-3" : "object-cover"}`} /> : null}
            <button
              disabled={pending}
              onClick={() => run(() => deleteBrandAssetAction(clientId, a.id))}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-sm text-bad shadow"
              aria-label="Quitar"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5 p-2">
            <select
              className="input !py-1 text-xs"
              value={a.category}
              disabled={pending}
              onChange={(e) => run(() => updateBrandAssetAction(clientId, a.id, { category: e.target.value as AssetView["category"] }))}
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              className="input !py-1 text-xs"
              defaultValue={a.label ?? ""}
              placeholder="Nombre (ej: Chef Luis)"
              onBlur={(e) => e.target.value !== (a.label ?? "") && run(() => updateBrandAssetAction(clientId, a.id, { label: e.target.value }))}
            />
            <button
              disabled={pending}
              onClick={() => run(() => updateBrandAssetAction(clientId, a.id, { pinned: !a.pinned }))}
              className={`w-full rounded-full border px-2 py-1 text-[11px] font-semibold ${a.pinned ? "border-purple bg-purple text-white" : "border-line text-muted"}`}
            >
              {a.pinned ? "📌 Va en todos los flyers" : "Incluir siempre"}
            </button>
          </div>
        </div>
      ))}
      <Uploader clientId={clientId} kind="library" label="Agregar logo, fotos del lugar, personas o productos" />
    </div>
  );
}
