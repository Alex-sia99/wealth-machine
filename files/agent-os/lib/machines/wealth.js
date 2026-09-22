/**
 * MACHINE « Wealth » — vidéos « faceless » de la niche richesse/patrimoine (mansions, fortunes, luxe face aux
 * catastrophes, erreurs des riches…) : b-roll Pexels (vidéos + photos) + rendus IA + motion design (cartes de
 * titre, chiffres animés, listes, citations, bandeaux) + voix off + AVATAR IA en lipsync à l'intro, au CTA et
 * sur quelques moments clés.
 *
 * Recette dérivée de la banque de niche « Wealth » (13 chaînes scannées + décorticage image par image par
 * Qwen 3.7 Flash — voir docs/RECETTE-NICHE-WEALTH.md). Les chiffres qui pilotent la machine (débit, durée des
 * plans, parts b-roll / IA / motion / avatar) sont des RÉGLAGES : ils se recalent sans toucher au code.
 *
 * Squelette cloné de pov.js (skill machine-factory) : machine à états reprenable, génération parallèle,
 * régénération non destructive, montage FFmpeg + Remotion (motion design en MP4/PNG, bouton CTA en PNG).
 *
 * Étapes : script (outline + sections en parallèle) → voix (par section) + Whisper + découpage + plan visuel
 *          → prompts (nature de chaque plan) → assets (Pexels · Kie · Remotion · lipsync FAL · Suno)
 *          → montage (zoom/dézoom/pan, bandeaux, sous-titres, CTA, musique) → packaging.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { DATA_DIR, ensureDir, readJSON, writeJSON } = require("../store");
const claude = require("../claude");
const vault = require("../vault");
const fal = require("../fal");
const ff = require("../ffmpeg");
const google = require("../google");
const tasks = require("../tasks");
const spend = require("../spend");
const bank = require("../bank");
const scrap = require("../scrap");
const pexels = require("../pexels");
const llm = require("../llm");  // Qwen via OpenRouter : écriture structurée à 1/100e du prix de Claude
const lab = require("../lab");  // askVision : vérification Qwen des b-roll et des photos de dossier

const MACHINE_ID = "wealth";
const MACHINE_NAME = "Wealth";
const ROOT = path.join(__dirname, "..", "..", "..");
const OUT_ROOT = path.join(__dirname, "..", "..", "output", "machines");
const AVATAR_DIR = path.join(OUT_ROOT, "wealth-avatars");
const REMOTION_DIR = path.join(ROOT, "remotion");
const RUNS_DIR = path.join(DATA_DIR, "machines", "runs", MACHINE_ID); // sous-dossier : listRuns ne voit que nos runs
ensureDir(OUT_ROOT);
ensureDir(AVATAR_DIR);
ensureDir(RUNS_DIR);

// ---------------------------------------------------------------- constantes de niche

const W = 1920, H = 1080, FPS = 30;
const SHOT_MIN = 2.0;
const SHOT_MAX = 7.5;
const BURST_MIN = 1.5;
const CARD_SEC = 3.0;        // carte de titre de section, prise sur la narration
const MAX_TRIES = 3;
const MAX_REWRITES = 3;
const IMG_CONCURRENCY = 5;
const BROLL_CONCURRENCY = 4;
const SECTION_CONCURRENCY = 5;
const TTS_MAX_CHARS = 1900;  // Inworld refuse au-delà de 2000

// Tarifs (USD). Images : catalogue studio (nano 0,02 / seedream 0,014 / gpt 0,06 / grok2 0,02).
const PRICES = {
  image: { nano: 0.02, seedream: 0.014, gpt: 0.06, grok2: 0.02 },
  voicePer1kChars: { inworld: 0.015, elevenlabs: 0.1 },
  whisperPerSec: 0.0008,
  lipsyncPerMin: 0.4,
  music: 0.06,
};

// Voix Inworld TTS (FAL) — les noms SONT les voix.
const VOICES = {
  English: ["Malcolm", "Graham", "Theodore", "Edward", "Simon", "Elliot", "James", "Oliver", "Rupert", "Sebastian", "Craig", "Mark", "Nate", "Ethan", "Blake", "Carter", "Serena", "Claire", "Victoria", "Miranda", "Evelyn", "Celeste", "Olivia", "Julia", "Sarah", "Elizabeth"],
  "Français": ["Alain", "Mathieu", "Étienne", "Hélène"],
  "Español": ["Diego", "Miguel", "Rafael", "Lupita"],
  Deutsch: ["Josef", "Johanna"],
  Italiano: ["Gianni", "Orietta"],
  "Português": ["Heitor", "Maitê"],
  Nederlands: ["Erik", "Lennart", "Katrien", "Lore"],
  Polski: ["Szymon", "Wojciech"],
  "Русский": ["Dmitry", "Nikolai", "Svetlana", "Elena"],
  "日本語": ["Satoshi", "Asuka"],
  "한국어": ["Hyunwoo", "Seojun", "Minji", "Yoona"],
  "中文": ["Yichen", "Jing", "Xiaoyin", "Xinyi"],
};
// Voix ElevenLabs v3 (FAL) — multilingues, les noms SONT les voix.
const ELEVEN_VOICES = ["Roger", "Charlie", "George", "Callum", "River", "Liam", "Will", "Eric", "Chris", "Brian", "Daniel", "Bill", "Aria", "Sarah", "Laura", "Charlotte", "Alice", "Matilda", "Jessica", "Lily"];
const VOICE_SUFFIX = {
  English: "(en)", "Français": "(fr)", "Español": "(es)", Deutsch: "(de)", Italiano: "(it)",
  "Português": "(pt)", Nederlands: "(nl)", Polski: "(pl)", "Русский": "(ru)", "日本語": "(ja)", "한국어": "(ko)", "中文": "(zh)",
};
const WHISPER_LANG = {
  English: "en", "Français": "fr", "Español": "es", Deutsch: "de", Italiano: "it", "Português": "pt",
  Nederlands: "nl", Polski: "pl", "Русский": "ru", "日本語": "ja", "한국어": "ko", "中文": "zh",
};
// Le CTA de la niche, dit PAR L'AVATAR (court, direct), inséré après la section réglée (ctaAfterSection).
// ≤ 25 mots : le CTA est dit par l'avatar et un passage avatar ne dépasse jamais 10 s.
const CTA_TEXT = {
  English: "Quick ask: if you enjoy luxury real estate colliding with physics and money, hit subscribe. It's free, and it keeps the channel going.",
  "Français": "Petite pause : si le luxe qui se heurte à la nature et à l'argent te passionne, abonne-toi. C'est gratuit et ça fait vivre la chaîne.",
  "Español": "Una pausa: si te apasiona el lujo chocando con la naturaleza y el dinero, suscríbete. Es gratis y mantiene vivo el canal.",
  Deutsch: "Kurze Bitte: Wenn dich Luxus im Kampf mit Natur und Geld fesselt, abonniere den Kanal. Es ist kostenlos und hält uns am Laufen.",
  Italiano: "Una pausa: se il lusso che si scontra con la natura e il denaro ti appassiona, iscriviti. È gratis e tiene vivo il canale.",
  "Português": "Uma pausa: se o luxo a chocar com a natureza e o dinheiro te fascina, subscreve. É grátis e mantém o canal vivo.",
};
const CTA_LABEL = {
  English: "SUBSCRIBE", "Français": "S'ABONNER", "Español": "SUSCRIBIRSE", Deutsch: "ABONNIEREN", Italiano: "ISCRIVITI", "Português": "INSCREVA-SE",
  Nederlands: "ABONNEREN", Polski: "SUBSKRYBUJ", "Русский": "ПОДПИСАТЬСЯ", "日本語": "登録", "한국어": "구독", "中文": "订阅",
};

const IMG_NEG = "Absolutely no text, no letters, no numbers, no captions, no subtitles, no watermark, no logo, no UI, no frame border, no split screen, no collage.";
const DEFAULT_AI_STYLE = "Ultra-realistic cinematic photograph, shot on a full-frame camera with a 35mm lens, shallow depth of field, dramatic natural light, rich contrast, moody teal-and-gold color grade, documentary realism, 16:9 wide framing, sharp details, high dynamic range";
const DEFAULT_MUSIC_STYLE = "Dark cinematic documentary underscore: slow tense piano, deep sub-bass pulse, soft string swells, subtle ticking percussion, ominous but elegant, 70-80 bpm, discreet bed under narration";
const DEFAULT_THEME = { bg: "#0a0d14", bg2: "#161c2a", accent: "#d4af37", fg: "#ffffff", muted: "#aab0bd", font: "'Segoe UI', Inter, Arial, sans-serif" };

// ---------------------------------------------------------------- Claude

function genModel() {
  return config().settings.promptModel || "";
}
/**
 * Écriture structurée. Par défaut **Qwen 3.7 Plus via OpenRouter** (`lib/llm.js`) : ~1/100e du prix de Claude et,
 * surtout, pas de limite de session — un run de 20 min fait ~15 appels longs, ce qui épuisait le quota Claude Code
 * en plein milieu d'un run (vécu : « You've hit your session limit » à l'étape des plans visuels).
 * `settings.textEngine = "claude"` force Claude CLI ; sinon Claude reste le repli automatique de `llm.askJson`.
 */
async function genJson(prompt, { ms = 6 * 60 * 1000, tries = 3, label = "" } = {}) {
  const engine = config().settings.textEngine || "qwen";
  let last;
  for (let a = 1; a <= tries; a++) {
    try {
      if (engine === "claude") {
        const j = claude.parseJson(await claude.ask(prompt, { timeoutMs: ms, model: genModel() || undefined }));
        if (j) return j;
        last = new Error("réponse illisible (JSON absent)");
      } else {
        return await llm.askJson(prompt, { timeoutMs: ms, tries: 2, label });
      }
    } catch (e) {
      last = e;
    }
    if (a < tries) await new Promise((r) => setTimeout(r, 3000 * a));
  }
  throw new Error(`${label || "Génération"} : ${last.message}`);
}

// ---------------------------------------------------------------- config

function defaultNicheId() {
  const n = bank.niches().find((x) => /^wealth\b/i.test(x.name));
  return n ? n.id : null;
}
const DEFAULT_SETTINGS = {
  imageModel: "nano", voiceProvider: "inworld", lipsyncModel: "veed/lipsync", promptModel: "", textEngine: "qwen",
  chainLanguage: "English", publishPrivacy: "private", channelName: "Wealth",
  subtitles: false, music: true, musicVolume: 0.12, musicStyle: DEFAULT_MUSIC_STYLE,
  // Chiffres de la niche, MESURÉS par le Labo sur 15 vidéos décortiquées image par image (docs/RECETTE-NICHE-WEALTH.md) :
  // durée médiane 18,9 min · 11,4 plans/min (médiane 4 s) · stock vidéo 61 % + photo 7 % · motion/texte plein écran 17 %
  // + graphiques 6 % · 60 % des plans portent un texte incrusté · caméra fixe 56 %, pan droite 16 %, zoom 25 %.
  wpm: 170,            // débit de la niche (repère) ; le script est dimensionné sur `measuredWpm`, le débit RÉEL du TTS
  shotSeconds: 4.5, durationMin: 20,
  mixBroll: 80,        // % des plans « footage » en b-roll Pexels (le reste en rendu IA) — la niche est à ~94 % de stock,
                       // nos 20 % d'IA remplacent ce qu'elle obtient avec des captures de JT et d'articles
  motionPct: 15,       // % des plans en motion design PLEIN ÉCRAN (dossier, comparatif, chiffre, liste, citation) — niche : 17 %
  lowerThirds: true,   // textes incrustés SUR le b-roll (chiffres chocs, aphorismes, bandeaux, titres presse) — le code n°1
  overlayPct: 55,      // % des plans qui portent un texte incrusté — niche : 60 %
  sectionCards: true,  // carte de titre au début de chaque section
  avatarIntro: true, avatarCount: 3, avatarSeconds: 10, // JAMAIS plus de 10 s d'avatar d'affilée (hook et CTA compris)
  brollCheck: true,    // boucle de vérification Qwen : chaque clip Pexels est noté (0-10) face à la description du plan, rejeté sous 6
  ctaAfterSection: 1,  // niche : le CTA arrive à 1:00-1:30, juste après le hook
  effects: { zoom: true, pan: true, amp: 0.10 },
  aiStyle: DEFAULT_AI_STYLE,
  theme: { ...DEFAULT_THEME },
};
function config() {
  const c = readJSON(`machines/${MACHINE_ID}.json`, null);
  if (c) {
    c.settings = Object.assign({}, DEFAULT_SETTINGS, c.settings || {});
    c.settings.effects = Object.assign({}, DEFAULT_SETTINGS.effects, c.settings.effects || {});
    c.settings.theme = Object.assign({}, DEFAULT_THEME, c.settings.theme || {});
    c.avatars = c.avatars || [];
    if (!c.nicheId) c.nicheId = defaultNicheId();
    return c;
  }
  const fresh = { id: MACHINE_ID, name: MACHINE_NAME, nicheId: defaultNicheId(), settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), avatars: [] };
  writeJSON(`machines/${MACHINE_ID}.json`, fresh);
  return fresh;
}
function saveConfig(c) {
  writeJSON(`machines/${MACHINE_ID}.json`, c);
}
function patchConfig(patch) {
  const c = config();
  if (patch.settings) {
    const s = patch.settings;
    if (s.effects) c.settings.effects = Object.assign({}, c.settings.effects, s.effects);
    if (s.theme) c.settings.theme = Object.assign({}, c.settings.theme, s.theme);
    for (const k of Object.keys(s)) if (k !== "effects" && k !== "theme") c.settings[k] = s[k];
  }
  for (const k of ["nicheId", "name"]) if (patch[k] !== undefined) c[k] = patch[k];
  saveConfig(c);
  return c;
}

// ---------------------------------------------------------------- avatars (l'onglet « personnage »)

const slug = (s) => String(s || "avatar").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
function upsertAvatar(a) {
  const c = config();
  const clean = {
    name: String(a.name || "Avatar").trim().slice(0, 60),
    appearance: String(a.appearance || "").trim(),
    sex: a.sex === "F" ? "F" : "M",
    referenceRel: a.referenceRel || null,
    voiceProvider: a.voiceProvider === "elevenlabs" ? "elevenlabs" : "inworld",
    voice: a.voice || null,
  };
  if (a.id) {
    const i = c.avatars.findIndex((x) => x.id === a.id);
    if (i < 0) throw new Error("Avatar introuvable");
    c.avatars[i] = { ...c.avatars[i], ...clean };
    saveConfig(c);
    return c.avatars[i];
  }
  const av = { id: "a" + Date.now().toString(36), ...clean, createdAt: new Date().toISOString() };
  c.avatars.push(av);
  saveConfig(c);
  return av;
}
function removeAvatar(id) {
  const c = config();
  c.avatars = c.avatars.filter((x) => x.id !== id);
  saveConfig(c);
}
function saveUploadedAvatar(name, dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(String(dataUrl));
  if (!m) throw new Error("Image invalide (png/jpg/webp attendu)");
  const file = `${slug(name)}-${Date.now().toString(36)}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
  fs.writeFileSync(path.join(AVATAR_DIR, file), Buffer.from(m[2], "base64"));
  return `agent-os/output/machines/wealth-avatars/${file}`;
}
/** Complète la fiche d'un avatar-présentateur (apparence EN = prompt image). */
async function completeAvatar({ name, appearance, sex } = {}) {
  const g = sex === "F" ? "femme" : "homme";
  const existing = config().avatars.map((a) => `${a.name} : ${(a.appearance || "").slice(0, 120)}`);
  return genJson(
    [
      `Complète la fiche d'un AVATAR-PRÉSENTATEUR (${g}) pour une chaîne YouTube « faceless » sur la richesse, le patrimoine et le luxe (documentaires dramatiques : mansions, fortunes, catastrophes).`,
      `Fourni par l'utilisateur (à respecter et enrichir, jamais contredire) : nom=${name || "(vide)"} ; apparence=${appearance || "(vide)"}.`,
      existing.length ? `AVATARS DÉJÀ CRÉÉS — rends celui-ci différent :\n- ${existing.join("\n- ")}` : "",
      "Style attendu : présentateur crédible et élégant (30-50 ans), tenue sobre haut de gamme (chemise/veste sombre, pas de cravate voyante), regard direct, fond neutre sombre.",
      "Règle : `appearance` en ANGLAIS (sert de prompt image), 40-60 mots : âge, origine, cheveux, yeux, peau, tenue signature, expression. Nom court et crédible si vide.",
      'RÉPONDS UNIQUEMENT EN JSON : {"name":"...","appearance":"..."}',
    ].filter(Boolean).join("\n"),
    { ms: 3 * 60 * 1000, label: "Fiche avatar" }
  );
}
/** Image de référence 16:9, cadrage présentateur (tête/buste, face caméra) — la base du lipsync. */
async function generateAvatarRef(name, appearance) {
  // Décor PRO (pas un fond uni) : bureau/bibliothèque/baie vitrée, comme un présentateur d'enquête financière. Cadrage
  // tête/buste face caméra conservé (c'est ce que le lipsync anime), sujet légèrement décentré, décor flou derrière.
  const prompt =
    `Ultra-realistic editorial photograph of ${appearance}, presenting to camera like the host of a premium financial investigation show. Medium close-up: head and shoulders fill about 60% of the frame, subject slightly off-center to the left, perfectly front-facing, looking straight into the lens, mouth closed, calm confident expression, both eyes clearly visible, no hands in frame. ` +
    "SETTING: an elegant modern office at dusk — dark wood desk edge, floor-to-ceiling window with a blurred city skyline and warm interior lamps, a bookshelf and a framed map in soft focus behind him; shallow depth of field (f/2), cinematic teal-and-gold color grade, soft key light on the face, warm rim light. 16:9 wide, shot on a full-frame camera, 85mm lens, natural detailed skin texture. " +
    "Keep exactly the outfit described. " + IMG_NEG;
  const url = await kiePoll(await kieCreate(imgTool().t2i, { prompt, aspect_ratio: "16:9" }), null);
  const file = `${slug(name)}-${Date.now().toString(36)}.png`;
  await download(url, path.join(AVATAR_DIR, file));
  spend.record("Kie.ai", MACHINE_NAME, imgPrice(), "USD", `Référence avatar ${name}`);
  return `agent-os/output/machines/wealth-avatars/${file}`;
}
async function regenAvatarImage(id) {
  const c = config();
  const a = c.avatars.find((x) => x.id === id);
  if (!a) throw new Error("Avatar introuvable");
  if (!a.appearance) throw new Error("Décris d'abord l'apparence de l'avatar");
  a.referenceRel = await generateAvatarRef(a.name, a.appearance);
  delete a.refUrl; delete a.refSrc;
  saveConfig(c);
  return a;
}
/** URL publique (Drive) de la référence — re-uploadée si l'image a changé. */
async function ensureAvatarRefUrl(av) {
  if (!av.referenceRel) throw new Error(`Avatar « ${av.name} » : aucune image de référence`);
  const abs = path.join(ROOT, av.referenceRel);
  if (!fs.existsSync(abs)) throw new Error(`Avatar « ${av.name} » : image de référence introuvable`);
  const c = config();
  const live = c.avatars.find((x) => x.id === av.id) || av;
  if (live.refUrl && live.refSrc === av.referenceRel) return live.refUrl;
  const up = await google.driveUpload(`wealth-avatar-${slug(av.name)}.png`, "image/png", fs.readFileSync(abs));
  await google.ensurePublic(up.id).catch(() => {});
  live.refUrl = `https://drive.google.com/uc?export=download&id=${up.id}`;
  live.refSrc = av.referenceRel;
  saveConfig(c);
  return live.refUrl;
}

// ---------------------------------------------------------------- runs

