    // ===== MACHINE WEALTH ===== (bloc exportable — voir lib/machines/wealth.export.json)
    if (p === "/api/machines/wealth/stock" && req.method === "GET") return json(res, 200, wealth.stock());
    if (p === "/api/machines/wealth" && req.method === "GET") return json(res, 200, { ...wealth.config(), voices: wealth.VOICES, elevenVoices: wealth.ELEVEN_VOICES, pexels: require("./lib/pexels").configured() });
    if (p === "/api/machines/wealth" && req.method === "PATCH") {
      const b = await readBody(req);
      return json(res, 200, { ...wealth.patchConfig(b), voices: wealth.VOICES, elevenVoices: wealth.ELEVEN_VOICES });
    }
    if (p === "/api/machines/wealth/estimate" && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      return json(res, 200, wealth.estimate(b));
    }
    // ---- Avatars (l'onglet « personnage ») ----
    if (p === "/api/machines/wealth/avatars" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, wealth.upsertAvatar(b)); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (p === "/api/machines/wealth/avatars/upload-ref" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, { rel: wealth.saveUploadedAvatar(b.name, b.dataUrl) }); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (p === "/api/machines/wealth/avatars/complete" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, await wealth.completeAvatar(b)); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (p === "/api/machines/wealth/avatars/generate-ref" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, { rel: await wealth.generateAvatarRef(b.name, b.appearance) }); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/avatars\/([\w-]+)\/regen-ref$/.exec(p);
    if (m && req.method === "POST") {
      try { return json(res, 200, await wealth.regenAvatarImage(m[1])); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/avatars\/([\w-]+)$/.exec(p);
    if (m && req.method === "DELETE") { wealth.removeAvatar(m[1]); return json(res, 200, { ok: true }); }
    // ---- Idées, runs ----
    if (p === "/api/machines/wealth/idea" && req.method === "POST") {
      try { return json(res, 200, await wealth.suggestTheme()); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    if (p === "/api/machines/wealth/runs" && req.method === "GET") return json(res, 200, wealth.listRuns());
    if (p === "/api/machines/wealth/runs" && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, wealth.createRun(b)); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/publish$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, await wealth.publishRun(m[1], b)); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/thumbnail$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { return json(res, 200, await wealth.regenThumbnail(m[1], b.instructions || "")); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    // Recomposer seulement le bandeau de la miniature (lieu + gros titre) sans repayer l'image
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/thumb-text$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { return json(res, 200, await wealth.restyleThumbnail(m[1], { place: b.place, headline: b.headline })); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/texts$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { return json(res, 200, await wealth.regenTexts(m[1], b.instructions || "", b.field || "")); } catch (e) { return json(res, 500, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/validate$/.exec(p);
    if (m && req.method === "POST") {
      try { return json(res, 200, wealth.validate(m[1])); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/section$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req);
      try { return json(res, 200, wealth.patchSection(m[1], b.n, b.text)); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/cancel$/.exec(p);
    if (m && req.method === "POST") {
      try { return json(res, 200, wealth.cancelRun(m[1])); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/resume$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try { const run = wealth.resumeRun(m[1], b.status); return json(res, 200, { ok: true, status: run.status }); } catch (e) { return json(res, 400, { error: e.message }); }
    }
    // Garde-fou : aucune régé pendant qu'un advance() tourne (écriture perdue)
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)\/regen$/.exec(p);
    if (m && req.method === "POST") {
      const b = await readBody(req).catch(() => ({}));
      try {
        if (wealth.getRun(m[1]).status.endsWith("_running")) return json(res, 400, { error: "Le run est en cours — attends la fin de l'étape avant de régénérer." });
        return json(res, 200, await wealth.regenShot(m[1], b.scene, { instructions: b.instructions || "", visual: b.visual || null }));
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    m = /^\/api\/machines\/wealth\/runs\/([\w-]+)$/.exec(p);
    if (m && req.method === "GET") {
      try { return json(res, 200, wealth.getRun(m[1])); } catch (e) { return json(res, 404, { error: e.message }); }
    }
    // ===== FIN MACHINE WEALTH =====

    // ===== LABO DE NICHE (scan complet + décorticage image par image, Qwen 3.7 Flash) =====
    if (p === "/api/lab/status") return json(res, 200, { running: lab.isRunning() });
    if (p === "/api/lab/scan" && req.method === "POST") {
      const b = await readBody(req);
      const inputs = Array.isArray(b.channels) ? b.channels : String(b.channels || "").split(/[\s,]+/).filter(Boolean);
      if (!inputs.length) return json(res, 400, { error: "Donne au moins une chaîne (URL, @handle ou UC…)" });
      if (lab.isRunning()) return json(res, 400, { error: "Un scan du Labo est déjà en cours" });
      (async () => {
        const ids = [];
        for (const inp of inputs) { try { const c = await lab.resolveChannel(inp); if (!ids.includes(c.channelId)) ids.push(c.channelId); } catch (e) { console.log("[lab]", inp, e.message); } }
        if (ids.length) await lab.scanNiche(b.niche || "Wealth", ids, { deep: Number(b.deep) || 4 }).catch((e) => console.log("[lab]", e.message));
      })();
      return json(res, 200, { ok: true, started: true, channels: inputs.length });
    }
    m = /^\/api\/lab\/niches\/([\w-]+)\/digest$/.exec(p);
    if (m && req.method === "GET") {
      try { return json(res, 200, lab.nicheDigest(m[1])); } catch (e) { return json(res, 404, { error: e.message }); }
    }
    m = /^\/api\/lab\/videos\/([\w-]+)$/.exec(p);
    if (m && req.method === "GET") {
      const r = lab.videoResult(m[1]);
      return r ? json(res, 200, r) : json(res, 404, { error: "Vidéo non analysée" });
    }
