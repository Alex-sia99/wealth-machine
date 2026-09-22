#!/usr/bin/env node
/**
 * Installe la machine « Wealth » dans un Agent OS existant.
 *
 *   node install.js [chemin/vers/le/projet]      # défaut : le dossier parent de ce dépôt
 *   node install.js .. --dry                     # simulation : dit ce qu'il ferait, n'écrit rien
 *
 * Le script copie les fichiers de la machine puis pose lui-même les points de branchement dans
 * `agent-os/server.js`, `agent-os/public/index.html`, `agent-os/public/js/core.js`,
 * `agent-os/public/js/pages/machines.js` et `remotion/src/Root.tsx`.
 *
 * Il est IDEMPOTENT : relancé, il ne duplique rien (chaque insertion est détectée avant d'être faite).
 * Une sauvegarde `.bak-wealth` est écrite à côté de chaque fichier modifié, la première fois seulement.
 * Si une ancre est introuvable (Agent OS très différent), le script ne devine pas : il affiche
 * l'instruction manuelle correspondante et continue.
 */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const target = path.resolve(argv.find((a) => !a.startsWith("--")) || path.join(HERE, ".."));

const C = { g: "\x1b[32m", y: "\x1b[33m", r: "\x1b[31m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const ok = (m) => console.log(`${C.g}✓${C.x} ${m}`);
const skip = (m) => console.log(`${C.d}·${C.x} ${m}`);
const warn = (m) => console.log(`${C.y}⚠${C.x} ${m}`);
const die = (m) => { console.error(`${C.r}✗${C.x} ${m}`); process.exit(1); };
const manual = [];

// ---------------------------------------------------------------- vérifications
console.log(`\n${C.b}Machine Wealth → ${target}${C.x}${DRY ? `  ${C.y}(simulation)${C.x}` : ""}\n`);
const must = ["agent-os/server.js", "agent-os/public/index.html", "agent-os/public/js/core.js", "agent-os/public/js/pages/machines.js", "remotion/src/Root.tsx"];
for (const rel of must) if (!fs.existsSync(path.join(target, rel))) die(`« ${rel} » introuvable : ${target} n'a pas l'air d'être une racine d'Agent OS (le dossier qui contient agent-os/ et remotion/).`);
for (const rel of ["agent-os/lib/store.js", "agent-os/lib/fal.js", "agent-os/lib/ffmpeg.js", "agent-os/lib/bank.js", "agent-os/lib/llm.js", "agent-os/lib/google.js"]) {
  if (!fs.existsSync(path.join(target, rel))) warn(`socle manquant : ${rel} — la machine ne démarrera pas sans lui`);
}

function read(rel) { return fs.readFileSync(path.join(target, rel), "utf8"); }
function write(rel, content) {
  if (DRY) return;
  const abs = path.join(target, rel);
  const bak = abs + ".bak-wealth";
  if (!fs.existsSync(bak)) fs.copyFileSync(abs, bak);
  fs.writeFileSync(abs, content, "utf8");
}

// ---------------------------------------------------------------- 1) fichiers
const FILES_DIR = path.join(HERE, "files");
function copyTree(dir, rel = "") {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) { copyTree(abs, r); continue; }
    const dest = path.join(target, r);
    const exists = fs.existsSync(dest);
    if (exists && fs.readFileSync(dest, "utf8") === fs.readFileSync(abs, "utf8")) { skip(`${r} (identique)`); continue; }
    if (!DRY) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(abs, dest); }
    ok(`${r}${exists ? " (remplacé)" : ""}`);
  }
}
console.log(`${C.b}Fichiers${C.x}`);
copyTree(FILES_DIR);

