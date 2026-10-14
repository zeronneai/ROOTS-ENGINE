import type { EditStyle } from "./types";
import { deepMerge, type DeepPartial } from "./merge";

/**
 * Presets de edición por tipo de negocio.
 * La idea: que una barbería y un despacho de abogados NUNCA se vean igual.
 * Cada preset define subtítulos, zooms, emojis, sonidos, color y ritmo.
 */

export const NICHES = [
  { id: "barberia", label: "Barbería / Estética masculina" },
  { id: "abogados", label: "Despacho legal" },
  { id: "contable", label: "Contabilidad / Servicios profesionales" },
  { id: "medspa", label: "Med spa / Belleza / Estética" },
  { id: "restaurante", label: "Restaurante / Comida" },
  { id: "gym", label: "Gym / Fitness / Nutrición" },
  { id: "bar", label: "Bar / Cantina / Vida nocturna" },
  { id: "dental", label: "Dental / Salud" },
  { id: "inmobiliaria", label: "Bienes raíces" },
  { id: "boutique", label: "Moda / Boutique / Joyería / Relojes" },
  { id: "western", label: "Western / Botas / Sombreros" },
  { id: "automotriz", label: "Autos / Talleres / Detailing" },
  { id: "creador", label: "Creador / Coach / Marca personal" },
  { id: "deportes", label: "Deportes / Academias" },
  { id: "otro", label: "Otro" },
] as const;

export type NicheId = (typeof NICHES)[number]["id"];

const BASE: EditStyle = {
  id: "base",
  name: "Base",
  description: "",
  niches: [],
  captions: {
    enabled: true,
    font: "Montserrat",
    weight: 900,
    sizePx: 78,
    uppercase: true,
    color: "#FFFFFF",
    highlightColor: "#22C55E",
    highlightMode: "color",
    strokeColor: "#000000",
    strokeWidth: 10,
    shadow: true,
    background: "none",
    backgroundColor: "rgba(0,0,0,0.6)",
    position: "center",
    maxWordsPerPage: 3,
    animation: "pop",
    letterSpacing: 0,
  },
  zoom: {
    enabled: true,
    style: "punch",
    intensity: 1.18,
    everySeconds: 3,
    onEmphasis: true,
    jumpCutAlternate: true,
  },
  emojis: { density: "medium", sizePx: 150, animation: "pop", palette: ["🔥", "💡", "👇", "✅", "🤯"] },
  sfx: { enabled: true, volume: 0.5, onZoom: "whoosh", onEmoji: "pop", onCut: "none" },
  grade: { filter: "contrast(1.08) saturate(1.08)", vignette: 0.25, grain: 0, tint: "transparent" },
  pacing: { cutSilencesOverMs: 300, keepPaddingMs: 80, removeFillers: true },
  overlays: {
    progressBar: true,
    progressColor: "#22C55E",
    hookTitle: true,
    hookTitleFont: "Montserrat",
    hookTitleColor: "#000000",
    hookTitleBg: "#FFFFFF",
    handle: false,
  },
  motion: { level: "medium", calloutStyle: "sticker", bursts: true, lowerThird: false, endCard: true },
  music: { enabled: true, volume: 0.32, duck: 0.3 },
  transition: "flash",
};

const define = (p: DeepPartial<EditStyle> & Pick<EditStyle, "id" | "name" | "description" | "niches">) =>
  deepMerge(BASE, p) as EditStyle;

