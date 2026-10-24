/** Pasos de una auditoría (cada uno es una llamada corta para no pasar el límite de Vercel). */
export const AUDIT_STEPS = [
  { id: "google", label: "Google: su perfil, sus reseñas y los negocios de su zona", busy: "Buscándolo en Google..." },
  { id: "reviews", label: "Reseñas de la competencia más fuerte", busy: "Leyendo reseñas de la competencia..." },
  { id: "web", label: "Su sitio web y los de la competencia", busy: "Revisando sitios web..." },
  { id: "social", label: "Sus redes y las de la competencia", busy: "Revisando redes..." },
  { id: "write", label: "Escribir el diagnóstico", busy: "Escribiendo el diagnóstico..." },
  { id: "finish", label: "Dónde se pierden clientes y los 3 movimientos", busy: "Cerrando la auditoría..." },
] as const;

export type AuditStepId = (typeof AUDIT_STEPS)[number]["id"];