function runPath(id) {
  return path.join(RUNS_DIR, id + ".json");
}
function listRuns() {
  try {
    return fs
      .readdirSync(RUNS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          const r = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, f), "utf8"));
          return {
            id: r.id, title: r.title || r.params?.subject || "Sans titre", status: r.status,
            createdAt: r.createdAt, mode: r.mode, cost: r.cost, params: r.params,
            shots: (r.scenes || []).length, sections: (r.sections || []).length,
            durationSec: r.voDuration || null, finalRel: r.finalRel || null, published: r.published || null,
          };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch { return []; }
}
function getRun(id) {
  const r = readJSON(path.relative(DATA_DIR, runPath(id)).replace(/\\/g, "/"), null);
  if (!r) throw new Error("Run introuvable");
  return r;
}
function saveRun(r) {
  r.updatedAt = new Date().toISOString();
  fs.writeFileSync(runPath(r.id), JSON.stringify(r, null, 1));
}
function log(r, msg) {
  r.logs = r.logs || [];
  r.logs.push({ t: new Date().toISOString(), msg: String(msg) });
  if (r.logs.length > 400) r.logs = r.logs.slice(-400);
  saveRun(r);
}
function totalCost(run) {
  const c = run.cost || {};
  return (c.voice || 0) + (c.images || 0) + (c.avatar || 0) + (c.music || 0) + (c.check || 0);
}
function avatarOf(run) {
  if (!run.params.avatarId) return null;
  return config().avatars.find((a) => a.id === run.params.avatarId) || null;
}

// ---------------------------------------------------------------- recette de niche

/** Le noyau dur : survit à toutes les régénérations. */
function coreRules(run) {
  const p = run.params;
  const s = config().settings;
  const words = Math.round(p.durationMin * scriptWpm());
  return [
    "NICHE : vidéo YouTube « faceless » sur la RICHESSE et le PATRIMOINE — documentaire dramatique sur ce qui arrive aux fortunes, aux mansions, aux objets de luxe et aux riches (catastrophes, erreurs, chutes, coûts cachés, folies), raconté avec des chiffres.",
    `SUJET : ${p.subject}.`,
    `LANGUE DE LA VOIX OFF : ${p.language}. Tous les prompts visuels (requêtes b-roll, descriptions d'images, textes des cartes) restent en ANGLAIS.`,
    `DURÉE VISÉE : ${p.durationMin} minutes, soit ~${words} mots au total (débit mesuré sur la niche : ${s.wpm} mots/min).`,
    "LE PRINCIPE : une ENQUÊTE implacable — un problème physique visible (érosion, glissement, inondation, feu, sol) devient un thriller financier (valeur, assurance, loi, revente). Le spectateur doit à chaque instant savoir COMBIEN (prix payé, coût des travaux, valeur perdue, prime d'assurance, amende, années) et POURQUOI. Chaque section raconte UN cas ou UNE idée, ancré dans un lieu réel, avec des noms, des dates et des sommes.",
    "TON (mesuré sur la niche) : journalistique, analytique, froid, implacable, légèrement cynique face à l'arrogance de l'argent — jamais moralisateur, jamais d'exclamation, jamais de fausse indignation. Mélange de troisième personne et de « you » (le spectateur est mis à la place de l'acheteur : « If you drive… you will see… »). Phrases de 10-20 mots, posées ; UNE question rhétorique par section maximum.",
    "APHORISMES : chaque section contient 1-2 phrases-massues courtes, réutilisables en texte incrusté. Le MOULE (court, binaire, définitif) : « The island migrates. The houses do not. » / « Nourishment is not a solution. It is a payment plan. » / « That is not a market. That is triage. » — mais ces phrases-là appartiennent aux concurrents : INVENTE les tiennes à partir des faits de TON sujet, ne les recopie jamais.",
    "DENSITÉ FACTUELLE : 2 à 4 chiffres précis par 100 mots (sommes en dollars, surfaces, dates, pieds par an, pouces par semaine, vitesses de vent, pourcentages assurés). Faits RÉELS et vérifiables — jamais inventés ; si un chiffre est incertain, dis « près de », « environ ». Cite des sources locales (journal, TV locale, comté, étude) quand c'est plausible.",
    "RÉTENTION : boucle ouverte dès le hook (la vidéo promet de prouver le titre), escalade de l'absurde (chaque solution échoue : déménager, murer, ensabler, assurer), phrase-pont en fin de section (« And that was before the water arrived. »), promesse tenue seulement à la fin.",
    "AUCUN appel à s'abonner dans le récit : le CTA est un bloc séparé, dit par l'avatar, inséré par la machine.",
    "INTERDIT : « dans cette vidéo », « aujourd'hui nous allons », « bienvenue sur la chaîne », listes à puces lues, titres lus à voix haute. Le récit commence à la première seconde par le hook.",
  ].join("\n");
}

/** La structure canonique de la niche. */
function storyRecipe(run) {
  const s = config().settings;
  return [
    "STRUCTURE OBLIGATOIRE (relevée sur les vidéos les plus vues de la niche) :",
    "1. HOOK (section 1, 15-30 s) = la FORMULE « walk-in » de la niche, RÉSERVÉE AU HOOK et interdite ailleurs (aucune autre section ne commence par « If you walk/drive… ») : « If you <drive/walk> <lieu précis, route, heure/saison> and look <direction>, you will see something that does not appear in any of the listing photos. » → l'anomalie en une image (une maison de 3 étages dans l'eau, une falaise qui s'arrête sous une piscine) → les prix immédiatement (« homes that last sold for 12, 18, 27 million dollars ») → la promesse implicite du titre. Dit par l'avatar face caméra si la machine l'active — écrire pour être DIT.",
    "2. PUIS L'ENQUÊTE, dans cet ordre (chaque section = un titre court EN de 3-6 mots pour la carte) : le CONTEXTE (histoire du lieu, le marché, ce que les riches ont acheté et pourquoi) → la MÉCANIQUE (la physique/géologie/hydrologie vulgarisée par une analogie : gâteau, éponge, tapis roulant) → l'ÉVÉNEMENT DÉCLENCHEUR (la nuit, la tempête, le mur qui cède, avec date et chiffres) → le PIÈGE (loi, permis refusés, assurance qui exclut, amende, rachat public) → l'ÉTUDE DE CAS (une adresse, un propriétaire, une somme précise, ce qu'il a tenté, ce que ça a coûté) → le KRACH ÉCONOMIQUE (valeurs, ventes, ce que dit le tableur de l'acheteur) → la CONCLUSION.",
    "3. Dans chaque section : le décor (2 phrases) → les faits chiffrés (le cœur) → le retournement (chaque solution échoue) → la conséquence en dollars → l'aphorisme → la phrase-pont.",
    `4. CTA : bloc séparé inséré par la machine après la section ${s.ctaAfterSection} (à ~1 min, comme la niche) — ne l'écris PAS.`,
    "5. CONCLUSION (dernière section) : fataliste et philosophique (« It is not real estate. It is a process. »), un dernier chiffre, UNE question polarisante pour les commentaires (« Should California make it easier to build seawalls, or protect the public beach? »), une phrase finale courte et mémorable.",
    "6. RÉPÉTITIONS INTERDITES : pas deux sections sur le même mécanisme, pas deux fois le même lieu, chaque section a un BEAT UNIQUE fixé par l'outline.",
  ].join("\n");
}

// ---------------------------------------------------------------- étape 1 : script (outline + sections en parallèle)

function sectionCount(durationMin) {
  return Math.max(3, Math.min(10, Math.round(durationMin / 1.3)));
}
/** Débit à utiliser pour DIMENSIONNER le script : celui du moteur de voix (mesuré), pas celui de la niche. */
function scriptWpm() {
  const s = config().settings;
  return Math.max(90, Math.min(220, Number(s.measuredWpm) || Number(s.ttsWpm) || 140));
}

async function writeOutline(run) {
  const c = config();
  const p = run.params;
  const nSections = sectionCount(p.durationMin);
  const words = Math.round(p.durationMin * scriptWpm());
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 20, maxVisions: 2 }); } catch { return ""; } })() : "";
  const j = await genJson(
    [
      "Tu prépares l'OUTLINE (le storyboard narratif) d'une vidéo YouTube « faceless » de la niche richesse/patrimoine.",
      "Tu n'écris PAS encore le script : tu fixes le squelette que des rédacteurs parallèles vont étoffer section par section.",
      "",
      coreRules(run),
      "",
      storyRecipe(run),
      "",
      inspiration ? "CE QUI PERFORME DANS LA NICHE (à égaler, pas à copier) :\n" + inspiration : "",
      "",
      `NOMBRE DE SECTIONS : EXACTEMENT ${nSections} (la 1ʳᵉ = hook, la dernière = conclusion, entre les deux des sections de contenu). ~${words} mots au total.`,
      `L'AVATAR-PRÉSENTATEUR apparaît à l'écran sur le hook, sur le CTA, et sur ${p.avatarCount} section(s) de contenu au moment le plus fort : marque-les \`avatar: true\` (les ${p.avatarCount} plus dramatiques, jamais deux consécutives).`,
      "",
      "CONTRAINTES DE SORTIE :",
      `- \`title\` : titre YouTube en ${c.settings.chainLanguage}, à la FORMULE EXACTE de la niche (relevée sur 150+ titres) : « <Lieu>'s $<N>M <Homes|Mansions|Estates> Are <Sliding|Falling|Washing|Sinking|Crumbling> Into <the Ocean|the Sea|…> — And <Nobody|Owners|the State|California> <Can't Stop It|Won't Help|Can't Save Them> ». Variante « <Lieu>'s $<N>M <Objet> <Verbe au passé> — And <Conséquence> ». 60-95 caractères, tiret cadratin obligatoire, pas d'émoji.`,
      "- `sections` : tableau de EXACTEMENT " + nSections + " objets, dans l'ordre :",
      "  {`n`, `role` ∈ hook | point | conclusion, `title` (EN, 3-6 mots : le texte de la carte de titre — pour le hook et la conclusion, un titre quand même),",
      "   `beat` (FR, 2-4 phrases : le cas/l'idée UNIQUE de cette section, le lieu, les personnes, le retournement),",
      "   `facts` (EN : 3-6 données chiffrées réelles et sourçables que la section DOIT contenir, ex. « $38M purchase price, 2019 »),",
      "   `keyStat` : {`number` (ex. « $2,400,000 », « 140 mph », « 87% »), `label` (EN, 3-8 mots)} — LE chiffre de la section, affichable seul en plein écran,",
      "   `words` (nombre de mots visé pour la section — hook ~70-90, conclusion ~110-150, les autres se partagent le reste ±15 %),",
      "   `avatar` (bool), `bridge` (EN : la phrase-pont exacte de fin de section)}.",
      "- `hook` : {`verbatim` (la 1ʳᵉ phrase exacte du hook, dans la langue de la voix, à la formule « walk-in » : « If you drive… you will see something that does not appear in any of the listing photos. »), `promise` (FR : ce que la vidéo promet)}.",
      "- `thumbIdea` : FR, 1-2 phrases : ce que la miniature doit montrer (un contraste luxe/ruine lisible en 1 seconde).",
      "- Les beats doivent être TOUS différents. La somme des `words` ≈ " + words + ".",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"title":"","hook":{"verbatim":"","promise":""},"sections":[{"n":1,"role":"hook","title":"","beat":"","facts":[""],"keyStat":{"number":"","label":""},"words":80,"avatar":true,"bridge":""}],"thumbIdea":""}',
    ].filter(Boolean).join("\n"),
    { ms: 10 * 60 * 1000, label: "Outline" }
  );
  if (!Array.isArray(j.sections) || j.sections.length < 3) throw new Error("Outline : sections manquantes");
  j.sections = j.sections.slice(0, nSections).map((s, i) => ({ ...s, n: i + 1, role: i === 0 ? "hook" : i === j.sections.length - 1 ? "conclusion" : s.role === "conclusion" ? "point" : s.role || "point" }));
  if (j.sections.length !== nSections) throw new Error(`Outline : ${j.sections.length} sections au lieu de ${nSections}`);
  // Garde-fou avatar : hook + exactement avatarCount sections de contenu, jamais consécutives
  const pts = j.sections.filter((s) => s.role === "point");
  let marked = pts.filter((s) => s.avatar);
  if (marked.length > p.avatarCount) marked.slice(p.avatarCount).forEach((s) => (s.avatar = false));
  if (marked.length < p.avatarCount) {
    const step = Math.max(1, Math.floor(pts.length / (p.avatarCount + 1)));
    for (let k = step; k < pts.length && pts.filter((s) => s.avatar).length < p.avatarCount; k += step) pts[k].avatar = true;
  }
  j.sections[0].avatar = !!p.avatarIntro;
  j.sections[j.sections.length - 1].avatar = false;
  run.outline = j;
  run.title = j.title || p.subject;
  run.sections = j.sections.map((s) => ({ n: s.n, role: s.role, title: s.title, text: null, avatar: !!s.avatar }));
  log(run, `Outline : « ${run.title} » — ${j.sections.length} sections (${j.sections.map((s) => s.title).join(" → ")})`);
  saveRun(run);
}

async function writeSection(run, n) {
  const p = run.params;
  const o = run.outline;
  const sec = o.sections[n - 1];
  const words = Number(sec.words) || Math.round((p.durationMin * scriptWpm()) / o.sections.length);
  const isHook = sec.role === "hook";
  const isLast = sec.role === "conclusion";
  const j = await genJson(
    [
      `Tu écris la SECTION ${n} sur ${o.sections.length} d'une vidéo intitulée « ${run.title} ». Une seule section, d'un seul tenant, prête pour la synthèse vocale.`,
      "",
      coreRules(run),
      "",
      storyRecipe(run),
      "",
      "OUTLINE COMPLET (pour la cohérence : ce qui précède et ce qui suit — tu n'écris QUE ta section) :",
      o.sections.map((s) => `  ${s.n}. [${s.role}] ${s.title} — ${s.beat} [faits : ${(s.facts || []).join(" ; ")}] → pont : « ${s.bridge || ""} »`).join("\n"),
      "",
      `TA SECTION : ${n} — [${sec.role}] « ${sec.title} ».`,
      isHook ? "" : "INTERDIT : reprendre la formule d'ouverture du hook (« If you walk… », « If you drive… ») — elle n'appartient qu'à la section 1. Commence autrement : par un fait, une date, une somme, un nom ou une scène.",
      `BEAT À ÉTOFFER : ${sec.beat}`,
      `FAITS À INTÉGRER (tous) : ${(sec.facts || []).join(" ; ")}`,
      sec.keyStat?.number ? `LE CHIFFRE-CLÉ à faire entendre clairement : ${sec.keyStat.number} (${sec.keyStat.label})` : "",
      isHook ? `C'EST LE HOOK : commence EXACTEMENT par « ${o.hook?.verbatim || ""} » puis la promesse (${o.hook?.promise || ""}). Écrit pour être DIT face caméra par l'avatar : naturel, rythmé, sans lourdeur.` : "",
      isLast ? "C'EST LA CONCLUSION : la leçon en creux, un dernier chiffre, une question pour les commentaires, une phrase finale courte et mémorable." : "",
      sec.bridge && !isLast ? `TERMINE PAR LA PHRASE-PONT EXACTE : « ${sec.bridge} »` : "",
      "",
      "CONTRAINTES DE SORTIE :",
      `- \`text\` : ${words} mots ± 12 %, en ${p.language}. Uniquement le texte lu : pas de titre, pas de didascalie, pas de balise, pas de puces, pas de « Section N ».`,
      "- `summary` : FR, 1 phrase (pour les rédacteurs des autres sections).",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"text":"","summary":""}',
    ].filter(Boolean).join("\n"),
    { ms: 8 * 60 * 1000, label: `Section ${n}` }
  );
  const text = String(j.text || "").replace(/\s+/g, " ").trim();
  if (text.split(/\s+/).length < words * 0.45) throw new Error(`Section ${n} : texte trop court`);
  return { text, summary: String(j.summary || "") };
}

async function stepScript(run) {
  if (!run.outline) await writeOutline(run);
  const todo = run.sections.filter((s) => !s.text);
  if (todo.length) {
    let done = run.sections.length - todo.length;
    await pool(todo, async (s) => {
      const r = await writeSection(run, s.n);
      s.text = r.text;
      s.summary = r.summary;
      done++;
      saveRun(run);
      await tasks.updateTask(run.taskId, { step: `Script : section ${done}/${run.sections.length}`, progress: 6 + Math.round((10 * done) / run.sections.length) }).catch(() => {});
    }, SECTION_CONCURRENCY);
  }
  const missing = run.sections.filter((s) => !s.text);
  if (missing.length) throw new Error(`${missing.length} section(s) sans texte (${missing.map((s) => s.n).join(", ")}) — relance l'étape.`);
  run.ctaText = CTA_TEXT[run.params.language] || CTA_TEXT.English;
  run.script = run.sections.map((s) => s.text).join(" ");
  const n = run.script.split(/\s+/).length;
  log(run, `Script écrit : ${run.sections.length} sections, ${n} mots (~${(n / scriptWpm()).toFixed(1)} min estimées au débit réel de la voix)`);
  saveRun(run);
}

// ---------------------------------------------------------------- étape 2 : voix par section + Whisper + découpage + plan visuel

function chunkText(text, max = TTS_MAX_CHARS) {
  const sentences = text.match(/[^.!?]+[.!?]+["»)]?\s*/g) || [text];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > max && cur) { out.push(cur.trim()); cur = ""; }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { cwd, windowsHide: true });
    let err = "";
    child.stdout.on("data", () => {}); // pipe non lu = process figé (piège connu)
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => reject(new Error("FFmpeg introuvable : " + e.message)));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error("FFmpeg : " + err.slice(-500)))));
  });
}

async function uploadPublic(name, absFile, mime) {
  const up = await google.driveUpload(name, mime, fs.readFileSync(absFile));
  await google.ensurePublic(up.id).catch(() => {});
  return `https://drive.google.com/uc?export=download&id=${up.id}`;
}

/** Synthèse d'un bloc de texte en mp3 (Inworld par morceaux ≤ 2000 car., ou ElevenLabs v3). */
async function synth(run, text, outFile) {
  if (fs.existsSync(outFile) && fs.statSync(outFile).size > 1000) return;
  const p = run.params;
  const provider = p.voiceProvider === "elevenlabs" ? "elevenlabs" : "inworld";
  const dir = path.dirname(outFile);
  const cancelled = () => cancelledRuns.has(run.id);
  if (provider === "elevenlabs") {
    const res = await fal.run("fal-ai/elevenlabs/text-to-dialogue/eleven-v3", { inputs: [{ text, voice: p.voice }] }, { timeoutMs: 8 * 60 * 1000, cancelled });
    const url = res?.audio?.url || res?.audio_url || (res?.audios && res.audios[0]?.url);
    if (!url) throw new Error(`ElevenLabs : pas d'audio (${JSON.stringify(res).slice(0, 120)})`);
    await fal.download(url, outFile);
  } else {
    const voice = `${p.voice} ${VOICE_SUFFIX[p.language] || "(en)"}`;
    const parts = chunkText(text);
    const files = [];
    for (let i = 0; i < parts.length; i++) {
      const r = await fal.run("fal-ai/inworld-tts", { text: parts[i], voice, sample_rate_hertz: 48000 }, { cancelled });
      const url = r.audio?.url;
      if (!url) throw new Error("Inworld TTS : aucun audio renvoyé");
      const f = outFile.replace(/\.mp3$/, `-p${i}.mp3`);
      await fal.download(url, f);
      files.push(f);
    }
    // NORMALISATION OBLIGATOIRE en mp3, MÊME pour un seul morceau : Inworld renvoie en réalité du **WAV PCM
    // 48 kHz** sous une extension .mp3. Copié tel quel, le fichier casse le concat final (le demuxer prend le
    // format du premier fichier) : vécu le 22/09/2026 — voix assemblée de 209 s pour 439 s de sections, Whisper
    // n'a transcrit qu'un tiers du texte et le découpage a produit des plans de 43 s. On ré-encode, on ne coupe
    // JAMAIS (`-c:a libmp3lame` seul : aucun trim, aucun filtre).
    const list = outFile.replace(/\.mp3$/, "-concat.txt");
    fs.writeFileSync(list, files.map((f) => `file '${path.basename(f)}'`).join("\n"));
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.basename(list), "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "1", "-y", path.basename(outFile)], dir);
    try { fs.unlinkSync(list); } catch {}
    files.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
  }
  const cost = +((text.length / 1000) * PRICES.voicePer1kChars[provider]).toFixed(4);
  run.cost.voice = (run.cost.voice || 0) + cost;
  spend.record("FAL.ai", MACHINE_NAME, cost, "USD", `${provider === "elevenlabs" ? "ElevenLabs v3" : "Inworld TTS"} (${text.length} car.)`);
  saveRun(run);
}

