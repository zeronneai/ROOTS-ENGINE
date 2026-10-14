/**
 * Fechas especiales para contenido en la frontera (México y Estados Unidos).
 * Las fijas van tal cual; las móviles se calculan para cualquier año (Pascua, Thanksgiving, Día de las Madres en EE. UU...).
 */

export type SpecialDate = { date: string; name: string; country: "MX" | "US" | "MX/US"; ideas: string };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** n-ésimo día de la semana del mes (weekday 0 = domingo). n = -1 → el último. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return lastDay - ((last - weekday + 7) % 7);
}

/** Domingo de Pascua (algoritmo de Meeus). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function datesFor(y: number): SpecialDate[] {
  const thanksgiving = nthWeekday(y, 11, 4, 4);
  const blackFriday = new Date(Date.UTC(y, 10, thanksgiving + 1));
  const cyberMonday = new Date(Date.UTC(y, 10, thanksgiving + 4));
  const e = easter(y);
  const easterDate = new Date(Date.UTC(y, e.month - 1, e.day));
  const holyThursday = new Date(easterDate.getTime() - 3 * 864e5);
  const d = (x: Date) => iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate());
  // El Buen Fin suele ser el fin de semana largo antes del Día de la Revolución (tercer lunes de noviembre)
  const revolution = nthWeekday(y, 11, 1, 3);
  return [
    { date: iso(y, 1, 1), name: "Año Nuevo", country: "MX/US", ideas: "propósitos, nuevo comienzo, promos de enero" },
    { date: iso(y, 1, 6), name: "Día de Reyes", country: "MX", ideas: "rosca, regalos, familia" },
    { date: iso(y, 2, nthWeekday(y, 2, 0, 2)), name: "Super Bowl", country: "US", ideas: "watch party, combos, botanas" },
    { date: iso(y, 2, 14), name: "San Valentín / Día del Amor y la Amistad", country: "MX/US", ideas: "parejas, amigos, regalos, 2x1" },
    { date: iso(y, 3, 8), name: "Día de la Mujer", country: "MX/US", ideas: "reconocimiento, empoderamiento (con respeto, sin promos frívolas)" },
    { date: iso(y, 3, 17), name: "St. Patrick's Day", country: "US", ideas: "verde, cerveza, fiesta" },
    { date: d(holyThursday), name: "Semana Santa", country: "MX", ideas: "vacaciones, viajes, horarios especiales, cuaresma" },
    { date: d(easterDate), name: "Pascua / Easter", country: "MX/US", ideas: "familia, huevos de pascua, primavera" },
    { date: iso(y, 4, 30), name: "Día del Niño", country: "MX", ideas: "niños, familia, regalos, actividades" },
    { date: iso(y, 5, 5), name: "Cinco de Mayo", country: "US", ideas: "celebración mexicana en EE. UU., comida y bebida" },
    { date: iso(y, 5, nthWeekday(y, 5, 0, 2)), name: "Mother's Day (EE. UU.)", country: "US", ideas: "mamá, regalos, brunch, consentirla" },
    { date: iso(y, 5, 10), name: "Día de las Madres (México)", country: "MX", ideas: "mamá, regalos, comida familiar, consentirla" },
    { date: iso(y, 5, 15), name: "Día del Maestro", country: "MX", ideas: "agradecimiento a maestros" },
    { date: iso(y, 5, nthWeekday(y, 5, 1, -1)), name: "Memorial Day", country: "US", ideas: "fin de semana largo, inicio del verano, ventas" },
    { date: iso(y, 6, nthWeekday(y, 6, 0, 3)), name: "Día del Padre", country: "MX/US", ideas: "papá, regalos, carne asada" },
    { date: iso(y, 7, 4), name: "4th of July", country: "US", ideas: "fiesta, fuegos artificiales, verano" },
    { date: iso(y, 8, 10), name: "Regreso a clases", country: "MX/US", ideas: "útiles, uniformes, cortes de cabello, rutina" },
    { date: iso(y, 9, nthWeekday(y, 9, 1, 1)), name: "Labor Day", country: "US", ideas: "fin de semana largo, ventas" },
    { date: iso(y, 9, 15), name: "Fiestas Patrias (Grito)", country: "MX", ideas: "mexicanidad, pozole, verde blanco y rojo, fiesta" },
    { date: iso(y, 10, 31), name: "Halloween", country: "MX/US", ideas: "disfraces, terror, dulces, temática oscura" },
    { date: iso(y, 11, 1), name: "Día de Muertos", country: "MX", ideas: "altar, catrinas, pan de muerto, cempasúchil, tradición" },
    { date: iso(y, 11, revolution - 3), name: "El Buen Fin (fecha aproximada, confirmar)", country: "MX", ideas: "descuentos fuertes, meses sin intereses" },
    { date: iso(y, 11, thanksgiving), name: "Thanksgiving", country: "US", ideas: "gratitud, familia, pavo" },
    { date: d(blackFriday), name: "Black Friday", country: "US", ideas: "descuentos fuertes, urgencia, solo por hoy" },
    { date: d(cyberMonday), name: "Cyber Monday", country: "US", ideas: "ventas en línea, citas o compras por internet" },
    { date: iso(y, 12, 12), name: "Día de la Virgen de Guadalupe", country: "MX", ideas: "tradición, peregrinación (con respeto)" },
    { date: iso(y, 12, 16), name: "Posadas", country: "MX", ideas: "posadas, piñatas, ponche, fiestas de fin de año" },
    { date: iso(y, 12, 24), name: "Nochebuena y Navidad", country: "MX/US", ideas: "regalos, tarjetas de regalo, cena, familia" },
    { date: iso(y, 12, 31), name: "Fin de año", country: "MX/US", ideas: "fiesta, brindis, resumen del año, propósitos" },
  ];
}

/** Fechas especiales que vienen en los próximos `days` días (o que acaban de pasar hace menos de 2 días). */
export function upcomingDates(from = new Date(), days = 45): (SpecialDate & { inDays: number })[] {
  const y = from.getUTCFullYear();
  const today = Date.UTC(y, from.getUTCMonth(), from.getUTCDate());
  return [...datesFor(y), ...datesFor(y + 1)]
    .map((s) => ({ ...s, inDays: Math.round((Date.parse(s.date) - today) / 864e5) }))
    .filter((s) => s.inDays >= -1 && s.inDays <= days)
    .sort((a, b) => a.inDays - b.inDays);
}
