/**
 * Correos con Resend (gratis hasta 3,000 al mes). Sin RESEND_API_KEY no se manda nada y no truena.
 * EMAIL_FROM: "Purple Roots <avisos@tudominio.com>" (el dominio se verifica en resend.com).
 * Sin dominio verificado, Resend solo deja mandar a tu propio correo desde onboarding@resend.dev.
 */
export async function sendEmail(opts: { to: string[]; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  const to = [...new Set(opts.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (!key || !to.length) return { sent: false, reason: !key ? "Falta RESEND_API_KEY" : "Sin correos" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Purple Roots <onboarding@resend.dev>",
      to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) return { sent: false, reason: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { sent: true, reason: null };
}

export const appUrl = () => (process.env.APP_URL || "https://roots-engine.vercel.app").replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Correo simple con el estilo de Purple Roots. */
export function simpleEmail(title: string, lines: string[], button: { label: string; href: string }) {
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="font-size:12px;letter-spacing:2px;color:#7c3aed;font-weight:bold">PURPLE ROOTS</div>
  <h1 style="font-size:22px;margin:12px 0">${esc(title)}</h1>
  ${lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:8px 0">${esc(l)}</p>`).join("")}
  <p style="margin:24px 0"><a href="${button.href}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">${esc(button.label)}</a></p>
  <p style="font-size:12px;color:#888">Si el botón no abre, copia este link: ${button.href}</p>
</div>`;
  const text = `${title}\n\n${lines.join("\n")}\n\n${button.label}: ${button.href}`;
  return { html, text };
}
