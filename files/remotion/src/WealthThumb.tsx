import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";

// MINIATURE de la machine Wealth — reproduit au pixel près le code des chaînes de la niche
// (Luxury Edge, Trophy Liability, Jenni Peterson, babyporcelana…) relevé sur leurs 8 miniatures les plus vues :
//   • fond : vue AÉRIENNE photoréaliste d'une mansion en péril (inondée, au bord d'une falaise effondrée,
//     frappée par une vague), ciel de tempête — générée à part, passée ici en `image` ;
//   • bandeau bas-gauche sur DEUX lignes :
//       ligne 1 = étiquette rouge « BREAKING » + boîte blanche avec le LIEU en noir,
//       ligne 2 = boîte blanche, 2-3 mots en NOIR ultra-gras condensé (« MALIBU ALERT », « MANSIONS SLIDING »).
//   • aucun visage, aucune flèche, aucun emoji, aucun cadre.
// Rendu en PNG par `npx remotion still WealthThumb` (aucune animation).
export const wealthThumbSchema = z.object({
  image: z.string(),            // fichier dans public/<dir>/
  dir: z.string().optional(),
  place: z.string(),            // « MALIBU », « KEY BISCAYNE »
  headline: z.string(),         // « MALIBU ALERT », « ALMOST GONE », « MANSIONS SLIDING »
  badge: z.string().optional(), // « BREAKING » par défaut
});
type Props = z.infer<typeof wealthThumbSchema>;

const W = 1280, H = 720;
const RED = "#e01b24";
const CONDENSED = "Impact, 'Haettenschweiler', 'Arial Narrow Bold', 'Arial Black', sans-serif";

/** Taille du gros titre : mesurée sur les miniatures concurrentes, qui remplissent 60 à 85 % de la largeur. */
function headlineSize(text: string): number {
  const n = Math.max(1, text.length);
  if (n <= 9) return 126;
  if (n <= 13) return 114;
  if (n <= 17) return 100;
  if (n <= 21) return 86;
  return 74;
}

export const WealthThumb: React.FC<Props> = ({ image, dir, place, headline, badge }) => {
  const src = image ? staticFile(dir ? `${dir}/${image}` : image) : null;
  const hl = String(headline || "").toUpperCase();
  const pl = String(place || "").toUpperCase();
  const size = headlineSize(hl);
  const shadow = "0 6px 18px rgba(0,0,0,.45)";
  return (
    <AbsoluteFill style={{ width: W, height: H, background: "#111", overflow: "hidden" }}>
      {src ? <Img src={src} style={{ width: W, height: H, objectFit: "cover" }} /> : null}
      {/* léger assombrissement du bas : le bandeau doit détacher même sur une écume blanche */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, background: "linear-gradient(0deg, rgba(0,0,0,.45), transparent)" }} />
      <div style={{ position: "absolute", left: 26, bottom: 24, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        {/* ligne 1 : BREAKING + lieu */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 6, boxShadow: shadow }}>
          <div style={{ background: RED, color: "#fff", fontFamily: CONDENSED, fontSize: 34, letterSpacing: 1.5, padding: "7px 16px 9px", lineHeight: 1, display: "flex", alignItems: "center" }}>
            {(badge || "BREAKING").toUpperCase()}
          </div>
          {pl ? (
            <div style={{ background: "#fff", color: "#0a0a0a", fontFamily: CONDENSED, fontSize: 34, letterSpacing: 1.2, padding: "7px 18px 9px", lineHeight: 1, display: "flex", alignItems: "center" }}>
              {pl}
            </div>
          ) : null}
        </div>
        {/* ligne 2 : le gros titre */}
        <div
          style={{
            background: "#fff",
            color: "#0a0a0a",
            fontFamily: CONDENSED,
            fontSize: size,
            lineHeight: 0.98,
            letterSpacing: -0.5,
            padding: "8px 20px 16px",
            boxShadow: shadow,
            maxWidth: W - 60,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {hl}
        </div>
      </div>
    </AbsoluteFill>
  );
};
