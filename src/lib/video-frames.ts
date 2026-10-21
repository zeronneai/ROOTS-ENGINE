"use client";

/** Saca fotos repartidas de un video (o la imagen misma) en el navegador, como JPEG base64. */
export async function grabFrames(src: string, kind: "video" | "image", count = 6): Promise<string[]> {
  if (kind === "image") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    return [draw(img, img.naturalWidth, img.naturalHeight)];
  }
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = src;
  await new Promise<void>((ok, fail) => {
    v.onloadedmetadata = () => ok();
    v.onerror = () => fail(new Error("No pude abrir el video"));
  });
  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    v.currentTime = ((i + 0.5) / count) * d;
    await new Promise<void>((ok) => {
      const done = () => ok();
      v.addEventListener("seeked", done, { once: true });
      setTimeout(done, 4000);
    });
    if (v.videoWidth) out.push(draw(v, v.videoWidth, v.videoHeight));
  }
  v.removeAttribute("src");
  v.load();
  return out;
}

function draw(el: CanvasImageSource, w: number, h: number) {
  const scale = Math.min(1, 640 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.75).split(",")[1];
}
