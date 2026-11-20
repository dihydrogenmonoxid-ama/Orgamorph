// PNG-Export (§12): SVG → Image → Canvas → Blob. Nur reines SVG, daher kein „verschmutzter“ Canvas.

export type PngResolution = "screen" | "double" | "printA4" | "printA3";

const LONG_EDGE_PX_300DPI = {
  printA4: Math.round((297 / 25.4) * 300),
  printA3: Math.round((420 / 25.4) * 300),
};

/** Skalierungsfaktor für die gewählte Auflösung (bezogen auf die SVG-Größe in px). */
export function pngScale(res: PngResolution, w: number, h: number): number {
  if (res === "screen") return 1;
  if (res === "double") return 2;
  const long = LONG_EDGE_PX_300DPI[res];
  return long / Math.max(w, h, 1);
}

export async function svgToPng(svg: string, w: number, h: number, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svgLoad"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    // Browser begrenzen die Canvasgröße; 16384 px ist überall unkritisch
    const s = Math.min(scale, 16384 / Math.max(w, h, 1));
    canvas.width = Math.max(1, Math.round(w * s));
    canvas.height = Math.max(1, Math.round(h * s));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("noCanvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