export const PRESETS: EditStyle[] = [
  define({
    id: "street-fade",
    name: "Street Fade",
    description: "Urbano y con punch. Letras gruesas, zooms agresivos, muchos emojis y glitch.",
    niches: ["barberia"],
    captions: {
      font: "Anton", weight: 400, sizePx: 96, highlightColor: "#FFD60A", highlightMode: "scale",
      strokeWidth: 12, maxWordsPerPage: 2, animation: "pop",
    },
    zoom: { style: "punch", intensity: 1.24, everySeconds: 2.4 },
    emojis: { density: "high", palette: ["💈", "🔥", "✂️", "💯", "😮‍💨", "👑"] },
    sfx: { onZoom: "whoosh", onEmoji: "pop", onCut: "click" },
    grade: { filter: "contrast(1.18) saturate(1.1)", vignette: 0.4, grain: 0.12 },
    pacing: { cutSilencesOverMs: 220 },
    overlays: { progressColor: "#FFD60A", hookTitleFont: "Anton", hookTitleBg: "#FFD60A" },
    motion: { level: "high", calloutStyle: "sticker", bursts: true },
    music: { volume: 0.38 },
    transition: "glitch",
  }),
  define({
    id: "counsel-authority",
    name: "Counsel",
    description: "Autoridad y confianza. Subtítulos limpios abajo, zooms lentos, cero emojis.",
    niches: ["abogados", "contable"],
    captions: {
      font: "Inter", weight: 600, sizePx: 54, uppercase: false, highlightColor: "#E5C07B",
      highlightMode: "underline", strokeWidth: 0, background: "bar", backgroundColor: "rgba(10,10,14,0.72)",
      position: "lower", maxWordsPerPage: 6, animation: "fade",
    },
    zoom: { style: "smooth", intensity: 1.07, everySeconds: 6, onEmphasis: false, jumpCutAlternate: true },
    emojis: { density: "none", palette: [] },
    sfx: { enabled: false, onZoom: "none", onEmoji: "none" },
    grade: { filter: "contrast(1.05) saturate(0.9)", vignette: 0.2 },
    pacing: { cutSilencesOverMs: 450, keepPaddingMs: 140 },
    overlays: {
      progressBar: false, hookTitleFont: "Playfair Display", hookTitleColor: "#FFFFFF",
      hookTitleBg: "rgba(10,10,14,0.85)", handle: true,
    },
    motion: { level: "low", calloutStyle: "bar", bursts: false, lowerThird: true },
    music: { volume: 0.2, duck: 0.22 },
    transition: "fade",
  }),
  define({
    id: "glow-luxe",
    name: "Glow Luxe",
    description: "Suave y elegante. Serif fina, tonos cálidos, brillos y transiciones suaves.",
    niches: ["medspa"],
    captions: {
      font: "Playfair Display", weight: 700, sizePx: 66, uppercase: false, highlightColor: "#F9C6CF",
      highlightMode: "color", strokeWidth: 0, shadow: true, position: "lower", maxWordsPerPage: 4,
      animation: "slide",
    },
    zoom: { style: "smooth", intensity: 1.09, everySeconds: 5, onEmphasis: false },
    emojis: { density: "low", sizePx: 120, animation: "float", palette: ["✨", "💖", "🌸", "💆‍♀️", "🤍"] },
    sfx: { volume: 0.3, onZoom: "none", onEmoji: "ding" },
    grade: { filter: "brightness(1.05) saturate(0.95) contrast(0.98)", vignette: 0.12, tint: "rgba(255,190,170,0.06)" },
    pacing: { cutSilencesOverMs: 380, keepPaddingMs: 120 },
    overlays: { progressColor: "#F9C6CF", hookTitleFont: "Playfair Display", hookTitleBg: "#FFF5F7", hookTitleColor: "#5B2333" },
    motion: { level: "medium", calloutStyle: "glow", bursts: true, lowerThird: true },
    music: { volume: 0.26 },
    transition: "fade",
  }),
  define({
    id: "food-hype",
    name: "Food Hype",
    description: "Antojo puro. Letra redonda que rebota, color saturado y emojis de comida.",
    niches: ["restaurante"],
    captions: {
      font: "Luckiest Guy", weight: 400, sizePx: 92, highlightColor: "#FF7A00", highlightMode: "scale",
      strokeWidth: 12, maxWordsPerPage: 3, animation: "bounce",
    },
    zoom: { style: "punch", intensity: 1.2, everySeconds: 3 },
    emojis: { density: "high", palette: ["🍔", "🔥", "🤤", "🌮", "😋", "🧀"] },
    sfx: { onZoom: "boom", onEmoji: "pop" },
    grade: { filter: "saturate(1.32) contrast(1.1)", vignette: 0.25 },
    overlays: { progressColor: "#FF7A00", hookTitleFont: "Luckiest Guy", hookTitleBg: "#FF7A00", hookTitleColor: "#1A0A00" },
    motion: { level: "high", calloutStyle: "sticker", bursts: true },
    music: { volume: 0.38 },
    transition: "whip",
  }),
  define({
    id: "iron-power",
    name: "Iron",
    description: "Intensidad de gym. Condensada, rojo, sacudidas y cortes rapidísimos.",
    niches: ["gym", "deportes"],
    captions: {
      font: "Bebas Neue", weight: 400, sizePx: 110, highlightColor: "#FF2D2D", highlightMode: "scale",
      strokeWidth: 8, maxWordsPerPage: 2, animation: "pop", letterSpacing: 2,
    },
    zoom: { style: "shake", intensity: 1.25, everySeconds: 2 },
    emojis: { density: "medium", palette: ["💪", "🔥", "⚡", "🏋️", "🥇"] },
    sfx: { onZoom: "boom", onEmoji: "pop", onCut: "whoosh" },
    grade: { filter: "contrast(1.25) saturate(0.85)", vignette: 0.45, grain: 0.2 },
    pacing: { cutSilencesOverMs: 200 },
    overlays: { progressColor: "#FF2D2D", hookTitleFont: "Bebas Neue", hookTitleBg: "#FF2D2D", hookTitleColor: "#FFFFFF" },
    motion: { level: "high", calloutStyle: "sticker", bursts: true },
    music: { volume: 0.42, duck: 0.35 },
    transition: "flash",
  }),
  define({
    id: "neon-night",
    name: "Neon Night",
    description: "Vida nocturna. Neón rosa y morado, rebotes, glitch y emojis de fiesta.",
    niches: ["bar"],
    captions: {
      font: "Bungee", weight: 400, sizePx: 80, highlightColor: "#FF3CAC", highlightMode: "color",
      strokeWidth: 8, strokeColor: "#1B0030", maxWordsPerPage: 3, animation: "bounce",
    },
    zoom: { style: "punch", intensity: 1.16, everySeconds: 3 },
    emojis: { density: "medium", palette: ["🍻", "💔", "🎶", "🥃", "🔥", "💃"] },
    sfx: { onZoom: "whoosh", onEmoji: "pop" },
    grade: { filter: "saturate(1.25) contrast(1.1) hue-rotate(-8deg)", vignette: 0.45, tint: "rgba(120,40,200,0.10)" },
    overlays: { progressColor: "#FF3CAC", hookTitleFont: "Bungee", hookTitleBg: "#FF3CAC", hookTitleColor: "#1B0030" },
    motion: { level: "high", calloutStyle: "glow", bursts: true },
    music: { volume: 0.4 },
    transition: "glitch",
  }),
  define({
    id: "smile-clean",
    name: "Smile",
    description: "Amigable y limpio. Letra redonda, píldora de color, ritmo tranquilo.",
    niches: ["dental"],
    captions: {
      font: "Nunito", weight: 800, sizePx: 66, uppercase: false, color: "#FFFFFF", highlightColor: "#2DD4BF",
      highlightMode: "box", strokeWidth: 0, background: "pill", backgroundColor: "rgba(6,40,48,0.65)",
      position: "lower", maxWordsPerPage: 4, animation: "pop",
    },
    zoom: { style: "smooth", intensity: 1.1, everySeconds: 4, onEmphasis: true },
    emojis: { density: "low", sizePx: 120, palette: ["😁", "🦷", "✨", "💙"] },
    sfx: { volume: 0.35, onZoom: "none", onEmoji: "ding" },
    grade: { filter: "brightness(1.05) saturate(1.02)", vignette: 0.1 },
    overlays: { progressColor: "#2DD4BF", hookTitleFont: "Nunito", hookTitleBg: "#2DD4BF", hookTitleColor: "#062830" },
    motion: { level: "medium", calloutStyle: "bar", bursts: true, lowerThird: true },
    music: { volume: 0.24 },
    transition: "fade",
  }),
  define({
    id: "editorial-minimal",
    name: "Editorial",
    description: "Revista de moda. Serif fina tipo máquina de escribir, sin emojis, grano de película.",
    niches: ["boutique", "inmobiliaria"],
    captions: {
      font: "Cormorant Garamond", weight: 600, sizePx: 64, uppercase: false, highlightColor: "#FFFFFF",
      highlightMode: "none", strokeWidth: 0, shadow: true, position: "lower", maxWordsPerPage: 6,
      animation: "typewriter", letterSpacing: 1,
    },
    zoom: { style: "smooth", intensity: 1.05, everySeconds: 7, onEmphasis: false },
    emojis: { density: "none", palette: [] },
    sfx: { enabled: false, onZoom: "none", onEmoji: "none" },
    grade: { filter: "contrast(1.06) saturate(0.82)", vignette: 0.3, grain: 0.1 },
    pacing: { cutSilencesOverMs: 500, keepPaddingMs: 160 },
    overlays: {
      progressBar: false, hookTitleFont: "Cormorant Garamond", hookTitleBg: "transparent",
      hookTitleColor: "#FFFFFF", handle: true,
    },
    motion: { level: "low", calloutStyle: "minimal", bursts: false, lowerThird: true },
    music: { volume: 0.24, duck: 0.25 },
    transition: "fade",
  }),
  define({
    id: "ranch-grit",
    name: "Ranch",
    description: "Western con carácter. Letra de cartel vaquero, tonos sepia y grano.",
    niches: ["western", "automotriz"],
    captions: {
      font: "Rye", weight: 400, sizePx: 76, color: "#F5E6C8", highlightColor: "#F59E0B", highlightMode: "color",
      strokeColor: "#2B1608", strokeWidth: 10, maxWordsPerPage: 3, animation: "slide",
    },
    zoom: { style: "punch", intensity: 1.15, everySeconds: 3.5 },
    emojis: { density: "low", palette: ["🤠", "🔥", "🐎", "🌵"] },
    sfx: { onZoom: "whoosh", onEmoji: "click" },
    grade: { filter: "sepia(0.22) contrast(1.12) saturate(0.95)", vignette: 0.45, grain: 0.18 },
    overlays: { progressColor: "#F59E0B", hookTitleFont: "Rye", hookTitleBg: "#F5E6C8", hookTitleColor: "#2B1608" },
    motion: { level: "medium", calloutStyle: "sticker", bursts: false },
    music: { volume: 0.32 },
    transition: "whip",
  }),
  define({
    id: "creator-bold",
    name: "Creator Bold",
    description: "El clásico de creadores. Mayúsculas gruesas, palabra clave en color, ritmo alto.",
    niches: ["creador", "otro"],
  }),
];

export const DEFAULT_PRESET_ID = "creator-bold";

export function getPreset(id?: string | null): EditStyle {
  return PRESETS.find((p) => p.id === id) ?? PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!;
}

export function presetForNiche(niche?: string | null): EditStyle {
  return PRESETS.find((p) => niche && p.niches.includes(niche)) ?? getPreset(DEFAULT_PRESET_ID);
}

/** Todas las fuentes que usan los presets (para precargarlas). */
export const PRESET_FONTS = Array.from(
  new Set(PRESETS.flatMap((p) => [p.captions.font, p.overlays.hookTitleFont])),
);
