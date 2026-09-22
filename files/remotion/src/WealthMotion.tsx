import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { z } from "zod";

// Motion design de la machine WEALTH — toutes les cartes d'un run rendues EN UNE SEULE passe (une <Sequence>
// par carte, durées exactes en secondes), puis découpées par FFmpeg. Deux lots par run :
//  - plein écran (intro / title / stat / list / quote) → MP4 direct (aucune vidéo décodée : aucun gel Remotion)
//  - bandeaux (lowerthird) → séquence PNG transparente incrustée par FFmpeg à l'instant voulu (transparent: true)
// Le thème (fond, accent doré, police) est un paramètre : il vient des réglages de la machine (dérivés de la niche).
export const FPS = 30;

const cardSchema = z.object({
  kind: z.enum(["intro", "title", "stat", "list", "quote", "lowerthird", "kicker", "headline", "dossier", "compare"]),
  seconds: z.number(),
  n: z.number().optional(),
  title: z.string().optional(),
  sub: z.string().optional(),
  items: z.array(z.string()).optional(),
  number: z.string().optional(),
  label: z.string().optional(),
  author: z.string().optional(),
  image: z.string().optional(),   // dossier : fichier dans public/<dir>/
  image2: z.string().optional(),  // compare : 2e image
  stamp: z.string().optional(),   // dossier : tampon (« PROPERTY FILE », « CASE FILE »)
  leftLabel: z.string().optional(),
  rightLabel: z.string().optional(),
});
export const wealthMotionSchema = z.object({
  dir: z.string().optional(),     // dossier public/<dir>/ des images (staticFile)
  cards: z.array(cardSchema),
  theme: z.object({
    bg: z.string(),
    bg2: z.string(),
    accent: z.string(),
    fg: z.string(),
    muted: z.string(),
    font: z.string(),
  }),
  transparent: z.boolean(),
});
export type WealthMotionProps = z.infer<typeof wealthMotionSchema>;
type Card = z.infer<typeof cardSchema>;
type Theme = WealthMotionProps["theme"];

export const DEFAULT_THEME: Theme = {
  bg: "#0a0d14",
  bg2: "#161c2a",
  accent: "#d4af37",
  fg: "#ffffff",
  muted: "#aab0bd",
  font: "'Segoe UI', Inter, Arial, sans-serif",
};

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Fondu de sortie commun : la carte disparaît sur les 12 dernières frames. */
function useInOut(total: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 14, stiffness: 120, mass: 0.8 } });
  const out = interpolate(frame, [total - 12, total - 1], [1, 0], clamp);
  return { frame, fps, inP, out };
}

/** Fond animé : dégradé profond + halo doré qui dérive + vignette + fines lignes. */
const Background: React.FC<{ theme: Theme; seconds: number }> = ({ theme, seconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const drift = Math.sin((t / Math.max(seconds, 1)) * Math.PI) * 6;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${theme.bg} 0%, ${theme.bg2} 60%, ${theme.bg} 100%)` }}>
      <div
        style={{
          position: "absolute",
          left: `${28 + drift}%`,
          top: `${30 - drift / 2}%`,
          width: 1100,
          height: 1100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.accent}22 0%, ${theme.accent}08 35%, transparent 70%)`,
          transform: "translate(-50%,-50%)",
          filter: "blur(6px)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)" }} />
      <div style={{ position: "absolute", left: 96, right: 96, top: 88, height: 2, background: `linear-gradient(90deg, transparent, ${theme.accent}66, transparent)` }} />
      <div style={{ position: "absolute", left: 96, right: 96, bottom: 88, height: 2, background: `linear-gradient(90deg, transparent, ${theme.accent}66, transparent)` }} />
    </AbsoluteFill>
  );
};