// ---------------------------------------------------------------- 2) server.js
console.log(`\n${C.b}agent-os/server.js${C.x}`);
{
  let s = read("agent-os/server.js");
  const before = s;
  const insertAfter = (anchor, text, label) => {
    if (s.includes(text.trim().split("\n")[0])) { skip(label + " (déjà présent)"); return; }
    if (!s.includes(anchor)) { warn(label + " : ancre introuvable"); manual.push(label); return; }
    s = s.replace(anchor, anchor + text);
    ok(label);
  };

  // requires
  insertAfter(
    /const \w+ = require\("\.\/lib\/machines\/[\w-]+"\);\n(?![\s\S]*const \w+ = require\("\.\/lib\/machines\/)/.test(s)
      ? s.match(/const \w+ = require\("\.\/lib\/machines\/[\w-]+"\);\n(?![\s\S]*const \w+ = require\("\.\/lib\/machines\/)/)[0]
      : 'const tasks = require("./lib/tasks");\n',
    'const wealth = require("./lib/machines/wealth");\nconst lab = require("./lib/lab");\n',
    "require wealth + lab"
  );

  // table des machines
  if (/const MACHINES = \{[^}]*\bwealth\b/.test(s)) skip("MACHINES (déjà présent)");
  else if (/const MACHINES = \{([^}]*)\}/.test(s)) {
    s = s.replace(/const MACHINES = \{([^}]*)\}/, (m, inner) => `const MACHINES = {${inner.trimEnd().replace(/,\s*$/, "")}, wealth }`);
    ok("MACHINES += wealth");
  } else { warn("MACHINES : introuvable"); manual.push("ajouter `wealth` à la table MACHINES"); }

  // carte du hub
  if (/card\(wealth\)/.test(s)) skip("GET /api/machines (déjà présent)");
  else if (/return json\(res, 200, \[card\(([^\]]*)\)\]\);/.test(s)) {
    s = s.replace(/return json\(res, 200, \[(card\([^\]]*)\]\);/, (m, inner) => `return json(res, 200, [${inner}, card(wealth)]);`);
    ok("GET /api/machines += card(wealth)");
  } else { warn("GET /api/machines : introuvable"); manual.push("ajouter `card(wealth)` à la liste de GET /api/machines"); }

  // le compteur de la carte doit savoir lire `avatars`
  if (s.includes("c.styles || c.avatars")) skip("card() lit avatars (déjà présent)");
  else if (s.includes("(c.characters || c.styles || []).length")) {
    s = s.replace("(c.characters || c.styles || []).length", "(c.characters || c.styles || c.avatars || []).length");
    ok("card() compte les avatars");
  }

  // Routes génériques (stock, order-info, ideas…) : toute alternative de machines du routeur reçoit `wealth`.
  // On ne code pas la liste en dur — chaque Agent OS a la sienne — on étend celles qui commencent par `timetravel|`.
  let rx = 0;
  s = s.replace(/\(timetravel\|[a-z|]+\)/g, (m) => {
    if (m.includes("wealth")) return m;
    rx++;
    return m.slice(0, -1) + "|wealth)";
  });
  if (rx) ok(`routes génériques (stock / order-info / ideas) : ${rx} liste(s) de machines étendue(s)`);
  else skip("routes génériques (déjà étendues ou absentes)");
  if (s.includes("c.characters || c.avatars || []).map(({ id, name")) skip("order-info expose les avatars (déjà présent)");
  else if (s.includes("(c.characters || []).map(({ id, name")) {
    s = s.replace("(c.characters || []).map(({ id, name", "(c.characters || c.avatars || []).map(({ id, name");
    ok("order-info expose les avatars");
  }

  // bloc de routes
  if (s.includes("// ===== MACHINE WEALTH =====")) skip("bloc de routes (déjà présent)");
  else {
    const snippet = fs.readFileSync(path.join(HERE, "server-routes.snippet.js"), "utf8");
    const anchors = ["\n    // ===== MACHINE Musique =====", "\n    // ===== MACHINES ====="];
    const anchor = anchors.find((a) => s.includes(a));
    if (anchor) { s = s.replace(anchor, "\n" + snippet + anchor); ok("bloc de routes Wealth + Labo"); }
    else { warn("bloc de routes : aucune ancre trouvée"); manual.push("coller server-routes.snippet.js dans le routeur de server.js"); }
  }

  // boot : sweepRuns + strandedRuns
  if (s.includes("wealth.sweepRuns()")) skip("sweepRuns au boot (déjà présent)");
  else if (/const stale = ([^;]*);/.test(s)) {
    s = s.replace(/const stale = ([^;]*);/, (m, inner) => `const stale = ${inner} + (wealth.sweepRuns() || 0);`);
    ok("sweepRuns au boot");
  } else { warn("sweepRuns : ancre introuvable"); manual.push("ajouter wealth.sweepRuns() au démarrage"); }
  if (s.includes("wealth.strandedRuns()")) skip("strandedRuns (déjà présent)");
  else if (/\.\.\.pov\.strandedRuns\(\)\]/.test(s)) {
    s = s.replace("...pov.strandedRuns()]", "...pov.strandedRuns(), ...wealth.strandedRuns()]");
    ok("strandedRuns (cron de sauvetage)");
  } else if (/strandedRuns\(\)\]/.test(s)) {
    s = s.replace(/strandedRuns\(\)\]/, "strandedRuns(), ...wealth.strandedRuns()]");
    ok("strandedRuns (cron de sauvetage)");
  }

  // manifeste des agents
  if (s.includes('{ id: "wealth", name: "Wealth"')) skip("manifeste agents (déjà présent)");
  else if (/(\{ id: "pov", name: "POV", api: "\/api\/machines\/pov" \},\n)/.test(s)) {
    s = s.replace(/(\{ id: "pov", name: "POV", api: "\/api\/machines\/pov" \},\n)/, `$1          { id: "wealth", name: "Wealth", api: "/api/machines/wealth" },\n`);
    ok("manifeste agents");
  }

  if (s !== before) write("agent-os/server.js", s);
}

