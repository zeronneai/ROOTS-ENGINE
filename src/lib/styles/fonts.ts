/** Fuentes self-hosted en public/fonts (ver scripts/setup-assets.mjs). */
export const FONT_FILES: Record<string, { slug: string; weights: number[] }> = {
  Anton: { slug: "anton", weights: [400] },
  Inter: { slug: "inter", weights: [400, 600, 800] },
  "Playfair Display": { slug: "playfair-display", weights: [700, 900] },
  "Luckiest Guy": { slug: "luckiest-guy", weights: [400] },
  "Bebas Neue": { slug: "bebas-neue", weights: [400] },
  Bungee: { slug: "bungee", weights: [400] },
  Nunito: { slug: "nunito", weights: [800] },
  "Cormorant Garamond": { slug: "cormorant-garamond", weights: [600] },
  Rye: { slug: "rye", weights: [400] },
  Montserrat: { slug: "montserrat", weights: [700, 900] },
  "Josefin Sans": { slug: "josefin-sans", weights: [300, 600] },
};

export const AVAILABLE_FONTS = Object.keys(FONT_FILES);