/** Texte mot à mot : chaque mot monte + s'éclaircit avec un léger décalage. */
const Words: React.FC<{ text: string; delay: number; style: React.CSSProperties; theme: Theme; perWord?: number }> = ({ text, delay, style, perWord = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = String(text || "").split(/\s+/).filter(Boolean);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 0.28em", ...style }}>
      {words.map((w, i) => {
        const p = spring({ frame: frame - delay - i * perWord, fps, config: { damping: 16, stiffness: 140, mass: 0.7 } });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 34}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** Compteur : "$2,400,000" / "40%" / "12 M" → monte de 0 à la valeur en ~1,3 s (ease-out), même format. */
function countUp(numberStr: string, progress: number): string {
  const m = /^([^\d\-]*)(-?[\d.,\s]+)(.*)$/.exec(String(numberStr || "").trim());
  if (!m) return numberStr;
  const [, prefix, raw, suffix] = m;
  const clean = raw.replace(/[\s,]/g, "");
  const decimals = clean.includes(".") ? clean.split(".")[1].length : 0;
  const target = Number(clean);
  if (!isFinite(target)) return numberStr;
  const eased = Easing.out(Easing.cubic)(Math.min(1, Math.max(0, progress)));
  const v = target * eased;
  const useSep = /,/.test(raw) || Math.abs(target) >= 10000;
  const str = useSep ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals);
  return `${prefix}${str}${suffix}`;
}

const IntroCard: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const { frame, fps, out } = useInOut(total);
  const line = interpolate(frame, [8, 34], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const subP = spring({ frame: frame - 26, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, color: theme.fg, justifyContent: "center", alignItems: "center", padding: "0 160px" }}>
      <Words text={c.title || ""} delay={4} theme={theme} style={{ fontSize: 96, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.06, textAlign: "center", textShadow: "0 8px 40px rgba(0,0,0,.5)" }} />
      <div style={{ width: 520 * line, height: 5, background: theme.accent, borderRadius: 3, margin: "34px 0 26px", boxShadow: `0 0 24px ${theme.accent}88` }} />
      {c.sub ? (
        <div style={{ fontSize: 38, fontWeight: 500, color: theme.muted, opacity: subP, transform: `translateY(${(1 - subP) * 20}px)`, textAlign: "center", letterSpacing: 2, textTransform: "uppercase" }}>
          {c.sub}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const { frame, fps, inP, out } = useInOut(total);
  const line = interpolate(frame, [10, 36], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const subP = spring({ frame: frame - 22, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, color: theme.fg, justifyContent: "center", alignItems: "center", padding: "0 140px" }}>
      {c.n != null ? (
        <div
          style={{
            transform: `scale(${inP})`,
            width: 132,
            height: 132,
            borderRadius: "50%",
            border: `4px solid ${theme.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 66,
            fontWeight: 900,
            color: theme.accent,
            marginBottom: 34,
            boxShadow: `0 0 40px ${theme.accent}55, inset 0 0 30px ${theme.accent}22`,
          }}
        >
          {c.n}
        </div>
      ) : null}
      <Words text={c.title || ""} delay={8} theme={theme} style={{ fontSize: 84, fontWeight: 900, letterSpacing: -1, lineHeight: 1.08, textAlign: "center", textShadow: "0 8px 40px rgba(0,0,0,.5)" }} />
      <div style={{ width: 380 * line, height: 4, background: theme.accent, borderRadius: 2, margin: "30px 0 22px" }} />
      {c.sub ? <div style={{ fontSize: 34, color: theme.muted, opacity: subP, transform: `translateY(${(1 - subP) * 18}px)`, textAlign: "center", maxWidth: 1300, lineHeight: 1.35 }}>{c.sub}</div> : null}
    </AbsoluteFill>
  );
};

const StatCard: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const { frame, fps, inP, out } = useInOut(total);
  const progress = interpolate(frame, [6, 6 + 1.3 * fps], [0, 1], clamp);
  const labelP = spring({ frame: frame - 18, fps, config: { damping: 15, stiffness: 120 } });
  const pulse = 1 + 0.015 * Math.sin((frame / fps) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, color: theme.fg, justifyContent: "center", alignItems: "center", padding: "0 140px" }}>
      {c.title ? <div style={{ fontSize: 34, color: theme.muted, letterSpacing: 3, textTransform: "uppercase", opacity: inP, marginBottom: 26 }}>{c.title}</div> : null}
      <div style={{ fontSize: 210, fontWeight: 900, letterSpacing: -6, lineHeight: 1, color: theme.accent, transform: `scale(${inP * pulse})`, textShadow: `0 0 60px ${theme.accent}55, 0 10px 40px rgba(0,0,0,.6)`, fontVariantNumeric: "tabular-nums" }}>
        {countUp(c.number || "0", progress)}
      </div>
      {c.label ? <div style={{ fontSize: 46, fontWeight: 600, marginTop: 30, opacity: labelP, transform: `translateY(${(1 - labelP) * 20}px)`, textAlign: "center", maxWidth: 1400, lineHeight: 1.3 }}>{c.label}</div> : null}
    </AbsoluteFill>
  );
};

const ListCard: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const { frame, fps, inP, out } = useInOut(total);
  const items = (c.items || []).slice(0, 6);
  const span = Math.max(1, (total - 40) / Math.max(items.length, 1));
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, color: theme.fg, justifyContent: "center", padding: "0 220px" }}>
      {c.title ? <div style={{ fontSize: 62, fontWeight: 900, marginBottom: 40, opacity: inP, transform: `translateX(${(1 - inP) * -40}px)` }}>{c.title}</div> : null}
      {items.map((it, i) => {
        const p = spring({ frame: frame - 12 - i * Math.min(span, 14), fps, config: { damping: 15, stiffness: 130 } });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 26, marginBottom: 22, opacity: p, transform: `translateX(${(1 - p) * 60}px)` }}>
            <div style={{ width: 54, height: 54, borderRadius: 12, background: theme.accent, color: theme.bg, fontWeight: 900, fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
            <div style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.25 }}>{it}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const QuoteCard: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const { frame, fps, inP, out } = useInOut(total);
  const authP = spring({ frame: frame - 30, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, color: theme.fg, justifyContent: "center", alignItems: "center", padding: "0 200px" }}>
      <div style={{ fontSize: 200, lineHeight: 0.6, color: theme.accent, opacity: inP * 0.9, fontFamily: "Georgia, serif", marginBottom: 30 }}>“</div>
      <Words text={c.title || ""} delay={6} perWord={2} theme={theme} style={{ fontSize: 64, fontWeight: 700, fontStyle: "italic", lineHeight: 1.25, textAlign: "center" }} />
      {c.author ? <div style={{ fontSize: 34, color: theme.accent, marginTop: 36, letterSpacing: 2, opacity: authP, textTransform: "uppercase" }}>— {c.author}</div> : null}
    </AbsoluteFill>
  );
};

/** Bandeau bas-gauche : entre par la gauche, reste, ressort avant la fin (fond transparent). */
const LowerThird: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 16, stiffness: 150, mass: 0.7 } });
  const outP = interpolate(frame, [total - 16, total - 2], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const x = (1 - inP) * -600 - outP * 700;
  const barH = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", pointerEvents: "none" }}>
      <div style={{ marginLeft: 96, marginBottom: 118, transform: `translateX(${x}px)`, display: "flex", alignItems: "stretch", gap: 0, fontFamily: theme.font }}>
        <div style={{ width: 12, background: theme.accent, borderRadius: 4, transform: `scaleY(${barH})`, transformOrigin: "bottom", boxShadow: `0 0 20px ${theme.accent}88` }} />
        <div style={{ background: "rgba(8,10,16,.82)", border: "1px solid rgba(255,255,255,.12)", borderLeft: "none", padding: "16px 34px 16px 26px", borderRadius: "0 14px 14px 0", backdropFilter: "blur(6px)" }}>
          <div style={{ color: theme.fg, fontSize: 44, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1, whiteSpace: "nowrap" }}>{c.title}</div>
          {c.sub ? <div style={{ color: theme.accent, fontSize: 26, fontWeight: 600, marginTop: 6, letterSpacing: 1.5, textTransform: "uppercase", whiteSpace: "nowrap" }}>{c.sub}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** « Kicker » : le code visuel n°1 de la niche — un chiffre choc ou une phrase-massue en gros, centré, incrusté sur le b-roll
 *  (« 32 TOTAL COLLAPSES SINCE 2020 », « THE ISLAND MIGRATES, THE HOUSES DO NOT »). Fond transparent, bande sombre derrière. */
const Kicker: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 15, stiffness: 150, mass: 0.7 } });
  const outP = interpolate(frame, [total - 12, total - 1], [1, 0], clamp);
  const text = String(c.title || "").toUpperCase();
  const isNumber = /^[^a-z]*\d/i.test(text) && text.length <= 24;
  const size = isNumber ? 150 : text.length > 40 ? 62 : text.length > 24 ? 78 : 96;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none", opacity: outP }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: isNumber ? 300 : 260, background: "linear-gradient(90deg, transparent 0%, rgba(0,0,0,.62) 14%, rgba(0,0,0,.62) 86%, transparent 100%)" }} />
      <div style={{ position: "relative", padding: "0 180px", textAlign: "center", fontFamily: theme.font, transform: `scale(${0.92 + 0.08 * inP})`, opacity: inP }}>
        <div style={{ color: isNumber ? theme.accent : theme.fg, fontSize: size, fontWeight: 900, letterSpacing: isNumber ? -3 : 0.5, lineHeight: 1.05, textShadow: "0 6px 30px rgba(0,0,0,.8)", fontVariantNumeric: "tabular-nums" }}>{text}</div>
        {c.sub ? <div style={{ color: isNumber ? theme.fg : theme.accent, fontSize: 34, fontWeight: 700, letterSpacing: 3, marginTop: 14, textTransform: "uppercase" }}>{c.sub}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

/** Bandeau « presse » pleine largeur en bas : étiquette rouge (source / BREAKING) + titre — les chaînes de la niche
 *  citent des coupures d'actualité locales pour crédibiliser. Fond transparent au-dessus du bandeau. */
const Headline: React.FC<{ c: Card; theme: Theme; total: number }> = ({ c, theme, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame, fps, config: { damping: 16, stiffness: 160, mass: 0.7 } });
  const outP = interpolate(frame, [total - 12, total - 1], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });
  const y = (1 - inP) * 220 + (1 - outP) * 220;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", pointerEvents: "none" }}>
      <div style={{ transform: `translateY(${y}px)`, marginBottom: 96, fontFamily: theme.font }}>
        <div style={{ display: "inline-block", marginLeft: 96, background: "#d0021b", color: "#fff", fontSize: 24, fontWeight: 900, letterSpacing: 3, padding: "8px 18px", borderRadius: "6px 6px 0 0", textTransform: "uppercase" }}>{c.sub || "BREAKING"}</div>
        <div style={{ background: "rgba(8,10,16,.9)", borderTop: `4px solid ${theme.accent}`, padding: "22px 96px 24px", color: theme.fg, fontSize: 46, fontWeight: 800, letterSpacing: 0.3, lineHeight: 1.15, textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Typewriter : révèle le texte caractère par caractère à partir de `from` (frames). */
const Typed: React.FC<{ text: string; from: number; cps?: number; style: React.CSSProperties }> = ({ text, from, cps = 40, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(0, Math.floor(((frame - from) / fps) * cps));
  const shown = text.slice(0, n);
  return <div style={{ ...style, opacity: frame >= from ? 1 : 0 }}>{shown}{n < text.length && frame >= from ? <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0 }}>▌</span> : null}</div>;
};

/** « Dossier » : présentation d'une personne, d'un lieu ou d'un bien — chemise cartonnée qui glisse, photo agrafée qui tombe,
 *  fiche dactylographiée (3-4 faits), tampon rouge qui claque. Le code « enquête » des documentaires. */
const Dossier: React.FC<{ c: Card; theme: Theme; total: number; dir?: string }> = ({ c, theme, total, dir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [total - 12, total - 1], [1, 0], clamp);
  const folder = spring({ frame, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } });
  const photo = spring({ frame: frame - 10, fps, config: { damping: 13, stiffness: 140, mass: 0.8 } });
  const stampP = spring({ frame: frame - Math.round(total * 0.62), fps, config: { damping: 9, stiffness: 300, mass: 0.6 } });
  const items = (c.items || []).slice(0, 4);
  const src = c.image ? staticFile(dir ? `${dir}/${c.image}` : c.image) : null;
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative", width: 1480, height: 820, transform: `translateY(${(1 - folder) * 140}px) rotate(${(1 - folder) * -2}deg)`, opacity: folder }}>
        {/* chemise */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#c9a86a,#b8944f)", borderRadius: 18, boxShadow: "0 40px 90px rgba(0,0,0,.6)" }} />
        <div style={{ position: "absolute", left: 40, top: -34, width: 380, height: 60, background: "#c9a86a", borderRadius: "14px 14px 0 0", color: "#3a2c10", fontWeight: 900, fontSize: 24, letterSpacing: 4, display: "flex", alignItems: "center", paddingLeft: 26, textTransform: "uppercase" }}>{c.sub || "CONFIDENTIAL"}</div>
        {/* fiche papier */}
        <div style={{ position: "absolute", left: 34, top: 30, right: 34, bottom: 30, background: "#f5f0e4", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,.25)", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent 0 46px, rgba(0,0,0,.05) 46px 47px)" }} />
          <div style={{ position: "absolute", left: 60, top: 50, right: 520, color: "#1a1a1a" }}>
            <div style={{ fontSize: 22, letterSpacing: 5, color: "#8a1b1b", fontWeight: 800, textTransform: "uppercase", marginBottom: 10 }}>{c.label || "PROPERTY FILE"}</div>
            {/* le titre s'adapte à sa longueur : un nom long passait sur deux lignes et mangeait les faits */}
            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: (c.title || "").length <= 18 ? 64 : (c.title || "").length <= 28 ? 52 : 44, fontWeight: 700, lineHeight: 1.06, marginBottom: 22 }}>{c.title}</div>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 13, height: 13, marginTop: 13, background: "#8a1b1b", borderRadius: 2, flexShrink: 0, opacity: frame >= 16 + i * 13 ? 1 : 0 }} />
                <Typed text={it} from={16 + i * 13} cps={70} style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 30, fontWeight: 700, lineHeight: 1.3, color: "#222" }} />
              </div>
            ))}
          </div>
          {/* photo agrafée */}
          <div style={{ position: "absolute", right: 60, top: 58, width: 420, height: 286, background: "#fff", padding: 12, boxShadow: "0 16px 40px rgba(0,0,0,.35)", transform: `rotate(${3 - (1 - photo) * 14}deg) translateY(${(1 - photo) * -260}px)`, opacity: photo }}>
            {src ? <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(.85) contrast(1.05)" }} /> : <div style={{ width: "100%", height: "100%", background: "#ccc" }} />}
            <div style={{ position: "absolute", left: "50%", top: -14, width: 60, height: 22, background: "#777", transform: "translateX(-50%) rotate(-4deg)", borderRadius: 3 }} />
          </div>
          {/* tampon */}
          {c.stamp ? (
            <div style={{ position: "absolute", right: 90, bottom: 60, transform: `rotate(-14deg) scale(${1.6 - 0.6 * stampP})`, opacity: Math.min(1, stampP) * 0.92, border: "6px solid #c8102e", color: "#c8102e", fontWeight: 900, fontSize: 54, letterSpacing: 6, padding: "10px 26px", borderRadius: 10, textTransform: "uppercase", fontFamily: "Impact, 'Arial Black', sans-serif" }}>{c.stamp}</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** « Compare » : avant/après ou luxe/ruine — deux images côte à côte avec leurs étiquettes, ligne dorée qui balaie. */
const Compare: React.FC<{ c: Card; theme: Theme; total: number; dir?: string }> = ({ c, theme, total, dir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [total - 12, total - 1], [1, 0], clamp);
  const left = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const right = spring({ frame: frame - 8, fps, config: { damping: 16, stiffness: 130 } });
  const sweep = interpolate(frame, [14, 14 + fps], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const titleP = spring({ frame: frame - 4, fps, config: { damping: 15, stiffness: 120 } });
  const s1 = c.image ? staticFile(dir ? `${dir}/${c.image}` : c.image) : null;
  const s2 = c.image2 ? staticFile(dir ? `${dir}/${c.image2}` : c.image2) : null;
  const Panel: React.FC<{ src: string | null; label?: string; p: number; side: "l" | "r" }> = ({ src, label, p, side }) => (
    <div style={{ position: "relative", width: 900, height: 560, borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,.55)", transform: `translateX(${(1 - p) * (side === "l" ? -300 : 300)}px)`, opacity: p, border: `2px solid ${side === "l" ? theme.accent : "#c8102e"}` }}>
      {src ? <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#222" }} />}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 26px", background: "linear-gradient(0deg, rgba(0,0,0,.85), transparent)", color: side === "l" ? theme.accent : "#ff5d5d", fontSize: 44, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: theme.font, justifyContent: "center", alignItems: "center" }}>
      {c.title ? <div style={{ position: "absolute", top: 70, color: theme.fg, fontSize: 52, fontWeight: 900, letterSpacing: 1, opacity: titleP, transform: `translateY(${(1 - titleP) * -20}px)`, textShadow: "0 6px 30px rgba(0,0,0,.6)" }}>{c.title}</div> : null}
      <div style={{ display: "flex", gap: 40, marginTop: 40 }}>
        <Panel src={s1} label={c.leftLabel} p={left} side="l" />
        <Panel src={s2} label={c.rightLabel} p={right} side="r" />
      </div>
      <div style={{ position: "absolute", left: `${8 + 84 * sweep}%`, top: 160, bottom: 160, width: 4, background: theme.accent, boxShadow: `0 0 30px ${theme.accent}`, opacity: sweep > 0 && sweep < 1 ? 0.9 : 0 }} />
    </AbsoluteFill>
  );
};

const CardView: React.FC<{ c: Card; theme: Theme; transparent: boolean; dir?: string }> = ({ c, theme, transparent, dir }) => {
  const total = Math.max(2, Math.round(c.seconds * FPS));
  const body =
    c.kind === "intro" ? <IntroCard c={c} theme={theme} total={total} />
    : c.kind === "stat" ? <StatCard c={c} theme={theme} total={total} />
    : c.kind === "list" ? <ListCard c={c} theme={theme} total={total} />
    : c.kind === "quote" ? <QuoteCard c={c} theme={theme} total={total} />
    : c.kind === "lowerthird" ? <LowerThird c={c} theme={theme} total={total} />
    : c.kind === "kicker" ? <Kicker c={c} theme={theme} total={total} />
    : c.kind === "headline" ? <Headline c={c} theme={theme} total={total} />
    : c.kind === "dossier" ? <Dossier c={c} theme={theme} total={total} dir={dir} />
    : c.kind === "compare" ? <Compare c={c} theme={theme} total={total} dir={dir} />
    : <TitleCard c={c} theme={theme} total={total} />;
  const overlay = c.kind === "lowerthird" || c.kind === "kicker" || c.kind === "headline";
  return (
    <AbsoluteFill>
      {!transparent && !overlay ? <Background theme={theme} seconds={c.seconds} /> : null}
      {body}
    </AbsoluteFill>
  );
};

export const WealthMotion: React.FC<WealthMotionProps> = ({ cards, theme, transparent, dir }) => {
  const th = { ...DEFAULT_THEME, ...(theme || {}) };
  let from = 0;
  return (
    <AbsoluteFill style={{ background: transparent ? "transparent" : th.bg }}>
      {cards.map((c, i) => {
        const dur = Math.max(2, Math.round(c.seconds * FPS));
        const el = (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <CardView c={c} theme={th} transparent={transparent} dir={dir} />
          </Sequence>
        );
        from += dur;
        return el;
      })}
    </AbsoluteFill>
  );
};

export function wealthMotionFrames(cards: { seconds: number }[]): number {
  return Math.max(1, cards.reduce((a, c) => a + Math.max(2, Math.round(c.seconds * FPS)), 0));
}