/** Découpe un segment de narration en plans : on coupe sur le SENS, jamais sur l'horloge. */
function buildShots(words, segStart, segEnd, target) {
  if (!words.length) return [];
  const boundary = words.map((w) => {
    if (/[.!?]["»)]?$/.test(w.w)) return "phrase";
    if (/[,;:]$/.test(w.w)) return "virgule";
    return null;
  });
  const commas = words.filter((_, i) => boundary[i] === "virgule").map((w) => w.end);
  const inBurst = (t) => commas.filter((c) => Math.abs(c - t) <= 4).length >= 3;
  const raw = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const dur = words[i].end - words[start].t;
    const b = boundary[i];
    const last = i === words.length - 1;
    let cut = false;
    if (last) cut = true;
    // Seuils calés sur la niche (médiane 4 s, 11,4 plans/min) : on coupe dès la première frontière de sens
    // passé la moitié de la cible, et on accepte une virgule un peu avant la cible — sinon le découpage suit la
    // longueur des phrases (6 s médians) et la vidéo paraît deux fois plus lente que celles des concurrents.
    else if (b === "phrase" && dur >= target * 0.5) cut = true;
    else if (b === "phrase" && dur >= BURST_MIN && inBurst(words[i].end)) cut = true;
    else if (b === "virgule" && dur >= target * 0.8) cut = true;
    else if (dur >= SHOT_MAX) cut = true;
    if (!cut) continue;
    raw.push({ start: words[start].t, end: words[i].end, say: words.slice(start, i + 1).map((w) => w.w).join(" ") });
    start = i + 1;
  }
  const merged = [];
  for (const s of raw) {
    const prev = merged[merged.length - 1];
    const d = s.end - s.start;
    if (prev && d < SHOT_MIN && prev.end - prev.start + d <= SHOT_MAX) {
      prev.end = s.end;
      prev.say += " " + s.say;
    } else merged.push({ ...s });
  }
  merged[0].start = segStart;
  for (let k = 0; k < merged.length - 1; k++) merged[k].end = merged[k + 1].start;
  merged[merged.length - 1].end = segEnd;
  return merged.map((s) => ({ start: +s.start.toFixed(2), end: +s.end.toFixed(2), dur: +(s.end - s.start).toFixed(2), say: s.say }));
}

/**
 * Plan visuel : à partir des segments (sections + CTA) et des mots Whisper, construit run.scenes :
 *  - `card`   : carte de titre de section (CARD_SEC, prise sur la narration)
 *  - `avatar` : avatar en lipsync (hook, CTA, sections marquées) — un seul plan continu
 *  - `shot`   : plan à visuel décidé à l'étape prompts (b-roll / IA / motion)
 */
function planVisuals(run) {
  const s = config().settings;
  const target = Number(run.params.shotSeconds) || s.shotSeconds;
  const scenes = [];
  let i = 1;
  const cap = Math.max(4, Math.min(10, Number(s.avatarSeconds) || 10)); // JAMAIS plus de 10 s d'avatar d'affilée
  /** Passage avatar de `cap` s max à partir de t0, coupé sur une fin de phrase/virgule ; renvoie l'instant de coupe. */
  const avatarCut = (t0, tEnd, role, n) => {
    const ws = run.words.filter((w) => w.t >= t0 - 0.3 && w.end <= Math.min(tEnd, t0 + cap) + 0.35);
    let cutT = Math.min(tEnd, t0 + cap);
    let say = "";
    if (ws.length) {
      let k = ws.length - 1;
      for (let j = ws.length - 1; j >= 0; j--) if (/[.!?,;:]["»)]?$/.test(ws[j].w) && ws[j].end - t0 >= cap * 0.55) { k = j; break; }
      cutT = Math.min(tEnd, ws[k].end);
      say = ws.slice(0, k + 1).map((w) => w.w).join(" ");
    }
    if (tEnd - cutT < 1.2) cutT = tEnd; // reliquat trop court : l'avatar finit le segment
    cutT = +cutT.toFixed(2);
    scenes.push({ i: i++, kind: "avatar", section: n, role, start: t0, end: cutT, dur: +(cutT - t0).toFixed(2), say });
    return cutT;
  };
  for (const seg of run.segments) {
    if (seg.kind === "cta") {
      // CTA : avatar ≤ cap s, le reste (rare : texte ≤ 25 mots) sur un plan b-roll
      const cutT = avatarCut(seg.start, seg.end, "cta", null);
      if (seg.end - cutT > 0.5) {
        const rest = run.words.filter((w) => w.t >= cutT - 0.05 && w.end <= seg.end + 0.3);
        const shots = rest.length ? buildShots(rest, cutT, seg.end, target) : [{ start: cutT, end: seg.end, dur: +(seg.end - cutT).toFixed(2), say: "" }];
        for (const sh of shots) scenes.push({ i: i++, kind: "shot", section: null, role: "cta", ...sh });
      }
      continue;
    }
    const sec = run.sections.find((x) => x.n === seg.n);
    let t0 = seg.start;
    // Carte de titre (pas sur le hook : il commence à la seconde 1 par l'avatar / le choc)
    if (s.sectionCards && sec.role !== "hook" && seg.end - seg.start > CARD_SEC + 4) {
      const cardEnd = +(t0 + CARD_SEC).toFixed(2);
      scenes.push({ i: i++, kind: "card", section: seg.n, role: sec.role, start: t0, end: cardEnd, dur: CARD_SEC, say: "", title: sec.title });
      t0 = cardEnd;
    }
    // Avatar : les `cap` premières secondes de la section (hook compris), coupées sur le sens
    if (sec.avatar && run.params.avatarId && seg.end - t0 > 3) t0 = avatarCut(t0, seg.end, sec.role, seg.n);
    if (seg.end - t0 < 0.5) continue;
    const words = run.words.filter((w) => w.t >= t0 - 0.3 && w.end <= seg.end + 0.3);
    const shots = words.length ? buildShots(words, t0, seg.end, target) : [{ start: t0, end: seg.end, dur: +(seg.end - t0).toFixed(2), say: "" }];
    for (const sh of shots) scenes.push({ i: i++, kind: "shot", section: seg.n, role: sec.role, ...sh });
  }
  // FILET : un trou dans le transcript Whisper produirait un plan unique de 30-40 s (vécu). Tout plan au-delà de
  // SHOT_MAX × 1.6 est redécoupé à l'horloge en parts égales proches de la cible.
  const split = [];
  for (const sc of scenes) {
    if (sc.kind !== "shot" || sc.dur <= SHOT_MAX * 1.6) { split.push(sc); continue; }
    const parts = Math.max(2, Math.round(sc.dur / target));
    const step = sc.dur / parts;
    for (let k = 0; k < parts; k++) {
      const st2 = +(sc.start + k * step).toFixed(2);
      const en2 = +(k === parts - 1 ? sc.end : sc.start + (k + 1) * step).toFixed(2);
      split.push({ ...sc, start: st2, end: en2, dur: +(en2 - st2).toFixed(2), say: k === 0 ? sc.say : "", splitFrom: sc.i });
    }
  }
  split.forEach((sc, k) => (sc.i = k + 1));
  scenes.length = 0;
  scenes.push(...split);
  run.scenes = scenes;
  const d = scenes.filter((x) => x.kind === "shot").map((x) => x.dur).sort((a, b) => a - b);
  run.shotStats = {
    shots: d.length, cards: scenes.filter((x) => x.kind === "card").length, avatars: scenes.filter((x) => x.kind === "avatar").length,
    avatarSec: +scenes.filter((x) => x.kind === "avatar").reduce((a, x) => a + x.dur, 0).toFixed(1),
    perMin: +(d.length / (run.voDuration / 60)).toFixed(1), median: d[Math.floor(d.length / 2)] || 0, min: d[0] || 0, max: d[d.length - 1] || 0,
  };
}

async function stepVoice(run) {
  const dir = path.join(OUT_ROOT, run.id);
  ensureDir(dir);
  const p = run.params;
  const total = run.sections.length + 1;
  let k = 0;
  for (const sec of run.sections) {
    const f = path.join(dir, `vo-S${sec.n}.mp3`);
    await synth(run, sec.text, f);
    sec.file = f;
    sec.duration = await ff.probeDuration(f, { label: `voix section ${sec.n}` });
    k++;
    await tasks.updateTask(run.taskId, { step: `Voix off : section ${k}/${total - 1}`, progress: 16 + Math.round((8 * k) / total) }).catch(() => {});
    saveRun(run);
  }
  const hasCta = !!p.avatarId && p.cta !== false;
  let ctaDuration = 0;
  if (hasCta) {
    const ctaFile = path.join(dir, "vo-cta.mp3");
    await synth(run, run.ctaText, ctaFile);
    ctaDuration = await ff.probeDuration(ctaFile, { label: "voix CTA" });
  }
  run.ctaDuration = ctaDuration;
  // assemblage : sections 1..k, CTA, sections k+1..N
  const order = [];
  const ctaAfter = Math.min(Math.max(1, Number(config().settings.ctaAfterSection) || 2), run.sections.length - 1);
  for (const sec of run.sections) {
    order.push({ kind: "section", n: sec.n, file: `vo-S${sec.n}.mp3`, duration: sec.duration });
    if (hasCta && sec.n === ctaAfter) order.push({ kind: "cta", file: "vo-cta.mp3", duration: ctaDuration });
  }
  const voFile = path.join(dir, "vo.mp3");
  fs.writeFileSync(path.join(dir, "vo-concat.txt"), order.map((o) => `file '${o.file}'`).join("\n"));
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "vo-concat.txt", "-c:a", "libmp3lame", "-b:a", "192k", "-y", "vo.mp3"], dir);
  run.voDuration = await ff.probeDuration(voFile, { label: "voix off" });
  run.voRel = `agent-os/output/machines/${run.id}/vo.mp3`;
  // GARDE : la voix assemblée doit valoir la somme des segments (±3 s). Un écart = concat cassé (formats mélangés,
  // morceau manquant) ; continuer produirait un Whisper partiel puis des plans de 40 s (vécu).
  const expected = order.reduce((a2, o) => a2 + o.duration, 0);
  if (Math.abs(run.voDuration - expected) > 3) {
    throw new Error(`Voix off : ${run.voDuration.toFixed(1)} s assemblées pour ${expected.toFixed(1)} s de segments — concat incohérent, étape refusée (supprime les vo-*.mp3 du run et relance).`);
  }
  let t = 0;
  const sum = order.reduce((a, o) => a + o.duration, 0);
  const scale = sum > 0 ? run.voDuration / sum : 1;
  run.segments = order.map((o) => {
    const seg = { ...o, start: +t.toFixed(3) };
    t += o.duration * scale;
    seg.end = +t.toFixed(3);
    return seg;
  });
  run.segments[run.segments.length - 1].end = +run.voDuration.toFixed(3);
  for (const sec of run.sections) {
    const sg = run.segments.find((x) => x.kind === "section" && x.n === sec.n);
    sec.start = sg.start; sec.end = sg.end;
  }
  // Débit RÉEL du moteur de voix (Inworld ≈ 135-145 mots/min, la niche lit à 170) : mémorisé pour que l'estimation
  // du prochain run vise la bonne longueur de script.
  const spokenWords = run.sections.reduce((a2, x) => a2 + x.text.split(/\s+/).length, 0);
  const realWpm = Math.round(spokenWords / (run.segments.filter((o) => o.kind === "section").reduce((a2, o) => a2 + o.duration, 0) / 60));
  if (realWpm > 80 && realWpm < 260) {
    run.measuredWpm = realWpm;
    const cc = config();
    const prev = Number(cc.settings.measuredWpm) || realWpm;
    cc.settings.measuredWpm = Math.round(prev * 0.6 + realWpm * 0.4); // moyenne glissante
    saveConfig(cc);
  }
  log(run, `Voix off : ${run.voDuration.toFixed(1)} s (${(run.voDuration / 60).toFixed(2)} min)${hasCta ? `, CTA ${ctaDuration.toFixed(1)} s après la section ${ctaAfter}` : ""} — débit réel ${realWpm} mots/min`);
  saveRun(run);

  // transcript mot-à-mot (Whisper) : cale les plans sur le sens
  if (!run.words || !run.words.length) {
    const low = path.join(dir, "vo-low.mp3");
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-i", "vo.mp3", "-ac", "1", "-b:a", "64k", "-y", "vo-low.mp3"], dir);
    const url = await uploadPublic(`${run.id}-vo.mp3`, low, "audio/mpeg");
    const res = await fal.run("fal-ai/whisper", { audio_url: url, task: "transcribe", language: WHISPER_LANG[p.language] || "en", chunk_level: "word" }, { timeoutMs: 15 * 60 * 1000, cancelled: () => cancelledRuns.has(run.id) });
    const chunks = Array.isArray(res?.chunks) ? res.chunks : [];
    run.words = chunks
      .map((c) => ({ t: Number(c.timestamp?.[0] ?? c.start ?? 0), end: Number(c.timestamp?.[1] ?? c.end ?? 0), w: String(c.text || "").trim() }))
      .filter((c) => c.w && isFinite(c.t) && isFinite(c.end));
    if (run.words.length < 40) throw new Error("Whisper : transcript inexploitable");
    const wCost = +(run.voDuration * PRICES.whisperPerSec).toFixed(4);
    run.cost.voice = (run.cost.voice || 0) + wCost;
    spend.record("FAL.ai", MACHINE_NAME, wCost, "USD", `Whisper (${Math.round(run.voDuration)} s)`);
    try { fs.unlinkSync(low); } catch {}
    saveRun(run);
  }
  planVisuals(run);
  const st = run.shotStats;
  log(run, `Plan visuel : ${st.shots} plans + ${st.cards} cartes + ${st.avatars} passages avatar (${st.avatarSec} s) — médiane ${st.median} s, ${st.perMin} plans/min`);
  saveRun(run);
}

// ---------------------------------------------------------------- étape 3 : prompts (nature de chaque plan)

const BATCH = 14;

/** Répartition imposée par les réglages, appliquée APRÈS le choix du modèle (qui propose, la machine dispose). */
function rebalance(run) {
  const p = run.params;
  const shots = run.scenes.filter((s) => s.kind === "shot" && s.visual);
  const motionTarget = Math.round((shots.length * (Number(p.motionPct) || 0)) / 100);
  let motion = shots.filter((s) => s.visual === "motion");
  // Trop de motion → les derniers redeviennent footage ; pas assez → on n'en invente pas (le modèle n'a pas de payload).
  // Un plan rétrogradé garde une description de CARTE (« Full-screen stat graphic displaying… ») et des requêtes
  // inutilisables : on efface les deux et on les fera réécrire au moment de chercher le b-roll.
  if (motion.length > motionTarget) {
    motion.slice(motionTarget).forEach((s) => {
      s.visual = "broll";
      delete s.motion;
      s.needsQueries = true;
      s.queries = [];
    });
  }
  const footage = shots.filter((s) => s.visual !== "motion");
  const aiTarget = Math.round((footage.length * (100 - (Number(p.mixBroll) ?? 70))) / 100);
  const ai = footage.filter((s) => s.visual === "ai");
  if (ai.length > aiTarget) ai.slice(aiTarget).forEach((s) => (s.visual = "broll"));
  else if (ai.length < aiTarget) {
    // promeut en IA les plans b-roll dont la description est la plus « imaginaire » (le modèle a noté aiScore)
    footage.filter((s) => s.visual === "broll").sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0)).slice(0, aiTarget - ai.length).forEach((s) => (s.visual = "ai"));
  }
  // textes incrustés : jamais sur un plan < 3 s ni sur un motion plein écran, jamais plus de 2 consécutifs, plafonnés à overlayPct
  const st = config().settings;
  if (!st.lowerThirds) shots.forEach((s) => delete s.overlay);
  let streak = 0;
  for (const s of run.scenes) {
    if (s.kind !== "shot") { streak = 0; continue; }
    if (s.overlay && (streak >= 2 || s.dur < 3 || s.visual === "motion")) delete s.overlay;
    streak = s.overlay ? streak + 1 : 0;
  }
  const cap = Math.round((shots.length * (Number(p.overlayPct ?? st.overlayPct) || 0)) / 100);
  const withOv = shots.filter((s) => s.overlay);
  if (withOv.length > cap) withOv.filter((s) => s.overlay.type !== "kicker").concat(withOv.filter((s) => s.overlay.type === "kicker")).slice(cap).forEach((s) => delete s.overlay);
}

