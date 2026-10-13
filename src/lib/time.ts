/**
 * Vercel corre en hora UTC: sin zona explícita, "4:37 PM" se muestra como "10:37 PM".
 * Usamos la hora de El Paso / Juárez (cambia de horario igual que El Paso).
 */
export const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Ciudad_Juarez";

export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("es-MX", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const fmtDate = (d: string | Date, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(d).toLocaleDateString("es-MX", { timeZone: TIME_ZONE, ...opts });