// ---------------------------------------------------------------- 3) frontend
console.log(`\n${C.b}Frontend${C.x}`);
{
  let s = read("agent-os/public/index.html");
  if (s.includes('js/pages/wealth.js')) skip("index.html (déjà présent)");
  else if (/(\s*<script src="js\/pages\/machines\.js"><\/script>)/.test(s)) {
    s = s.replace(/(\s*<script src="js\/pages\/machines\.js"><\/script>)/, `\n  <script src="js/pages/wealth.js"></script>$1`);
    write("agent-os/public/index.html", s);
    ok("index.html : <script> de la page Wealth");
  } else { warn("index.html : ancre introuvable"); manual.push('ajouter <script src="js/pages/wealth.js"></script> dans index.html'); }
}
{
  let s = read("agent-os/public/js/core.js");
  if (/\[[^\]]*"wealth"[^\]]*\]\.includes\(name\)/.test(s)) skip("core.js (déjà présent)");
  else if (/(\[[^\]]*"pov"\])\.includes\(name\)/.test(s)) {
    s = s.replace(/(\[[^\]]*)"pov"\]\.includes\(name\)/, `$1"pov", "wealth"].includes(name)`);
    write("agent-os/public/js/core.js", s);
    ok("core.js : surlignage de la nav");
  } else { warn("core.js : ancre introuvable"); manual.push('ajouter "wealth" au tableau de core.js qui renvoie vers « machines »'); }
}
{
  let s = read("agent-os/public/js/pages/machines.js");
  if (s.includes('href="#/wealth"')) skip("machines.js (déjà présent)");
  else {
    const card = `        <a class="bank-folder" href="#/wealth" style="text-decoration:none;color:inherit">
          <div style="font-size:34px">💰</div>
          <b>Wealth</b>
          <div class="small muted" style="margin-top:4px">Fortunes, mansions &amp; luxe face aux catastrophes — b-roll Pexels vérifié + rendus IA + motion design + avatar lipsync</div>
        </a>
`;
    const anchor = /(\s*<div class="bank-folder" style="opacity:\.55;cursor:default">)/;
    if (anchor.test(s)) {
      s = s.replace(anchor, "\n" + card + "$1");
      if (s.includes("c.styles || []).length} ${unit}")) s = s.replace("c.styles || []).length} ${unit}", "c.styles || cfg.avatars || []).length} ${unit}");
      if (/const TAB_KEYS = \{([^}]*)\}/.test(s) && !s.includes('"#/wealth"')) {
        s = s.replace(/const TAB_KEYS = \{([^}]*)\}/, (m, inner) => `const TAB_KEYS = {${inner.trimEnd().replace(/,\s*$/, "")}, "#/wealth": "wealth-tab" }`);
      }
      write("agent-os/public/js/pages/machines.js", s);
      ok("machines.js : carte du hub");
    } else { warn("machines.js : ancre introuvable"); manual.push("ajouter une carte Wealth (href #/wealth) au hub des machines"); }
  }
}