async function stepPrompts(run) {
  const todo = run.scenes.filter((s) => s.kind === "shot" && !s.desc);
  if (!todo.length) { rebalance(run); saveRun(run); return; }
  const p = run.params;
  const o = run.outline;
  const lots = [];
  const pushLots = (n, mine) => {
    if (!mine.length) return;
    const parts = Math.ceil(mine.length / BATCH);
    const size = Math.ceil(mine.length / parts);
    for (let i = 0; i < mine.length; i += size) lots.push({ section: n, shots: mine.slice(i, i + size) });
  };
  for (const sec of run.sections) pushLots(sec.n, todo.filter((s) => s.section === sec.n));
  // Les plans qui suivent l'avatar pendant le CTA n'appartiennent à aucune section (`section: null`) : sans ce
  // rattrapage ils n'entrent dans aucun lot, restent sans description et font échouer l'étape (vécu sur le run 4).
  pushLots(run.sections[0].n, todo.filter((s) => s.section == null));
  let done = 0;
  const worker = async (lot) => {
    const sec = o.sections[lot.section - 1];
    const j = await genJson(
      [
        "Tu es le DIRECTEUR VISUEL d'une vidéo YouTube « faceless » de la niche richesse/patrimoine (b-roll de banque d'images + rendus IA + motion design).",
        `Vidéo : « ${run.title} ». Section ${lot.section} : « ${sec.title } » — ${sec.beat}`,
        `Chiffre-clé de la section : ${sec.keyStat?.number || "—"} (${sec.keyStat?.label || ""}). Faits : ${(sec.facts || []).join(" ; ")}`,
        "",
        "Pour CHAQUE plan ci-dessous (le texte est ce qui est DIT pendant le plan), décide le visuel :",
        `- \`visual\` ∈ broll | ai | motion. Cible globale : ~${p.mixBroll} % de b-roll réel parmi les plans footage, ~${100 - p.mixBroll} % de rendus IA, ~${p.motionPct} % de plans motion design plein écran.`,
        "  broll = ce qui EXISTE en banque d'images (villes, mansions, chantiers, tempêtes, inondations, avocats, argent, voitures, yachts, paysages, drones) ; ai = ce qui n'existe PAS en banque (un lieu précis + un événement précis, une scène reconstituée, un contraste impossible) ; motion = le moment où un CHIFFRE, une LISTE ou une CITATION mérite l'écran entier (jamais deux motion consécutifs).",
        "- `desc` : EN, 15-30 mots, la scène concrète et filmable (sujet, action, décor, lumière, ambiance) — sert de prompt IA et de guide de sélection.",
        "- `queries` : 3 requêtes de banque d'images EN, de 2 à 4 mots, uniquement des CHOSES FILMABLES qu'un vidéaste a réellement tournées (« mansion aerial drone », « hurricane palm trees », « construction crane villa », « insurance papers desk », « firefighter burnt house »).",
        "  INTERDIT ABSOLU dans une requête : un concept abstrait (cost, value, market, wealth, risk, crisis, failure, future, math, exodus), un nom propre, un chiffre, une marque. Une requête comme « luxury construction cost » ou « high end real estate » ne rapporte RIEN d'utilisable : nomme l'objet ou le geste que l'on verrait à l'écran.",
        "- `aiScore` : 0-10, à quel point ce plan gagne à être généré par IA plutôt que trouvé en banque.",
        "- `camera` ∈ zoom_in | zoom_out | pan_left | pan_right | static — mouvement de caméra ajouté au montage ; varie, jamais deux fois le même de suite ; zoom_in sur ce qui se rapproche/menace, zoom_out pour révéler, pan pour les panoramas.",
        "- `motion` (SEULEMENT si visual = motion) : {`type` ∈ dossier | compare | stat | list | quote, …} — motion design POUSSÉ, façon enquête :",
        "  dossier = PRÉSENTATION d'un lieu, d'une propriété ou d'une personne : chemise « CONFIDENTIAL » qui s'ouvre, photo agrafée, fiche dactylographiée, tampon rouge. {`title` (EN, le nom : « 30 Sheep Pond Road », « Marguerite Drive », « The Doronin Estate »), `label` (« PROPERTY FILE » | « CASE FILE » | « PERSON OF INTEREST » | « INCIDENT REPORT »), `sub` (lieu/date court), `items` (3-4 faits EN de 3-8 mots avec chiffres : « Listed 2023: $2,300,000 »), `stamp` (« CONDEMNED » | « UNINSURABLE » | « SOLD » | « RED-TAGGED » | « FOR SALE » ou \"\"), `imageQuery` (2-4 mots pour la photo de la fiche), `imageDesc` (EN, 10-20 mots)}. À utiliser dès qu'un lieu/une propriété/une personne est INTRODUIT (5-7 s).",
        "  compare = AVANT/APRÈS ou LUXE/RUINE côte à côte : {`title` (EN, 3-7 mots), `leftLabel` (« 2023 — $2.3M »), `rightLabel` (« 2024 — $200K »), `leftQuery`, `rightQuery` (2-4 mots chacun), `leftDesc`, `rightDesc` (EN, 10-20 mots)} (4-6 s).",
        "  stat = un CHIFFRE plein écran : {`title` (EN, 2-6 mots), `number` (« $2,400,000 », « 140 mph »), `label` (EN, 3-8 mots)}. list = {`title`, `items` (3-5 éléments EN de 2-6 mots)}. quote = {`title` (la citation), `author`}.",
        "  Un plan motion doit durer ≥ 4 s : si le plan est plus court, ne le propose pas en motion.",
        "  ÉQUILIBRE OBLIGATOIRE : ne propose pas QUE des `stat`. Dès qu'un lieu, une propriété, une adresse, une agence ou une personne est nommé dans cette section, la première carte motion de la section doit être un `dossier` ; garde `compare` pour tout avant/après ou toute chute de prix.",
        `- \`overlay\` : le CODE N°1 DE LA NICHE — un texte incrusté SUR le b-roll, sur ~${p.overlayPct ?? 40} % des plans (jamais sur un plan < 3 s, jamais plus de 2 plans consécutifs) : {\`type\` ∈ kicker | lower | headline, \`title\`, \`sub\`}.`,
        "  kicker = un CHIFFRE CHOC ou un APHORISME pris MOT POUR MOT dans ce qui est dit (« $8K / WEEK », « 32 TOTAL COLLAPSES SINCE 2020 », « 0% HAD LAND MOVEMENT INSURANCE », « THE ISLAND MIGRATES, THE HOUSES DO NOT ») — title ≤ 8 mots, sub optionnel (lieu/date) ; c'est le type dominant (2 sur 3).",
        "  lower = bandeau bas-gauche : un lieu, un nom, une date, une somme (title 2-5 mots, sub 1-4 mots).",
        "  headline = titre de presse plausible en capitales (« OCEANFRONT HOMES RED-TAGGED AFTER STORM DAMAGE ») avec sub = la source (« CBS Los Angeles », « County Records »), seulement sur un plan de destruction/actualité, 1-2 par vidéo maximum.",
        "- ALTERNANCE VISUELLE STRICTE (relevée sur la niche) : un plan d'OPULENCE (vue aérienne de mansion, piscine, yacht, intérieur, coucher de soleil) puis un plan de DESTRUCTION/MENACE (vagues violentes, falaise qui cède, débris, tempête, fissures, inondation) — jamais trois plans du même registre de suite.",
        "",
        "PLANS À DÉCIDER :",
        lot.shots.map((s) => `${s.i}. [${s.dur}s] ${s.say}`).join("\n"),
        "",
        `RÉPONDS UNIQUEMENT EN JSON : {"shots":[{"i":${lot.shots[0].i},"visual":"broll","desc":"","queries":["","",""],"aiScore":3,"camera":"zoom_in","motion":null,"overlay":{"type":"kicker","title":"","sub":""}}]} — overlay: null quand il n'y en a pas.`,
      ].join("\n"),
      { ms: 8 * 60 * 1000, label: `Plans visuels (section ${lot.section}, plans ${lot.shots[0].i}-${lot.shots[lot.shots.length - 1].i})` }
    );
    for (const sh of j.shots || []) {
      const s = run.scenes.find((x) => x.i === Number(sh.i) && x.kind === "shot");
      if (!s || !sh.desc) continue;
      s.desc = String(sh.desc);
      s.queries = (Array.isArray(sh.queries) ? sh.queries : []).map((q) => String(q).trim()).filter(Boolean).slice(0, 4);
      if (!s.queries.length) s.queries = [s.desc.split(/\s+/).slice(0, 4).join(" ")];
      s.aiScore = Number(sh.aiScore) || 0;
      s.camera = ["zoom_in", "zoom_out", "pan_left", "pan_right", "static"].includes(sh.camera) ? sh.camera : null;
      s.visual = ["broll", "ai", "motion"].includes(sh.visual) ? sh.visual : "broll";
      if (s.visual === "motion" && sh.motion && ["dossier", "compare", "stat", "list", "quote"].includes(sh.motion.type) && s.dur >= 4) {
        const m = sh.motion;
        const str = (v, n = 80) => String(v || "").slice(0, n);
        s.motion = {
          type: m.type, title: str(m.title), number: str(m.number, 30), label: str(m.label, 40), items: (m.items || []).map((x) => str(x, 60)).slice(0, 5), author: str(m.author, 40),
          sub: str(m.sub, 40), stamp: str(m.stamp, 20).toUpperCase(), imageQuery: str(m.imageQuery, 60), imageDesc: str(m.imageDesc, 200),
          leftLabel: str(m.leftLabel, 30), rightLabel: str(m.rightLabel, 30), leftQuery: str(m.leftQuery, 60), rightQuery: str(m.rightQuery, 60), leftDesc: str(m.leftDesc, 200), rightDesc: str(m.rightDesc, 200),
        };
        const bad = (s.motion.type === "stat" && !s.motion.number) || (s.motion.type === "list" && s.motion.items.length < 2) || (s.motion.type === "quote" && !s.motion.title)
          || (s.motion.type === "dossier" && (!s.motion.title || s.motion.items.length < 2)) || (s.motion.type === "compare" && (!s.motion.leftLabel || !s.motion.rightLabel));
        if (bad) { s.visual = "broll"; delete s.motion; }
      } else if (s.visual === "motion") { s.visual = "broll"; delete s.motion; }
      const ov = sh.overlay || (sh.lower && sh.lower.title ? { type: "lower", ...sh.lower } : null);
      if (ov && ov.title) s.overlay = { type: ["kicker", "lower", "headline"].includes(ov.type) ? ov.type : "kicker", title: String(ov.title).slice(0, ov.type === "headline" ? 70 : 48), sub: String(ov.sub || "").slice(0, 30) };
      else delete s.overlay;
    }
    done += lot.shots.length;
    await tasks.updateTask(run.taskId, { step: `Plans visuels : ${Math.min(done, todo.length)}/${todo.length}`, progress: 30 + Math.round((10 * done) / todo.length) }).catch(() => {});
    saveRun(run);
  };
  await pool(lots, worker, 4);
  // DEUXIÈME PASSE : le modèle saute parfois une entrée dans un lot (un `i` absent de son JSON). Plutôt que de
  // faire échouer toute l'étape pour un plan, on relance les manquants en petits lots avant d'abandonner.
  let missing = run.scenes.filter((s) => s.kind === "shot" && !s.desc);
  if (missing.length) {
    log(run, `${missing.length} plan(s) sans description au premier passage (${missing.map((s) => s.i).join(", ")}) — deuxième passe…`);
    const retry = [];
    for (const sec of run.sections) {
      const mine = missing.filter((s) => s.section === sec.n);
      for (let i = 0; i < mine.length; i += 4) retry.push({ section: sec.n, shots: mine.slice(i, i + 4) });
    }
    const orphans = missing.filter((s) => s.section == null);
    for (let i = 0; i < orphans.length; i += 4) retry.push({ section: run.sections[0].n, shots: orphans.slice(i, i + 4) });
    await pool(retry, worker, 3);
    missing = run.scenes.filter((s) => s.kind === "shot" && !s.desc);
  }
  if (missing.length) throw new Error(`${missing.length} plan(s) sans description (plans ${missing.slice(0, 6).map((s) => s.i).join(", ")}) — relance l'étape.`);
  // caméra : jamais deux fois la même de suite, jamais static sur un plan long
  const cams = ["zoom_in", "pan_right", "zoom_out", "pan_left"];
  let k = 0, prev = null;
  for (const s of run.scenes) {
    if (s.kind === "card") { prev = null; continue; }
    if (s.kind !== "shot") continue;
    if (!s.camera || s.camera === prev || (s.camera === "static" && s.dur > 4)) { s.camera = cams[k % cams.length]; if (s.camera === prev) s.camera = cams[(k + 1) % cams.length]; k++; }
    prev = s.camera;
  }
  rebalance(run);
  const n = (v) => run.scenes.filter((s) => s.kind === "shot" && s.visual === v).length;
  const ov = (t) => run.scenes.filter((s) => s.overlay && s.overlay.type === t).length;
  log(run, `Plans visuels : ${n("broll")} b-roll · ${n("ai")} IA · ${n("motion")} motion · textes incrustés : ${ov("kicker")} chiffres/aphorismes, ${ov("lower")} bandeaux, ${ov("headline")} titres presse`);
  saveRun(run);
}

// ---------------------------------------------------------------- Kie (images IA)

function kieKey() {
  const k = vault.get("kie");
  if (!k) throw new Error("Clé Kie absente du coffre");
  return k;
}
const KIE_T2I = { grok2: "grok-imagine-image-2-0/text-to-image", nano: "nano-banana-2-lite", seedream: "seedream/5-lite-text-to-image", gpt: "gpt-image-2-text-to-image" };
const KIE_I2I = { grok2: "grok-imagine-image-2-0/image-edit", nano: "nano-banana-2-lite", seedream: "seedream/5-lite-image-to-image", gpt: "gpt-image-2-image-to-image" };
const KIE_IMGFIELD = { grok2: "image_urls", nano: "image_urls", seedream: "image_urls", gpt: "input_urls" };

async function kieCreate(model, input) {
  const r = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
  }).then((x) => x.json());
  if (!r.data?.taskId) throw new Error(`Kie : ${r.msg || JSON.stringify(r).slice(0, 160)}`);
  return r.data.taskId;
}
async function kiePoll(taskId, runId, timeoutMs = 10 * 60 * 1000) {
  const t0 = Date.now();
  while (true) {
    await new Promise((r) => setTimeout(r, 8000));
    if (runId && cancelledRuns.has(runId)) throw new Error("Annulée par l'utilisateur");
    if (Date.now() - t0 > timeoutMs) throw new Error("Kie : délai dépassé");
    const r = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: { Authorization: `Bearer ${kieKey()}` } }).then((x) => x.json());
    if (r.data?.state === "success") return JSON.parse(r.data.resultJson).resultUrls[0];
    if (r.data?.state === "fail") throw new Error(`Kie : ${r.data?.failMsg || "génération échouée"}`);
  }
}
async function download(url, file) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Téléchargement ${resp.status}`);
  fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()));
}
function imgTool() {
  const t = config().settings.imageModel || "nano";
  return { key: t, t2i: KIE_T2I[t] || KIE_T2I.nano, i2i: KIE_I2I[t] || KIE_I2I.nano, field: KIE_IMGFIELD[t] || "image_urls" };
}
function imgPrice() {
  return PRICES.image[config().settings.imageModel] || 0.02;
}
function buildImagePrompt(run, scene) {
  return `${config().settings.aiStyle}.\n\nSCENE: ${scene.desc}\n\n${IMG_NEG}`;
}
async function generateImage(run, scene) {
  const dir = path.join(OUT_ROOT, run.id, "assets");
  ensureDir(dir);
  const file = path.join(dir, `ai-${String(scene.i).padStart(3, "0")}.png`);
  const url = await kiePoll(await kieCreate(imgTool().t2i, { prompt: buildImagePrompt(run, scene), aspect_ratio: "16:9" }), run.id);
  await download(url, file);
  scene.asset = { kind: "image", src: "ai", file, rel: `agent-os/output/machines/${run.id}/assets/ai-${String(scene.i).padStart(3, "0")}.png`, ts: Date.now() };
  delete scene.error;
  run.cost.images = (run.cost.images || 0) + imgPrice();
  spend.record("Kie.ai", MACHINE_NAME, imgPrice(), "USD", `Image IA plan ${scene.i}`);
  saveRun(run);
}

// ---------------------------------------------------------------- Pexels (b-roll)

/**
 * BOUCLE DE VÉRIFICATION des b-roll (Qwen 3.7 Flash, ~0,001 $) : 3 images du clip (début/milieu/fin) sont notées
 * 0-10 face à la description du plan et à ce qui est dit. Rejet sous CHECK_MIN (hors sujet, texte/logo/watermark,
 * portrait, personne qui parle en gros plan…) → candidat suivant, puis requête suivante, puis photo, puis IA.
 */
const CHECK_MIN = 6;
async function verifyClip(run, scene, file, kind, query = "") {
  if (config().settings.brollCheck === false) return { score: 10, reason: "vérification désactivée", skipped: true };
  const dir = path.dirname(file);
  const base = path.join(dir, `chk-${scene.i}-${Date.now().toString(36)}`);
  const frames = [];
  try {
    if (kind === "video") {
      const d = await ff.probeDurationSafe(file);
      for (const t of [0.3, Math.max(0.4, d / 2), Math.max(0.5, d - 0.6)]) {
        const f = `${base}-${frames.length}.jpg`;
        await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-ss", t.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=480:-2", f]);
        frames.push(f);
      }
    } else {
      const f = `${base}-0.jpg`;
      await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-frames:v", "1", "-vf", "scale=480:-2", f]);
      frames.push(f);
    }
    const content = [{
      type: "text",
      text: [
        `Tu vérifies un ${kind === "video" ? "clip de banque d'images (3 images : début, milieu, fin)" : "photo de banque d'images"} choisi pour illustrer un plan d'une vidéo documentaire sur les fortunes immobilières face aux catastrophes.`,
        `CE QUE LE PLAN DOIT MONTRER : ${scene.desc}`,
        scene.say ? `CE QUI EST DIT PENDANT LE PLAN : « ${String(scene.say).slice(0, 300)} »` : "",
        `REQUÊTE UTILISÉE : « ${query || (scene.queries || [])[0] || ""} »`,
        "",
        "Note de 0 à 10 la CORRESPONDANCE (sujet, échelle, ambiance, registre luxe ou destruction). Règles : 0-3 si hors sujet ou contradictoire (une piscine pour une falaise qui cède, un désert pour l'océan) ; 0 si texte/logo/watermark/sous-titre lisible, si l'image est en portrait ou déformée, si une personne parle face caméra en gros plan, si c'est un dessin/3D alors qu'on veut du réel ; 6-7 si c'est le bon registre sans être exact ; 8-10 si c'est exactement ça.",
        'RÉPONDS UNIQUEMENT EN JSON : {"score":0,"reason":"FR, 1 phrase","textOrLogo":false}',
      ].filter(Boolean).join("\n"),
    }];
    for (const f of frames) content.push({ type: "image_url", image_url: { url: "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64") } });
    const { json, cost } = await lab.askVision(content, { timeoutMs: 3 * 60 * 1000 });
    run.cost.check = (run.cost.check || 0) + (cost || 0);
    return { score: Math.max(0, Math.min(10, Number(json.score) || 0)), reason: String(json.reason || "").slice(0, 160), textOrLogo: !!json.textOrLogo };
  } catch (e) {
    return { score: CHECK_MIN, reason: "vérification indisponible (" + String(e.message).slice(0, 60) + ")", skipped: true }; // best-effort : on ne bloque jamais sur le vérificateur
  } finally {
    frames.forEach((f) => { try { fs.unlinkSync(f); } catch {} });
  }
}

