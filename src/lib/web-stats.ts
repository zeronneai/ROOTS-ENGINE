/** Resumen de la analítica web a partir de los eventos crudos. */
export type WebEvent = {
  ts: string; type: "pageview" | "leave" | "click"; visitor: string; session: string; path: string; title: string | null;
  ref_domain: string | null; utm_source: string | null; utm_medium: string | null; device: string | null; browser: string | null;
  country: string | null; city: string | null; duration_ms: number | null; scroll: number | null; label: string | null;
};

const SOCIAL: Record<string, string> = {
  "instagram.com": "Instagram", "l.instagram.com": "Instagram", "facebook.com": "Facebook", "m.facebook.com": "Facebook", "l.facebook.com": "Facebook", "lm.facebook.com": "Facebook",
  "tiktok.com": "TikTok", "google.com": "Google", "google.com.mx": "Google", "bing.com": "Bing", "youtube.com": "YouTube", "t.co": "X", "linktr.ee": "Linktree", "yelp.com": "Yelp",
};

const count = <T,>(items: T[], key: (x: T) => string | null) => {
  const m = new Map<string, number>();
  for (const x of items) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
};

export function sourceOf(e: Pick<WebEvent, "ref_domain" | "utm_source">) {
  if (e.utm_source) return e.utm_source.charAt(0).toUpperCase() + e.utm_source.slice(1);
  if (!e.ref_domain) return "Directo";
  const d = e.ref_domain.replace(/^www\./, "");
  return SOCIAL[d] ?? (d.includes("google.") ? "Google" : d);
}

export function summarize(events: WebEvent[], days: number) {
  const views = events.filter((e) => e.type === "pageview");
  const leaves = events.filter((e) => e.type === "leave");
  const clicks = events.filter((e) => e.type === "click");

  // sesiones: primera página (fuente), páginas vistas, tiempo y última página
  const sessions = new Map<string, { first: WebEvent; pages: WebEvent[]; time: number; device: string | null; country: string | null }>();
  for (const v of [...views].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const s = sessions.get(v.session) ?? { first: v, pages: [], time: 0, device: v.device, country: v.country };
    s.pages.push(v);
    sessions.set(v.session, s);
  }
  for (const l of leaves) {
    const s = sessions.get(l.session);
    if (s) s.time += l.duration_ms ?? 0;
  }
  const sess = [...sessions.values()];
  const bounces = sess.filter((s) => s.pages.length === 1 && s.time < 10_000).length;

  // por página
  const pageMap = new Map<string, { path: string; title: string | null; views: number; visitors: Set<string>; time: number[]; scroll: number[]; exits: number; entries: number }>();
  const page = (p: string, title: string | null) => {
    let x = pageMap.get(p);
    if (!x) pageMap.set(p, (x = { path: p, title, views: 0, visitors: new Set(), time: [], scroll: [], exits: 0, entries: 0 }));
    if (title && !x.title) x.title = title;
    return x;
  };
  for (const v of views) {
    const x = page(v.path, v.title);
    x.views++;
    x.visitors.add(v.visitor);
  }
  for (const l of leaves) {
    const x = page(l.path, null);
    if (l.duration_ms != null) x.time.push(l.duration_ms);
    if (l.scroll != null) x.scroll.push(l.scroll);
  }
  for (const s of sess) {
    page(s.pages[0].path, null).entries++;
    page(s.pages[s.pages.length - 1].path, null).exits++;
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const pages = [...pageMap.values()]
    .filter((p) => p.views > 0)
    .map((p) => ({
      path: p.path,
      title: p.title,
      views: p.views,
      visitors: p.visitors.size,
      avgSeconds: Math.round(avg(p.time) / 1000),
      avgScroll: Math.round(avg(p.scroll)),
      entries: p.entries,
      exits: p.exits,
      exitRate: p.views ? Math.round((p.exits / p.views) * 100) : 0,
    }))
    .sort((a, b) => b.views - a.views);

  // por día
  const byDay = new Map<string, { views: number; visitors: Set<string> }>();
  for (const v of views) {
    const d = v.ts.slice(0, 10);
    const x = byDay.get(d) ?? { views: 0, visitors: new Set<string>() };
    x.views++;
    x.visitors.add(v.visitor);
    byDay.set(d, x);
  }
  const series: { day: string; views: number; visitors: number }[] = [];
  for (let k = days - 1; k >= 0; k--) {
    const d = new Date(Date.now() - k * 864e5).toISOString().slice(0, 10);
    series.push({ day: d, views: byDay.get(d)?.views ?? 0, visitors: byDay.get(d)?.visitors.size ?? 0 });
  }

  return {
    visitors: new Set(views.map((v) => v.visitor)).size,
    sessions: sess.length,
    pageviews: views.length,
    avgSessionSeconds: sess.length ? Math.round(sess.reduce((a, s) => a + s.time, 0) / sess.length / 1000) : 0,
    pagesPerSession: sess.length ? +(views.length / sess.length).toFixed(1) : 0,
    bounceRate: sess.length ? Math.round((bounces / sess.length) * 100) : 0,
    pages: pages.slice(0, 25),
    sources: count(sess, (s) => sourceOf(s.first)).slice(0, 10),
    devices: count(sess, (s) => s.device),
    countries: count(sess, (s) => s.country).slice(0, 8),
    cities: count(views, (v) => v.city).slice(0, 8),
    browsers: count(sess, (s) => s.first.browser),
    clicks: count(clicks, (c) => c.label).slice(0, 12),
    series,
  };
}

export type WebSummary = ReturnType<typeof summarize>;

/** Quién está ahorita (últimos 5 minutos). */
export function realtime(events: WebEvent[]) {
  const since = Date.now() - 5 * 60_000;
  const recent = events.filter((e) => Date.parse(e.ts) >= since);
  const lastBySession = new Map<string, WebEvent>();
  for (const e of recent.sort((a, b) => a.ts.localeCompare(b.ts))) if (e.type === "pageview") lastBySession.set(e.session, e);
  const now = [...lastBySession.values()];
  return { active: new Set(recent.map((e) => e.session)).size, pages: count(now, (e) => e.path).slice(0, 6) };
}
