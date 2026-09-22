/**
 * MACHINE WEALTH — onglets : Générer / Runs / Stock / Avatars / Paramètres.
 * Wizard identique aux autres machines (rail wiz-head / wiz-rail / wiz-scroll).
 *
 * Étapes : Script (outline + sections) → Voix (par section + Whisper + plan visuel) → Plans (b-roll / IA / motion)
 *          → Assets (Pexels · Kie · Remotion · lipsync) → Montage → Fini.
 * L'onglet Avatars = le « personnage » de la machine : présentateur IA (référence 16:9) lipsynqué sur la voix off.
 */
AgentOS.register("wealth", {
  title: "Wealth",
  async render(el) {
    const { api, esc, ago } = AgentOS;
    let cfg = await api("/api/machines/wealth");
    const TABS = ["gen", "runs", "stock", "avatars", "settings"];
    let tab = TABS.includes(localStorage.getItem("wealth-tab")) ? localStorage.getItem("wealth-tab") : "gen";
    let wizTimer = null;
    this.onLeave = () => clearTimeout(wizTimer);

    const LANGS = Object.keys(cfg.voices || { English: [] });
    const media = (rel, ts) => `/media/${encodeURIComponent(rel)}${ts ? `?v=${ts}` : ""}`;
    const KIND_ICON = { card: "🏷", avatar: "🧑‍💼", shot: "🎞" };
    const VIS_ICON = { broll: "🎞 b-roll", ai: "🤖 IA", motion: "✨ motion" };
    const CAM = { zoom_in: "zoom +", zoom_out: "zoom −", pan_left: "pan ←", pan_right: "pan →", static: "fixe" };

    function shell() {
      el.innerHTML = `
        <div class="card">
          <h2><a href="#/machines" class="back-btn" style="margin-right:10px" title="Retour aux Machines">←</a>💰 Wealth
            <span class="h-actions">
              <span class="mini-seg" id="wl-tabs">
                <button data-t="gen" class="${tab === "gen" ? "active" : ""}">⚙ Générer</button>
                <button data-t="runs" class="${tab === "runs" ? "active" : ""}">🎞 Runs</button>
                <button data-t="stock" class="${tab === "stock" ? "active" : ""}">📦 Stock</button>
                <button data-t="avatars" class="${tab === "avatars" ? "active" : ""}">🧑‍💼 Avatars</button>
                <button data-t="settings" class="${tab === "settings" ? "active" : ""}">🛠 Paramètres</button>
              </span>
            </span>
          </h2>
          <div id="wl-body"></div>
        </div>`;
      el.querySelectorAll("#wl-tabs button").forEach((b) =>
        b.addEventListener("click", () => {
          tab = b.dataset.t;
          try { localStorage.setItem("wealth-tab", tab); } catch {}
          shell();
        })
      );
      ({ gen: renderGen, runs: renderRuns, stock: renderStock, avatars: renderAvatars, settings: renderSettings })[tab]();
    }

    // ═══════════════════════════ Onglet Générer ═══════════════════════════
    async function renderGen() {
      const body = el.querySelector("#wl-body");
      let chans = [];
      try { chans = await api("/api/channels"); } catch {}
      const s = cfg.settings;
      const lang = cfg.voices[s.chainLanguage] ? s.chainLanguage : "English";
      const avatars = cfg.avatars || [];
      const readyAvatars = avatars.filter((a) => a.referenceRel);

      body.innerHTML = `
        ${!cfg.pexels ? `<div class="empty small" style="color:var(--err);margin:0 0 10px"><b>Clé Pexels absente</b> — ajoute-la dans Paramètres → Coffre (le b-roll en dépend).</div>` : ""}
        ${!readyAvatars.length ? `<div class="empty small" style="margin:0 0 10px">🧑‍💼 Aucun avatar avec image de référence — crée-en un dans l'onglet <b>Avatars</b> (ou lance sans avatar : ni intro face caméra, ni CTA).</div>` : ""}
        <label class="field"><span>Sujet de la vidéo <span class="muted">(le cas, le lieu, l'angle — ou 💡 pour une idée tirée de la banque de niche)</span></span>
          <span class="row" style="gap:6px">
            <input id="g-subject" class="grow" placeholder="ex : Malibu's $50M cliff mansions are sliding into the Pacific · The $100M Star Island estates going underwater">
            <button class="btn btn-sm" id="g-idea" title="Proposer un sujet d'après la banque de niche">💡</button>
          </span></label>
        <div class="grid grid-4 mb" style="align-items:end">
          <label class="field" style="margin:0"><span>🧑‍💼 Avatar (présentateur)</span>
            <select id="g-avatar"><option value="none">— sans avatar —</option>${readyAvatars.map((a, i) => `<option value="${esc(a.id)}"${i === 0 ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
          <label class="field" style="margin:0"><span>Langue de la voix</span>
            <select id="g-lang">${LANGS.map((l) => `<option${l === lang ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label class="field" style="margin:0"><span>Moteur de voix</span>
            <select id="g-vprov"><option value="inworld"${s.voiceProvider !== "elevenlabs" ? " selected" : ""}>Inworld — 0,015 $/1k car.</option><option value="elevenlabs"${s.voiceProvider === "elevenlabs" ? " selected" : ""}>ElevenLabs v3 — 0,10 $/1k car.</option></select></label>
          <label class="field" style="margin:0"><span>Voix</span>
            <select id="g-voice"></select></label>
        </div>
        <div class="grid grid-4 mb" style="align-items:end">
          <label class="field" style="margin:0"><span>Durée : <b id="g-dlbl">${s.durationMin}</b> min <span class="muted">(~<b id="g-wlbl">${Math.round(s.durationMin * s.wpm)}</b> mots)</span></span>
            <input type="range" id="g-dur" min="2" max="30" value="${s.durationMin}" style="width:100%"></label>
          <label class="field" style="margin:0"><span>Parité b-roll / IA : <b id="g-mixlbl">${s.mixBroll}</b> % b-roll</span>
            <input type="range" id="g-mix" min="0" max="100" step="5" value="${s.mixBroll}" style="width:100%"></label>
          <label class="field" style="margin:0"><span>Motion design : <b id="g-motlbl">${s.motionPct}</b> % des plans</span>
            <input type="range" id="g-mot" min="0" max="40" step="5" value="${s.motionPct}" style="width:100%"></label>
          <label class="field" style="margin:0"><span>Passages avatar : <b id="g-avlbl">${s.avatarCount}</b> <span class="muted">(+ intro + CTA)</span></span>
            <input type="range" id="g-avn" min="0" max="6" value="${s.avatarCount}" style="width:100%"></label>
        </div>
        <div class="grid grid-4 mb" style="align-items:end">
          <label class="field" style="margin:0"><span>🖼 Modèle des rendus IA</span>
            <select id="g-imodel">${[["nano", "Nano Banana 2 Lite — 0,02 $"], ["grok2", "Grok Imagine 2.0 — 0,02 $"], ["seedream", "Seedream 5 Lite — 0,014 $"], ["gpt", "GPT Image 2 — 0,06 $"]].map(([k, l]) => `<option value="${k}"${s.imageModel === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field" style="margin:0"><span>👄 Lipsync</span>
            <input value="${esc(s.lipsyncModel || "veed/lipsync")}" disabled title="Réglable dans Paramètres"></label>
          <label class="field" style="margin:0"><span>🎵 Volume musique : <b id="g-mvlbl">${Math.round((s.musicVolume || 0.12) * 100)}</b> %</span>
            <input type="range" id="g-mvol" min="3" max="40" step="1" value="${Math.round((s.musicVolume || 0.12) * 100)}" style="width:100%"></label>
          <label class="field" style="margin:0"><span>🎞 Durée cible d'un plan : <b id="g-shotlbl">${s.shotSeconds}</b> s</span>
            <input type="range" id="g-shot" min="2.5" max="8" step="0.5" value="${s.shotSeconds}" style="width:100%"></label>
        </div>
        <div class="fbar mb" style="padding:10px 12px;flex-wrap:wrap;gap:12px">
          <span class="fbar-item"><span>Intro face caméra</span>
            <span class="mini-seg" id="g-avintro"><button data-v="0"${s.avatarIntro ? "" : ' class="active"'}>Non</button><button data-v="1"${s.avatarIntro ? ' class="active"' : ""}>Oui</button></span></span>
          <span class="fbar-item"><span>Musique de fond</span>
            <span class="mini-seg" id="g-music"><button data-v="0"${s.music ? "" : ' class="active"'}>Non</button><button data-v="1"${s.music ? ' class="active"' : ""}>Oui</button></span></span>
          <span class="fbar-item"><span>Sous-titres</span>
            <span class="mini-seg" id="g-sub"><button data-v="0"${s.subtitles ? "" : ' class="active"'}>Non</button><button data-v="1"${s.subtitles ? ' class="active"' : ""}>Oui</button></span></span>
          <span class="fbar-item"><span>Mode</span>
            <span class="mini-seg" id="g-mode"><button class="active" data-v="semi">Semi-manuel</button><button data-v="auto">100 % auto</button></span></span>
        </div>
        <div class="fbar mb" style="padding:10px 12px">
          <span class="fbar-item"><span>Publication automatique</span>
            <span class="mini-seg" id="g-pub"><button class="active" data-v="0">Non</button><button data-v="1">Oui</button></span></span>
          <span class="fbar-item" id="g-pubchan-wrap" style="display:none"><span>Chaîne</span>
            <select id="g-pubchan" style="min-width:170px"><option value="">— choisis la chaîne —</option></select> <select id="g-pubpriv" style="width:150px"><option value="private" selected>🔒 Privée</option><option value="unlisted">🔗 Non répertoriée</option><option value="public">🌍 Publique</option></select></span>
          <span id="g-cost" style="margin-left:auto;font-weight:800;font-size:17px;color:#4ade80;background:rgba(74,222,128,.09);border:1px solid rgba(74,222,128,.35);border-radius:10px;padding:9px 16px;white-space:nowrap"></span>
          <button class="btn btn-accent" id="g-go" style="font-size:14px;padding:10px 22px">⚙ Générer</button>
        </div>
        <div class="small muted" style="text-align:right">Script (outline + sections) → Voix + Whisper + plan visuel → Plans (b-roll · IA · motion) → Assets (Pexels · Kie · Remotion · lipsync · Suno) → Montage (zoom/pan · bandeaux · CTA) → Packaging</div>`;

      const $ = (q) => body.querySelector(q);
      const seg = (id, cb) => body.querySelectorAll(`#${id} button`).forEach((b) =>
        b.addEventListener("click", () => { body.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle("active", x === b)); cb && cb(b.dataset.v); }));
      const activeVal = (id) => body.querySelector(`#${id} button.active`).dataset.v;

      const fillVoices = () => {
        const prov = $("#g-vprov").value;
        const vs = prov === "elevenlabs" ? cfg.elevenVoices : (cfg.voices[$("#g-lang").value] || cfg.voices.English);
        $("#g-voice").innerHTML = vs.map((v) => `<option>${esc(v)}</option>`).join("");
      };
      fillVoices();
      $("#g-lang").addEventListener("change", fillVoices);
      $("#g-vprov").addEventListener("change", () => { fillVoices(); costLine(); });
      seg("g-sub"); seg("g-mode"); seg("g-music", costLine); seg("g-avintro", costLine);

      const costLine = async () => {
        const d = Number($("#g-dur").value) || 8;
        $("#g-dlbl").textContent = d;
        $("#g-wlbl").textContent = Math.round(d * s.wpm);
        $("#g-mixlbl").textContent = $("#g-mix").value;
        $("#g-motlbl").textContent = $("#g-mot").value;
        $("#g-avlbl").textContent = $("#g-avn").value;
        try {
          const e = await api("/api/machines/wealth/estimate", { method: "POST", body: {
            durationMin: d, mixBroll: Number($("#g-mix").value), motionPct: Number($("#g-mot").value), avatarId: $("#g-avatar").value, avatarCount: Number($("#g-avn").value),
            avatarIntro: activeVal("g-avintro") === "1", music: activeVal("g-music") === "1", voiceProvider: $("#g-vprov").value,
            imageModel: $("#g-imodel").value, shotSeconds: Number($("#g-shot").value),
          }});
          const c = $("#g-cost");
          c.textContent = `≈ ${e.total.toFixed(2)} $`;
          c.title = `~${e.shots} plans (${e.broll} b-roll · ${e.ai} IA · ${e.motion} motion) + ${e.avatarSec} s d'avatar · images ${e.images.toFixed(2)}$ · voix + Whisper ${e.voice.toFixed(2)}$ · lipsync ${e.avatar.toFixed(2)}$ · musique ${e.music.toFixed(2)}$`;
        } catch {}
      };
      ["#g-dur", "#g-mix", "#g-mot", "#g-avn", "#g-shot"].forEach((q) => $(q).addEventListener("input", costLine));
      $("#g-avatar").addEventListener("change", costLine);
      $("#g-imodel").addEventListener("change", costLine);
      $("#g-mvol").addEventListener("input", (e) => ($("#g-mvlbl").textContent = e.target.value));
      $("#g-shot").addEventListener("input", (e) => ($("#g-shotlbl").textContent = e.target.value));
      costLine();

      const pubChan = $("#g-pubchan");
      const goBtn = $("#g-go");
      const pubOn = () => activeVal("g-pub") === "1";
      const gateGo = () => (goBtn.disabled = pubOn() && !pubChan.value);
      pubChan.innerHTML = `<option value="">— choisis la chaîne —</option>` + chans.filter((c) => !c.error).map((c) => `<option value="${esc(c.channelId)}">${esc(c.title)}</option>`).join("");
      pubChan.addEventListener("change", gateGo);
      seg("g-pub", () => { $("#g-pubchan-wrap").style.display = pubOn() ? "" : "none"; gateGo(); });

      $("#g-idea").addEventListener("click", async () => {
        const input = $("#g-subject"), btn = $("#g-idea");
        input.classList.add("ai-thinking"); input.disabled = true; input.value = ""; input.placeholder = "💡 Je fouille la niche…";
        btn.disabled = true; btn.textContent = "⏳";
        try {
          const j = await api("/api/machines/wealth/idea", { method: "POST" });
          input.value = j.subject || j.title || "";
          if (j.why) AgentOS.toast("💡 " + j.why, "ok");
        } catch (e) { AgentOS.toast(e.message, "err"); }
        input.classList.remove("ai-thinking"); input.disabled = false;
        input.placeholder = "ex : Malibu's $50M cliff mansions are sliding into the Pacific";
        btn.disabled = false; btn.textContent = "💡";
      });

      goBtn.addEventListener("click", async () => {
        const subject = $("#g-subject").value.trim();
        if (!subject) return AgentOS.toast("Donne un sujet, ou clique 💡", "err");
        goBtn.disabled = true; goBtn.textContent = "⏳ Lancement…";
        try {
          const run = await api("/api/machines/wealth/runs", { method: "POST", body: {
            subject, durationMin: Number($("#g-dur").value), language: $("#g-lang").value, voiceProvider: $("#g-vprov").value, voice: $("#g-voice").value,
            avatarId: $("#g-avatar").value, avatarCount: Number($("#g-avn").value), avatarIntro: activeVal("g-avintro") === "1",
            mixBroll: Number($("#g-mix").value), motionPct: Number($("#g-mot").value),
            subtitles: activeVal("g-sub") === "1", music: activeVal("g-music") === "1", musicVolume: Number($("#g-mvol").value) / 100, mode: activeVal("g-mode"),
            imageModel: $("#g-imodel").value, shotSeconds: Number($("#g-shot").value),
            publishChannelId: pubOn() ? pubChan.value : null, publishPrivacy: $("#g-pubpriv").value, allowNoPublish: !pubOn(),
          }});
          AgentOS.toast("🚀 Run lancé", "ok");
          openWizard(run.id);
        } catch (e) { AgentOS.toast(e.message, "err"); }
        goBtn.disabled = false; goBtn.textContent = "⚙ Générer";
        gateGo();
      });
    }

    // ═══════════════════════════ Wizard ═══════════════════════════
    const STEPS = [
      { key: "script", icon: "📝", label: "Script" },
      { key: "voice", icon: "🎙", label: "Voix" },
      { key: "prompts", icon: "🎬", label: "Plans" },
      { key: "assets", icon: "🧩", label: "Assets" },
      { key: "montage", icon: "🎞", label: "Montage" },
    ];
    const FINI = STEPS.length;
    function stepIndex(status) {
      const i = STEPS.findIndex((s) => status.startsWith(s.key));
      return i < 0 ? FINI : i;
    }
    const shotsOf = (run) => (run.scenes || []).filter((s) => s.kind === "shot");
    function stepDone(run, i) {
      const sc = run.scenes || [];
      if (i === 0) return !!run.script;
      if (i === 1) return !!(sc.length && run.words?.length);
      if (i === 2) return !!(sc.length && shotsOf(run).every((s) => s.desc && s.visual));
      if (i === 3) return !!(sc.length && sc.every((s) => s.asset));
      return !!run.finalRel;
    }
    function globalPct(run) {
      const sc = run.scenes || [];
      const n = sc.length || 1;
      const done = sc.filter((s) => s.asset).length;
      const map = { script_running: 6, script_ready: 14, voice_running: 18, voice_ready: 28, prompts_running: 30, prompts_ready: 40, assets_ready: 72, montage_running: 76, packaging_running: 94, done: 100 };
      if (run.status === "assets_running") return 42 + Math.round((30 * done) / n);
      if (run.status === "script_running") return 4 + Math.round((10 * (run.sections || []).filter((s) => s.text).length) / Math.max(1, (run.sections || []).length || 6));
      return map[run.status] ?? 8;
    }
    function countHTML(run) {
      const sc = run.scenes || [];
      const live = sc.filter((s) => s.pending || s.rendering).length;
      if (run.status.startsWith("script")) return `📝 ${(run.sections || []).filter((s) => s.text).length}/${(run.sections || []).length || "?"} sections`;
      if (!sc.length) return "";
      const n = (v) => shotsOf(run).filter((s) => s.visual === v).length;
      if (run.status.startsWith("assets")) {
        const done = sc.filter((s) => s.asset).length;
        const fail = sc.filter((s) => !s.asset && s.error).length;
        return `🧩 ${done}/${sc.length} assets${live ? ` · ${live} en cours` : ""}${fail ? ` · <span style="color:var(--err)">${fail} échec</span>` : ""}`;
      }
      if (run.status.startsWith("prompts")) return `🎬 ${shotsOf(run).filter((s) => s.desc).length}/${shotsOf(run).length} plans · ${n("broll")} b-roll · ${n("ai")} IA · ${n("motion")} motion`;
      return `🎞 ${shotsOf(run).length} plans · ${sc.filter((s) => s.kind === "card").length} cartes · ${sc.filter((s) => s.kind === "avatar").length} avatar`;
    }

    function openWizard(runId) {
      const overlay = document.createElement("div");
      overlay.className = "picker-overlay";
      overlay.innerHTML = `<div class="scrap-modal lg" id="wiz"><span class="spin"></span></div>`;
      document.body.appendChild(overlay);
      const tick = async () => {
        let run;
        try { run = await api("/api/machines/wealth/runs/" + runId); }
        catch (e) { overlay.querySelector("#wiz").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
        const box = overlay.querySelector("#wiz");
        const sc = run.scenes || [];
        const nb = (f) => sc.filter((s) => s[f]).length;
        const shellKey = [run.status, box.dataset.view || "", sc.length, run.error ? 1 : 0, nb("desc"), nb("asset"), sc.filter((s) => s.pending || s.rendering).length,
          (run.sections || []).filter((s) => s.text).length, sc.map((s) => (s.asset && s.asset.ts) || 0).reduce((a, b) => a + b, 0), run.finalRel ? 1 : 0, run.pack ? run.pack.thumbTs || 1 : 0, run.published ? 1 : 0, run.music ? (run.music.files || []).length : 0].join("|");
        if (box.dataset.shellKey !== shellKey || !box.querySelector(".wiz-scroll")) {
          box.dataset.shellKey = shellKey;
          renderWizard(box, run, overlay);
        }
        if (!["done", "failed"].includes(run.status) && document.body.contains(overlay)) {
          clearTimeout(wizTimer);
          wizTimer = setTimeout(tick, 4000);
        }
      };
      tick();
    }

    function renderWizard(box, run, overlay) {
      const idx = stepIndex(run.status);
      const running = run.status.endsWith("_running");
      const viewIdx = box.dataset.view !== undefined && box.dataset.view !== "" ? Number(box.dataset.view) : Math.min(idx, FINI);
      const prevScroll = box.querySelector(".wiz-scroll")?.scrollTop || 0;
      const gpct = globalPct(run);
      const validateLabel = {
        script_ready: "✓ Valider le script → Voix",
        voice_ready: "✓ Valider le découpage → Plans",
        prompts_ready: "✓ Valider les plans → Assets",
        assets_ready: "✓ Valider les assets → Montage",
      }[run.status];
      const runMsg = {
        script_running: "Claude écrit l'outline puis les sections (5 en parallèle)…",
        voice_running: "Synthèse de chaque section, Whisper transcrit, la machine découpe et place cartes + avatar…",
        prompts_running: "Direction visuelle : b-roll, IA ou motion pour chaque plan…",
        assets_running: "Pexels, images IA, cartes Remotion, lipsync de l'avatar, musique Suno — tout en parallèle…",
        montage_running: "Montage final (zoom/pan, bandeaux, CTA, musique, sous-titres)…",
        packaging_running: "Claude prépare titre, description, tags et miniature…",
      }[run.status] || "";
      const cost = run.cost ? (run.cost.images || 0) + (run.cost.voice || 0) + (run.cost.avatar || 0) + (run.cost.music || 0) : 0;

      box.classList.add("wiz-modal");
      box.innerHTML = `
        <div class="wiz-head">
          <div class="wiz-gbar" title="Progression : ${gpct}%"><div style="width:${gpct}%"></div></div>
          <div class="row between" style="margin:10px 0 4px">
            <h2 style="margin:0;font-size:15px">💰 ${esc(run.pack?.title || run.title)}
              <span class="small muted mono" style="margin-left:8px">${run.id} · ${run.mode} · ${esc(run.params.language)} · ${run.params.durationMin} min · ${cost.toFixed(2)}$ · ${gpct}%</span></h2>
            <span class="row" style="gap:6px">
              ${run.status !== "done" ? `<button class="btn btn-sm" data-zap-run title="⚡ Décharge : relance le run là où il s'est arrêté">⚡</button>` : ""}
              ${!["done", "failed"].includes(run.status) ? `<button class="btn btn-sm" data-cancel-run title="Annuler ce run">🛑 Annuler</button>` : ""}
              <button class="btn btn-sm btn-ghost" data-close>✕</button>
            </span>
          </div>
          <div class="wiz-rail">
            ${STEPS.map((s, i) => `
              <div class="wiz-step ${stepDone(run, i) ? "done" : i === idx ? "active" : ""}" data-view="${i}" style="cursor:pointer" title="${s.label}">
                <div class="wiz-dot" ${i === viewIdx ? 'style="outline:2px solid var(--accent);outline-offset:3px"' : ""}>${stepDone(run, i) ? "✓" : i < idx ? "⚠" : s.icon}</div><span>${s.label}</span>
              </div>
              ${i < STEPS.length - 1 ? `<div class="wiz-link ${stepDone(run, i) ? "done" : i === idx && running ? "active" : ""}"></div>` : ""}`).join("")}
            <div class="wiz-link ${run.status === "done" ? "done" : run.status === "packaging_running" ? "active" : ""}"></div>
            <div class="wiz-step ${run.status === "done" ? "done" : ""}" data-view="${FINI}" style="cursor:pointer" title="Titre, description, tags, miniature, publication">
              <div class="wiz-dot" ${viewIdx === FINI ? 'style="outline:2px solid var(--accent);outline-offset:3px"' : ""}>🏁</div><span>Fini</span>
            </div>
          </div>
          ${run.error ? `<div class="empty small" style="color:var(--err);margin:0"><b>Échec</b>${esc(run.error)} <button class="btn btn-sm" data-retry>↻ Reprendre où on s'est arrêté</button></div>` : ""}
          ${running ? `<div class="small muted"><span class="spin" style="width:12px;height:12px"></span> ${esc(runMsg)}</div>` : ""}
          <div class="small" style="font-weight:600;color:var(--accent)">${countHTML(run)}</div>
        </div>
        <div class="wiz-scroll">${viewHTML(run, viewIdx)}</div>
        ${validateLabel ? `<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn btn-accent" data-validate>${validateLabel}</button></div>` : ""}`;

      box.querySelector("[data-close]").addEventListener("click", () => { clearTimeout(wizTimer); overlay.remove(); });
      box.querySelectorAll(".wiz-step[data-view]").forEach((s) => s.addEventListener("click", () => { box.dataset.view = s.dataset.view; renderWizard(box, run, overlay); }));
      const on = (sel, fn) => { const b = box.querySelector(sel); if (b) b.addEventListener("click", () => fn(b)); };
      const reopen = () => { clearTimeout(wizTimer); overlay.remove(); openWizard(run.id); };
      on("[data-validate]", async (b) => {
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/wealth/runs/${run.id}/validate`, { method: "POST" }); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; }
      });
      on("[data-cancel-run]", async (b) => {
        b.disabled = true;
        try { await api(`/api/machines/wealth/runs/${run.id}/cancel`, { method: "POST" }); AgentOS.toast("Run annulé 🛑", "ok"); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; }
      });
      const zap = async (b) => {
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/wealth/runs/${run.id}/resume`, { method: "POST", body: {} }); AgentOS.toast("⚡ Décharge envoyée", "ok"); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; b.textContent = "⚡"; }
      };
      on("[data-zap-run]", zap);
      on("[data-retry]", zap);
      wireView(box, run, viewIdx, reopen);
      const sc = box.querySelector(".wiz-scroll");
      if (sc) sc.scrollTop = prevScroll;
    }

    // ── Contenu d'une étape ──
    function viewHTML(run, viewIdx) {
      const key = STEPS[viewIdx]?.key || "fini";
      const o = run.outline;

      if (key === "script") {
        if (!o) return `<div class="empty small"><span class="spin"></span> Claude écrit l'outline…</div>`;
        const editable = run.status === "script_ready";
        const n = (run.script || run.sections.map((s) => s.text || "").join(" ")).split(/\s+/).filter(Boolean).length;
        return `<div class="small muted mb">${n} mots · ~${(n / (cfg.settings.wpm || 155)).toFixed(1)} min estimées · hook : « ${esc(o.hook?.verbatim || "")} »${editable ? " · le texte de chaque section est éditable" : ""}</div>
          ${o.sections.map((sec) => {
            const l = (run.sections || []).find((x) => x.n === sec.n) || {};
            return `<div class="scrap-row" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px 12px">
              <div class="row between" style="align-items:center">
                <b class="small">${sec.n}. ${esc(sec.title || "")} <span class="muted">(${esc(sec.role)})</span> ${sec.avatar ? '<span class="badge accent">🧑‍💼 avatar</span>' : ""}</b>
                <span class="small muted mono">${l.text ? l.text.split(/\s+/).length + " mots" : "⏳"}${sec.keyStat?.number ? ` · 📊 ${esc(sec.keyStat.number)}` : ""}</span>
              </div>
              <div class="small muted">${esc(sec.beat || "")}</div>
              ${l.text
                ? editable
                  ? `<textarea data-section="${sec.n}" rows="5" style="width:100%;font-size:12px;line-height:1.55">${esc(l.text)}</textarea>`
                  : `<div class="small" style="white-space:pre-wrap;line-height:1.6">${esc(l.text)}</div>`
                : `<div class="small muted"><span class="spin" style="width:10px;height:10px"></span> en écriture…</div>`}
            </div>`;
          }).join("")}`;
      }

      if (key === "voice") {
        if (!run.voRel) return `<div class="empty small"><span class="spin"></span> Synthèse de la voix off, section par section…</div>`;
        const st = run.shotStats;
        return `<audio controls src="${media(run.voRel)}" style="width:100%;margin-bottom:10px"></audio>
          ${st ? `<div class="row mb" style="gap:18px;flex-wrap:wrap">
            <span class="small"><b>${st.shots}</b> plans</span><span class="small"><b>${st.cards}</b> cartes de section</span>
            <span class="small"><b>${st.avatars}</b> passages avatar (${st.avatarSec} s)</span>
            <span class="small">médiane <b>${st.median} s</b> · <b>${st.perMin}</b> plans/min</span>
            <span class="small">CTA <b>${run.ctaDuration ? run.ctaDuration.toFixed(1) + " s" : "—"}</b></span>
          </div>` : ""}
          ${(run.scenes || []).map((s) => `<div class="scrap-row" style="gap:10px${s.kind !== "shot" ? ";background:rgba(255,255,255,.03)" : ""}">
            <span class="small mono" style="flex:none;width:96px">${s.start}s +${s.dur}s</span>
            <span class="badge" style="flex:none;width:86px;text-align:center">${KIND_ICON[s.kind] || ""} ${s.kind === "card" ? "S" + s.section : s.kind === "avatar" ? (s.role === "cta" ? "CTA" : "S" + s.section) : "S" + s.section}</span>
            <span class="small grow" style="min-width:0">${esc(s.say || (s.kind === "card" ? "Carte de titre : " + (s.title || "") : ""))}</span>
          </div>`).join("")}`;
      }

      if (key === "prompts") {
        const sh = shotsOf(run);
        if (!sh.some((s) => s.desc)) return `<div class="empty small"><span class="spin"></span> Direction visuelle en cours…</div>`;
        return sh.map((s) => `
          <div class="scrap-row" style="gap:10px;align-items:flex-start">
            <span class="small mono" style="flex:none;width:30px">${s.i}</span>
            <span class="badge" style="flex:none;width:74px;text-align:center">${VIS_ICON[s.visual] || "…"}</span>
            <span class="small muted mono" style="flex:none;width:52px">${CAM[s.camera] || ""}</span>
            <span class="small grow" style="min-width:0">${esc(s.desc || "…")}${s.queries ? `<div class="small muted">🔎 ${esc(s.queries.join(" · "))}</div>` : ""}${s.motion ? `<div class="small" style="color:var(--accent)">✨ ${esc(s.motion.type)} : ${esc(s.motion.number || s.motion.title || "")} ${esc(s.motion.label || "")} ${(s.motion.items || []).length ? "— " + esc(s.motion.items.join(" / ")) : ""}</div>` : ""}${s.overlay ? `<div class="small" style="color:#ffd54d">${s.overlay.type === "kicker" ? "💥" : s.overlay.type === "headline" ? "📰" : "🏷"} ${esc(s.overlay.title)} <span class="muted">${esc(s.overlay.sub || "")}</span></div>` : ""}</span>
          </div>`).join("");
      }

      if (key === "assets") {
        const canRegen = !run.status.endsWith("_running");
        const thumb = (s) => {
          const a = s.asset;
          if (!a) return `<div class="empty small" style="height:106px;margin:0;display:flex;align-items:center;justify-content:center">${s.pending || s.rendering ? '<span class="spin"></span>' : s.error ? "❌" : "⏳"}</div>`;
          if (a.kind === "image") return `<img src="${media(a.rel, a.ts)}" style="width:100%;height:106px;object-fit:cover;border-radius:6px">`;
          return `<video src="${media(a.rel, a.ts)}" muted preload="metadata" style="width:100%;height:106px;object-fit:cover;border-radius:6px;background:#000" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>`;
        };
        const label = (s) => s.kind === "card" ? "🏷 carte" : s.kind === "avatar" ? "🧑‍💼 avatar" : (VIS_ICON[s.visual] || "") + (s.asset?.borrowed ? " (emprunté)" : s.asset?.src === "pexels" && s.asset.kind === "image" ? " (photo)" : "");
        return `<div class="small muted mb">${(run.scenes || []).filter((s) => s.asset).length}/${(run.scenes || []).length} assets${run.music ? ` · 🎵 musique ${run.music.files?.length ? "prête" : run.music.error ? "échouée" : "en cours"}` : ""} · survole une vidéo pour la lire · ↻ régénère un plan (consigne optionnelle), les sélecteurs forcent b-roll / IA</div>
          <div class="row" style="gap:8px;flex-wrap:wrap">${(run.scenes || []).map((s) => `
          <div class="scrap-row" style="flex-direction:column;align-items:stretch;gap:4px;padding:6px;width:200px;${s.error && !s.asset ? "border-color:var(--err)" : ""}" title="${esc(s.desc || s.say || "")}">
            ${thumb(s)}
            <span class="row between" style="align-items:center">
              <span class="small mono">${s.i} · ${label(s)} · ${s.dur}s</span>
              <span class="row" style="gap:3px">
                ${canRegen && s.kind === "shot" && s.visual !== "motion" ? `<button class="mini-btn" data-regen-shot="${s.i}" data-visual="${s.visual === "ai" ? "broll" : "ai"}" title="Basculer en ${s.visual === "ai" ? "b-roll" : "IA"}" ${s.pending ? "disabled" : ""}>${s.visual === "ai" ? "🎞" : "🤖"}</button>` : ""}
                ${canRegen ? `<button class="mini-btn" data-regen-shot="${s.i}" title="Régénérer ce plan" ${s.pending ? "disabled" : ""}>↻</button>` : ""}
              </span>
            </span>
            ${s.asset?.author ? `<span class="small muted" style="font-size:9px">Pexels · ${esc(s.asset.author)}${s.asset.verify ? ` · ✔ ${s.asset.verify.score}/10${s.asset.tried && s.asset.tried.length > 1 ? " (" + s.asset.tried.length + " essais)" : ""}` : ""}</span>` : ""}
            ${s.asset?.verify && s.asset.verify.score < 6 ? `<span class="small" style="font-size:9px;color:var(--warn)" title="${esc(s.asset.verify.reason || "")}">⚠ sous le seuil : ${esc((s.asset.verify.reason || "").slice(0, 60))}</span>` : ""}
          </div>`).join("")}</div>`;
      }

      if (key === "montage") {
        if (!run.finalRel) return run.status === "montage_running"
          ? `<div class="empty small"><span class="spin"></span> Montage en cours (clips zoom/pan + bandeaux + CTA + musique)…</div>`
          : `<div class="empty small">Le montage n'est pas encore rendu.</div>`;
        return `<video src="${media(run.finalRel)}" controls style="width:100%;max-height:430px;border-radius:12px;background:#000"></video>
          <div class="row between mt"><span class="small muted">${(run.scenes || []).length} plans · ${(run.sections || []).length} sections · ${(run.voDuration / 60).toFixed(1)} min</span>
            <a class="btn btn-sm btn-accent" href="${media(run.finalRel)}" download>⬇ Télécharger</a></div>`;
      }

      // ── Fini ──
      const pk = run.pack;
      if (!pk) return run.status === "packaging_running"
        ? `<div class="empty small"><span class="spin"></span> Claude prépare titre, description, tags et miniature…</div>`
        : `<div class="empty small">La vidéo n'est pas encore montée.</div>`;
      return `
        ${run.published?.url
          ? `<div class="empty small" style="margin:0 0 10px;color:#4ade80;border-color:rgba(74,222,128,.4)"><b>📤 Publiée (${esc(run.published.privacyStatus)})</b><a href="${esc(run.published.url)}" target="_blank">▶ Voir sur YouTube</a></div>`
          : `<div class="small muted" style="margin-bottom:8px">📦 La vidéo attend dans le <b>Stock</b> — publie-la ci-dessous quand tu veux.</div>`}
        <div class="row" style="gap:16px;align-items:flex-start">
          <div style="flex:none;width:290px">
            ${pk.thumbRel ? `<img src="${media(pk.thumbRel, pk.thumbTs)}" style="width:290px;border-radius:10px;border:1px solid var(--border-soft)">` : `<div class="empty small">Pas de miniature</div>`}
            <div class="small muted" style="text-align:center;margin-top:4px">Miniature au code de la niche : vue drone + bandeau BREAKING</div>
            <div class="row" style="gap:5px;margin-top:6px">
              <input type="text" id="pk-thumb-place" value="${esc(pk.thumbPlace || "")}" placeholder="LIEU" style="width:44%;font-size:11px;text-transform:uppercase">
              <input type="text" id="pk-thumb-head" value="${esc(pk.thumbHeadline || "")}" placeholder="GROS TITRE (2-3 mots)" style="flex:1;font-size:11px;text-transform:uppercase">
              <button class="mini-btn" data-thumb-text title="Recomposer le bandeau (sans repayer l'image)">↻</button>
            </div>
            <div class="row" style="gap:5px;margin-top:5px">
              <input type="text" id="pk-thumb-instr" placeholder="Observation pour refaire l'image…" style="flex:1;font-size:11px">
              <button class="mini-btn" data-regen-thumb title="Régénérer l'image de la miniature">🎨</button>
            </div>
            ${run.finalRel ? `<a class="btn btn-sm btn-ghost" style="width:100%;margin-top:8px;text-align:center" href="${media(run.finalRel)}" download>⬇ Télécharger la vidéo</a>` : ""}
          </div>
          <div class="grow" style="min-width:0">
            <input type="text" id="pk-text-instr" placeholder="Observation pour régénérer un texte (optionnel)…" style="width:100%;font-size:11px;margin-bottom:8px">
            <label class="field"><span class="row between">Titre <span class="row" style="gap:5px"><span class="small muted mono">${(pk.title || "").length}/100</span><button class="mini-btn" data-copy="pk-title">📋</button><button class="mini-btn" data-regen-text="title">↻💡</button></span></span><input type="text" id="pk-title" value="${esc(pk.title || "")}"></label>
            <label class="field"><span class="row between">Description <span class="row" style="gap:5px"><button class="mini-btn" data-copy="pk-desc">📋</button><button class="mini-btn" data-regen-text="description">↻💡</button></span></span><textarea id="pk-desc" rows="6">${esc(pk.description || "")}</textarea></label>
            <label class="field"><span class="row between">Tags <span class="row" style="gap:5px"><span class="small muted mono">${(pk.tags || []).join(", ").length}/500</span><button class="mini-btn" data-copy="pk-tags">📋</button><button class="mini-btn" data-regen-text="tags">↻💡</button></span></span><textarea id="pk-tags" rows="2">${esc((pk.tags || []).join(", "))}</textarea></label>
            <div class="row" style="gap:8px">
              <select id="pk-chan" style="flex:1"><option value="">— chaîne YouTube —</option></select>
              <select id="pk-priv" style="width:170px" title="Mode de publication">
                <option value="private" selected>🔒 Privée</option><option value="unlisted">🔗 Non répertoriée</option><option value="public">🌍 Publique</option>
              </select>
              <button class="btn btn-sm btn-accent" data-publish disabled>📤 Publier</button>
            </div>
          </div>
        </div>`;
    }

    // ── Interactions d'une étape ──
    function wireView(box, run, viewIdx, reopen) {
      box.querySelectorAll("textarea[data-section]").forEach((ta) => ta.addEventListener("change", async () => {
        try { await api(`/api/machines/wealth/runs/${run.id}/section`, { method: "POST", body: { n: Number(ta.dataset.section), text: ta.value } }); AgentOS.toast(`Section ${ta.dataset.section} enregistrée`, "ok"); }
        catch (e) { AgentOS.toast(e.message, "err"); }
      }));
      box.querySelectorAll("[data-regen-shot]").forEach((b) => b.addEventListener("click", async () => {
        const visual = b.dataset.visual || null;
        const ins = visual ? "" : prompt("Consigne pour ce plan (laisse vide pour en chercher un autre du même genre) :", "");
        if (ins === null) return;
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/wealth/runs/${run.id}/regen`, { method: "POST", body: { scene: b.dataset.regenShot, instructions: ins, visual } }); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; b.textContent = "↻"; }
      }));
      box.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", (e) => {
        e.preventDefault();
        const src = box.querySelector("#" + b.dataset.copy);
        if (src) { navigator.clipboard.writeText(src.value); AgentOS.toast("Copié 📋", "ok"); }
      }));
      box.querySelectorAll("[data-regen-text]").forEach((b) => b.addEventListener("click", async () => {
        const instructions = box.querySelector("#pk-text-instr")?.value || "";
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/wealth/runs/${run.id}/texts`, { method: "POST", body: { instructions, field: b.dataset.regenText } }); AgentOS.toast("Régénéré 🔄", "ok"); box.dataset.view = String(FINI); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); b.disabled = false; b.textContent = "↻💡"; }
      }));
      const tt = box.querySelector("[data-thumb-text]");
      if (tt) tt.addEventListener("click", async () => {
        tt.disabled = true; tt.textContent = "⏳";
        try {
          await api(`/api/machines/wealth/runs/${run.id}/thumb-text`, { method: "POST", body: { place: box.querySelector("#pk-thumb-place").value, headline: box.querySelector("#pk-thumb-head").value } });
          AgentOS.toast("Bandeau recomposé ↻", "ok"); box.dataset.view = String(FINI); reopen();
        } catch (e) { AgentOS.toast(e.message, "err"); tt.disabled = false; tt.textContent = "↻"; }
      });
      const rt = box.querySelector("[data-regen-thumb]");
      if (rt) rt.addEventListener("click", async () => {
        const instructions = box.querySelector("#pk-thumb-instr")?.value || "";
        rt.disabled = true; rt.textContent = "⏳";
        try { await api(`/api/machines/wealth/runs/${run.id}/thumbnail`, { method: "POST", body: { instructions } }); AgentOS.toast("Miniature régénérée 🎨", "ok"); box.dataset.view = String(FINI); reopen(); }
        catch (e) { AgentOS.toast(e.message, "err"); rt.disabled = false; rt.textContent = "🎨"; }
      });
      const pub = box.querySelector("[data-publish]");
      if (pub) {
        const sel = box.querySelector("#pk-chan");
        api("/api/channels").then((chs) => {
          sel.innerHTML = `<option value="">— chaîne YouTube —</option>` + chs.filter((c) => !c.error).map((c) => `<option value="${esc(c.channelId)}">${esc(c.title)}</option>`).join("");
        }).catch(() => {});
        sel.addEventListener("change", () => (pub.disabled = !sel.value));
        pub.addEventListener("click", async () => {
          pub.disabled = true; pub.textContent = "⏳ Envoi…";
          try {
            const r = await api(`/api/machines/wealth/runs/${run.id}/publish`, { method: "POST", body: {
              channelId: sel.value, privacyStatus: box.querySelector("#pk-priv").value, title: box.querySelector("#pk-title").value,
              description: box.querySelector("#pk-desc").value, tags: box.querySelector("#pk-tags").value.split(",").map((x) => x.trim()).filter(Boolean),
            }});
            AgentOS.toast("📤 Publiée : " + r.url, "ok");
            reopen();
          } catch (e) { AgentOS.toast(e.message, "err"); pub.disabled = false; pub.textContent = "📤 Publier"; }
        });
      }
    }

    // ═══════════════════════════ Onglet Runs ═══════════════════════════
    async function renderRuns() {
      const body = el.querySelector("#wl-body");
      const runs = await api("/api/machines/wealth/runs");
      const BADGE = { done: ["✓ terminé", "ok"], failed: ["✗ échec", "err"] };
      body.innerHTML = runs.length
        ? runs.map((r) => {
            const [lb, bd] = BADGE[r.status] || ["⏳ en cours", "warn"];
            const cost = r.cost ? (r.cost.images || 0) + (r.cost.voice || 0) + (r.cost.avatar || 0) + (r.cost.music || 0) : 0;
            return `<div class="scrap-row ${r.status === "done" ? "done" : r.status === "failed" ? "failed" : ""}" style="cursor:pointer" data-run="${r.id}">
              <b class="small grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title)}</b>
              <span class="small muted">${r.sections || 0} sections · ${r.shots || 0} plans${r.durationSec ? " · " + (r.durationSec / 60).toFixed(1) + " min" : ""} · ${r.mode}</span>
              <span class="small mono row-stat">${cost ? cost.toFixed(2) + "$" : ""}</span>
              <span class="small muted">${ago(r.createdAt)}</span>
              <span class="badge ${bd}">${lb}</span>
              ${r.status !== "done" ? `<button class="mini-btn" data-zap="${r.id}" title="⚡ Décharge : relance le run">⚡</button>` : ""}
              ${!["done", "failed"].includes(r.status) ? `<button class="mini-btn" data-cancel="${r.id}" title="Annuler">🛑</button>` : ""}
            </div>`;
          }).join("")
        : `<div class="empty">Aucun run — lance ta première vidéo dans ⚙ Générer.</div>`;
      body.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => openWizard(b.dataset.run)));
      body.querySelectorAll("[data-zap]").forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation(); b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/wealth/runs/${b.dataset.zap}/resume`, { method: "POST", body: {} }); AgentOS.toast("⚡ Décharge envoyée", "ok"); openWizard(b.dataset.zap); }
        catch (err) { AgentOS.toast(err.message, "err"); }
        renderRuns();
      }));
      body.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", async (e) => {
        e.stopPropagation(); b.disabled = true;
        try { await api(`/api/machines/wealth/runs/${b.dataset.cancel}/cancel`, { method: "POST" }); AgentOS.toast("Run annulé 🛑", "ok"); } catch (err) { AgentOS.toast(err.message, "err"); }
        renderRuns();
      }));
    }

    // ═══════════════════════════ Onglet Stock ═══════════════════════════
    async function renderStock() {
      const body = el.querySelector("#wl-body");
      let stock = [];
      try { stock = await api("/api/machines/wealth/stock"); } catch {}
      const live = stock.filter((v) => !v.archived);
      body.innerHTML = live.length
        ? live.map((v) => `
            <div class="scrap-row ${v.posted ? "done" : ""}" style="cursor:pointer;border-left:3px solid ${v.posted ? "var(--ok,#4ade80)" : "var(--accent)"}" data-run="${esc(v.id)}">
              ${v.thumbRel ? `<img src="${media(v.thumbRel)}" style="width:74px;height:42px;object-fit:cover;border-radius:6px;flex:none">` : `<span style="width:74px;text-align:center">💰</span>`}
              <b class="small grow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.title)}</b>
              <span class="small muted">${v.shots} plans · ${(v.durationSec / 60).toFixed(1)} min</span>
              <span class="small muted">${AgentOS.dateFr(v.createdAt)}</span>
              <span class="badge ${v.posted ? "ok" : "warn"}">${v.posted ? "📤 postée" : "en stock"}</span>
            </div>`).join("")
        : `<div class="empty">Stock vide.</div>`;
      body.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => openWizard(b.dataset.run)));
    }

    // ═══════════════════════════ Onglet Avatars ═══════════════════════════
    async function renderAvatars() {
      const body = el.querySelector("#wl-body");
      cfg = await api("/api/machines/wealth");
      const avatars = cfg.avatars || [];
      body.innerHTML = `
        <div class="row between mb"><div class="small muted">L'avatar = le présentateur IA : image de référence 16:9 (tête/buste, face caméra) lipsynquée sur la voix off à l'intro, au CTA et sur les moments clés. Plusieurs avatars = plusieurs chaînes/identités.</div>
          <button class="btn btn-accent btn-sm" id="btn-newav">+ Nouvel avatar</button></div>
        ${avatars.length ? `<div class="grid grid-3">${avatars.map((a) => `
          <div class="scrap-row" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px">
            ${a.referenceRel ? `<img src="${media(a.referenceRel)}?v=${Date.now()}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;border:1px solid var(--border-soft)">` : `<div class="empty small" style="aspect-ratio:16/9;margin:0;display:flex;align-items:center;justify-content:center">Pas d'image de référence</div>`}
            <div class="row between"><b>${esc(a.name)} <span class="muted small">${a.sex === "F" ? "♀" : "♂"}</span></b>
              <span class="row" style="gap:4px"><button class="mini-btn" data-regen="${a.id}" title="Régénérer la référence 16:9">🔄 16:9</button><button class="mini-btn" data-edit="${a.id}">✏</button><button class="mini-btn" data-del="${a.id}">🗑</button></span></div>
            <div class="small muted" style="line-height:1.4">${esc((a.appearance || "").slice(0, 220))}</div>
          </div>`).join("")}</div>` : `<div class="empty">Aucun avatar — crée le présentateur de la chaîne.</div>`}`;
      body.querySelector("#btn-newav").addEventListener("click", () => avatarDialog(null));
      body.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => avatarDialog(avatars.find((a) => a.id === b.dataset.edit))));
      body.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (!confirm("Supprimer cet avatar ?")) return;
        await api(`/api/machines/wealth/avatars/${b.dataset.del}`, { method: "DELETE" });
        renderAvatars();
      }));
      body.querySelectorAll("[data-regen]").forEach((b) => b.addEventListener("click", async () => {
        b.disabled = true; b.textContent = "⏳";
        try { await api(`/api/machines/wealth/avatars/${b.dataset.regen}/regen-ref`, { method: "POST" }); AgentOS.toast("Référence régénérée 🎨", "ok"); }
        catch (e) { AgentOS.toast(e.message, "err"); }
        renderAvatars();
      }));
    }

    function avatarDialog(existing) {
      const overlay = document.createElement("div");
      overlay.className = "picker-overlay";
      let referenceRel = existing?.referenceRel || null;
      overlay.innerHTML = `
        <div class="scrap-modal" style="max-width:720px">
          <h2 style="margin-top:0">${existing ? "✏ Modifier l'avatar" : "🧑‍💼 Nouvel avatar"}</h2>
          <div class="grid grid-2" style="align-items:end">
            <label class="field"><span>Nom</span><input id="ad-name" value="${esc(existing?.name || "")}" placeholder="ex : Daniel"></label>
            <label class="field"><span>Sexe</span><select id="ad-sex"><option value="M"${existing?.sex !== "F" ? " selected" : ""}>Homme</option><option value="F"${existing?.sex === "F" ? " selected" : ""}>Femme</option></select></label>
          </div>
          <label class="field"><span class="row between">Apparence <span class="muted">(EN, ~40-60 mots : âge, origine, cheveux, tenue sobre haut de gamme)</span><button class="mini-btn" id="ad-complete">✨ Compléter avec Claude</button></span>
            <textarea id="ad-app" rows="4">${esc(existing?.appearance || "")}</textarea></label>
          <div class="row" style="gap:12px;align-items:flex-start">
            <div id="ad-preview" style="flex:none;width:240px;aspect-ratio:16/9;border-radius:8px;border:1px solid var(--border-soft);background:var(--surface);display:flex;align-items:center;justify-content:center;overflow:hidden" class="small muted">${referenceRel ? `<img src="${media(referenceRel)}" style="width:100%;height:100%;object-fit:cover">` : "aucune image"}</div>
            <div class="grow small muted">
              <div class="row" style="gap:6px;margin-bottom:8px"><button class="btn btn-sm" id="ad-gen">🎨 Générer la référence (Kie, 16:9)</button><label class="btn btn-sm" style="cursor:pointer">📁 Importer une photo<input type="file" id="ad-file" accept="image/*" style="display:none"></label></div>
              Le cadrage doit être tête/buste, face caméra, bouche fermée : c'est ce que le lipsync anime. Une vraie photo (portrait 16:9) marche aussi.
            </div>
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn btn-ghost" id="ad-cancel">Annuler</button><button class="btn btn-accent" id="ad-save">Enregistrer</button></div>
        </div>`;
      document.body.appendChild(overlay);
      const $ = (q) => overlay.querySelector(q);
      const setPreview = () => { $("#ad-preview").innerHTML = referenceRel ? `<img src="${media(referenceRel)}?v=${Date.now()}" style="width:100%;height:100%;object-fit:cover">` : "aucune image"; };
      $("#ad-cancel").addEventListener("click", () => overlay.remove());
      $("#ad-file").addEventListener("change", () => {
        const f = $("#ad-file").files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = async () => {
          try { const r = await api("/api/machines/wealth/avatars/upload-ref", { method: "POST", body: { name: $("#ad-name").value || "avatar", dataUrl: rd.result } }); referenceRel = r.rel; setPreview(); AgentOS.toast("Image importée 📁", "ok"); }
          catch (e) { AgentOS.toast(e.message, "err"); }
        };
        rd.readAsDataURL(f);
      });
      $("#ad-complete").addEventListener("click", async (e) => {
        e.preventDefault();
        const b = $("#ad-complete"); b.disabled = true; b.textContent = "⏳";
        try {
          const r = await api("/api/machines/wealth/avatars/complete", { method: "POST", body: { name: $("#ad-name").value.trim(), appearance: $("#ad-app").value.trim(), sex: $("#ad-sex").value } });
          if (r.name && !$("#ad-name").value.trim()) $("#ad-name").value = r.name;
          if (r.appearance) $("#ad-app").value = r.appearance;
        } catch (err) { AgentOS.toast(err.message, "err"); }
        b.disabled = false; b.textContent = "✨ Compléter avec Claude";
      });
      $("#ad-gen").addEventListener("click", async () => {
        const app = $("#ad-app").value.trim();
        if (!app) return AgentOS.toast("Décris d'abord l'apparence (ou ✨)", "err");
        const b = $("#ad-gen"); b.disabled = true; b.textContent = "⏳ Génération…";
        try { const r = await api("/api/machines/wealth/avatars/generate-ref", { method: "POST", body: { name: $("#ad-name").value || "avatar", appearance: app } }); referenceRel = r.rel; setPreview(); AgentOS.toast("Portrait généré 🎨", "ok"); }
        catch (e) { AgentOS.toast(e.message, "err"); }
        b.disabled = false; b.textContent = "🎨 Générer la référence (Kie, 16:9)";
      });
      $("#ad-save").addEventListener("click", async () => {
        const name = $("#ad-name").value.trim();
        if (!name) return AgentOS.toast("Donne un nom", "err");
        try {
          await api("/api/machines/wealth/avatars", { method: "POST", body: { id: existing?.id, name, sex: $("#ad-sex").value, appearance: $("#ad-app").value.trim(), referenceRel } });
          AgentOS.toast("Avatar enregistré", "ok");
          overlay.remove();
          renderAvatars();
        } catch (e) { AgentOS.toast(e.message, "err"); }
      });
    }

    // ═══════════════════════════ Onglet Paramètres ═══════════════════════════
    async function renderSettings() {
      const body = el.querySelector("#wl-body");
      let niches = [];
      try { niches = await api("/api/bank/niches"); } catch {}
      const s = cfg.settings;
      const MODELS = { nano: "Nano Banana 2 Lite — 0,02 $", grok2: "Grok Imagine Image 2.0 — 0,02 $", seedream: "Seedream 5 Lite — 0,014 $", gpt: "GPT Image 2 — 0,06 $" };
      const th = s.theme || {};
      body.innerHTML = `
        <div class="small" style="font-weight:700;color:var(--ink-2);margin-bottom:6px">📐 CHIFFRES DE LA NICHE <span class="muted" style="font-weight:400">(recalés depuis docs/RECETTE-NICHE-WEALTH.md — ils pilotent le script et le découpage)</span></div>
        <div class="grid grid-4" style="align-items:end">
          <label class="field"><span>🗣 Débit de la niche : <b id="s-wpmlbl">${s.wpm}</b> mots/min ${s.measuredWpm ? `<span class="muted">· voix mesurée : <b>${s.measuredWpm}</b></span>` : ""}</span><input type="range" id="s-wpm" min="120" max="190" step="5" value="${s.wpm}"></label>
          <label class="field"><span>🎞 Durée cible d'un plan : <b id="s-shotlbl">${s.shotSeconds}</b> s</span><input type="range" id="s-shot" min="2.5" max="8" step="0.5" value="${s.shotSeconds}"></label>
          <label class="field"><span>⏱ Durée par défaut : <b id="s-durlbl">${s.durationMin}</b> min</span><input type="range" id="s-dur" min="2" max="30" step="1" value="${s.durationMin}"></label>
          <label class="field"><span>📣 CTA après la section</span><input type="number" id="s-cta" min="1" max="8" value="${s.ctaAfterSection}"></label>
        </div>
        <div class="grid grid-4" style="align-items:end">
          <label class="field"><span>🎞 Parité b-roll par défaut : <b id="s-mixlbl">${s.mixBroll}</b> %</span><input type="range" id="s-mix" min="0" max="100" step="5" value="${s.mixBroll}"></label>
          <label class="field"><span>✨ Motion plein écran : <b id="s-motlbl">${s.motionPct}</b> % · 💥 textes incrustés : <b id="s-ovlbl">${s.overlayPct ?? 40}</b> %</span><span class="row" style="gap:6px"><input type="range" id="s-mot" min="0" max="40" step="5" value="${s.motionPct}" style="flex:1"><input type="range" id="s-ov" min="0" max="80" step="5" value="${s.overlayPct ?? 40}" style="flex:1"></span></label>
          <label class="field"><span>🧑‍💼 Passages avatar : <b id="s-avlbl">${s.avatarCount}</b> · <b id="s-avslbl">${s.avatarSeconds}</b> s chacun</span><span class="row" style="gap:6px"><input type="range" id="s-avn" min="0" max="6" value="${s.avatarCount}" style="flex:1"><input type="range" id="s-avs" min="6" max="30" step="1" value="${s.avatarSeconds}" style="flex:1"></span></label>
          <div class="field"><span>Éléments</span><span class="row" style="gap:10px;flex-wrap:wrap">
            <label class="small"><input type="checkbox" id="s-avintro" ${s.avatarIntro ? "checked" : ""}> intro avatar</label>
            <label class="small"><input type="checkbox" id="s-cards" ${s.sectionCards ? "checked" : ""}> cartes de section</label>
            <label class="small"><input type="checkbox" id="s-lower" ${s.lowerThirds ? "checked" : ""}> textes incrustés</label>
            <label class="small"><input type="checkbox" id="s-subs" ${s.subtitles ? "checked" : ""}> sous-titres par défaut</label>
            <label class="small" title="Chaque clip Pexels est noté 0-10 par Qwen face à la description du plan ; sous 6 il est rejeté et un autre est cherché"><input type="checkbox" id="s-check" ${s.brollCheck !== false ? "checked" : ""}> vérifier les b-roll</label></span></div>
        </div>
        <div class="small" style="font-weight:700;color:var(--ink-2);margin:10px 0 6px">🎥 EFFETS & STYLE</div>
        <div class="grid grid-4" style="align-items:end">
          <div class="field"><span>Mouvements de caméra</span><span class="row" style="gap:10px"><label class="small"><input type="checkbox" id="s-zoom" ${s.effects.zoom ? "checked" : ""}> zoom / dézoom</label><label class="small"><input type="checkbox" id="s-pan" ${s.effects.pan ? "checked" : ""}> pan gauche / droite</label></span></div>
          <label class="field"><span>Amplitude : <b id="s-amplbl">${Math.round(s.effects.amp * 100)}</b> %</span><input type="range" id="s-amp" min="3" max="25" step="1" value="${Math.round(s.effects.amp * 100)}"></label>
          <label class="field"><span>🎨 Thème motion : fond / fond 2 / accent / texte</span><span class="row" style="gap:6px"><input type="color" id="s-bg" value="${esc(th.bg)}"><input type="color" id="s-bg2" value="${esc(th.bg2)}"><input type="color" id="s-accent" value="${esc(th.accent)}"><input type="color" id="s-fg" value="${esc(th.fg)}"></span></label>
          <label class="field"><span>🖼 Modèle d'images IA</span><select id="s-model">${Object.entries(MODELS).map(([k, l]) => `<option value="${k}"${s.imageModel === k ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>🤖 Style des rendus IA <span class="muted">(préambule EN de chaque prompt image)</span></span><textarea id="s-aistyle" rows="2">${esc(s.aiStyle || "")}</textarea></label>
        <div class="grid grid-4" style="align-items:end">
          <label class="field"><span>🎙 Moteur de voix par défaut</span><select id="s-vprov"><option value="inworld"${s.voiceProvider !== "elevenlabs" ? " selected" : ""}>Inworld (0,015 $/1k car.)</option><option value="elevenlabs"${s.voiceProvider === "elevenlabs" ? " selected" : ""}>ElevenLabs v3 (0,10 $/1k car.)</option></select></label>
          <label class="field"><span>✍ Moteur de texte <span class="muted">(script, plans, packaging)</span></span><select id="s-text"><option value="qwen"${s.textEngine !== "claude" ? " selected" : ""}>Qwen 3.7 Plus — OpenRouter (rapide, ~0,01 $/run)</option><option value="claude"${s.textEngine === "claude" ? " selected" : ""}>Claude CLI (limite de session)</option></select></label>
          <label class="field"><span>👄 Modèle de lipsync (FAL)</span><input id="s-lip" value="${esc(s.lipsyncModel || "veed/lipsync")}" placeholder="veed/lipsync"></label>
          <label class="field"><span>🎵 Musique par défaut · volume <b id="s-mvlbl">${Math.round((s.musicVolume || 0.12) * 100)}</b> %</span><span class="row" style="gap:6px"><label class="small"><input type="checkbox" id="s-music" ${s.music ? "checked" : ""}> oui</label><input type="range" id="s-mvol" min="3" max="40" step="1" value="${Math.round((s.musicVolume || 0.12) * 100)}" style="flex:1"></span></label>
          <label class="field"><span>🏦 Banque de niche liée</span><select id="s-niche"><option value="">— aucune —</option>${niches.map((n) => `<option value="${n.id}"${cfg.nicheId === n.id ? " selected" : ""}>${esc(n.name)}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>🎵 Style Suno de la musique de fond</span><textarea id="s-mstyle" rows="2">${esc(s.musicStyle || "")}</textarea></label>
        <div class="grid grid-3" style="align-items:end">
          <label class="field"><span>🌍 Langue de la chaîne <span class="muted">(titre, description, tags)</span></span><select id="s-chain">${LANGS.map((l) => `<option${s.chainLanguage === l ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
          <label class="field"><span>🔒 Confidentialité à la publication</span><select id="s-priv">${[["private", "🔒 Privée"], ["unlisted", "🔗 Non répertoriée"], ["public", "🌍 Publique"]].map(([v, l]) => `<option value="${v}"${s.publishPrivacy === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field"><span>📣 Nom de chaîne (CTA)</span><input id="s-chan" value="${esc(s.channelName || "Wealth")}"></label>
        </div>
        <button class="btn btn-accent" id="s-save">Enregistrer</button>`;
      const $ = (x) => body.querySelector(x);
      const bind = (id, lbl, f = (v) => v) => $(id).addEventListener("input", (e) => ($(lbl).textContent = f(e.target.value)));
      bind("#s-wpm", "#s-wpmlbl"); bind("#s-shot", "#s-shotlbl"); bind("#s-dur", "#s-durlbl"); bind("#s-mix", "#s-mixlbl"); bind("#s-mot", "#s-motlbl");
      bind("#s-avn", "#s-avlbl"); bind("#s-avs", "#s-avslbl"); bind("#s-amp", "#s-amplbl"); bind("#s-mvol", "#s-mvlbl"); bind("#s-ov", "#s-ovlbl");
      $("#s-save").addEventListener("click", async () => {
        try {
          cfg = await api("/api/machines/wealth", { method: "PATCH", body: {
            nicheId: $("#s-niche").value || null,
            settings: {
              wpm: Number($("#s-wpm").value), shotSeconds: Number($("#s-shot").value), durationMin: Number($("#s-dur").value), ctaAfterSection: Number($("#s-cta").value) || 2,
              mixBroll: Number($("#s-mix").value), motionPct: Number($("#s-mot").value), overlayPct: Number($("#s-ov").value), avatarCount: Number($("#s-avn").value), avatarSeconds: Number($("#s-avs").value),
              avatarIntro: $("#s-avintro").checked, sectionCards: $("#s-cards").checked, lowerThirds: $("#s-lower").checked, subtitles: $("#s-subs").checked,
              effects: { zoom: $("#s-zoom").checked, pan: $("#s-pan").checked, amp: Number($("#s-amp").value) / 100 },
              theme: { bg: $("#s-bg").value, bg2: $("#s-bg2").value, accent: $("#s-accent").value, fg: $("#s-fg").value },
              imageModel: $("#s-model").value, aiStyle: $("#s-aistyle").value.trim(), voiceProvider: $("#s-vprov").value, textEngine: $("#s-text").value, brollCheck: $("#s-check").checked, lipsyncModel: $("#s-lip").value.trim() || "veed/lipsync",
              music: $("#s-music").checked, musicVolume: Number($("#s-mvol").value) / 100, musicStyle: $("#s-mstyle").value.trim(),
              chainLanguage: $("#s-chain").value, publishPrivacy: $("#s-priv").value, channelName: $("#s-chan").value.trim() || "Wealth",
            },
          }});
          AgentOS.toast("Paramètres enregistrés", "ok");
        } catch (e) { AgentOS.toast(e.message, "err"); }
      });
    }

    shell();
  },
});