/** Trouve, vérifie et télécharge le meilleur clip Pexels pour un plan ; photo en repli ; null si rien. */
async function fetchBroll(run, scene, { exclude = [], retried = false } = {}) {
  const dir = path.join(OUT_ROOT, run.id, "assets");
  ensureDir(dir);
  run.usedPexels = run.usedPexels || [];
  const skip = new Set([...run.usedPexels, ...exclude]);
  if (scene.needsQueries || !(scene.queries || []).length) {
    const fresh = await rewriteQueries(run, scene, []).catch(() => null);
    if (fresh && fresh.length) { scene.queries = fresh; delete scene.needsQueries; saveRun(run); }
  }
  const queries = (scene.queries || []).slice(0, 3);
  const tried = [];
  let best = null; // meilleur candidat sous le seuil (gardé si rien ne passe)
  const consider = async (asset, kind) => {
    const v = await verifyClip(run, scene, asset.file, kind, asset.query);
    tried.push({ id: asset.pexelsId, score: v.score, reason: v.reason });
    asset.verify = { score: v.score, reason: v.reason, tries: tried.length };
    if (v.score >= CHECK_MIN) return true;
    if (!best || v.score > best.asset.verify.score) { if (best) { try { fs.unlinkSync(best.asset.file); } catch {} } best = { asset, kind }; }
    else { try { fs.unlinkSync(asset.file); } catch {} }
    return false;
  };
  for (const q of queries) {
    let vids = [];
    try { vids = await pexels.searchVideos(q, { perPage: 15 }); } catch (e) { if (/quota/i.test(e.message)) throw e; continue; }
    const ranked = vids.filter((v) => !skip.has("v" + v.id)).map((v) => ({ v, s: pexels.scoreVideo(v, scene.dur) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s);
    for (const { v } of ranked.slice(0, 3)) {
      if (tried.length >= 6) break;
      const f = pexels.pickVideoFile(v);
      if (!f) continue;
      const file = path.join(dir, `px-${scene.i}-${v.id}.mp4`);
      try {
        await pexels.download(f.link, file);
        const d = await ff.probeDuration(file, { label: `Pexels ${v.id}` });
        const asset = { kind: "video", src: "pexels", file, rel: `agent-os/output/machines/${run.id}/assets/${path.basename(file)}`, pexelsId: v.id, query: q, dur: +d.toFixed(2), w: f.width, h: f.height, author: v.user?.name || "", url: v.url || "", ts: Date.now() };
        skip.add("v" + v.id);
        if (await consider(asset, "video")) { run.usedPexels.push("v" + v.id); scene.asset = asset; scene.asset.tried = tried; return scene.asset; }
      } catch (e) { try { fs.unlinkSync(file); } catch {} }
    }
    if (tried.length >= 6) break;
  }
  // Repli photo (zoom lent au montage)
  for (const q of queries) {
    if (tried.length >= 8) break;
    let photos = [];
    try { photos = await pexels.searchPhotos(q, { perPage: 10 }); } catch (e) { if (/quota/i.test(e.message)) throw e; continue; }
    for (const ph of photos.filter((x) => !skip.has("p" + x.id) && Number(x.width) >= Number(x.height)).slice(0, 2)) {
      const file = path.join(dir, `px-${scene.i}-${ph.id}.jpg`);
      try {
        await pexels.download(ph.src?.large2x || ph.src?.large || ph.src?.original, file);
        const asset = { kind: "image", src: "pexels", file, rel: `agent-os/output/machines/${run.id}/assets/${path.basename(file)}`, pexelsId: ph.id, query: q, author: ph.photographer || "", url: ph.url || "", ts: Date.now() };
        skip.add("p" + ph.id);
        if (await consider(asset, "image")) { run.usedPexels.push("p" + ph.id); scene.asset = asset; scene.asset.tried = tried; return scene.asset; }
      } catch { try { fs.unlinkSync(file); } catch {} }
    }
  }
  // RATTRAPAGE : aucune requête n'a rien donné de valable. Avant d'abandonner, on fait RÉÉCRIRE les requêtes en
  // partant des raisons de rejet — le premier jet part souvent sur des concepts abstraits (« luxury construction
  // cost », « high end real estate »), que les banques d'images ne savent pas illustrer, alors qu'un objet filmable
  // (« crane over unfinished villa », « surveyor tape damaged house ») rapporte le bon plan.
  if (!retried && config().settings.brollCheck !== false && tried.length) {
    const fresh = await rewriteQueries(run, scene, tried).catch(() => null);
    if (fresh && fresh.length) {
      log(run, `Plan ${scene.i} : requêtes sans résultat (${tried.map((t) => t.score).join("/")}) → nouvelles pistes « ${fresh.join(" / ")} »`);
      if (best) { try { fs.unlinkSync(best.asset.file); } catch {} }
      scene.queries = fresh;
      return fetchBroll(run, scene, { exclude: [...exclude, ...tried.map((t) => "v" + t.id), ...tried.map((t) => "p" + t.id)], retried: true });
    }
  }
  // Toujours rien : on garde le meilleur candidat s'il est acceptable (≥ 4), sinon null → rendu IA
  if (best && best.asset.verify.score >= 4) {
    run.usedPexels.push((best.kind === "video" ? "v" : "p") + best.asset.pexelsId);
    scene.asset = best.asset;
    scene.asset.tried = tried;
    scene.asset.belowThreshold = true;
    return scene.asset;
  }
  if (best) { try { fs.unlinkSync(best.asset.file); } catch {} }
  scene.checkTried = tried;
  return null;
}

/** Réécrit les requêtes de banque d'images d'un plan à partir des raisons de rejet du vérificateur. */
async function rewriteQueries(run, scene, tried = []) {
  const j = await genJson(
    [
      "Tu cherches des plans de BANQUE D'IMAGES (Pexels) pour illustrer un plan de documentaire, et les requêtes précédentes n'ont rien donné d'utilisable.",
      `CE QUE LE PLAN DOIT MONTRER : ${scene.desc}`,
      scene.say ? `CE QUI EST DIT : « ${String(scene.say).slice(0, 220)} »` : "",
      (scene.queries || []).length ? `REQUÊTES DÉJÀ ESSAYÉES (échec) : ${(scene.queries || []).join(" / ")}` : "Ce plan n'a pas encore de requête utilisable (il devait être une carte de texte).",
      tried.length ? `POURQUOI LES CLIPS TROUVÉS ONT ÉTÉ REJETÉS : ${tried.slice(0, 5).map((t) => `${t.score}/10 — ${t.reason}`).join(" ; ")}` : "",
      "",
      "Propose 3 NOUVELLES requêtes en anglais, 2 à 4 mots, RADICALEMENT différentes des précédentes :",
      "- uniquement des CHOSES FILMABLES qu'un vidéaste de banque d'images a réellement tournées : objets, lieux, gestes, matières, machines, météo, animaux, foules.",
      "- INTERDIT : tout concept abstrait (cost, value, market, wealth, risk, future, crisis, failure), tout nom propre, tout chiffre, toute marque.",
      "- va du plus évident au plus indirect mais sûr : si la scène est « le coût de la reconstruction », cherche « construction crane villa », « builder blueprint site », « concrete pouring house ».",
      "- une requête = un sujet unique, pas une phrase.",
      'RÉPONDS UNIQUEMENT EN JSON : {"queries":["","",""]}',
    ].filter(Boolean).join("\n"),
    { ms: 3 * 60 * 1000, tries: 2, label: `Nouvelles requêtes plan ${scene.i}` }
  );
  return (j.queries || []).map((q) => String(q).trim()).filter(Boolean).slice(0, 3);
}

/** Photo vérifiée pour un dossier/comparatif (Pexels, sinon rendu IA à partir de la description). */
async function fetchMotionImage(run, scene, query, desc, suffix) {
  const dir = path.join(OUT_ROOT, run.id, "assets");
  ensureDir(dir);
  run.usedPexels = run.usedPexels || [];
  const skip = new Set(run.usedPexels);
  let photos = [];
  try { photos = await pexels.searchPhotos(query, { perPage: 8 }); } catch {}
  for (const ph of photos.filter((x) => !skip.has("p" + x.id) && Number(x.width) >= Number(x.height)).slice(0, 3)) {
    const file = path.join(dir, `mo-${scene.i}-${suffix}-${ph.id}.jpg`);
    try {
      await pexels.download(ph.src?.large2x || ph.src?.large || ph.src?.original, file);
      const v = await verifyClip(run, { ...scene, desc: desc || query, say: "" }, file, "image", query);
      if (v.score >= CHECK_MIN) { run.usedPexels.push("p" + ph.id); return { file, src: "pexels", score: v.score }; }
      try { fs.unlinkSync(file); } catch {}
    } catch { try { fs.unlinkSync(file); } catch {} }
  }
  // repli IA
  const file = path.join(dir, `mo-${scene.i}-${suffix}-ai.png`);
  const url = await kiePoll(await kieCreate(imgTool().t2i, { prompt: `${config().settings.aiStyle}.\n\nSCENE: ${desc || query}\n\n${IMG_NEG}`, aspect_ratio: "16:9" }), run.id);
  await download(url, file);
  run.cost.images = (run.cost.images || 0) + imgPrice();
  spend.record("Kie.ai", MACHINE_NAME, imgPrice(), "USD", `Image de dossier plan ${scene.i}`);
  return { file, src: "ai", score: null };
}

// ---------------------------------------------------------------- Remotion (motion design)

function spawnRemotion(args, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["remotion", ...args], { cwd: REMOTION_DIR, shell: true, windowsHide: true });
    let err = "";
    child.stdout.on("data", (d) => { if (onLine) onLine(d.toString()); }); // OBLIGATOIRE : un pipe non lu fige le rendu
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300) || "code " + code))));
  });
}
function cardOf(run, scene, images = {}) {
  if (scene.kind === "card") return { kind: "title", seconds: scene.dur, n: scene.section, title: scene.title || "", sub: "" };
  const m = scene.motion || {};
  if (m.type === "stat") return { kind: "stat", seconds: scene.dur, title: m.title || "", number: m.number || "", label: m.label || "" };
  if (m.type === "list") return { kind: "list", seconds: scene.dur, title: m.title || "", items: m.items || [] };
  if (m.type === "dossier") return { kind: "dossier", seconds: scene.dur, title: m.title || "", label: m.label || "PROPERTY FILE", sub: m.sub || "CONFIDENTIAL", items: m.items || [], stamp: m.stamp || "", image: images.image || "" };
  if (m.type === "compare") return { kind: "compare", seconds: scene.dur, title: m.title || "", leftLabel: m.leftLabel || "", rightLabel: m.rightLabel || "", image: images.image || "", image2: images.image2 || "" };
  return { kind: "quote", seconds: scene.dur, title: m.title || "", author: m.author || "" };
}
/** Photos des dossiers/comparatifs (vérifiées par Qwen, IA en repli) — avant le rendu Remotion. */
async function prepareMotionImages(run, scenes) {
  for (const s of scenes) {
    const m = s.motion;
    if (!m || (m.type !== "dossier" && m.type !== "compare")) continue;
    m.images = m.images || {};
    try {
      if (m.type === "dossier" && !(m.images.image && fs.existsSync(m.images.image))) {
        const r = await fetchMotionImage(run, s, m.imageQuery || (s.queries || [])[0] || s.desc, m.imageDesc || s.desc, "a");
        m.images.image = r.file; m.images.imageSrc = r.src;
      }
      if (m.type === "compare") {
        if (!(m.images.image && fs.existsSync(m.images.image))) { const r = await fetchMotionImage(run, s, m.leftQuery || (s.queries || [])[0] || s.desc, m.leftDesc || m.leftLabel, "a"); m.images.image = r.file; }
        if (!(m.images.image2 && fs.existsSync(m.images.image2))) { const r = await fetchMotionImage(run, s, m.rightQuery || (s.queries || [])[1] || s.desc, m.rightDesc || m.rightLabel, "b"); m.images.image2 = r.file; }
      }
    } catch (e) { s.error = "image de dossier : " + e.message; }
    saveRun(run);
  }
}
/** Toutes les cartes plein écran d'un run en UNE passe Remotion → assets/mo-<i>.mp4 (normalisés). */
async function renderMotionBatch(run, scenes, onProgress) {
  if (!scenes.length) return;
  const dir = path.join(OUT_ROOT, run.id, "assets");
  ensureDir(dir);
  const theme = config().settings.theme;
  const rel = `wm-${run.id}-${Date.now().toString(36)}`;
  // images des dossiers/comparatifs → remotion/public/<rel>/ (staticFile)
  const pubDir = path.join(REMOTION_DIR, "public", rel);
  ensureDir(pubDir);
  const cards = scenes.map((s) => {
    const im = (s.motion && s.motion.images) || {};
    const names = {};
    for (const k of ["image", "image2"]) {
      if (im[k] && fs.existsSync(im[k])) { const name = `${s.i}-${k}${path.extname(im[k]) || ".jpg"}`; fs.copyFileSync(im[k], path.join(pubDir, name)); names[k] = name; }
    }
    return cardOf(run, s, names);
  });
  const propsFile = path.join(REMOTION_DIR, `${rel}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ dir: rel, cards, theme, transparent: false }));
  const tmpName = `${rel}.mp4`;
  const tmpFile = path.join(REMOTION_DIR, tmpName);
  let lastPct = 0;
  await spawnRemotion(["render", "WealthMotion", tmpName, `--props=${path.basename(propsFile)}`], (line) => {
    const m = /Rendered\s+(\d+)\/(\d+)/.exec(line);
    if (m && onProgress) { const pct = Math.round((100 * Number(m[1])) / Number(m[2])); if (pct - lastPct >= 10) { lastPct = pct; onProgress(pct); } }
  });
  if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 1000) throw new Error("motion design : Remotion n'a produit aucun fichier");
  // découpe par carte (frames exactes) + normalisation aux paramètres des clips
  let t = 0;
  for (let k = 0; k < scenes.length; k++) {
    const s = scenes[k];
    const frames = Math.max(2, Math.round(cards[k].seconds * FPS));
    const out = path.join(dir, `mo-${String(s.i).padStart(3, "0")}.mp4`);
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", tmpFile, "-ss", (t / FPS).toFixed(4), "-frames:v", String(frames), "-an", "-vf", `fps=${FPS},format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), "-video_track_timescale", "15360", out]);
    s.asset = { kind: "motion", src: "remotion", file: out, rel: `agent-os/output/machines/${run.id}/assets/${path.basename(out)}`, ts: Date.now() };
    delete s.error;
    t += frames;
  }
  try { fs.unlinkSync(tmpFile); fs.unlinkSync(propsFile); fs.rmSync(pubDir, { recursive: true, force: true }); } catch {}
  saveRun(run);
}
/** Textes incrustés (fond transparent) : UNE séquence PNG pour tout le run ; chaque overlay connaît son offset de frame. */
const OVERLAY_KIND = { lower: "lowerthird", kicker: "kicker", headline: "headline" };
async function renderLowerThirds(run) {
  const scenes = run.scenes.filter((s) => s.kind === "shot" && s.overlay && s.visual !== "motion");
  if (!scenes.length) { run.lowerSeq = null; return; }
  const dir = path.join(OUT_ROOT, run.id, "assets");
  ensureDir(dir);
  const theme = config().settings.theme;
  const cards = scenes.map((s) => ({ kind: OVERLAY_KIND[s.overlay.type] || "kicker", seconds: Math.min(s.dur - 0.4, s.overlay.type === "kicker" ? 5 : 6), title: s.overlay.title, sub: s.overlay.sub || "" }));
  const rel = `wlt-${run.id}`;
  const propsFile = path.join(REMOTION_DIR, `${rel}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ cards, theme, transparent: true }));
  await spawnRemotion(["render", "WealthMotion", rel, "--sequence", "--image-format=png", `--props=${path.basename(propsFile)}`]);
  const folder = path.join(REMOTION_DIR, rel);
  const first = fs.readdirSync(folder).find((f) => /^element-\d+\.png$/.test(f));
  if (!first) throw new Error("bandeaux : séquence PNG absente");
  // COPIE puis suppression, jamais `renameSync` : sous Windows, renommer le dossier que Remotion vient d'écrire
  // échoue en EPERM tant qu'un handle traîne (antivirus, indexation) — et un rename ne franchit pas les volumes.
  const seqDir = path.join(dir, "lt-seq");
  fs.rmSync(seqDir, { recursive: true, force: true });
  ensureDir(seqDir);
  for (const f of fs.readdirSync(folder)) fs.copyFileSync(path.join(folder, f), path.join(seqDir, f));
  for (let a = 1; a <= 3; a++) {
    try { fs.rmSync(folder, { recursive: true, force: true }); break; }
    catch { await new Promise((r) => setTimeout(r, 500 * a)); }
  }
  try { fs.unlinkSync(propsFile); } catch {}
  const pad = /^element-(\d+)\.png$/.exec(first)[1].length;
  let f0 = 0;
  for (let k = 0; k < scenes.length; k++) {
    const frames = Math.max(2, Math.round(cards[k].seconds * FPS));
    scenes[k].lowerFrames = { from: f0, count: frames };
    f0 += frames;
  }
  run.lowerSeq = { dir: seqDir, pad, ts: Date.now() };
  saveRun(run);
}

// ---------------------------------------------------------------- avatar (lipsync FAL)

async function makeAvatarClip(run, scene) {
  const av = avatarOf(run);
  if (!av) throw new Error("Aucun avatar sélectionné");
  const dir = path.join(OUT_ROOT, run.id, "assets");
  ensureDir(dir);
  const refAbs = path.join(ROOT, av.referenceRel || "");
  if (!av.referenceRel || !fs.existsSync(refAbs)) throw new Error(`Avatar « ${av.name} » sans image de référence`);
  const D = scene.dur;
  const slice = path.join(dir, `av-${scene.i}.mp3`);
  const base = path.join(dir, `av-${scene.i}-base.mp4`);
  const lip = path.join(dir, `av-${scene.i}-lip.mp4`);
  const out = path.join(dir, `av-${String(scene.i).padStart(3, "0")}.mp4`);
  // 1) tranche audio exacte de la voix off
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-ss", scene.start.toFixed(3), "-t", D.toFixed(3), "-i", path.join(OUT_ROOT, run.id, "vo.mp3"), "-c:a", "libmp3lame", "-b:a", "192k", slice]);
  // 2) clip de base : image fixe du présentateur à la durée EXACTE de la tranche (règle d'or : jamais -shortest)
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", refAbs, "-i", slice, "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`, "-c:a", "aac", "-b:a", "192k", "-t", D.toFixed(3), "-movflags", "+faststart", base]);
  // 3) lipsync (vidéo + audio publics)
  const model = config().settings.lipsyncModel || "veed/lipsync";
  const vUrl = await uploadPublic(`${run.id}-av-${scene.i}.mp4`, base, "video/mp4");
  const aUrl = await uploadPublic(`${run.id}-av-${scene.i}.mp3`, slice, "audio/mpeg");
  const res = await fal.run(model, { video_url: vUrl, audio_url: aUrl }, { timeoutMs: 15 * 60 * 1000, cancelled: () => cancelledRuns.has(run.id) });
  const lipUrl = res?.video?.url || res?.video_url;
  if (!lipUrl) throw new Error(`Lipsync : pas de vidéo (${JSON.stringify(res).slice(0, 120)})`);
  await fal.download(lipUrl, lip);
  // 4) normalisation muette à la durée exacte (la voix reste celle de vo.mp3 au montage) ; padding si le lipsync est plus court
  const frames = Math.max(2, Math.round(D * FPS));
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", lip, "-an", "-vf", `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},tpad=stop_mode=clone:stop_duration=3,format=yuv420p`,
    "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), "-video_track_timescale", "15360", out]);
  const cost = +((D / 60) * PRICES.lipsyncPerMin).toFixed(4);
  run.cost.avatar = (run.cost.avatar || 0) + cost;
  spend.record("FAL.ai", MACHINE_NAME, cost, "USD", `Lipsync avatar plan ${scene.i} (${model}, ${D.toFixed(0)} s)`);
  scene.asset = { kind: "avatar", src: model, file: out, rel: `agent-os/output/machines/${run.id}/assets/${path.basename(out)}`, ts: Date.now() };
  delete scene.error;
  try { fs.unlinkSync(base); fs.unlinkSync(lip); } catch {}
  saveRun(run);
}

// ---------------------------------------------------------------- musique de fond (Suno via Kie)

