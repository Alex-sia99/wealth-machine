/**
 * Contrôle visuel et technique d'un run Wealth : vérifie les invariants de la recette et fabrique deux
 * planches-contact (vue d'ensemble + moments clés : avatar, carte, dossier, comparatif, texte incrusté, CTA).
 *
 *   node scripts/check-wealth-run.js <runId>
 *
 * Sortie : output/machines/<runId>/sheet-overview.jpg et sheet-picks.jpg, + un rapport en console.
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { DATA_DIR } = require("../lib/store");

const id = process.argv[2];
if (!id) { console.error("Usage : node scripts/check-wealth-run.js <runId>"); process.exit(1); }
const run = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "machines", "runs", "wealth", id + ".json"), "utf8"));
const dir = path.join(__dirname, "..", "output", "machines", id);
const final = path.join(dir, "final.mp4");

function ff(args, cwd) {
  return new Promise((resolve, reject) => {
    const c = spawn("ffmpeg", args, { cwd, windowsHide: true });
    let err = "";
    c.stdout.on("data", () => {});
    c.stderr.on("data", (d) => (err += d.toString()));
    c.on("close", (code) => (code === 0 ? resolve(err) : reject(new Error(err.slice(-300)))));
  });
}

(async () => {
  const sc = run.scenes || [];
  const shots = sc.filter((s) => s.kind === "shot");
  const av = sc.filter((s) => s.kind === "avatar");
  const ov = sc.filter((s) => s.overlay);
  const mo = shots.filter((s) => s.visual === "motion");
  const pct = (n) => Math.round((100 * n) / Math.max(shots.length, 1));
  const cost = Object.values(run.cost || {}).reduce((a, b) => a + b, 0);

  console.log(`\n=== ${run.pack?.title || run.title} (${id}) ===`);
  console.log(`statut ${run.status} · ${(run.voDuration / 60).toFixed(2)} min · ${cost.toFixed(2)} $ · débit réel ${run.measuredWpm || "?"} mots/min`);
  console.log(`${sc.length} scènes : ${shots.length} plans · ${sc.filter((s) => s.kind === "card").length} cartes · ${av.length} passages avatar`);
  console.log(`visuels : ${pct(shots.filter((s) => s.visual === "broll").length)} % b-roll · ${pct(shots.filter((s) => s.visual === "ai").length)} % IA · ${pct(mo.length)} % motion`);
  console.log(`textes incrustés : ${ov.length} (${pct(ov.length)} % des plans) — ${["kicker", "lower", "headline"].map((t) => `${t} ${ov.filter((s) => s.overlay.type === t).length}`).join(" · ")}`);
  console.log(`motion design : ${["dossier", "compare", "stat", "list", "quote"].map((t) => `${t} ${mo.filter((s) => s.motion && s.motion.type === t).length}`).join(" · ")}`);

  // --- invariants de la recette
  const bad = [];
  const tooLong = av.filter((s) => s.dur > 10.5);
  if (tooLong.length) bad.push(`${tooLong.length} passage(s) avatar > 10 s : ${tooLong.map((s) => s.role + " " + s.dur + "s").join(", ")}`);
  const longShots = shots.filter((s) => s.dur > 13);
  if (longShots.length) bad.push(`${longShots.length} plan(s) > 13 s : ${longShots.map((s) => "#" + s.i + " " + s.dur + "s").join(", ")}`);
  const noAsset = sc.filter((s) => !s.asset);
  if (noAsset.length) bad.push(`${noAsset.length} scène(s) sans visuel`);
  const borrowed = sc.filter((s) => s.asset && s.asset.borrowed);
  if (borrowed.length) bad.push(`${borrowed.length} visuel(s) empruntés au plan précédent`);
  const weak = shots.filter((s) => s.asset && s.asset.verify && s.asset.verify.score < 6);
  if (weak.length) bad.push(`${weak.length} b-roll sous le seuil de vérification : ${weak.map((s) => "#" + s.i + " " + s.asset.verify.score + "/10").join(", ")}`);
  if (run.voDuration && fs.existsSync(final)) {
    const out = await ff(["-hide_banner", "-i", final, "-f", "null", "-"]).catch((e) => e.message);
    const m = /time=(\d+):(\d+):([\d.]+)/g;
    let last = null, mm;
    while ((mm = m.exec(out))) last = mm;
    if (last) {
      const d = Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]);
      if (Math.abs(d - run.voDuration) > 2) bad.push(`vidéo ${d.toFixed(1)} s vs voix ${run.voDuration.toFixed(1)} s`);
      else console.log(`durée vidéo ${d.toFixed(1)} s = voix ${run.voDuration.toFixed(1)} s ✓`);
    }
  }
  const scores = shots.map((s) => s.asset && s.asset.verify && s.asset.verify.score).filter((x) => typeof x === "number");
  if (scores.length) console.log(`vérification b-roll : moyenne ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}/10 sur ${scores.length} clips`);
  console.log(bad.length ? "\n⚠ " + bad.join("\n⚠ ") : "\n✓ tous les invariants de la recette sont respectés");

  // --- planches-contact
  if (!fs.existsSync(final)) { console.log("\n(pas de final.mp4 : pas de planche-contact)"); return; }
  await ff(["-hide_banner", "-loglevel", "error", "-y", "-i", "final.mp4", "-vf", `fps=1/${Math.max(4, Math.round(run.voDuration / 16))},scale=480:-2,tile=4x4`, "-frames:v", "1", "sheet-overview.jpg"], dir);
  const picks = [];
  const push = (label, t) => { if (t != null && picks.length < 8) picks.push([label, +t.toFixed(2)]); };
  if (av[0]) push("avatar", av[0].start + Math.min(3, av[0].dur / 2));
  const cta = av.find((s) => s.role === "cta");
  if (cta) push("cta", cta.start + Math.min(3, cta.dur / 2));
  const card = sc.find((s) => s.kind === "card");
  if (card) push("carte", card.start + 1.5);
  for (const t of ["dossier", "compare", "stat"]) {
    const s = mo.find((x) => x.motion && x.motion.type === t);
    if (s) push(t, s.start + Math.min(3, s.dur * 0.6));
  }
  for (const s of ov.slice(0, 3)) push("texte-" + s.overlay.type, s.start + 1.4);
  const br = shots.find((s) => s.visual === "broll" && s.asset && s.asset.kind === "video");
  if (br) push("broll", br.start + 1);
  const names = [];
  for (const [label, t] of picks) {
    const f = `pick-${label}.jpg`;
    await ff(["-hide_banner", "-loglevel", "error", "-y", "-ss", String(t), "-i", "final.mp4", "-frames:v", "1", "-vf", "scale=640:-2", f], dir);
    names.push(f);
  }
  if (names.length) {
    fs.writeFileSync(path.join(dir, "picks-list.txt"), names.map((n) => `file '${n}'`).join("\n"));
    const rows = Math.ceil(names.length / 4);
    await ff(["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", "picks-list.txt", "-vf", `tile=4x${rows}`, "-frames:v", "1", "sheet-picks.jpg"], dir);
    try { fs.unlinkSync(path.join(dir, "picks-list.txt")); names.forEach((n) => fs.unlinkSync(path.join(dir, n))); } catch {}
  }
  console.log(`\nplanches : ${path.join(dir, "sheet-overview.jpg")}\n           ${path.join(dir, "sheet-picks.jpg")} (${picks.map((p) => p[0]).join(", ")})`);
})().catch((e) => { console.error("ÉCHEC :", e.message); process.exit(1); });
