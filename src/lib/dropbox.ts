import yauzl from "yauzl";

/**
 * Dropbox sin API: los links compartidos se descargan directo con ?dl=1.
 * - Link a un archivo: se baja el archivo.
 * - Link a una carpeta: Dropbox la entrega como .zip; de ahí sacamos el video más nuevo que no se haya usado.
 */

const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const IMAGE = /\.(jpe?g|png|webp)$/i;

export function directDropboxUrl(url: string) {
  const u = new URL(url.trim());
  if (!/(^|\.)dropbox\.com$/i.test(u.hostname) && !/dropboxusercontent\.com$/i.test(u.hostname)) throw new Error("El link no es de Dropbox");
  u.searchParams.delete("dl");
  u.searchParams.delete("raw");
  u.searchParams.set("dl", "1");
  return u.toString();
}

export const isDropboxFolder = (url: string) => /dropbox\.com\/(scl\/fo|sh)\//i.test(url);

async function download(url: string, maxMb = 1500) {
  const res = await fetch(directDropboxUrl(url), { redirect: "follow" });
  if (!res.ok) throw new Error(`Dropbox respondió ${res.status}. Revisa que el link sea público ("cualquiera con el link").`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len > maxMb * 1024 * 1024) throw new Error(`El archivo de Dropbox pesa más de ${maxMb} MB`);
  const buf = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  return { buf, name: name ? decodeURIComponent(name) : null, type: res.headers.get("content-type") ?? "" };
}

function readZip(buf: Buffer): Promise<{ name: string; modified: Date; size: number; read: () => Promise<Buffer> }[]> {
  return new Promise((ok, bad) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return bad(err ?? new Error("zip inválido"));
      const out: { name: string; modified: Date; size: number; read: () => Promise<Buffer> }[] = [];
      zip.on("entry", (e: yauzl.Entry) => {
        if (!e.fileName.endsWith("/")) {
          out.push({
            name: e.fileName,
            modified: e.getLastModDate(),
            size: e.uncompressedSize,
            read: () =>
              new Promise((res, rej) =>
                zip.openReadStream(e, (er, stream) => {
                  if (er || !stream) return rej(er ?? new Error("no se pudo leer"));
                  const chunks: Buffer[] = [];
                  stream.on("data", (c: Buffer) => chunks.push(c));
                  stream.on("end", () => res(Buffer.concat(chunks)));
                  stream.on("error", rej);
                }),
              ),
          });
        }
        zip.readEntry();
      });
      zip.on("end", () => ok(out));
      zip.on("error", bad);
      zip.readEntry();
    });
  });
}

/** Baja el video (o imagen) del link de Dropbox. En carpetas, el más nuevo que no esté en `used`. */
export async function fetchDropboxMedia(url: string, used: string[] = []) {
  const { buf, name, type } = await download(url);
  const isZip = isDropboxFolder(url) || /zip/i.test(type) || (name ?? "").toLowerCase().endsWith(".zip");
  if (!isZip) {
    const fname = name ?? "video.mp4";
    if (/text\/html/i.test(type)) throw new Error("Dropbox regresó una página en vez del archivo. Revisa que el link sea público.");
    return { buffer: buf, name: fname, kind: IMAGE.test(fname) ? ("image" as const) : ("video" as const) };
  }
  const entries = (await readZip(buf))
    .filter((e) => VIDEO.test(e.name) || IMAGE.test(e.name))
    .filter((e) => !used.includes(e.name))
    .sort((a, b) => b.modified.getTime() - a.modified.getTime());
  const pick = entries[0];
  if (!pick) throw new Error("No hay videos nuevos en la carpeta de Dropbox (los que hay ya se publicaron).");
  return { buffer: await pick.read(), name: pick.name, kind: IMAGE.test(pick.name) ? ("image" as const) : ("video" as const) };
}

export const mimeFor = (name: string) =>
  /\.mov$/i.test(name) ? "video/quicktime" : /\.webm$/i.test(name) ? "video/webm" : /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : /\.jpe?g$/i.test(name) ? "image/jpeg" : "video/mp4";