async function startMusic(run) {
  if (!run.params.music) return;
  if (run.music && (run.music.taskId || (run.music.files || []).length)) return;
  const style = `${config().settings.musicStyle || DEFAULT_MUSIC_STYLE}. Fits a dramatic documentary titled "${String(run.title).slice(0, 80)}". Purely instrumental, absolutely NO vocals, NO lyrics, NO singing.`;
  const r = await fetch("https://api.kie.ai/api/v1/generate", {
    method: "POST",
    headers: { Authorization: `Bearer ${kieKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "V5_5", customMode: true, instrumental: true, style, title: `Wealth BGM ${run.id}`, prompt: "", styleWeight: 0.65, weirdnessConstraint: 0.65, audioWeight: 0.65, callBackUrl: "https://your-domain.com/api/callback" }),
  }).then((x) => x.json());
  const taskId = r.data?.taskId;
  if (!taskId) { log(run, `🎵 Suno indisponible (${r.msg || JSON.stringify(r).slice(0, 100)}) — sans musique`); run.music = { error: r.msg || "refus" }; saveRun(run); return; }
  run.music = { taskId, startedAt: new Date().toISOString() };
  run.cost.music = (run.cost.music || 0) + PRICES.music;
  spend.record("Kie.ai", MACHINE_NAME, PRICES.music, "USD", "Musique de fond (Suno, 2 titres)");
  log(run, "🎵 Musique de fond lancée en parallèle (Suno)…");
  saveRun(run);
}
async function collectMusic(run, { wait = false, timeoutMs = 12 * 60 * 1000 } = {}) {
  if (!run.music || !run.music.taskId || (run.music.files || []).length || run.music.error) return;
  const t0 = Date.now();
  while (true) {
    if (cancelledRuns.has(run.id)) throw new Error("Annulée par l'utilisateur");
    const d = await fetch(`https://api.kie.ai/api/v1/generate/record-info?taskId=${run.music.taskId}`, { headers: { Authorization: `Bearer ${kieKey()}` } }).then((x) => x.json());
    const st = d.data?.status;
    if (/FAILED|SENSITIVE|ERROR/i.test(String(st || ""))) { run.music.error = String(st); saveRun(run); log(run, `🎵 Musique échouée (${st}) — sans musique de fond`); return; }
    const tracks = (d.data?.response?.sunoData || []).filter((t) => t.audioUrl);
    if (st === "SUCCESS" && tracks.length) {
      const dir = path.join(OUT_ROOT, run.id);
      const files = [];
      for (let k = 0; k < Math.min(2, tracks.length); k++) { const f = `bgm-${k}.mp3`; await download(tracks[k].audioUrl, path.join(dir, f)); files.push(f); }
      run.music.files = files;
      saveRun(run);
      log(run, `🎵 Musique de fond prête (${files.length} titre(s))`);
      return;
    }
    if (!wait) return;
    if (Date.now() - t0 > timeoutMs) { log(run, "🎵 Musique pas prête à temps — montage sans musique"); return; }
    await new Promise((r2) => setTimeout(r2, 20000));
  }
}

// ---------------------------------------------------------------- étape 4 : assets (tout en parallèle)

async function stepAssets(run) {
  const dir = path.join(OUT_ROOT, run.id);
  ensureDir(path.join(dir, "assets"));
  await startMusic(run).catch((e) => log(run, "🎵 " + e.message));
  const shots = run.scenes.filter((s) => s.kind === "shot");
  const need = (s) => !s.asset || !fs.existsSync(s.asset.file);
  const broll = shots.filter((s) => s.visual === "broll" && need(s));
  const ai = shots.filter((s) => s.visual === "ai" && need(s));
  const motion = run.scenes.filter((s) => (s.kind === "card" || (s.kind === "shot" && s.visual === "motion")) && need(s));
  const avatars = run.scenes.filter((s) => s.kind === "avatar" && need(s));
  const total = broll.length + ai.length + motion.length + avatars.length;
  let done = 0;
  const tick = (what) => {
    done++;
    tasks.updateTask(run.taskId, { step: `Assets : ${done}/${total} (${what})`, progress: 42 + Math.round((30 * done) / Math.max(total, 1)), status: "running" }).catch(() => {});
  };
  log(run, `Assets : ${broll.length} b-roll Pexels (vérifiés par Qwen) · ${ai.length} images IA · ${motion.length} cartes motion · ${avatars.length} passages avatar`);

  const jobs = [];
  // b-roll (pool 4) — repli IA si Pexels n'a rien
  jobs.push(pool(broll, async (s) => {
    s.rendering = true; saveRun(run);
    try {
      const a = await fetchBroll(run, s);
      if (!a) { log(run, `Plan ${s.i} : aucun clip validé pour « ${(s.queries || []).join(" / ")} »${s.checkTried ? " (" + s.checkTried.length + " candidats notés " + s.checkTried.map((t) => t.score).join("/") + ")" : ""} → rendu IA`); s.visual = "ai"; s.fallback = "pexels-empty"; await genWithRetry(run, s, "image"); }
      else if (a.belowThreshold) log(run, `Plan ${s.i} : meilleur clip sous le seuil (${a.verify.score}/10 — ${a.verify.reason})`);
      delete s.error;
    } catch (e) { s.error = e.message; }
    finally { delete s.rendering; saveRun(run); tick("b-roll"); }
  }, BROLL_CONCURRENCY));
  // images IA (pool 5, prompts adaptés en cas de refus)
  jobs.push(pool(ai, async (s) => { await genWithRetry(run, s, "image"); tick("IA"); }, IMG_CONCURRENCY));
  // motion design (photos des dossiers/comparatifs vérifiées, puis une passe Remotion) + textes incrustés
  jobs.push((async () => {
    if (motion.length) {
      motion.forEach((s) => { s.rendering = true; });
      saveRun(run);
      try {
        await prepareMotionImages(run, motion);
        await renderMotionBatch(run, motion, (pct) => tasks.updateTask(run.taskId, { step: `Motion design : rendu ${pct} %` }).catch(() => {}));
      }
      catch (e) { motion.forEach((s) => (s.error = e.message)); log(run, "⚠ Motion design : " + e.message.slice(0, 160)); }
      finally { motion.forEach((s) => delete s.rendering); saveRun(run); done += motion.length; }
    }
    if (config().settings.lowerThirds && !(run.lowerSeq && fs.existsSync(run.lowerSeq.dir))) {
      try { await renderLowerThirds(run); } catch (e) { log(run, "⚠ Bandeaux indisponibles : " + e.message.slice(0, 120)); run.lowerSeq = null; }
    }
  })());
  // avatar (pool 2)
  jobs.push(pool(avatars, async (s) => {
    s.rendering = true; saveRun(run);
    let fails = 0;
    while (true) {
      try { await makeAvatarClip(run, s); break; }
      catch (e) { s.error = e.message; saveRun(run); if (++fails >= 2) break; await new Promise((r) => setTimeout(r, 5000)); }
    }
    delete s.rendering; saveRun(run); tick("avatar");
  }, 2));
  await Promise.all(jobs);

  const missing = run.scenes.filter((s) => !s.asset);
  if (missing.length) {
    const why = (missing.find((s) => s.error) || {}).error || "cause inconnue";
    const msg = `${missing.length} asset(s) manquant(s) (plans ${missing.slice(0, 8).map((s) => s.i).join(", ")}) — ${why}`;
    if (run.mode === "auto" && missing.some((s) => s.kind !== "shot")) throw new Error(`${msg}. Étape non franchie.`);
    log(run, `⚠ ${msg} — ${run.mode === "auto" ? "les plans manquants reprendront le visuel précédent" : "régénère-les (↻) avant de valider"}.`);
  }
  await collectMusic(run).catch(() => {});
}

// ---------------------------------------------------------------- étape 5 : montage

function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p2 = (n, k = 2) => String(n).padStart(k, "0");
  return `${p2(Math.floor(ms / 3600000))}:${p2(Math.floor((ms % 3600000) / 60000))}:${p2(Math.floor((ms % 60000) / 1000))},${p2(ms % 1000, 3)}`;
}
function buildSrt(run, dir) {
  const MAXW = 6, MAXD = 2.6;
  const lines = [];
  let cur = [];
  const w = run.words;
  for (let i = 0; i < w.length; i++) {
    cur.push(w[i]);
    const dur = w[i].end - cur[0].t;
    const endsSentence = /[.!?]["»)]?$/.test(w[i].w);
    const endsClause = /[,;:]$/.test(w[i].w);
    if (i === w.length - 1 || endsSentence || cur.length >= MAXW || dur >= MAXD || (endsClause && cur.length >= 3)) {
      lines.push({ start: cur[0].t, end: w[i].end, text: cur.map((x) => x.w).join(" ").replace(/\s+([,.!?;:])/g, "$1").toUpperCase() });
      cur = [];
    }
  }
  for (let i = 0; i < lines.length - 1; i++) if (lines[i + 1].start - lines[i].end < 0.25) lines[i].end = lines[i + 1].start - 0.02;
  fs.writeFileSync(path.join(dir, "subs.srt"), lines.map((l, i) => `${i + 1}\n${srtTime(l.start)} --> ${srtTime(l.end)}\n${l.text}\n`).join("\n"), "utf8");
  return lines.length;
}

/** Filtre zoompan (Ken Burns) selon le mouvement demandé. `frames` = nombre de frames de sortie ; `d` = 1 pour la vidéo, frames pour l'image. */
function zoomExpr(camera, frames, amp, d) {
  const N = Math.max(frames, 2);
  const A = amp.toFixed(4);
  const center = "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'";
  if (camera === "zoom_out") return `zoompan=z='(1+${A})-${A}*on/${N}':${center}:d=${d}:s=${W}x${H}:fps=${FPS}`;
  if (camera === "pan_right") return `zoompan=z='${(1 + amp).toFixed(4)}':x='(iw-iw/zoom)*on/${N}':y='ih/2-(ih/zoom/2)':d=${d}:s=${W}x${H}:fps=${FPS}`;
  if (camera === "pan_left") return `zoompan=z='${(1 + amp).toFixed(4)}':x='(iw-iw/zoom)*(1-on/${N})':y='ih/2-(ih/zoom/2)':d=${d}:s=${W}x${H}:fps=${FPS}`;
  return `zoompan=z='1+${A}*on/${N}':${center}:d=${d}:s=${W}x${H}:fps=${FPS}`; // zoom_in
}

async function buildClip(run, s, out) {
  const fx = config().settings.effects;
  const frames = Math.max(2, Math.round(s.dur * FPS));
  const enc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), "-video_track_timescale", "15360", "-frames:v", String(frames), out];
  const a = s.asset;
  let camera = s.camera || "zoom_in";
  if (camera !== "static" && ((camera.startsWith("zoom") && !fx.zoom) || (camera.startsWith("pan") && !fx.pan))) camera = fx.zoom ? "zoom_in" : fx.pan ? "pan_right" : "static";
  const amp = Math.min(0.25, Math.max(0.03, Number(fx.amp) || 0.1));
  if (a.kind === "motion" || a.kind === "avatar") {
    // déjà normalisés : on rallonge si besoin (clone de la dernière image) et on coupe à la frame exacte
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", a.file, "-an", "-vf", `fps=${FPS},tpad=stop_mode=clone:stop_duration=4,format=yuv420p`, ...enc]);
    return;
  }
  if (a.kind === "image") {
    const amp2 = Math.min(amp, 0.012 * s.dur + 0.03);
    const vf = camera === "static"
      ? `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=yuv420p`
      : `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},${zoomExpr(camera, frames, amp2, frames)},format=yuv420p`;
    await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", a.file, "-vf", vf, ...enc]);
    return;
  }
  // vidéo b-roll : boucle si plus courte que le plan ; fps normalisé AVANT zoompan (d=1 : une frame de sortie par frame d'entrée)
  const loop = (a.dur || 0) < s.dur + 0.2 ? ["-stream_loop", "-1"] : [];
  const vf = camera === "static"
    ? `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},format=yuv420p`
    : `fps=${FPS},scale=2304:1296:force_original_aspect_ratio=increase,crop=2304:1296,${zoomExpr(camera, frames, amp, 1)},format=yuv420p`;
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", ...loop, "-i", a.file, "-an", "-vf", vf, ...enc]);
}

async function renderCtaSeq(run, label) {
  const rel = `wcta-${run.id}`;
  fs.writeFileSync(path.join(REMOTION_DIR, rel + ".json"), JSON.stringify({ label }));
  await spawnRemotion(["render", "CtaTopRight", rel, "--sequence", "--image-format=png", `--props=${rel}.json`]);
  const folder = path.join(REMOTION_DIR, rel);
  if (!fs.existsSync(path.join(folder, "element-000.png"))) throw new Error("séquence CTA absente");
  return folder;
}

async function renderMontage(run) {
  const dir = path.join(OUT_ROOT, run.id);
  const clips = path.join(dir, "clips");
  ensureDir(clips);
  const name = (s) => String(s.i).padStart(3, "0") + ".mp4";

  // 1) un clip normalisé par plan (pool 3 : ffmpeg est gourmand) — plan sans asset → visuel du plan précédent (jamais d'écran noir)
  const order = run.scenes.slice().sort((a, b) => a.i - b.i);
  let lastGood = null;
  for (const s of order) {
    if (s.asset && fs.existsSync(s.asset.file)) lastGood = s.asset;
    else if (lastGood) { s.asset = { ...lastGood, borrowed: true }; s.camera = s.camera === "zoom_in" ? "zoom_out" : "zoom_in"; }
    else throw new Error(`Plan ${s.i} : aucun visuel disponible (ni le sien, ni un précédent)`);
  }
  let k = 0;
  await pool(order, async (s) => {
    const out = path.join(clips, name(s));
    if (!(fs.existsSync(out) && fs.statSync(out).size > 5000 && s.asset.ts && fs.statSync(out).mtimeMs > s.asset.ts)) await buildClip(run, s, out);
    k++;
    if (k % 8 === 0) await tasks.updateTask(run.taskId, { step: `Montage : clips ${k}/${order.length}`, progress: 74 + Math.round((10 * k) / order.length), status: "running" }).catch(() => {});
  }, 3);
  log(run, `${order.length} clips rendus (zoom/pan : ${order.filter((s) => s.camera && s.camera !== "static").length})`);

  // 2) concaténation
  fs.writeFileSync(path.join(dir, "clips.txt"), order.map((s) => `file 'clips/${name(s)}'`).join("\n"));
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "clips.txt", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-r", String(FPS), "-pix_fmt", "yuv420p", "video-mute.mp4"], dir);
  const muteDur = await ff.probeDuration(path.join(dir, "video-mute.mp4"), { label: "vidéo muette" });
  if (Math.abs(muteDur - run.voDuration) > 2.5) throw new Error(`Montage : vidéo de ${muteDur.toFixed(1)} s pour une voix de ${run.voDuration.toFixed(1)} s — dérive du concat, montage refusé`);

  // 3) piste audio : voix + musique en boucle (volume réglé)
  let audioIn = "vo.mp3";
  if (run.music && (run.music.files || []).length) {
    const files = run.music.files.filter((f) => fs.existsSync(path.join(dir, f)));
    if (files.length) {
      fs.writeFileSync(path.join(dir, "bgm-list.txt"), files.map((f) => `file '${f}'`).join("\n"), "utf8");
      await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", "bgm-list.txt", "-c:a", "libmp3lame", "-q:a", "3", "bgm-bed.mp3"], dir);
      const vol = Math.min(Math.max(Number(run.params.musicVolume ?? config().settings.musicVolume) || 0.12, 0.03), 0.6);
      await runFfmpeg(["-y", "-i", "vo.mp3", "-stream_loop", "-1", "-i", "bgm-bed.mp3", "-filter_complex", `[1:a]volume=${vol},afade=t=in:st=0:d=2[bgm];[0:a][bgm]amix=inputs=2:duration=first:normalize=0[aout]`, "-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "audio-bed.m4a"], dir);
      audioIn = "audio-bed.m4a";
      log(run, `🎵 Musique mixée (volume ${Math.round(vol * 100)} %)`);
    }
  }

  // 4) sous-titres, bandeaux, bouton CTA, mux — en une passe
  const subsOn = run.params.subtitles === true;
  if (subsOn) log(run, `Sous-titres : ${buildSrt(run, dir)} lignes`);
  const inputs = ["-i", "video-mute.mp4", "-i", audioIn];
  let filter = "";
  let cur = "[0:v]";
  let idx = 2;
  if (subsOn) {
    filter += `[0:v]subtitles=subs.srt:force_style='FontName=Arial Black,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=1,Alignment=2,MarginV=40'[sub]`;
    cur = "[sub]";
  }
  // bandeaux : chaque bandeau = une entrée sur la même séquence PNG avec son start_number
  const lts = run.lowerSeq && fs.existsSync(run.lowerSeq.dir) ? run.scenes.filter((s) => s.overlay && s.lowerFrames && s.asset && !s.asset.borrowed && s.kind === "shot" && s.visual !== "motion") : [];
  for (const s of lts.slice(0, 60)) {
    const pattern = path.join(run.lowerSeq.dir, `element-%0${run.lowerSeq.pad}d.png`);
    inputs.push("-framerate", String(FPS), "-start_number", String(s.lowerFrames.from), "-i", pattern);
    const st = +(s.start + 0.25).toFixed(2);
    const en = +(st + s.lowerFrames.count / FPS).toFixed(2);
    filter += `${filter ? ";" : ""}[${idx}:v]format=rgba,setpts=PTS+${st}/TB[lt${idx}];${cur}[lt${idx}]overlay=0:0:eof_action=pass:enable='between(t,${st},${en})'[v${idx}]`;
    cur = `[v${idx}]`;
    idx++;
  }
  // bouton CTA pendant le passage CTA de l'avatar (best-effort)
  const ctaScene = run.scenes.find((s) => s.kind === "avatar" && s.role === "cta");
  let ctaSeq = null;
  if (ctaScene) {
    try { ctaSeq = await renderCtaSeq(run, CTA_LABEL[run.params.language] || CTA_LABEL.English); }
    catch (e) { log(run, "Bouton CTA indisponible (" + String(e.message).slice(0, 90) + ") — montage sans bouton"); }
  }
  if (ctaSeq) {
    const st = +(ctaScene.start + Math.min(2.5, ctaScene.dur * 0.25)).toFixed(2);
    inputs.push("-framerate", String(FPS), "-start_number", "0", "-i", path.join(ctaSeq, "element-%03d.png"));
    filter += `${filter ? ";" : ""}[${idx}:v]format=rgba,scale=${W}:${H},setpts=PTS+${st}/TB[cta];${cur}[cta]overlay=0:0:eof_action=pass:enable='between(t,${st},${st + 4})'[vcta]`;
    cur = "[vcta]";
    idx++;
  }
  await runFfmpeg([
    "-hide_banner", "-loglevel", "error", "-y", ...inputs,
    ...(filter ? ["-filter_complex", filter] : []),
    "-map", cur === "[0:v]" ? "0:v" : cur, "-map", "1:a",
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-t", run.voDuration.toFixed(3), "-movflags", "+faststart", "final.mp4",
  ], dir);

  try {
    if (ctaSeq) fs.rmSync(ctaSeq, { recursive: true, force: true });
    fs.unlinkSync(path.join(REMOTION_DIR, `wcta-${run.id}.json`));
  } catch {}
  try { fs.rmSync(clips, { recursive: true, force: true }); fs.unlinkSync(path.join(dir, "video-mute.mp4")); } catch {}
  return path.join(dir, "final.mp4");
}

// ---------------------------------------------------------------- étape 6 : packaging

function capTags(tags, max = 500) {
  const out = [];
  let len = 0;
  for (const t of tags) {
    const s = String(t).trim();
    if (!s) continue;
    const add = s.length + (s.includes(" ") ? 2 : 0) + (out.length ? 1 : 0);
    if (len + add > max) break;
    out.push(s);
    len += add;
  }
  return out;
}
/**
 * Miniatures concurrentes les plus vues **AU FORMAT DE LA MACHINE** : références de style pour la nôtre.
 * Le filtre (un montant en dollars + un verbe de chute dans le titre) est indispensable : sans lui, le top de la
 * banque est trusté par les chaînes météo (« 1700+ DEATHS Estimated! Nepal Flash Flood »), dont le code visuel
 * n'a rien à voir avec les mansions.
 */
const THUMB_FORMAT = /\$\s?\d/i;
const THUMB_VERB = /(slid|fall|wash|sink|crumbl|underwater|eaten|burn|collaps|losing|lost|disappear|swallow|red-tagged|uninsurable|condemn)/i;
function topCompetitorThumbFiles(n = 3) {
  try {
    const c = config();
    if (!c.nicheId) return [];
    const s = bank.summary(c.nicheId);
    const out = [];
    for (const v of s.topVideos) {
      if (!(THUMB_FORMAT.test(v.title) && THUMB_VERB.test(v.title))) continue;
      for (const ch of s.channels) for (const rel of scrap.channelThumbs(ch.channelId)) if (rel.endsWith(`-${v.videoId}.jpg`)) out.push(path.join(ROOT, rel));
      if (out.length >= n) break;
    }
    return out.slice(0, n);
  } catch { return []; }
}

async function generatePackaging(run) {
  const c = config();
  const o = run.outline;
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 15, maxVisions: 0 }); } catch { return ""; } })() : "";
  const j = await genJson(
    [
      "Tu prépares la PUBLICATION YouTube d'une vidéo « faceless » de la niche richesse/patrimoine (mansions, fortunes, luxe face aux catastrophes et aux erreurs).",
      `LANGUE DE LA CHAÎNE (titre, description, tags) : ${c.settings.chainLanguage}.`,
      "",
      `TITRE DE TRAVAIL : ${run.title}`,
      `SUJET : ${run.params.subject}`,
      `SECTIONS : ${o.sections.map((s) => `${s.n}. ${s.title}`).join(", ")}`,
      `IDÉE DE MINIATURE (outline) : ${o.thumbIdea || ""}`,
      "SCRIPT (début) :", run.script.slice(0, 2500),
      "",
      inspiration ? "CE QUI PERFORME DANS LA NICHE (codes de titres et de tags à reprendre) :\n" + inspiration : "",
      "",
      "CONTRAINTES :",
      "- `title` : la FORMULE EXACTE de la niche (relevée sur 150+ titres concurrents) : « <Lieu>'s $<N>M <Homes|Mansions|Estates> Are <Sliding|Falling|Washing|Sinking|Crumbling> Into <the Ocean|the Sea> — And <Nobody|Owners|the State|California> <Can't Stop It|Won't Help|Can't Save Them> » (variante : « <Lieu>'s $<N>M <Objet> <Verbe au passé> — And <Conséquence> »). 60-95 caractères, tiret cadratin obligatoire, pas d'émoji, pas de majuscules criardes.",
      "- `description` : §1 (3-4 phrases) le récit en clair avec 2-3 chiffres ; §2 une question au spectateur ; §3 « Subscribe for more stories… » ; puis une ligne vide et « Disclaimer: this video is for entertainment and educational purposes. Figures are approximate and based on public reporting. Stock footage and AI-generated visuals are used for illustration. »",
      "- `tags` : 16-22 mots-clés du plus précis au plus large (lieux, mansions, luxury real estate, wealth, rich people, natural disaster, money mistakes…).",
      "- `thumbPrompt` : EN, 25-45 mots, LA SCÈNE de la miniature seulement (le style et l'interdiction de texte sont ajoutés par la machine) : vue aérienne drone d'UNE propriété de luxe identifiable de ce sujet, en péril immédiat (eau jusqu'aux fenêtres, falaise effondrée sous la terrasse, vague qui explose, carcasse brûlée), ciel de tempête. Décris la propriété et la menace, rien d'autre. Ne demande JAMAIS de texte dans l'image.",
      "- `thumbPlace` : le LIEU en CAPITALES pour l'étiquette du bandeau, 1-3 mots, tel qu'il apparaîtrait sur une chaîne d'info (« MALIBU », « KEY BISCAYNE », « OUTER BANKS », « PACIFIC PALISADES »).",
      "- `thumbHeadline` : le GROS TITRE du bandeau, en CAPITALES, **2 à 3 mots, 22 caractères maximum**, au code exact de la niche : « <LIEU> ALERT », « ALMOST GONE », « MANSIONS SLIDING », « MANSION COLLAPSE », « GOING UNDER », « BURNED TO DIRT ». Jamais de ponctuation, jamais de chiffre, jamais une phrase.",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"title":"","description":"","tags":[],"thumbPrompt":"","thumbPlace":"","thumbHeadline":""}',
    ].filter(Boolean).join("\n"),
    { ms: 8 * 60 * 1000, label: "Packaging" }
  );
  run.pack = {
    title: String(j.title || run.title).slice(0, 100), description: String(j.description || ""), tags: capTags(j.tags || []),
    thumbPrompt: String(j.thumbPrompt || ""),
    thumbPlace: String(j.thumbPlace || "").toUpperCase().slice(0, 22),
    thumbHeadline: String(j.thumbHeadline || "ALERT").toUpperCase().replace(/[.!?,;:]+$/, "").slice(0, 26),
  };
  saveRun(run);
  await generateThumbnail(run, j.thumbPrompt);
  log(run, `Packaging prêt : « ${run.pack.title} »`);
  saveRun(run);
}

