/** Pasos del botón "Arrancar motor" (cada uno es una llamada corta para no pasar el límite de Vercel). */
export const ENGINE_STEPS = [
  { id: "own", label: "Revisar sus redes, Google y el mercado local", busy: "Revisando redes y Google..." },
  { id: "brand", label: "Armar el Brand Brain", busy: "Entendiendo la marca..." },
  { id: "discover", label: "Buscar competencia y referencias", busy: "Investigando el mercado..." },
  { id: "scan", label: "Escanear sus videos", busy: "Bajando videos..." },
  { id: "analyze", label: "Desarmar los que más pegaron", busy: "Analizando outliers..." },
  { id: "report", label: "Reporte: mercado, oportunidades y estrategia", busy: "Escribiendo el reporte..." },
  { id: "plan", label: "Plan de la primera semana", busy: "Planeando qué grabar..." },
] as const;

export type EngineStepId = (typeof ENGINE_STEPS)[number]["id"];
