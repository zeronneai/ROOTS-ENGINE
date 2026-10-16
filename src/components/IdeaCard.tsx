import Link from "next/link";
import { setIdeaStatusAction } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export type Idea = {
  id: string; title: string; format: string; hooks: string[]; script: { beat: string; line: string }[];
  shot_list: string[]; cta: string; caption: string; hashtags: string[]; score: number; reasoning: string;
  publish_date: string; status: string; position: number; tone?: string | null; event?: string | null;
};

const STATUS: Record<string, { l: string; c: string }> = {
  idea: { l: "Idea", c: "" },
  approved: { l: "Aprobada", c: "text-lavender" },
  recorded: { l: "Grabada", c: "text-warn" },
  edited: { l: "Editada", c: "text-ok" },
  posted: { l: "Publicada", c: "text-ok" },
  skipped: { l: "Saltada", c: "text-muted" },
};

export const TONE_LABEL: Record<string, string> = {
  comedia: "😂 Comedia",
  viral: "🔥 Viral / trend",
  creativo: "🎬 Creativo",
  venta: "💸 Venta",
  detras: "🎥 Detrás de cámaras",
  educativo: "💡 Tips",
};

export const dayName = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });

/** Tarjeta de una idea de contenido (plan semanal o campaña). */
export function IdeaCard({ clientId, idea: i, isAgency, campaign = false }: { clientId: string; idea: Idea; isAgency: boolean; campaign?: boolean }) {
  // en campañas, "reasoning" trae primero el concepto y luego el porqué
  const [concept, ...why] = campaign ? (i.reasoning ?? "").split("\n\n") : ["", i.reasoning];
  const reason = why.join("\n\n");
  return (
    <article className="card break-inside-avoid p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="display text-lavender">{dayName(i.publish_date)}</span>
        {i.event ? <span className="chip !bg-sun/60">{i.event}</span> : null}
        {i.tone ? <span className="chip">{TONE_LABEL[i.tone] ?? i.tone}</span> : null}
        <span className="chip">{i.format}</span>
        <span className={`chip ${STATUS[i.status]?.c}`}>{STATUS[i.status]?.l ?? i.status}</span>
        {i.score ? <span className="ml-auto font-mono text-ok" title={campaign ? "Qué tan compartible es" : "Qué tan probado está"}>{i.score}</span> : null}
      </div>
      <h3 className="mt-3 text-xl font-semibold">{i.title}</h3>
      {concept ? <p className="mt-2 text-sm">{concept}</p> : null}

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="label">Hooks (escoge uno)</div>
          <ol className="mt-2 space-y-2">
            {i.hooks.map((h, k) => (
              <li key={k} className="rounded-lg border border-line px-3 py-2 text-sm">“{h}”</li>
            ))}
          </ol>
          <div className="label mt-4">{campaign ? "Escenas" : "Guion"}</div>
          <ul className="mt-2 space-y-2 text-sm">
            {i.script.map((s, k) => (
              <li key={k}>
                <span className="text-xs text-purple">{s.beat}</span>
                <div>{s.line}</div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="label">Qué grabar</div>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm">
            {i.shot_list.map((s, k) => <li key={k}>{s}</li>)}
          </ol>
          <div className="label mt-4">CTA</div>
          <p className="mt-1 text-sm">{i.cta}</p>
          <div className="label mt-4">Copy</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{i.caption}</p>
          <p className="mt-1 text-xs text-lavender">{i.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
        </div>
      </div>

      {isAgency && reason ? <p className="mt-4 whitespace-pre-wrap text-xs text-muted">Por qué: {reason}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2 print:hidden">
        <Link href={`/c/${clientId}/videos?idea=${i.id}`} className="btn btn-primary">Subir grabación</Link>
        {i.status === "idea" ? (
          <form action={setIdeaStatusAction.bind(null, clientId, i.id, "approved")}><SubmitButton className="btn btn-ghost">Aprobar</SubmitButton></form>
        ) : null}
        {["edited", "recorded"].includes(i.status) ? (
          <form action={setIdeaStatusAction.bind(null, clientId, i.id, "posted")}><SubmitButton className="btn btn-ghost">Ya se publicó</SubmitButton></form>
        ) : null}
        {i.status !== "skipped" ? (
          <form action={setIdeaStatusAction.bind(null, clientId, i.id, "skipped")}><SubmitButton className="btn btn-ghost">Saltar</SubmitButton></form>
        ) : null}
      </div>
    </article>
  );
}