/**
 * Le code de miniature de la niche, relevé sur les 8 miniatures les plus vues des chaînes « mansions » :
 * une vue AÉRIENNE photoréaliste d'une propriété de luxe en péril (submergée, au bord d'une falaise effondrée,
 * frappée par une vague), ciel de tempête — SANS aucun texte dans l'image — puis un bandeau « BREAKING » incrusté
 * en bas à gauche (étiquette rouge + LIEU, puis 2-3 mots en noir ultra-gras sur blanc). Le texte est composé par
 * Remotion, jamais demandé au modèle d'image : aucun générateur n'écrit proprement.
 */
const THUMB_SCENE_RULES = [
  "AERIAL DRONE PHOTOGRAPH, medium altitude, slightly tilted down, exactly like a press drone shot.",
  "The subject is ONE clearly readable luxury property (or a short row of them) in immediate danger: water up to the windows, the cliff or the ground collapsed right under the terrace, a huge wave exploding against the seawall, or the burnt shell of the estate.",
  "The threat and the luxury must BOTH be unmistakable in one glance: pool, glass walls, columns, manicured lawn, palm trees on one side — churning grey-green water, raw earth, debris, white foam on the other.",
  "Overcast storm sky, cold desaturated grey-blue palette with the house bright enough to pop, heavy contrast, photorealistic press quality, no people, no boats in the foreground.",
  "Keep the BOTTOM-LEFT QUARTER of the frame visually simple (water, ground, foam): a news banner will be composited there.",
].join(" ");

/** Compose le bandeau « BREAKING » par-dessus l'image de fond (Remotion still, 1280×720). */
async function composeThumbBanner(run, bgFile, outFile, place, headline) {
  const rel = `wt-${run.id}`;
  const pubDir = path.join(REMOTION_DIR, "public", rel);
  ensureDir(pubDir);
  const name = "bg" + (path.extname(bgFile) || ".png");
  fs.copyFileSync(bgFile, path.join(pubDir, name));
  const propsFile = path.join(REMOTION_DIR, `${rel}.json`);
  fs.writeFileSync(propsFile, JSON.stringify({ image: name, dir: rel, place, headline, badge: "BREAKING" }));
  const tmpName = `${rel}.png`;
  await spawnRemotion(["still", "WealthThumb", tmpName, `--props=${path.basename(propsFile)}`]);
  const tmpFile = path.join(REMOTION_DIR, tmpName);
  if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size < 1000) throw new Error("miniature : Remotion n'a produit aucun fichier");
  fs.copyFileSync(tmpFile, outFile);
  try { fs.unlinkSync(tmpFile); fs.unlinkSync(propsFile); fs.rmSync(pubDir, { recursive: true, force: true }); } catch {}
}

async function generateThumbnail(run, thumbPrompt) {
  const dir = path.join(OUT_ROOT, run.id);
  const file = path.join(dir, "thumbnail.png");
  const bg = path.join(dir, "thumbnail-bg.png");
  const tool = imgTool();
  // Références i2i : les miniatures concurrentes AU FORMAT (drone + mansion en péril) — c'est ce qui donne la
  // « patte » de la niche ; le t2i descriptif seul dérive vers de la carte postale.
  const refs = [];
  for (const f of topCompetitorThumbFiles(3)) { try { refs.push(await uploadPublic(`${run.id}-thumbref-${refs.length}.jpg`, f, "image/jpeg")); } catch {} }
  const prompt = [
    refs.length ? `STYLE REFERENCES ATTACHED: ${refs.length} thumbnails from the competing channels of this exact niche. Reproduce their visual identity so closely that a viewer would believe it is the same channel: same aerial drone viewpoint, same storm light, same framing of a doomed luxury property, same level of photorealism and contrast. IGNORE the text banners burned into the references — your image must contain NO text at all. Draw a NEW scene for this subject, never copy their content.` : "",
    THUMB_SCENE_RULES,
    `SCENE: ${thumbPrompt}`,
    IMG_NEG,
    "ABSOLUTELY NO TEXT, no letters, no words, no numbers, no logo, no watermark, no banner, no caption anywhere in the image.",
  ].filter(Boolean).join("\n\n");
  const input = { prompt, aspect_ratio: "16:9" };
  if (refs.length) input[tool.field] = refs;
  const url = await kiePoll(await kieCreate(refs.length ? tool.i2i : tool.t2i, input), run.id);
  await download(url, bg);
  run.cost.images = (run.cost.images || 0) + imgPrice();
  spend.record("Kie.ai", MACHINE_NAME, imgPrice(), "USD", "Miniature (fond)");
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", bg, "-vf", "scale=1280:720", path.join(dir, "thumbnail-bg-1280.png")]);
  fs.renameSync(path.join(dir, "thumbnail-bg-1280.png"), bg);
  // Bandeau BREAKING composé par-dessus (le code n°1 de la niche)
  const place = (run.pack.thumbPlace || run.outline?.sections?.[0]?.title || "").toString().toUpperCase().slice(0, 22);
  const headline = (run.pack.thumbHeadline || "ALERT").toString().toUpperCase().slice(0, 26);
  try {
    await composeThumbBanner(run, bg, file, place, headline);
  } catch (e) {
    log(run, "⚠ Bandeau de miniature indisponible (" + String(e.message).slice(0, 90) + ") — miniature sans bandeau");
    fs.copyFileSync(bg, file);
  }
  run.pack.thumbRel = `agent-os/output/machines/${run.id}/thumbnail.png`;
  run.pack.thumbBgRel = `agent-os/output/machines/${run.id}/thumbnail-bg.png`;
  run.pack.thumbTs = Date.now();
  saveRun(run);
}

