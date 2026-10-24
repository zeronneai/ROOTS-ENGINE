import "server-only";
import type { AuditReport } from "@/lib/ai/audit";
import { AUDIT_T } from "@/components/audit/AuditReport";
import type { AuditLink, CompetitorLinks } from "./audits";

/**
 * La auditoría en HTML simple, con estilos en línea y tablas: así Google (Apps Script) la
 * convierte a PDF para el correo, y también se lee bien como cuerpo de correo.
 * Sin imágenes ni degradados (el convertidor de Google no los respeta).
 */

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const PURPLE = "#4f4789";
const DEEP = "#3b3569";
const SUN = "#fce762";
const INK = "#211c35";
const MUTED = "#6e6a80";
const LINE = "#e8e5ef";
const OK = "#15803d";
const BAD = "#b91c1c";
const tone = (s: number) => (s >= 75 ? OK : s >= 50 ? "#c2410c" : BAD);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function auditHtml(opts: {
  r: AuditReport;
  business: string;
  city: string;
  date: string;
  lang: "en" | "es";
  links: AuditLink[];
  compLinks: CompetitorLinks;
  shareUrl: string;
}) {
  const { r, lang, links, compLinks } = opts;
  const t = AUDIT_T[lang];
  const h2 = (n: string, title: string, sub?: string) =>
    `<p style="margin:28px 0 2px;font-size:11px;letter-spacing:2px;color:${PURPLE}">${n}</p><h2 style="margin:0 0 ${sub ? 2 : 12}px;font-size:22px;color:${INK}">${esc(title)}</h2>${sub ? `<p style="margin:0 0 12px;color:${MUTED}">${esc(sub)}</p>` : ""}`;
  const box = (inner: string, bg = "#ffffff") =>
    `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 10px"><tr><td style="background:${bg};border:1px solid ${LINE};border-radius:12px;padding:14px 16px">${inner}</td></tr></table>`;
  const li = (items: string[], mark: string, color: string) =>
    items.map((x) => `<p style="margin:0 0 6px"><span style="color:${color};font-weight:bold">${mark}</span> ${esc(x)}</p>`).join("");

  const areaRows = r.areas
    .map((a) => `<td style="padding:8px;background:${DEEP};color:#fff;border-radius:8px;font-size:12px;text-align:center">${esc(t.areas[a.key])}<br><b style="font-size:18px;color:${SUN}">${a.score}</b></td>`)
    .join(`<td width="6"></td>`);

  const linkChips = links
    .map((l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:0 6px 6px 0;padding:5px 10px;border:1px solid #8f86c9;border-radius:20px;color:#ffffff;text-decoration:none;font-size:13px"><b style="color:${SUN};font-size:11px">${esc(t.kinds[l.kind])}</b> ${esc(l.label)}</a>`)
    .join("");

  const cover = `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:${PURPLE};color:#ffffff;border-radius:18px;padding:26px 26px 20px">
    <table width="100%"><tr><td style="font-size:11px;letter-spacing:3px;color:#e9e6f7">${esc(t.kicker).toUpperCase()}</td><td align="right" style="font-size:12px;color:#e9e6f7">${esc(opts.date)}</td></tr></table>
    <p style="margin:22px 0 0;font-size:13px;color:#e9e6f7">${esc(t.prepared)}</p>
    <table width="100%"><tr>
      <td valign="top"><h1 style="margin:4px 0 2px;font-size:34px;line-height:1.05;color:#ffffff">${esc(opts.business)}</h1><p style="margin:0;color:#e9e6f7">${esc(opts.city)}</p></td>
      <td width="120" align="center" valign="top"><div style="border:6px solid ${SUN};border-radius:60px;width:96px;height:96px;text-align:center"><div style="font-size:38px;font-weight:bold;line-height:66px;color:#ffffff">${r.score}</div><div style="font-size:10px;color:#e9e6f7;line-height:12px">/100</div></div></td>
    </tr></table>
    ${links.length ? `<p style="margin:14px 0 6px;font-size:10px;letter-spacing:2px;color:#e9e6f7">${esc(t.reviewed).toUpperCase()}</p>${linkChips}` : ""}
    <p style="margin:16px 0 6px;font-size:19px;font-weight:bold;color:${SUN};line-height:1.3">${esc(r.headline)}</p>
    <p style="margin:0 0 16px;color:#ffffff;line-height:1.5">${esc(r.summary)}</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>${areaRows}</tr></table>
  </td></tr></table>`;

  const leave = r.leaveAlone.length ? h2("01", t.leave) + box(li(r.leaveAlone, "✓", OK)) : "";

  const lost =
    h2("02", t.lost) +
    r.customersLost
      .map((x) => box(`<p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:1px;color:${PURPLE}">${esc(x.moment).toUpperCase()}</p><p style="margin:4px 0">${esc(x.whatHappens)}</p><p style="margin:0;color:${BAD};font-size:13px">${esc(x.cost)}</p>`))
      .join("");

  const moves =
    h2("03", t.moves, t.movesSub) +
    r.firstMoves
      .slice(0, 3)
      .map((m, i) =>
        box(
          `<table width="100%"><tr><td width="44" valign="top" style="font-size:34px;font-weight:bold;color:${PURPLE}">${i + 1}</td><td valign="top"><p style="margin:0;font-size:16px;font-weight:bold">${esc(m.title)}</p><p style="margin:2px 0 6px;font-size:12px;color:${PURPLE}">${esc(m.timeframe)}</p><p style="margin:0 0 6px;color:${MUTED}">${esc(m.why)}</p><p style="margin:0">${esc(m.how)}</p></td></tr></table>`,
          "#fffded",
        ),
      )
      .join("");

  const area = (k: (typeof r.areas)[number]) => {
    let extra = "";
    if (k.key === "social") {
      const s = r.social;
      extra =
        box(
          `<p style="margin:0 0 4px;font-size:11px;letter-spacing:1px;color:${MUTED}">${esc(t.first).toUpperCase()}</p><p style="margin:0 0 8px;font-weight:bold">${esc(s.firstImpression.verdict)}</p>` +
            [
              [t.bio, s.firstImpression.bio],
              [t.photo, s.firstImpression.photo],
              [t.highlights, s.firstImpression.highlights],
              [t.link, s.firstImpression.link],
            ]
              .map(([a, b]) => `<p style="margin:0 0 4px"><b>${esc(a)}:</b> <span style="color:${MUTED}">${esc(b)}</span></p>`)
              .join(""),
          "#fffded",
        ) +
        (s.contentAndHooks.stopTheScroll.length ? `<p style="margin:8px 0 4px;font-weight:bold;color:${OK}">${esc(t.stop)}</p>${li(s.contentAndHooks.stopTheScroll, "•", OK)}` : "") +
        (s.contentAndHooks.losePeople.length ? `<p style="margin:8px 0 4px;font-weight:bold;color:${BAD}">${esc(t.lose)}</p>${li(s.contentAndHooks.losePeople, "•", BAD)}` : "") +
        `<p style="margin:8px 0 4px"><b>${esc(t.cadence)}:</b> <span style="color:${MUTED}">${esc(s.contentAndHooks.cadence)}</span></p><p style="margin:0 0 8px"><b>${esc(t.consistency)}:</b> <span style="color:${MUTED}">${esc(s.brandConsistency)}</span></p>`;
    }
    if (k.key === "google") {
      const g = r.google;
      extra =
        `<p style="margin:8px 0"><b>${esc(t.standing)}:</b> <span style="color:${MUTED}">${esc(g.standing)}</span></p>` +
        (g.loves.length ? `<p style="margin:8px 0 4px;font-weight:bold;color:${OK}">${esc(t.loves)}</p>` + g.loves.map((x) => `<p style="margin:0 0 6px"><b>${esc(x.theme)}</b> <i style="color:${MUTED}">“${esc(x.quote)}”</i></p>`).join("") : "") +
        (g.complaints.length
          ? `<p style="margin:8px 0 4px;font-weight:bold;color:${BAD}">${esc(t.complaints)}</p>` +
            g.complaints.map((x) => `<p style="margin:0 0 6px"><b>${esc(x.theme)}</b> <i style="color:${MUTED}">“${esc(x.quote)}”</i><br><b style="color:${OK}">${esc(t.fix)}:</b> ${esc(x.fix)}</p>`).join("")
          : "") +
        (g.profileGaps.length ? `<p style="margin:8px 0 4px;font-weight:bold">${esc(t.gaps)}</p>${li(g.profileGaps, "•", "#c2410c")}` : "");
    }
    const problems = k.problems
      .map(
        (p) =>
          `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0"><tr><td style="background:#faf9fc;border-radius:10px;padding:10px 12px;font-size:14px"><b>${esc(p.problem)}</b> <span style="font-size:11px;color:${p.priority === "high" ? BAD : MUTED}">· ${esc(t.priority[p.priority])}</span><br><span style="color:${MUTED}"><b style="color:${INK}">${esc(t.evidence)}:</b> ${esc(p.evidence)}</span><br><b style="color:${OK}">${esc(t.fix)}:</b> ${esc(p.fix)}</td></tr></table>`,
      )
      .join("");
    return box(
      `<table width="100%"><tr><td><span style="font-size:18px;font-weight:bold">${esc(t.areas[k.key])}</span></td><td align="right"><span style="background:${tone(k.score)};color:#fff;border-radius:12px;padding:3px 10px;font-weight:bold;font-size:13px">${k.score}/100</span></td></tr></table>` +
        `<p style="margin:6px 0;color:${MUTED}">${esc(k.verdict)}</p>` +
        extra +
        (k.working.length ? `<p style="margin:8px 0 4px;font-weight:bold;color:${OK}">${esc(t.working)}</p>${li(k.working, "✓", OK)}` : "") +
        problems,
    );
  };
  const deep = h2("04", t.deep) + r.areas.map(area).join("");

  const comps = r.competitors.length
    ? h2("05", t.competitors) +
      r.competitors
        .map((c) => {
          const l = compLinks[norm(c.name)] ?? {};
          const ig = c.instagram ? `<a href="${esc(l.instagram ?? `https://www.instagram.com/${c.instagram.replace(/^@/, "")}/`)}" style="color:${PURPLE}">@${esc(c.instagram.replace(/^@/, ""))}</a>${c.followers != null ? ` · ${c.followers.toLocaleString("en-US")} ${esc(t.followers)}` : ""}` : "";
          const meta = [c.rating != null ? `★ ${c.rating} · ${c.reviews ?? 0} ${esc(t.reviews)}` : "", ig, l.google ? `<a href="${esc(l.google)}" style="color:${PURPLE}">Google</a>` : "", l.website ? `<a href="${esc(l.website)}" style="color:${PURPLE}">${esc(t.kinds.website)}</a>` : ""].filter(Boolean).join(" · ");
          return box(`<p style="margin:0;font-size:16px;font-weight:bold">${esc(c.name)}</p><p style="margin:2px 0 8px;font-size:12px;color:${MUTED}">${meta}</p><p style="margin:0 0 4px"><b style="color:${BAD}">${esc(t.better)}:</b> ${esc(c.doingBetter)}</p><p style="margin:0"><b style="color:${OK}">${esc(t.win)}:</b> ${esc(c.whereYouWin)}</p>`);
        })
        .join("")
    : "";

  const quick = r.quickWins.length ? h2("06", t.quick) + box(li(r.quickWins, "☐", PURPLE)) : "";
  const notChecked = r.notChecked.length ? `<p style="margin:18px 0;font-size:12px;color:${MUTED}"><b>${esc(t.notChecked)}:</b> ${esc(r.notChecked.join(" · "))}</p>` : "";
  const closing = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td style="background:${PURPLE};color:#fff;border-radius:18px;padding:22px 24px"><p style="margin:0 0 12px;line-height:1.5">${esc(r.closingNote)}</p><p style="margin:0 0 6px;font-size:18px;font-weight:bold">${esc(t.cta)}</p><p style="margin:0">WhatsApp: <a href="https://wa.me/19152343655" style="color:${SUN}">+1 (915) 234-3655</a> · <a href="https://purpleroots.agency" style="color:${SUN}">purpleroots.agency</a></p></td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:${INK};max-width:760px;margin:0 auto">${cover}${leave}${lost}${moves}${deep}${comps}${quick}${notChecked}${closing}<p style="text-align:center;font-size:11px;color:${MUTED};margin:14px 0">${esc(t.footer)}</p></div>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(opts.business)} · ${esc(t.kicker)}</title></head><body style="margin:0;padding:16px;background:#ffffff">${body}</body></html>`;
}
