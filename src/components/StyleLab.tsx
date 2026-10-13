"use client";
import { useEffect, useMemo, useState } from "react";
import { StylePlayer } from "./StylePlayer";
import { PRESETS } from "@/lib/styles/presets";
import { ENERGY_LABELS, resolveStyle } from "@/lib/styles/resolve";
import type { StyleOverrides } from "@/lib/styles/types";
import type { Direction } from "@/lib/edl/build";
import type { Word } from "@/lib/edl/types";

export type LabState = {
  presetId: string | null;
  moodId: string | null;
  overrides: StyleOverrides;
};

type Mood = { id: string; name: string; style_overrides: StyleOverrides };

/**
 * Laboratorio de estilo: el mismo video, cualquier estilo, en vivo.
 * Se usa en la demo pública, en la pestaña Estilo del cliente y en la revisión de cada edición.
 */
export function StyleLab(props: {
  src: string;
  words: Word[];
  duration: number;
  direction?: Direction | null;
  hookTitle?: string | null;
  handle?: string | null;
  niche?: string | null;
  brandAccent?: string | null;
  clientOverrides?: StyleOverrides | null;
  moods?: Mood[];
  initial?: Partial<LabState>;
  onChange?: (s: LabState) => void;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  const [presetId, setPresetId] = useState<string | null>(props.initial?.presetId ?? null);
  const [moodId, setMoodId] = useState<string | null>(props.initial?.moodId ?? null);
  const init = props.initial?.overrides ?? {};
  const [energy, setEnergy] = useState<number>(init.energy ?? 0);
  const [emojis, setEmojis] = useState<boolean>(init.emojis?.density !== "none");
  const [sfx, setSfx] = useState<boolean>(init.sfx?.enabled !== false);
  const [useBrand, setUseBrand] = useState<boolean>(true);
  const [position, setPosition] = useState<string>(init.captions?.position ?? "");

  const overrides: StyleOverrides = useMemo(() => {
    const o: StyleOverrides = { energy };
    if (!emojis) o.emojis = { density: "none" };
    if (!sfx) o.sfx = { enabled: false };
    if (position) o.captions = { position: position as "upper" | "center" | "lower" };
    return o;
  }, [energy, emojis, sfx, position]);

  const mood = props.moods?.find((m) => m.id === moodId);
  const style = useMemo(
    () =>
      resolveStyle({
        presetId,
        niche: props.niche,
        brandAccent: useBrand ? props.brandAccent : null,
        layers: [props.clientOverrides, mood?.style_overrides, overrides],
      }),
    [presetId, props.niche, props.brandAccent, props.clientOverrides, mood, overrides, useBrand],
  );

  const { onChange } = props;
  useEffect(() => {
    onChange?.({ presetId, moodId, overrides });
  }, [presetId, moodId, overrides, onChange]);

  return (
    <div className={`grid gap-6 ${props.compact ? "lg:grid-cols-[300px_1fr]" : "lg:grid-cols-[340px_1fr]"}`}>
      <div className="mx-auto w-full max-w-[340px]">
        <StylePlayer
          src={props.src}
          words={props.words}
          duration={props.duration}
          style={style}
          direction={props.direction}
          hookTitle={props.hookTitle}
          handle={props.handle}
        />
        <p className="mt-3 text-center text-xs text-muted">
          Estilo activo: <span className="text-lavender">{style.name}</span>
          {mood ? <> · mood <span className="text-lavender">{mood.name}</span></> : null}
        </p>
      </div>

      <div className="space-y-6">
        <section>
          <div className="label mb-3">Estilo base</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <PresetCard
              active={presetId === null}
              name="Automático"
              desc="El que mejor le queda a su giro y a su marca."
              swatch={null}
              onClick={() => setPresetId(null)}
            />
            {PRESETS.map((p) => (
              <PresetCard
                key={p.id}
                active={presetId === p.id}
                name={p.name}
                desc={p.description}
                swatch={p.captions.highlightColor}
                font={p.captions.font}
                onClick={() => setPresetId(p.id)}
              />
            ))}
          </div>
        </section>

        {props.moods && props.moods.length ? (
          <section>
            <div className="label mb-3">Mood</div>
            <div className="flex flex-wrap gap-2">
              <button className={`chip ${moodId === null ? "glow text-white" : ""}`} onClick={() => setMoodId(null)}>
                Normal
              </button>
              {props.moods.map((m) => (
                <button key={m.id} className={`chip ${moodId === m.id ? "glow text-white" : ""}`} onClick={() => setMoodId(m.id)}>
                  {m.name}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="label mb-2">
              Energía: <span className="text-lavender normal-case tracking-normal">{ENERGY_LABELS[String(energy)]}</span>
            </div>
            <input
              type="range"
              min={-2}
              max={2}
              step={1}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full accent-purple"
            />
          </div>
          <div>
            <div className="label mb-2">Subtítulos</div>
            <select className="input" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="">Posición del estilo</option>
              <option value="upper">Arriba</option>
              <option value="center">Centro</option>
              <option value="lower">Abajo</option>
            </select>
          </div>
          <Toggle label="Emojis" value={emojis} onChange={setEmojis} />
          <Toggle label="Efectos de sonido" value={sfx} onChange={setSfx} />
          {props.brandAccent ? <Toggle label="Usar color de la marca" value={useBrand} onChange={setUseBrand} /> : null}
        </section>

        {props.children}
      </div>
    </div>
  );
}

function PresetCard(p: { active: boolean; name: string; desc: string; swatch: string | null; font?: string; onClick: () => void }) {
  return (
    <button
      onClick={p.onClick}
      className={`card text-left p-3 transition ${p.active ? "glow border-purple" : "hover:border-purple/60"}`}
    >
      <div className="flex items-center gap-2">
        {p.swatch ? <span className="h-3 w-3 rounded-full" style={{ background: p.swatch }} /> : <span className="text-xs">✦</span>}
        <span className="font-semibold text-sm">{p.name}</span>
        {p.font ? <span className="ml-auto text-[10px] text-muted">{p.font}</span> : null}
      </div>
      <p className="mt-1 text-xs text-muted leading-snug">{p.desc}</p>
    </button>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex cursor-pointer items-center justify-between rounded-xl border border-line px-3 py-2"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${value ? "bg-purple" : "bg-line"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${value ? "left-4.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