/** Recompose seulement le bandeau (texte modifié à la main) sans repayer l'image. */
async function restyleThumbnail(runId, { place, headline } = {}) {
  const run = getLiveRun(runId);
  try {
    if (!run.pack) throw new Error("Packaging absent");
    const dir = path.join(OUT_ROOT, run.id);
    const bg = path.join(dir, "thumbnail-bg.png");
    if (!fs.existsSync(bg)) throw new Error("Fond de miniature absent — régénère la miniature");
    if (place !== undefined) run.pack.thumbPlace = String(place).toUpperCase().slice(0, 22);
    if (headline !== undefined) run.pack.thumbHeadline = String(headline).toUpperCase().slice(0, 26);
    await composeThumbBanner(run, bg, path.join(dir, "thumbnail.png"), run.pack.thumbPlace || "", run.pack.thumbHeadline || "ALERT");
    run.pack.thumbTs = Date.now();
    saveRun(run);
    return getRun(runId);
  } finally {
    releaseLiveRun(runId);
  }
}
async function regenThumbnail(runId, instructions) {
  const run = getRun(runId);
  const j = await genJson(
    [
      "Réécris le PROMPT de miniature YouTube d'une vidéo de la niche richesse/patrimoine (mansions, fortunes, luxe face aux catastrophes).",
      `Vidéo : ${run.pack?.title || run.title} — sujet : ${run.params.subject}. Idée : ${run.outline?.thumbIdea || ""}`,
      `Prompt actuel : ${run.pack?.thumbPrompt || ""}`,
      instructions ? `PRIORITÉ ABSOLUE — consigne de l'utilisateur : ${instructions}` : "",
      "Code : vue aérienne drone d'UNE propriété de luxe de ce sujet en péril immédiat (eau, falaise effondrée, vague, incendie), ciel de tempête, photoréaliste. 25-45 mots, la scène seulement, zéro texte dans l'image.",
      "Rends aussi `thumbPlace` (le lieu en CAPITALES, 1-3 mots) et `thumbHeadline` (2-3 mots en CAPITALES, 22 caractères max, façon « MALIBU ALERT » / « ALMOST GONE » / « MANSIONS SLIDING »).",
      'RÉPONDS UNIQUEMENT EN JSON : {"thumbPrompt":"","thumbPlace":"","thumbHeadline":""}',
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Miniature" }
  );
  run.pack.thumbPrompt = String(j.thumbPrompt || run.pack.thumbPrompt);
  if (j.thumbPlace) run.pack.thumbPlace = String(j.thumbPlace).toUpperCase().slice(0, 22);
  if (j.thumbHeadline) run.pack.thumbHeadline = String(j.thumbHeadline).toUpperCase().replace(/[.!?,;:]+$/, "").slice(0, 26);
  saveRun(run);
  await generateThumbnail(run, run.pack.thumbPrompt);
  return getRun(runId);
}
async function regenTexts(runId, instructions, field) {
  const run = getRun(runId);
  const c = config();
  const want = field === "all" ? ["title", "description", "tags"] : [field];
  const j = await genJson(
    [
      `Réécris ${want.join(", ")} pour une vidéo YouTube de la niche richesse/patrimoine.`,
      `Langue : ${c.settings.chainLanguage}. Titre actuel : ${run.pack?.title}. Sujet : ${run.params.subject}`,
      instructions ? `Consigne : ${instructions}` : "",
      "Titre : formule de la niche « <Lieu>'s $<N>M <Homes> Are <Verbe-ing> Into <the Ocean> — And <Nobody> Can't Stop It », 60-95 caractères. Description : récit chiffré, question, abonnement, disclaimer (approximations, stock + IA).",
      `RÉPONDS UNIQUEMENT EN JSON avec seulement ces clés : ${want.map((f) => `"${f}"`).join(", ")}`,
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Textes" }
  );
  if (j.title) run.pack.title = String(j.title).slice(0, 100);
  if (j.description) run.pack.description = String(j.description);
  if (j.tags) run.pack.tags = capTags(j.tags);
  saveRun(run);
  return getRun(runId);
}

// ---------------------------------------------------------------- stock + publication

function stock() {
  return readJSON(`machines/${MACHINE_ID}-stock.json`, []);
}
function patchStock(entryId, patch = {}) {
  const s = stock();
  const e = s.find((x) => x.id === entryId);
  if (!e) throw new Error("Entrée de stock introuvable");
  for (const k of ["archived", "posted"]) if (patch[k] !== undefined) e[k] = !!patch[k];
  writeJSON(`machines/${MACHINE_ID}-stock.json`, s);
  return e;
}
function addToStock(run) {
  const s = stock();
  if (s.some((x) => x.id === run.id)) return;
  s.unshift({
    id: run.id, runId: run.id, title: run.pack?.title || run.title, description: run.pack?.description || "", tags: run.pack?.tags || [],
    finalRel: run.finalRel, thumbRel: run.pack?.thumbRel || null, durationSec: run.voDuration, shots: (run.scenes || []).length,
    cost: run.cost, createdAt: new Date().toISOString(), posted: false, archived: false,
  });
  writeJSON(`machines/${MACHINE_ID}-stock.json`, s);
}
async function publishRun(runId, { channelId, title, description, tags, privacyStatus } = {}) {
  const run = getRun(runId);
  if (!run.finalRel) throw new Error("Pas de vidéo à publier");
  const chan = channelId || run.params.publishChannelId;
  if (!chan) throw new Error("Choisis une chaîne");
  const file = path.join(ROOT, run.finalRel);
  const priv = privacyStatus || run.params.publishPrivacy || config().settings.publishPrivacy || "private";
  const vid = await google.youtubeUpload(chan, file, {
    title: (title || run.pack?.title || run.title).slice(0, 100),
    description: description || run.pack?.description || "",
    tags: (tags && tags.length ? tags : run.pack?.tags || []).slice(0, 60),
    privacyStatus: priv,
    categoryId: "24",
  });
  if (run.pack?.thumbRel) {
    try { await google.youtubeSetThumbnail(chan, vid.id, path.join(ROOT, run.pack.thumbRel)); }
    catch (e) { log(run, "⚠ " + e.message + " — la vidéo est en ligne, pose la miniature à la main."); }
  }
  run.published = { videoId: vid.id, url: `https://youtu.be/${vid.id}`, at: new Date().toISOString(), privacyStatus: priv };
  saveRun(run);
  try { patchStock(run.id, { posted: true }); } catch {}
  return run.published;
}

// ---------------------------------------------------------------- concurrence + relances

async function pool(items, worker, concurrency = 6) {
  const q = items.slice();
  let err = null;
  const run1 = async () => {
    while (q.length) {
      const it = q.shift();
      try { await worker(it); } catch (e) { err = err || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run1));
  if (err) throw err;
}

const cancelledRuns = new Set();

function isPolicyError(msg) {
  return /flagged|content polic|violat|sensitive|moderat|nsfw|safety|inappropriate|prohibit|unsafe|harmful|censor/i.test(String(msg || ""));
}
/** Refus/échec répété d'une image IA : on réécrit la description (implicite / simplifiée) — jamais le même prompt deux fois. */
async function adaptScenePrompt(run, scene, reason) {
  const n = scene.rewrites || 0;
  const policy = isPolicyError(reason);
  if (n >= MAX_REWRITES) { log(run, `Plan ${scene.i} : ${MAX_REWRITES} réécritures déjà tentées (${String(reason).slice(0, 80)})`); return false; }
  try {
    const j = await genJson(
      [
        `Tu réécris la DESCRIPTION D'IMAGE d'un plan de vidéo documentaire (niche richesse/patrimoine) parce que le générateur d'images ${policy ? "l'a REFUSÉE (filtre de modération)" : "a échoué plusieurs fois dessus"}.`,
        `Motif renvoyé : ${String(reason).slice(0, 200)}`,
        `Ce qui est dit pendant le plan : « ${scene.say} »`,
        `Description actuelle (à remplacer) : ${scene.desc}`,
        policy
          ? "OBJECTIF : garder le sens (même lieu, même tension) mais rendre l'image acceptable par un filtre STRICT : aucune victime, aucun blessé, aucun corps, aucune violence, aucune personne identifiable, aucune marque ; passe par la suggestion (l'après, l'objet, le décor vide, le plan large)."
          : "OBJECTIF : garder le sens mais SIMPLIFIER : un sujet, un décor, une lumière, pas de mots rares, pas de texte.",
        "Description en ANGLAIS, 15-30 mots, concrète et photographiable.",
        'RÉPONDS UNIQUEMENT EN JSON : {"desc":""}',
      ].join("\n"),
      { ms: 4 * 60 * 1000, tries: 2, label: `Adaptation du plan ${scene.i}` }
    );
    const text = String(j.desc || "").trim();
    if (text.length < 15 || text === scene.desc) throw new Error("réécriture vide ou identique");
    scene.promptHistory = (scene.promptHistory || []).concat([{ desc: scene.desc, error: String(reason).slice(0, 200), ts: Date.now() }]);
    scene.desc = text;
    scene.rewrites = n + 1;
    saveRun(run);
    log(run, `Plan ${scene.i} : description ${policy ? "refusée par Kie" : "en échec répété"} → réécrite (${n + 1}/${MAX_REWRITES}), nouvel essai`);
    return true;
  } catch (e) {
    log(run, `Plan ${scene.i} : réécriture impossible (${e.message.slice(0, 80)})`);
    return false;
  }
}
async function genWithRetry(run, scene, kind) {
  scene.rendering = true;
  saveRun(run);
  try {
    if (scene.lastError) { const why = scene.lastError; delete scene.lastError; await adaptScenePrompt(run, scene, why); }
    let fails = 0;
    while (true) {
      if (cancelledRuns.has(run.id)) throw new Error("Annulée par l'utilisateur");
      try {
        if (kind === "image") await generateImage(run, scene);
        return;
      } catch (e) {
        scene.error = e.message;
        saveRun(run);
        if (isPolicyError(e.message)) { if (await adaptScenePrompt(run, scene, e.message)) continue; return; }
        if (++fails >= MAX_TRIES) return;
        await new Promise((r) => setTimeout(r, 4000 * fails));
      }
    }
  } finally {
    delete scene.rendering;
    saveRun(run);
  }
}

// ---------------------------------------------------------------- machine à états

const activeAdvance = new Set();

function scriptComplete(run) {
  return !!run.outline && !!run.sections?.length && run.sections.every((s) => s.text) && !!run.script;
}
function promptsComplete(run) {
  return !!run.scenes?.length && run.scenes.filter((s) => s.kind === "shot").every((s) => s.desc && s.visual);
}
function assetsComplete(run) {
  return !!run.scenes?.length && run.scenes.every((s) => s.asset);
}
function deriveStatus(run) {
  if (!scriptComplete(run)) return "script_running";
  if (!run.scenes?.length || !run.words?.length) return "voice_running";
  if (!promptsComplete(run)) return "prompts_running";
  if (!assetsComplete(run)) return "assets_running";
  if (!run.finalRel) return "montage_running";
  if (!run.pack) return "packaging_running";
  return "done";
}
function cancelRun(id) {
  const run = getRun(id);
  cancelledRuns.add(id);
  if (run.status !== "done" && run.status !== "failed" && !run.cancelledFrom) run.cancelledFrom = run.status;
  tasks.updateTask(run.taskId, { step: "Annulée par l'utilisateur", status: "failed" }).catch(() => {});
  if (!activeAdvance.has(id)) { run.status = "failed"; run.error = "Annulée par l'utilisateur"; log(run, "Run annulé"); }
  else log(run, "Annulation demandée — abandon des requêtes en cours…");
  saveRun(run);
  return getRun(id);
}
function resumeRun(id, forcedStatus) {
  if (activeAdvance.has(id)) throw new Error("Le run tourne déjà — la décharge ⚡ n'est utile que s'il est à l'arrêt.");
  const run = getRun(id);
  cancelledRuns.delete(id);
  run.status = forcedStatus || run.cancelledFrom || (run.status === "failed" ? deriveStatus(run) : run.status);
  run.error = null;
  delete run.cancelledFrom;
  (run.scenes || []).forEach((s) => {
    if (s.kind === "shot" && s.visual === "ai" && s.error && !s.asset) s.lastError = s.error;
    delete s.rendering; delete s.pending; delete s.error;
  });
  (run.sections || []).forEach((s) => { delete s.rendering; delete s.error; });
  saveRun(run);
  log(run, `Reprise à l'étape « ${run.status.replace("_running", " (en cours)").replace("_ready", " (validé)")} »`);
  advance(run.id);
  return getRun(id);
}

const STEPS = [
  ["script", "Écriture du script : outline puis sections en parallèle (Claude)…", 6, stepScript],
  ["voice", "Voix off par section + Whisper + découpage + plan visuel…", 16, stepVoice],
  ["prompts", "Direction visuelle de chaque plan…", 30, stepPrompts],
  ["assets", "Assets : Pexels, images IA, motion design, avatar lipsync, musique…", 42, stepAssets],
];

async function advance(runId) {
  cancelledRuns.delete(runId);
  activeAdvance.add(runId);
  const run = getRun(runId);
  const auto = run.mode === "auto";
  const t = (patch) => tasks.updateTask(run.taskId, Object.assign({ status: "running" }, patch)).catch(() => {});
  try {
    await ff.ensureTools();
    while (true) {
      if (cancelledRuns.has(runId)) throw new Error("Annulée par l'utilisateur");
      const cur = run.status;
      const step = STEPS.find(([name]) => cur === name + "_running");
      if (step) {
        await t({ step: step[1], progress: step[2] });
        await step[3](run);
        const idx = STEPS.indexOf(step);
        const next = idx + 1 < STEPS.length ? STEPS[idx + 1][0] + "_running" : "montage_running";
        run.status = auto ? next : step[0] + "_ready";
      } else if (cur === "montage_running") {
        await collectMusic(run, { wait: true }).catch(() => {});
        await t({ step: "Montage final (zoom/pan, bandeaux, CTA, musique, sous-titres)…", progress: 74 });
        const out = await renderMontage(run);
        run.finalRel = `agent-os/output/machines/${run.id}/final.mp4`;
        run.status = "packaging_running";
        log(run, "Montage terminé : " + out);
      } else if (cur === "packaging_running") {
        await t({ step: "Packaging : titre, description, tags, miniature…", progress: 92 });
        if (!run.pack || !run.pack.thumbRel) await generatePackaging(run);
        addToStock(run);
        run.status = "done";
        log(run, "Vidéo ajoutée au stock");
        if (run.params.publishChannelId) {
          await t({ step: "Publication YouTube…", progress: 97 });
          try { const pub = await publishRun(run.id); log(run, `Publiée : ${pub.url} (${pub.privacyStatus})`); }
          catch (e) { log(run, "⚠ Publication échouée : " + e.message); }
        }
      } else break;
      saveRun(run);
      if (run.status === "done") {
        await tasks.updateTask(run.taskId, { step: `Terminée — ${run.sections.length} sections, ${(run.voDuration / 60).toFixed(1)} min`, progress: 100, status: "done" }).catch(() => {});
        break;
      }
      if (run.status.endsWith("_ready")) {
        await tasks.updateTask(run.taskId, { step: `En attente de validation (${run.status.replace("_ready", "")})`, status: "running" }).catch(() => {});
        break;
      }
    }
  } catch (e) {
    run.status = "failed";
    run.error = e.message;
    log(run, "❌ " + e.message);
    saveRun(run);
    await tasks.updateTask(run.taskId, { step: e.message.slice(0, 200), status: "failed" }).catch(() => {});
  } finally {
    activeAdvance.delete(runId);
  }
  return getRun(runId);
}

function createRun(params = {}) {
  const c = config();
  const s = c.settings;
  const id = "w" + Date.now().toString(36);
  const durationMin = Math.max(2, Math.min(30, Number(params.durationMin) || s.durationMin || 8));
  const language = params.language || "English";
  const subject = String(params.subject || "").trim();
  if (!subject) throw new Error("Donne un sujet (le cas, le lieu ou l'idée de la vidéo)");
  if (params.publishChannelId === undefined && !params.allowNoPublish && s.autoPublish) throw new Error("Publication auto activée : choisis une chaîne");
  const avatarId = params.avatarId && params.avatarId !== "none" ? params.avatarId : null;
  if (avatarId) {
    const av = c.avatars.find((a) => a.id === avatarId);
    if (!av) throw new Error("Avatar introuvable");
    if (!av.referenceRel) throw new Error(`L'avatar « ${av.name} » n'a pas d'image de référence (onglet Avatars)`);
  }
  const voiceProvider = params.voiceProvider === "elevenlabs" ? "elevenlabs" : "inworld";
  const voice = params.voice || (voiceProvider === "elevenlabs" ? ELEVEN_VOICES[0] : (VOICES[language] || VOICES.English)[0]);
  const run = {
    id, machineId: MACHINE_ID, title: subject, status: "script_running", mode: params.mode === "auto" ? "auto" : "semi", createdAt: new Date().toISOString(),
    params: {
      subject, durationMin, language, voiceProvider, voice, avatarId,
      avatarIntro: avatarId ? params.avatarIntro !== false : false,
      avatarCount: avatarId ? Math.max(0, Math.min(6, Number(params.avatarCount ?? s.avatarCount))) : 0,
      cta: avatarId ? params.cta !== false : false,
      mixBroll: Math.max(0, Math.min(100, Number(params.mixBroll ?? s.mixBroll))),
      motionPct: Math.max(0, Math.min(40, Number(params.motionPct ?? s.motionPct))),
      overlayPct: Math.max(0, Math.min(80, Number(params.overlayPct ?? s.overlayPct))),
      shotSeconds: Math.max(2.5, Math.min(8, Number(params.shotSeconds) || s.shotSeconds)),
      subtitles: params.subtitles === true,
      music: params.music !== undefined ? !!params.music : !!s.music,
      musicVolume: Number(params.musicVolume) || s.musicVolume,
      imageModel: params.imageModel || s.imageModel,
      publishChannelId: params.publishChannelId || null,
      publishPrivacy: params.publishPrivacy || s.publishPrivacy || "private",
      channelName: params.channelName || s.channelName || "Wealth",
    },
    cost: { voice: 0, images: 0, avatar: 0, music: 0 },
    sections: [], scenes: [], logs: [],
  };
  if (params.imageModel && PRICES.image[params.imageModel]) { const cc = config(); cc.settings.imageModel = params.imageModel; saveConfig(cc); }
  run.estimate = estimate(run.params);
  const task = tasks.createTask({
    title: `Wealth — ${subject.slice(0, 60)}`,
    desc: `${durationMin} min · ~${run.estimate.shots} plans · ~${run.estimate.total.toFixed(2)} $`,
    machine: MACHINE_NAME, machineId: MACHINE_ID, runId: id, kind: "video", step: "Démarrage…", progress: 2, status: "running",
  });
  run.taskId = task.id;
  saveRun(run);
  advance(id);
  return run;
}

/** Devis affiché avant de lancer. */
function estimate(p = {}) {
  const s = config().settings;
  const durationMin = Number(p.durationMin) || s.durationMin || 8;
  const shotSec = Number(p.shotSeconds) || s.shotSeconds;
  const avatarOn = !!(p.avatarId && p.avatarId !== "none");
  const avatarCount = avatarOn ? Number(p.avatarCount ?? s.avatarCount) : 0;
  const avatarSec = avatarOn ? (p.avatarIntro !== false ? 25 : 0) + avatarCount * s.avatarSeconds + (p.cta !== false ? 12 : 0) : 0;
  const words = Math.round(durationMin * scriptWpm());
  const chars = Math.round(words * 5.7) + 200;
  const sections = sectionCount(durationMin);
  const secs = durationMin * 60 - avatarSec - (s.sectionCards ? (sections - 1) * CARD_SEC : 0);
  const shots = Math.max(1, Math.round(secs / shotSec));
  const motion = Math.round((shots * (Number(p.motionPct ?? s.motionPct))) / 100);
  const ai = Math.round(((shots - motion) * (100 - Number(p.mixBroll ?? s.mixBroll))) / 100);
  const broll = shots - motion - ai;
  const price = PRICES.image[p.imageModel || s.imageModel] || 0.02;
  const images = (ai + 1) * price; // + miniature
  const provider = p.voiceProvider === "elevenlabs" ? "elevenlabs" : "inworld";
  const voice = (chars / 1000) * PRICES.voicePer1kChars[provider] + durationMin * 60 * PRICES.whisperPerSec;
  const avatar = (avatarSec / 60) * PRICES.lipsyncPerMin;
  const music = (p.music !== undefined ? !!p.music : !!s.music) ? PRICES.music : 0;
  return { words, sections, shots, broll, ai, motion, avatarSec, images: +images.toFixed(2), voice: +voice.toFixed(3), avatar: +avatar.toFixed(2), music, total: +(images + voice + avatar + music).toFixed(2) };
}

function validate(runId) {
  const run = getRun(runId);
  if (!run.status.endsWith("_ready")) throw new Error("Rien à valider à cette étape.");
  const stuck = (run.scenes || []).filter((s) => s.pending || s.rendering);
  if (stuck.length) throw new Error(`${stuck.length} plan(s) en cours de régénération — attends la fin.`);
  if (run.status === "assets_ready") {
    const miss = run.scenes.filter((s) => !s.asset && s.kind !== "shot");
    if (miss.length) throw new Error(`${miss.length} carte(s)/avatar(s) manquant(s) — régénère-les avant de valider.`);
  }
  if (run.status === "script_ready") run.script = run.sections.map((s) => s.text).join(" ");
  const order = ["script", "voice", "prompts", "assets"];
  const cur = run.status.replace("_ready", "");
  const idx = order.indexOf(cur);
  run.status = idx + 1 < order.length ? order[idx + 1] + "_running" : "montage_running";
  saveRun(run);
  advance(runId);
  return getRun(runId);
}
function patchSection(runId, n, text) {
  const run = getRun(runId);
  if (run.status !== "script_ready") throw new Error("Le script ne s'édite qu'à l'étape « Script » validable.");
  const s = (run.sections || []).find((x) => x.n === Number(n));
  if (!s) throw new Error("Section introuvable");
  s.text = String(text || "").replace(/\s+/g, " ").trim();
  run.script = run.sections.map((x) => x.text).join(" ");
  saveRun(run);
  return getRun(runId);
}

// ---------------------------------------------------------------- régénération d'un plan (non destructive)

const liveRuns = new Map();
function getLiveRun(id) {
  const e = liveRuns.get(id);
  if (e) { e.n++; return e.run; }
  const run = getRun(id);
  liveRuns.set(id, { run, n: 1 });
  return run;
}
function releaseLiveRun(id) {
  const e = liveRuns.get(id);
  if (!e) return;
  if (--e.n <= 0) liveRuns.delete(id);
}

/**
 * Régénère le visuel d'UN plan : b-roll → autre clip Pexels (nouvelle requête si consigne) ; IA → nouvelle image
 * (description réécrite si consigne) ; motion/carte → nouveau rendu ; avatar → nouveau lipsync.
 * `visual` force le type (broll | ai | motion). L'ancien asset n'est perdu qu'en cas de succès.
 */
async function regenShot(runId, sceneI, { instructions = "", visual = null } = {}) {
  const run = getLiveRun(runId);
  try {
    const scene = run.scenes.find((s) => s.i === Number(sceneI));
    if (!scene) throw new Error("Plan introuvable");
    if (scene.pending) throw new Error("Ce plan est déjà en cours de régénération");
    scene.pending = true;
    saveRun(run);
    const old = scene.asset;
    try {
      if (scene.kind === "avatar") { await makeAvatarClip(run, scene); }
      else if (scene.kind === "card") { await renderMotionBatch(run, [scene]); }
      else {
        if (visual && ["broll", "ai", "motion"].includes(visual) && (visual !== "motion" || scene.motion)) scene.visual = visual;
        if (instructions) {
          const j = await genJson(
            [
              "Réécris la direction visuelle d'UN plan de vidéo documentaire (niche richesse/patrimoine).",
              `Ce qui est dit pendant le plan : « ${scene.say} »`,
              `Description actuelle : ${scene.desc} — requêtes actuelles : ${(scene.queries || []).join(" / ")}`,
              `PRIORITÉ ABSOLUE — consigne de l'utilisateur : ${instructions}`,
              "Rends `desc` (EN, 15-30 mots, concret et filmable) et `queries` (3 requêtes de banque d'images EN, 2-4 mots, noms concrets, pas de noms propres ni de chiffres).",
              'RÉPONDS UNIQUEMENT EN JSON : {"desc":"","queries":["","",""]}',
            ].join("\n"),
            { ms: 4 * 60 * 1000, label: "Réécriture du plan" }
          );
          if (j.desc) scene.desc = String(j.desc);
          if (Array.isArray(j.queries) && j.queries.length) scene.queries = j.queries.map(String).filter(Boolean).slice(0, 4);
        }
        scene.asset = null;
        if (scene.visual === "motion" && scene.motion) { if (instructions && scene.motion.images) scene.motion.images = {}; await prepareMotionImages(run, [scene]); await renderMotionBatch(run, [scene]); }
        else if (scene.visual === "ai") {
          try { await generateImage(run, scene); }
          catch (e) { if (!isPolicyError(e.message) || !(await adaptScenePrompt(run, scene, e.message))) throw e; await generateImage(run, scene); }
        } else {
          const a = await fetchBroll(run, scene, { exclude: old && old.pexelsId ? [(old.kind === "video" ? "v" : "p") + old.pexelsId] : [] });
          if (!a) throw new Error("Pexels : aucun clip trouvé pour ces requêtes — change la consigne ou passe le plan en IA");
        }
      }
    } catch (e) {
      scene.asset = old;
      throw e;
    } finally {
      delete scene.pending;
      saveRun(run);
    }
    return getRun(runId);
  } finally {
    releaseLiveRun(runId);
  }
}

// ---------------------------------------------------------------- idées

function producedThemes() {
  const out = listRuns().map((r) => r.params?.subject || r.title);
  for (const s of stock()) out.push(s.title);
  return [...new Set(out.filter(Boolean))].slice(0, 60);
}
function ideaRules() {
  return [
    "CE QUI FAIT DÉCOLLER UN SUJET DANS CETTE NICHE :",
    "- une FORTUNE ou un OBJET DE LUXE identifiable (mansion, île privée, yacht, collection, quartier de milliardaires) confronté à une FORCE qui le dépasse : nature (ouragan, incendie, glissement, inondation, érosion, séisme), erreur humaine (construction, achat, assurance, taxes), mécanisme financier (dette, marché, saisie) ;",
    "- un CHIFFRE choc dès le titre (prix, perte, années, vitesse du vent) et un LIEU réel et précis ;",
    "- la promesse d'un retournement (« it lasted one winter », « nobody wanted it », « the insurer walked away ») ;",
    "- des cas RÉELS, documentés dans la presse (jamais inventés), récents de préférence ;",
    "- varier : côtes, montagnes, déserts, îles, villes ; USA, Europe, Asie, Golfe ; résidences, hôtels, stades, collections.",
  ].join("\n");
}
async function suggestTheme() {
  const c = config();
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 25, maxVisions: 0 }); } catch { return ""; } })() : "";
  const done = producedThemes();
  return genJson(
    [
      "Propose UN sujet de vidéo « faceless » pour une chaîne YouTube de la niche richesse/patrimoine.",
      "", ideaRules(), "",
      inspiration ? "CE QUE FONT LES CONCURRENTS :\n" + inspiration : "",
      "",
      done.length ? "DÉJÀ PRODUIT — n'en propose NI un doublon NI une variante proche :\n" + done.map((t) => "- " + t).join("\n") : "",
      "",
      'RÉPONDS UNIQUEMENT EN JSON : {"subject":"le sujet en anglais, précis (cas + lieu + angle), tel qu\'on le donnerait à un rédacteur","title":"le titre YouTube en anglais aux codes de la niche","why":"1 phrase en français : pourquoi ça va marcher"}',
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Idée" }
  );
}
async function suggestThemes(count) {
  const c = config();
  const k = Math.min(Math.max(Number(count) || 1, 1), 8);
  const inspiration = c.nicheId ? (() => { try { return bank.inspiration(c.nicheId, { maxTitles: 15, maxVisions: 0 }); } catch { return ""; } })() : "";
  const done = producedThemes();
  const j = await genJson(
    [
      `Propose EXACTEMENT ${k} sujets de vidéos « faceless » pour une chaîne de la niche richesse/patrimoine.`,
      `RÈGLE CAPITALE : les ${k} sujets doivent être RADICALEMENT différents ENTRE EUX (pas deux ouragans, pas deux mansions de Malibu) — varie les forces, les lieux, les types de fortune.`,
      ideaRules(),
      done.length ? `IDÉES DÉJÀ PRODUITES — interdiction de les reprendre OU d'en proposer une PROCHE :\n- ${done.slice(0, 40).join("\n- ")}` : "",
      inspiration,
      `RÉPONDS UNIQUEMENT EN JSON : {"ideas":[{"text":"le sujet en anglais (cas + lieu + angle)","pitch":"1 phrase en français"}]} — exactement ${k} entrées.`,
    ].filter(Boolean).join("\n"),
    { ms: 5 * 60 * 1000, label: "Idées" }
  );
  return (j.ideas || []).slice(0, k);
}
async function orderRun({ publishChannelId, publishPrivacy, publish, overrides, theme } = {}) {
  const last = listRuns()[0];
  const c = config();
  const base = { durationMin: c.settings.durationMin || 8, language: c.settings.chainLanguage || "English", ...((last && last.params) || {}), ...(overrides || {}) };
  if (!base.avatarId && c.avatars.length) base.avatarId = c.avatars[0].id;
  const subject = theme || (await suggestTheme()).subject;
  return createRun({ ...base, subject, mode: "auto", publishChannelId: publish ? publishChannelId : null, publishPrivacy: publishPrivacy || "private", allowNoPublish: !publish });
}

// ---------------------------------------------------------------- maintenance

function sweepRuns() {
  let n = 0;
  for (const r of listRuns()) {
    if (!r.status?.endsWith("_running")) continue;
    try {
      const run = getRun(r.id);
      run.status = "failed";
      run.error = "Interrompue par un redémarrage du serveur";
      (run.scenes || []).forEach((s) => { delete s.rendering; delete s.pending; });
      (run.sections || []).forEach((s) => { delete s.rendering; });
      saveRun(run);
      n++;
    } catch {}
  }
  return n;
}
function strandedRuns() {
  return listRuns().filter((r) => r.status?.endsWith("_running") && !activeAdvance.has(r.id));
}

module.exports = {
  MACHINE_ID, MACHINE_NAME, VOICES, ELEVEN_VOICES, PRICES, DEFAULT_THEME,
  config, patchConfig,
  upsertAvatar, removeAvatar, completeAvatar, generateAvatarRef, saveUploadedAvatar, regenAvatarImage,
  listRuns, getRun, createRun, validate, cancelRun, resumeRun, advance, estimate, patchSection,
  regenShot, suggestTheme, suggestThemes, producedThemes, orderRun, regenThumbnail, restyleThumbnail, regenTexts,
  stock, patchStock, publishRun, sweepRuns, strandedRuns, totalCost,
};