// ---------------------------------------------------------------- 4) Remotion
console.log(`\n${C.b}remotion/src/Root.tsx${C.x}`);
{
  let s = read("remotion/src/Root.tsx");
  const before = s;
  if (!s.includes('from "./WealthMotion"')) {
    const imp = `import { WealthMotion, wealthMotionSchema, wealthMotionFrames, DEFAULT_THEME as WEALTH_THEME, FPS as WM_FPS } from "./WealthMotion";\nimport { WealthThumb, wealthThumbSchema } from "./WealthThumb";\n`;
    const lastImport = s.lastIndexOf("\nimport ");
    const eol = s.indexOf("\n", lastImport + 1);
    s = s.slice(0, eol + 1) + imp + s.slice(eol + 1);
    ok("imports");
  } else skip("imports (déjà présents)");

  if (!s.includes('id="WealthMotion"')) {
    const comps = `      <Composition
        id="WealthMotion"
        component={WealthMotion}
        durationInFrames={WM_FPS * 12}
        fps={WM_FPS}
        width={1920}
        height={1080}
        schema={wealthMotionSchema}
        defaultProps={{ cards: [{ kind: "title" as const, seconds: 3, n: 1, title: "Wealth", sub: "" }], dir: "", theme: WEALTH_THEME, transparent: false }}
        calculateMetadata={({ props }) => ({ durationInFrames: wealthMotionFrames(props.cards) })}
      />
      <Composition
        id="WealthThumb"
        component={WealthThumb}
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
        schema={wealthThumbSchema}
        defaultProps={{ image: "", dir: "", place: "MALIBU", headline: "MALIBU ALERT", badge: "BREAKING" }}
      />
`;
    const anchor = s.indexOf("      <Composition");
    if (anchor > 0) { s = s.slice(0, anchor) + comps + s.slice(anchor); ok("compositions WealthMotion + WealthThumb"); }
    else { warn("Root.tsx : aucune <Composition> trouvée"); manual.push("déclarer les compositions WealthMotion et WealthThumb dans Root.tsx"); }
  } else skip("compositions (déjà présentes)");

  if (s !== before) write("remotion/src/Root.tsx", s);
}

// ---------------------------------------------------------------- récapitulatif
console.log(`\n${C.b}Terminé.${C.x}${DRY ? ` ${C.y}Rien n'a été écrit (--dry).${C.x}` : ""}`);
if (manual.length) {
  console.log(`\n${C.y}À faire à la main (ancres non trouvées) :${C.x}`);
  manual.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
}
console.log(`\n${C.b}Avant le premier run${C.x}
  1. Coffre (Paramètres → Coffre) : ${C.b}kie${C.x}, ${C.b}fal${C.x}, ${C.b}pexels${C.x}, ${C.b}openrouter${C.x} ; Google Drive connecté (URLs publiques pour FAL) ;
     une clé YouTube Data si tu veux utiliser le Labo de niche.
  2. Vérifier Remotion : ${C.b}cd remotion && npx remotion compositions${C.x} (WealthMotion et WealthThumb doivent apparaître).
  3. Démarrer Agent OS, ouvrir ${C.b}Machines → Wealth → onglet Avatars${C.x} et créer un présentateur (✨ fiche, 🎨 référence).
  4. Banque de niche (facultatif mais recommandé) :
     ${C.b}cd agent-os && node scripts/niche-lab.js --niche "Wealth" --deep 4 <URLs de chaînes>${C.x}
  5. Onglet ⚙ Générer : un sujet (ou 💡), l'avatar, la durée → Générer.

Recette de la niche : ${C.b}agent-os/docs/RECETTE-NICHE-WEALTH.md${C.x}
Contrôle d'un run : ${C.b}node agent-os/scripts/check-wealth-run.js <runId>${C.x}
`);
