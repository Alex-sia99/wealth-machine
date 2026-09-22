/**
 * Pexels — recherche de b-roll (vidéos + photos) compatible montage FFmpeg, zéro dépendance npm.
 * Clé : coffre (pexels) ou ../.env (PEXELS). Quota Pexels : 200 requêtes/heure → appels espacés (≥ 400 ms).
 *
 * pickVideoFile : choisit le fichier mp4 H.264 en 1920×1080 (sinon 1280×720, sinon le plus proche ≤ 1920),
 * fps 23-60 — ce que FFmpeg normalise sans surprise (jamais de 4K, jamais de HLS).
 */
const fs = require("fs");
const path = require("path");
const vault = require("./vault");

function key() {
  const k = vault.get("pexels");
  if (k) return k;
  try {
    const txt = fs.readFileSync(path.join(__dirname, "..", "..", ".env"), "utf8");
    const m = /^PEXELS=(.+)$/m.exec(txt);
    if (m) return m[1].trim();
  } catch {}
  throw new Error("Clé Pexels absente (coffre « Pexels » ou .env)");
}
function configured() {
  try { return !!key(); } catch { return false; }
}

// File d'attente : une requête à la fois, ≥ 400 ms d'écart (limite 200/h ≈ 1 toutes les 18 s en moyenne — on
// reste bien en dessous sur un run : ~1 requête par plan b-roll).
let chain = Promise.resolve();
let lastAt = 0;
function throttle(fn) {
  const job = async () => {
    const wait = Math.max(0, 400 - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  };
  const p = chain.then(job, job);
  chain = p.catch(() => {});
  return p;
}

async function get(url) {
  return throttle(async () => {
    const resp = await fetch(url, { headers: { Authorization: key() } });
    if (resp.status === 429) throw new Error("Pexels : quota horaire atteint (200 requêtes/h) — réessaie plus tard");
    if (!resp.ok) throw new Error(`Pexels ${resp.status}`);
    return resp.json();
  });
}

/** Recherche de vidéos (paysage). Renvoie les objets Pexels bruts. */
async function searchVideos(query, { perPage = 15, orientation = "landscape", size = "medium", page = 1 } = {}) {
  const p = new URLSearchParams({ query: String(query), per_page: String(perPage), orientation, size, page: String(page) });
  const j = await get(`https://api.pexels.com/videos/search?${p}`);
  return j.videos || [];
}
/** Recherche de photos (paysage). */
async function searchPhotos(query, { perPage = 15, orientation = "landscape", size = "large", page = 1 } = {}) {
  const p = new URLSearchParams({ query: String(query), per_page: String(perPage), orientation, size, page: String(page) });
  const j = await get(`https://api.pexels.com/v1/search?${p}`);
  return j.photos || [];
}

/** Le meilleur fichier vidéo pour FFmpeg : mp4, ≤ 1920 de large, priorité 1920×1080 puis 1280×720. */
function pickVideoFile(video) {
  const files = (video.video_files || []).filter((f) => f.link && /mp4/i.test(f.file_type || "mp4") && Number(f.width) <= 1920 && Number(f.width) >= 960);
  if (!files.length) return null;
  const score = (f) => {
    const w = Number(f.width) || 0, fps = Number(f.fps) || 30;
    let s = w === 1920 ? 100 : w === 1280 ? 80 : w >= 1440 ? 60 : 40;
    if (fps >= 23 && fps <= 31) s += 10; else if (fps > 31 && fps <= 60) s += 4;
    if (/hd|sd/i.test(f.quality || "")) s += f.quality === "hd" ? 2 : 0;
    return s;
  };
  return files.sort((a, b) => score(b) - score(a))[0];
}

/**
 * Score d'un clip pour un plan de `wantSec` secondes : durée couvrant le plan (sinon il faudra boucler),
 * paysage, résolution disponible. Les clips trop longs ne sont pas pénalisés (on ne prend que le début).
 */
function scoreVideo(video, wantSec) {
  const f = pickVideoFile(video);
  if (!f) return -1;
  const d = Number(video.duration) || 0;
  let s = 0;
  if (Number(video.width) >= Number(video.height)) s += 3; else return -1; // jamais de portrait
  if (d >= wantSec) s += 6; else if (d >= wantSec * 0.6) s += 3; else if (d >= 3) s += 1; else return -1;
  if (d >= 6 && d <= 25) s += 2; // ni un flash ni un plan-séquence de 2 min
  s += Number(f.width) === 1920 ? 3 : Number(f.width) === 1280 ? 2 : 1;
  return s;
}

async function download(url, file) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Téléchargement Pexels ${resp.status}`);
  fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()));
  return file;
}

module.exports = { configured, searchVideos, searchPhotos, pickVideoFile, scoreVideo, download };
