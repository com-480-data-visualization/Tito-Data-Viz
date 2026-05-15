function initAct3(data) {
    if (!data?.length) return;
    const section = document.getElementById("act3");
    if (!section) return;

    let activePos = null;
    let activePreset = "ours";
    let weights = { scoring: 0.2, creation: 0.2, progression: 0.2, defense: 0.2, discipline: 0.2 };
    let quizAnswers = {};
    let impactView = "rank";
    let hoveredPid = null;
    let selectedPid = null;
    let lastTopPid = null;

    function openPlayerModal(player) {
        if (!player) return;
        const subPos = player.subPos;
        const rows = computeNewComposites(subPos, weights);
        const byUser = rows.slice().sort((a, b) => b.newComp - a.newComp);
        const byEa = rows.slice().filter(r => r.player.ea?.ovr != null)
                                 .sort((a, b) => b.player.ea.ovr - a.player.ea.ovr);
        const userIdx = byUser.findIndex(r => r.player.name === player.name && (r.player.club || "") === (player.club || ""));
        const eaIdx = byEa.findIndex(r => r.player.name === player.name && (r.player.club || "") === (player.club || ""));
        const meRow = userIdx >= 0 ? byUser[userIdx] : null;
        // use the live composite/gap so the modal matches the rebuilt ranking
        const augmented = Object.assign({}, player, {
            composite: meRow ? meRow.newComp : player.composite,
            gap:       meRow ? meRow.newGap  : player.gap,
            userWeights: { ...weights },
            userComposite: meRow ? meRow.newComp : null,
            userRank: userIdx >= 0 ? userIdx + 1 : null,
            eaRank: eaIdx >= 0 ? eaIdx + 1 : null
        });
        window.openAct2Modal(augmented, data);
    }
    function findPlayerByPid(pidStr) {
        return data.find(p => (p.name + "|" + (p.club || "")) === pidStr);
    }
    function pidOf(p) { return p.name + "|" + (p.club || ""); }

    let hoverClearTimer = null;
    function applyHovered(pid) {
        if (hoveredPid === pid) return;
        hoveredPid = pid;
        section.querySelectorAll("[data-pid]").forEach(el => {
            el.classList.toggle("a3-hover", el.dataset.pid === pid);
        });
        syncRadarHover(pid);
    }
    function setHovered(pid) {
        if (hoverClearTimer) {
            clearTimeout(hoverClearTimer);
            hoverClearTimer = null;
        }
        if (pid == null) {
            hoverClearTimer = setTimeout(() => {
                hoverClearTimer = null;
                applyHovered(null);
            }, 140);
        } else {
            applyHovered(pid);
        }
    }

    const OURS = {};
    for (const p of data) {
        if (p.subPos && !OURS[p.subPos] && p.dimWeights) {
            OURS[p.subPos] = { ...p.dimWeights };
        }
    }

    const OVR_STATS = {};
    {
        const buckets = {};
        for (const p of data) {
            if (!p.subPos || p.ea?.ovr == null) continue;
            (buckets[p.subPos] = buckets[p.subPos] || []).push(p.ea.ovr);
        }
        for (const sp in buckets) {
            const arr = buckets[sp];
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
            OVR_STATS[sp] = { mean, std: Math.sqrt(variance) || 1 };
        }
    }

    function normalizeWeights(w, dims) {
        const ds = dims || A3_DIMS;
        let s = 0;
        for (const d of ds) s += Math.max(0, w[d] || 0);
        if (s === 0) {
            const eq = 1 / ds.length;
            return Object.fromEntries(ds.map(d => [d, eq]));
        }
        const out = {};
        for (const d of ds) out[d] = Math.max(0, w[d] || 0) / s;
        return out;
    }

    function rawScore(player, w, dims) {
        const s = player.subScores || {};
        const ds = dims || A3_DIMS;
        let total = 0;
        for (const d of ds) total += (w[d] || 0) * (s[d] || 0);
        return total;
    }

    function computeNewComposites(sub, w) {
        const dims = a3DimsFor(sub);
        const players = data.filter(p =>
            p.subPos === sub && p.ea?.ovr != null && p.subScores
        );
        if (!players.length) return [];
        const raws = players.map(p => rawScore(p, w, dims));
        const mean = raws.reduce((a, b) => a + b, 0) / raws.length;
        const variance = raws.reduce((s, v) => s + (v - mean) ** 2, 0) / raws.length;
        const std = Math.sqrt(variance) || 1;
        const targ = OVR_STATS[sub] || { mean: 75, std: 5 };
        const rescaled = raws.map(r => ((r - mean) / std) * targ.std + targ.mean);

        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        const n = players.length;
        for (let i = 0; i < n; i++) {
            const x = players[i].ea.ovr;
            const y = rescaled[i];
            sx += x; sy += y; sxy += x * y; sx2 += x * x;
        }
        const denom = n * sx2 - sx * sx;
        const slope = denom ? (n * sxy - sx * sy) / denom : 0;
        const intercept = (sy - slope * sx) / n;

        return players.map((p, i) => ({
            player: p,
            newComp: rescaled[i],
            newGap: rescaled[i] - (slope * p.ea.ovr + intercept)
        }));
    }

    window._act3_getState = function () {
        return {
            pos: activePos,
            weights: { ...weights },
            quiz2: quiz2State
                ? { score: quiz2State.score, total: quiz2State.picks.length, done: quiz2State.idx >= quiz2State.picks.length }
                : null,
            computeNewComposites
        };
    };

    const scenes = {
        1: document.getElementById("a3-scene-1"),
        2: document.getElementById("a3-scene-2"),
        3: document.getElementById("a3-scene-3")
    };

    function showScene(n) {
        for (const k in scenes) if (scenes[k]) scenes[k].hidden = (+k !== n);
        if (n === 2) {
            renderCrest();
            renderQuiz();
        }
        if (n === 3) {
            renderCrest();
            renderSliders();
            renderPresets();
            renderImpact();
            renderHero();
            requestAnimationFrame(() => renderRadar());
            const build = scenes[3];
            if (build) {
                build.classList.remove("is-ready");
                void build.offsetWidth;
                build.classList.add("is-ready");
            }
        }
        if (n >= 2) {
            requestAnimationFrame(() => {
                scenes[n]?.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    section.querySelectorAll("[data-goto]").forEach(btn => {
        btn.addEventListener("click", () => showScene(+btn.dataset.goto));
    });

    const lineupEl = document.getElementById("a3-lineup");
    const pitchPreviewEl = document.getElementById("a3-pitch-preview");

    function renderLineup() {
        if (!lineupEl) return;
        const svgNS = "http://www.w3.org/2000/svg";
        lineupEl.innerHTML = "";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 100 140");

        const lines = [
            "M 3 3 L 97 3 L 97 137 L 3 137 Z",
            "M 3 70 L 97 70",
            "M 28 3 L 28 20 L 72 20 L 72 3",
            "M 42 3 L 42 10 L 58 10 L 58 3",
            "M 28 137 L 28 120 L 72 120 L 72 137",
            "M 42 137 L 42 130 L 58 130 L 58 137"
        ];
        for (const d of lines) {
            const p = document.createElementNS(svgNS, "path");
            p.setAttribute("d", d);
            p.setAttribute("class", "a3-pitch-line");
            svg.appendChild(p);
        }
        const cc = document.createElementNS(svgNS, "circle");
        cc.setAttribute("cx", 50); cc.setAttribute("cy", 70); cc.setAttribute("r", 9);
        cc.setAttribute("class", "a3-pitch-line");
        svg.appendChild(cc);
        const spot = document.createElementNS(svgNS, "circle");
        spot.setAttribute("cx", 50); spot.setAttribute("cy", 70); spot.setAttribute("r", 0.7);
        spot.setAttribute("class", "a3-pitch-spot");
        svg.appendChild(spot);

        A3_SLOTS.forEach((slot, i) => {
            const outer = document.createElementNS(svgNS, "g");
            outer.setAttribute("transform", `translate(${slot.x}, ${slot.y * 1.4})`);

            const g = document.createElementNS(svgNS, "g");
            g.setAttribute("class", "a3-slot-group" +
                (slot.sub === activePos ? " active" : "") +
                (i === 0 ? " hint" : ""));
            g.setAttribute("data-sub", slot.sub);
            g.setAttribute("data-idx", i);

            const shadow = document.createElementNS(svgNS, "circle");
            shadow.setAttribute("class", "a3-slot-shadow");
            shadow.setAttribute("r", 5.4);
            shadow.setAttribute("cy", 0.9);
            g.appendChild(shadow);

            const ring = document.createElementNS(svgNS, "circle");
            ring.setAttribute("class", "a3-slot-ring");
            ring.setAttribute("r", 5.4);
            g.appendChild(ring);

            const c = document.createElementNS(svgNS, "circle");
            c.setAttribute("class", "a3-slot-circle");
            c.setAttribute("r", 4.6);
            g.appendChild(c);

            const t = document.createElementNS(svgNS, "text");
            t.setAttribute("class", "a3-slot-label");
            t.textContent = slot.label;
            g.appendChild(t);

            const title = document.createElementNS(svgNS, "title");
            title.textContent = slot.caption;
            g.appendChild(title);

            g.addEventListener("mouseenter", () => setPreview(slot.sub));
            g.addEventListener("mouseleave", () => setPreview(null));
            g.addEventListener("focus", () => setPreview(slot.sub));
            g.addEventListener("blur", () => setPreview(null));
            g.setAttribute("tabindex", "0");
            g.setAttribute("role", "button");
            g.setAttribute("aria-label", "Pick " + slot.caption);
            g.addEventListener("click", () => commitPos(slot.sub));
            g.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commitPos(slot.sub); }
            });
            outer.appendChild(g);
            svg.appendChild(outer);
        });

        lineupEl.appendChild(svg);
        setPreview(activePos);
    }

    function setPreview(sub) {
        if (!pitchPreviewEl) return;
        const shown = sub || activePos;
        if (!shown) {
            pitchPreviewEl.innerHTML =
                '<div class="a3-preview-empty">' +
                    '<span class="a3-preview-tag a3-preview-tag-empty">Step 1</span>' +
                    '<div class="a3-preview-name">Select a position.</div>' +
                    '<div class="a3-preview-lore">Every role carries its own stats. Tap any slot on the pitch to start rebuilding it.</div>' +
                '</div>';
            pitchPreviewEl.classList.remove("is-hover");
            return;
        }
        const label = SUBPOS_LABELS[shown] || shown || "";
        const lore = POS_LORE[shown] || "";
        pitchPreviewEl.innerHTML =
            '<span class="a3-preview-tag">' + shown + '</span>' +
            '<div class="a3-preview-name">' + label + '</div>' +
            '<div class="a3-preview-lore">' + lore + '</div>' +
            '<div class="a3-preview-cta">Click to rebuild ' + label.toLowerCase() + ' &rsaquo;</div>';
        pitchPreviewEl.classList.toggle("is-hover", !!sub);
    }

    function commitPos(sub) {
        if (!sub) return;
        selectPos(sub);
        confirmPos();
    }

    function confirmPos() {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) { showScene(2); return; }

        const scene1 = scenes[1];
        const scene2 = scenes[2];
        const pitch = document.querySelector(".a3-lineup-wrap");
        const preview = pitchPreviewEl;
        if (!scene1 || !scene2 || !pitch) { showScene(2); return; }

        scene2.hidden = false;
        gsap.set(scene2, { opacity: 0, y: 20 });

        const tl = gsap.timeline({
            onComplete: () => {
                scene1.hidden = true;
                gsap.set(pitch, { clearProps: "all" });
                if (preview) gsap.set(preview, { clearProps: "all" });
                renderCrest();
                renderQuiz();
                scenes[2]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
        if (preview) tl.to(preview, { scale: 1.04, opacity: 0, filter: "blur(4px)", duration: 0.35, ease: "power2.in" }, 0);
        tl.to(pitch, { scale: 0.82, opacity: 0, y: -18, filter: "blur(3px)", duration: 0.55, ease: "power3.inOut" }, 0.03)
          .fromTo(scene2, { y: 24, filter: "blur(4px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.55, ease: "power2.out" }, 0.3);
    }

    function selectPos(sub) {
        if (!sub) return;
        activePos = sub;
        lineupEl?.querySelectorAll(".a3-slot-group").forEach(g => {
            g.classList.toggle("active", g.getAttribute("data-sub") === sub);
        });
        activePreset = "ours";
        const dims = a3DimsFor(sub);
        const eq = 1 / dims.length;
        const defaults = Object.fromEntries(dims.map(d => [d, eq]));
        const source = OURS[sub] ? Object.fromEntries(dims.map(d => [d, OURS[sub][d] || 0])) : defaults;
        weights = normalizeWeights(source, dims);
        quizAnswers = {};
        updatePosLabels();
        renderPresets();
        renderSliders();
        renderImpact();
        renderRadar();
        renderHero();
        setPreview(null);
        renderCrest();
        startQuiz2();
    }

    function updatePosLabels() {
        const label = (SUBPOS_LABELS[activePos] || activePos).toLowerCase().replace(/s$/, "");
        const b = document.getElementById("a3-build-pos-label");
        const q = document.getElementById("a3-quiz-pos-label");
        if (b) b.textContent = label;
        if (q) q.textContent = label;
    }

    function renderCrest() {
        const html = a3CrestSVG(activePos);
        const b = document.getElementById("a3-crest-b");
        const q = document.getElementById("a3-crest-q");
        if (b) b.innerHTML = html;
        if (q) q.innerHTML = html;
    }

    const quizBody = document.getElementById("a3-quiz-body");
    const quizDotsEl = document.getElementById("a3-quiz-dots");
    const quizTeaseEl = document.getElementById("a3-quiz-tease");
    const quizDoneBtn = document.getElementById("a3-quiz-done");

    let quizStepIdx = 0;

    function renderQuizDots() {
        if (!quizDotsEl) return;
        const qs = A3_QUIZ[activePos] || [];
        let html = "";
        for (let i = 0; i < qs.length; i++) {
            const cls = (quizAnswers[i] != null ? " done" : "") + (i === quizStepIdx ? " current" : "");
            html += '<button class="a3-qdot' + cls + '" data-i="' + i + '" aria-label="Question ' + (i + 1) + '"></button>';
        }
        quizDotsEl.innerHTML = html;
        quizDotsEl.querySelectorAll(".a3-qdot").forEach(btn => {
            btn.addEventListener("click", () => renderQuizStep(+btn.dataset.i));
        });
    }

    function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

    function computeProfileShort(sub, w) {
        const order = a3DimsFor(sub).slice().sort((a, b) => (w[b] || 0) - (w[a] || 0));
        const top = order[0];
        const nick = (sub === "GK" && ({ scoring: "stopper", creation: "distributor", defense: "sweeper" })[top]) || DIM_NICK[top] || top;
        return "The " + cap(nick);
    }

    function updateQuizTease() {
        if (!quizTeaseEl || !quizDoneBtn) return;
        const qs = A3_QUIZ[activePos] || [];
        const answered = qs.filter((_, i) => quizAnswers[i] != null).length;
        const allDone = qs.length > 0 && answered === qs.length;
        if (answered === 0) {
            quizTeaseEl.innerHTML = '<span class="a3-quiz-hint">or skip and start with our defaults</span>';
            quizDoneBtn.textContent = "Skip to rankings ›";
        } else if (!allDone) {
            quizTeaseEl.innerHTML = '<span class="a3-quiz-tease-count">' + answered + ' / ' + qs.length + '</span>';
            quizDoneBtn.textContent = "Continue anyway ›";
        } else {
            quizTeaseEl.innerHTML = 'Your profile <b>' + computeProfileShort(activePos, weights) + '</b>';
            quizDoneBtn.textContent = "See the rankings ›";
        }
        quizDoneBtn.hidden = false;
    }

    function renderQuiz() {
        if (!quizBody) return;
        const qs = A3_QUIZ[activePos] || [];
        if (!qs.length) return;
        let startIdx = qs.findIndex((_, i) => quizAnswers[i] == null);
        if (startIdx === -1) startIdx = qs.length - 1;
        renderQuizStep(startIdx);
    }

    function renderQuizStep(idx) {
        const qs = A3_QUIZ[activePos] || [];
        const q = qs[idx];
        if (!q) return;
        const prevIdx = quizStepIdx;
        quizStepIdx = idx;
        const total = qs.length;
        const direction = idx > prevIdx ? 1 : idx < prevIdx ? -1 : 0;

        const card =
            '<div class="a3-q-card" data-dir="' + direction + '">' +
                '<div class="a3-q-counter"><span class="a3-q-n">Question ' + (idx + 1) + '</span>' +
                    '<span class="a3-q-of"> of ' + total + '</span></div>' +
                '<fieldset class="a3-q-fs">' +
                    '<legend class="a3-q-prompt">' + q.prompt + '</legend>' +
                    '<div class="a3-q-choices">' +
                        q.choices.map((c, ci) => {
                            const sel = quizAnswers[idx] === ci ? " selected" : "";
                            return '<button class="a3-q-choice' + sel +
                                   '" data-c="' + ci + '" aria-pressed="' + (quizAnswers[idx] === ci) + '">' +
                                   (DIM_ICONS[c.dim] || "") + '<span>' + c.text + '</span></button>';
                        }).join('') +
                    '</div>' +
                '</fieldset>' +
                '<div class="a3-q-nav">' +
                    (idx > 0
                        ? '<button class="a3-link a3-q-prev">&lsaquo; previous</button>'
                        : '<span class="a3-q-ph"></span>') +
                    (idx < total - 1
                        ? '<button class="a3-link a3-q-next">' +
                              (quizAnswers[idx] != null ? 'next' : 'skip') +
                              ' &rsaquo;</button>'
                        : '<span class="a3-q-ph"></span>') +
                '</div>' +
            '</div>';

        quizBody.innerHTML = card;

        quizBody.querySelectorAll(".a3-q-choice").forEach(btn => {
            btn.addEventListener("click", () => {
                const ci = +btn.dataset.c;
                quizAnswers[idx] = ci;
                quizBody.querySelectorAll(".a3-q-choice").forEach(b => {
                    b.classList.remove("selected");
                    b.setAttribute("aria-pressed", "false");
                });
                btn.classList.add("selected");
                btn.setAttribute("aria-pressed", "true");
                computeWeightsFromQuiz();
                activePreset = null;
                renderPresets();
                renderQuizDots();
                updateQuizTease();
                const nextBtn = quizBody.querySelector(".a3-q-next");
                if (nextBtn) nextBtn.textContent = "next ›";
                setTimeout(() => {
                    if (idx < qs.length - 1) renderQuizStep(idx + 1);
                }, 380);
            });
        });
        quizBody.querySelector(".a3-q-prev")?.addEventListener("click", () => renderQuizStep(idx - 1));
        quizBody.querySelector(".a3-q-next")?.addEventListener("click", () => renderQuizStep(idx + 1));

        renderQuizDots();
        updateQuizTease();
    }

    function computeWeightsFromQuiz() {
        const dims = a3DimsFor(activePos);
        const base = Object.fromEntries(dims.map(d => [d, 0.10]));
        const qs = A3_QUIZ[activePos] || [];
        Object.entries(quizAnswers).forEach(([qi, ci]) => {
            const q = qs[+qi]; if (!q) return;
            const c = q.choices[+ci]; if (!c) return;
            base[c.dim] = (base[c.dim] || 0) + c.w;
        });
        weights = normalizeWeights(base, dims);
    }

    const presetsEl = document.getElementById("a3-presets");
    function renderPresets() {
        presetsEl?.querySelectorAll(".a3-preset").forEach(b => {
            b.classList.toggle("active", activePreset && b.dataset.preset === activePreset);
        });
    }
    if (presetsEl) {
        presetsEl.querySelectorAll(".a3-preset").forEach(btn => {
            btn.addEventListener("click", () => {
                const key = btn.dataset.preset;
                let w = key === "ours" ? OURS[activePos] : A3_PRESETS[activePos]?.[key];
                if (!w) return;
                weights = normalizeWeights(w, a3DimsFor(activePos));
                activePreset = key;
                renderPresets();
                renderSliders();
                renderImpact();
                renderRadar();
                renderHero();
            });
        });
    }

    const slidersEl = document.getElementById("a3-sliders");
    function renderSliders() {
        if (!slidersEl) return;
        const dims = a3DimsFor(activePos);
        const pct = d => (weights[d] * 100);
        let html = "";
        for (const d of dims) {
            const v = pct(d);
            html +=
                '<div class="a3-slider" data-dim="' + d + '">' +
                    '<span class="a3-slider-name">' + a3DimLabel(activePos, d) + '</span>' +
                    '<span class="a3-slider-val">' + v.toFixed(0) + '%</span>' +
                    '<input type="range" class="a3-range" min="0" max="100" step="1" value="' + v.toFixed(0) +
                        '" style="--p:' + v.toFixed(0) + '%" data-dim="' + d + '">' +
                '</div>';
        }
        slidersEl.innerHTML = html;
        let rafPending = false;
        function scheduleUpdate() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                renderImpact();
                renderRadar();
                renderHero();
            });
        }
        slidersEl.querySelectorAll(".a3-range").forEach(r => {
            r.addEventListener("input", (ev) => {
                ev.stopPropagation();
                const d = r.dataset.dim;
                const val = +r.value / 100;
                weights[d] = val;
                weights = normalizeWeights(weights, a3DimsFor(activePos));
                for (const dim of dims) {
                    if (dim === d) continue;
                    const slider = slidersEl.querySelector('.a3-range[data-dim="' + dim + '"]');
                    const valEl  = slidersEl.querySelector('.a3-slider[data-dim="' + dim + '"] .a3-slider-val');
                    if (slider) {
                        const pc = (weights[dim] * 100).toFixed(0);
                        slider.value = pc;
                        slider.style.setProperty("--p", pc + "%");
                    }
                    if (valEl) valEl.textContent = (weights[dim] * 100).toFixed(0) + "%";
                }
                const ownPc = (weights[d] * 100).toFixed(0);
                r.style.setProperty("--p", ownPc + "%");
                const ownValEl = slidersEl.querySelector('.a3-slider[data-dim="' + d + '"] .a3-slider-val');
                if (ownValEl) ownValEl.textContent = ownPc + "%";
                activePreset = null;
                renderPresets();
                quiz2Dirty = true;
                scheduleUpdate();
            });
        });
    }

    function pulseSlider(dim) {
        const el = slidersEl?.querySelector('.a3-slider[data-dim="' + dim + '"]');
        if (!el) return;
        el.classList.remove("pulse");
        void el.offsetWidth;
        el.classList.add("pulse");
    }

    function renderHero() {
        const rows = computeNewComposites(activePos, weights);
        if (!rows.length) return;
        const sorted = rows.slice().sort((a, b) => b.newComp - a.newComp);
        const byOvr = rows.slice().sort((a, b) => b.player.ea.ovr - a.player.ea.ovr);
        const ovrRank = new Map(byOvr.map((r, i) => [r.player, i + 1]));
        const yourRank = new Map(sorted.map((r, i) => [r.player, i + 1]));
        let row = sorted[0];
        if (selectedPid) {
            const found = sorted.find(r => pidOf(r.player) === selectedPid);
            if (found) row = found;
        }
        renderHeroCard(row, ovrRank, yourRank, !!selectedPid);
    }

    function renderHeroCard(topRow, ovrRankMap, yourRankMap, isSelection) {
        const el = document.getElementById("a3-hero-card");
        if (!el || !topRow) { if (el) el.innerHTML = ""; return; }
        const p = topRow.player;
        const eaRank = ovrRankMap.get(p) || 1;
        const yourRank = yourRankMap.get(p) || 1;
        const delta = eaRank - yourRank;
        const move = delta > 0
            ? '<span class="a3-hero-move up">&uarr; ' + delta + ' from EA #' + eaRank + '</span>'
            : delta < 0
                ? '<span class="a3-hero-move down">&darr; ' + Math.abs(delta) + ' from EA #' + eaRank + '</span>'
                : '<span class="a3-hero-move flat">= EA #' + eaRank + '</span>';
        const label = isSelection
            ? 'Your #' + yourRank + ' <span class="a3-hero-pos">' + (SUBPOS_LABELS[activePos] || activePos).toLowerCase().replace(/s$/, "") + '</span>'
            : 'Your #1 <span class="a3-hero-pos">' + (SUBPOS_LABELS[activePos] || activePos).toLowerCase().replace(/s$/, "") + '</span>';
        const clearBtn = isSelection
            ? '<button class="a3-hero-clear" aria-label="Back to #1">&times;</button>'
            : '';
        el.innerHTML =
            '<div class="a3-hero-label">' + label + clearBtn + '</div>' +
            '<div class="a3-hero-body" data-pid="' + escapeAttr(pidOf(p)) + '">' +
                avatarHTMLString(p.photo, p.name, "a3-hero-img", "a3-hero-fallback") +
                '<div class="a3-hero-text">' +
                    '<div class="a3-hero-name">' + p.name + '</div>' +
                    '<div class="a3-hero-meta">' + (p.club || "") + ' &middot; OVR ' + (p.ea?.ovr ?? "-") + '</div>' +
                    '<div class="a3-hero-row">' +
                        '<span class="a3-hero-comp">' + topRow.newComp.toFixed(1) + '</span>' +
                        '<span class="a3-hero-comp-l">your composite</span>' +
                        move +
                    '</div>' +
                '</div>' +
            '</div>';
        const clear = el.querySelector(".a3-hero-clear");
        if (clear) {
            clear.addEventListener("click", (e) => {
                e.stopPropagation();
                selectedPid = null;
                renderHero();
                syncRowSelection();
            });
        }
        const body = el.querySelector(".a3-hero-body");
        if (body) {
            body.style.cursor = "pointer";
            // don't count a slider drag that ends here as a click
            let downInside = false;
            body.addEventListener("pointerdown", (e) => {
                downInside = body.contains(e.target);
            });
            body.addEventListener("click", (e) => {
                if (!downInside) { downInside = false; return; }
                downInside = false;
                e.stopPropagation();
                openPlayerModal(p);
            });
        }
    }

    function selectPlayer(pid) {
        selectedPid = (selectedPid === pid) ? null : pid;
        renderHero();
        renderRadar();
        syncRowSelection();
    }

    function syncRowSelection() {
        section.querySelectorAll(".a3-row[data-pid]").forEach(el => {
            el.classList.toggle("is-selected", el.dataset.pid === selectedPid);
        });
    }

    const radarEl = document.getElementById("a3-stat-radar");
    const radarLegendEl = document.getElementById("a3-radar-legend");
    let radarTopRows = [];

    function renderRadar() {
        if (!radarEl) return;
        const rows = computeNewComposites(activePos, weights);
        const sorted = rows.slice().sort((a, b) => b.newComp - a.newComp).slice(0, 3);
        radarTopRows = sorted;
        drawRadar(sorted);
        drawRadarLegend(sorted);
        const tt = document.getElementById("a3-radar-tt");
        if (tt && !hoveredPid) {
            tt.classList.remove("show");
            tt.innerHTML = '<div class="a3-rtt-empty">Hover a name<br>for the breakdown</div>';
        }
    }

    function drawRadar(rows) {
        const dims = a3DimsFor(activePos);
        const N = dims.length;
        const size = 420;
        const cx = size / 2;
        const cy = size / 2;
        const R = size / 2 - 58;
        const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;
        const axisPoint = (i, v) => {
            const r = R * Math.max(0, Math.min(100, v)) / 100;
            return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
        };
        const gridPoint = (i, ratio) => {
            const r = R * ratio;
            return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
        };

        let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="a3-sr-svg" preserveAspectRatio="xMidYMid meet">';

        [0.25, 0.5, 0.75, 1].forEach((ratio, idx) => {
            const pts = dims.map((_, i) => gridPoint(i, ratio).join(",")).join(" ");
            svg += '<polygon points="' + pts + '" class="a3-sr-ring' + (idx === 3 ? " is-outer" : "") + '"/>';
        });
        [25, 50, 75, 100].forEach(v => {
            const y = cy - R * v / 100;
            svg += '<text x="' + (cx + 4) + '" y="' + (y - 2) + '" class="a3-sr-tick">' + v + '</text>';
        });
        dims.forEach((_, i) => {
            const [x, y] = gridPoint(i, 1);
            svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" class="a3-sr-spoke"/>';
        });
        dims.forEach((dim, i) => {
            const a = angle(i);
            const lx = cx + (R + 32) * Math.cos(a);
            const ly = cy + (R + 32) * Math.sin(a);
            let anchor = "middle";
            if (Math.cos(a) > 0.3) anchor = "start";
            else if (Math.cos(a) < -0.3) anchor = "end";
            const label = a3DimLabel(activePos, dim);
            svg += '<g class="a3-sr-axis" data-dim="' + dim + '">' +
                   '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor +
                   '" dominant-baseline="middle" class="a3-sr-axislabel">' + label + '</text>' +
                   '</g>';
        });

        rows.forEach((r, pi) => {
            const slot = A3_SLOT_COLORS[pi];
            const pts = dims.map((d, i) => {
                const v = (r.player.subScores && r.player.subScores[d]) || 0;
                return axisPoint(i, v).join(",");
            }).join(" ");
            svg += '<polygon points="' + pts + '" class="a3-sr-poly" data-pid="' + escapeAttr(pidOf(r.player)) +
                   '" style="fill:' + slot.tint + ';stroke:' + slot.color + '"/>';
        });

        rows.forEach((r, pi) => {
            const slot = A3_SLOT_COLORS[pi];
            dims.forEach((d, i) => {
                const v = (r.player.subScores && r.player.subScores[d]) || 0;
                const [x, y] = axisPoint(i, v);
                svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) +
                       '" r="3.5" class="a3-sr-dot" data-pid="' + escapeAttr(pidOf(r.player)) +
                       '" style="fill:' + slot.color + '"><title>' +
                       escapeAttr(r.player.name) + ' &middot; ' + a3DimLabel(activePos, d) + ': ' +
                       v.toFixed(1) + '</title></circle>';
            });
        });

        svg += '</svg>';
        radarEl.innerHTML = svg;

        radarEl.querySelectorAll(".a3-sr-axis").forEach(el => {
            el.style.cursor = "pointer";
            el.addEventListener("click", () => pulseSlider(el.dataset.dim));
        });
        radarEl.querySelectorAll(".a3-sr-poly").forEach(el => {
            el.addEventListener("mouseenter", () => setHovered(el.dataset.pid));
            el.addEventListener("mouseleave", () => setHovered(null));
            el.addEventListener("click", () => openPlayerModal(findPlayerByPid(el.dataset.pid)));
        });
    }

    function drawRadarLegend(rows) {
        if (!radarLegendEl) return;
        radarLegendEl.innerHTML = rows.map((r, i) => {
            const slot = A3_SLOT_COLORS[i];
            const p = r.player;
            return '<div class="a3-lg-item" data-pid="' + escapeAttr(pidOf(p)) + '" style="--slot:' + slot.color + '">' +
                       '<span class="a3-lg-dot"></span>' +
                       '<span class="a3-lg-num">' + (i + 1) + '</span>' +
                       '<span class="a3-lg-name">' + p.name + '</span>' +
                       '<span class="a3-lg-comp">' + r.newComp.toFixed(1) + '</span>' +
                   '</div>';
        }).join("");
        radarLegendEl.querySelectorAll(".a3-lg-item").forEach(el => {
            el.addEventListener("mouseenter", () => setHovered(el.dataset.pid));
            el.addEventListener("mouseleave", () => setHovered(null));
            el.addEventListener("click", () => openPlayerModal(findPlayerByPid(el.dataset.pid)));
        });
    }

    function drawRadarGhost(pid) {
        if (!radarEl) return;
        const svg = radarEl.querySelector("svg");
        if (!svg) return;
        svg.querySelectorAll(".a3-sr-ghost, .a3-sr-ghost-dot").forEach(n => n.remove());
        if (!pid) return;
        if (radarTopRows.some(r => pidOf(r.player) === pid)) return;
        const all = computeNewComposites(activePos, weights);
        const me = all.find(r => pidOf(r.player) === pid);
        if (!me) return;
        const dims = a3DimsFor(activePos);
        const N = dims.length;
        const size = 420;
        const cx = size / 2;
        const cy = size / 2;
        const R = size / 2 - 58;
        const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;
        const pts = dims.map((d, i) => {
            const v = (me.player.subScores && me.player.subScores[d]) || 0;
            const r = R * Math.max(0, Math.min(100, v)) / 100;
            return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))].join(",");
        }).join(" ");
        const svgNS = "http://www.w3.org/2000/svg";
        const poly = document.createElementNS(svgNS, "polygon");
        poly.setAttribute("points", pts);
        poly.setAttribute("class", "a3-sr-ghost is-hi");
        svg.appendChild(poly);
        dims.forEach((d, i) => {
            const v = (me.player.subScores && me.player.subScores[d]) || 0;
            const r = R * Math.max(0, Math.min(100, v)) / 100;
            const x = cx + r * Math.cos(angle(i));
            const y = cy + r * Math.sin(angle(i));
            const dot = document.createElementNS(svgNS, "circle");
            dot.setAttribute("cx", x.toFixed(1));
            dot.setAttribute("cy", y.toFixed(1));
            dot.setAttribute("r", 3.5);
            dot.setAttribute("class", "a3-sr-ghost-dot is-hi");
            svg.appendChild(dot);
        });
    }

    function syncRadarHover(pid) {
        if (!radarEl) return;
        radarEl.querySelectorAll(".a3-sr-poly").forEach(el => {
            const match = pid && el.dataset.pid === pid;
            el.classList.toggle("is-hi", !!match);
            el.classList.toggle("is-dim", pid && !match);
        });
        radarEl.querySelectorAll(".a3-sr-dot").forEach(el => {
            const match = pid && el.dataset.pid === pid;
            el.classList.toggle("is-hi", !!match);
            el.classList.toggle("is-dim", pid && !match);
        });
        drawRadarGhost(pid);
        const tt = document.getElementById("a3-radar-tt");
        if (!tt) return;
        let rowIdx = pid ? radarTopRows.findIndex(r => pidOf(r.player) === pid) : -1;
        let me = rowIdx >= 0 ? radarTopRows[rowIdx] : null;
        if (!me && pid) {
            const all = computeNewComposites(activePos, weights);
            me = all.find(r => pidOf(r.player) === pid) || null;
        }
        if (!me) {
            tt.classList.remove("show");
            tt.innerHTML = '<div class="a3-rtt-empty">Hover a name<br>for the breakdown</div>';
            return;
        }
        const color = rowIdx >= 0 ? A3_SLOT_COLORS[rowIdx].color : "#d4af37";
        const dims = a3DimsFor(activePos);
        const others = radarTopRows.filter((_, i) => i !== rowIdx);
        let rows = "";
        dims.forEach(d => {
            const mine = (me.player.subScores && me.player.subScores[d]) || 0;
            const peerAvg = others.length
                ? others.reduce((s, r) => s + ((r.player.subScores && r.player.subScores[d]) || 0), 0) / others.length
                : mine;
            const delta = mine - peerAvg;
            const deltaCls = delta > 6 ? "up" : delta < -6 ? "down" : "flat";
            const deltaStr = (delta >= 0 ? "+" : "") + delta.toFixed(0);
            rows += '<div class="a3-rtt-row">' +
                        '<span class="a3-rtt-l">' + a3DimLabel(activePos, d) + '</span>' +
                        '<div class="a3-rtt-bar"><span class="a3-rtt-fill" style="width:' +
                            Math.max(2, Math.min(100, mine)).toFixed(0) + '%; background:' + color + '"></span></div>' +
                        '<span class="a3-rtt-v">' + mine.toFixed(0) + '</span>' +
                        '<span class="a3-rtt-d ' + deltaCls + '">' + deltaStr + '</span>' +
                    '</div>';
        });
        tt.innerHTML =
            '<div class="a3-rtt-head" style="--slot:' + color + '">' +
                '<span class="a3-rtt-dot"></span>' +
                '<span class="a3-rtt-name">' + me.player.name + '</span>' +
                '<span class="a3-rtt-sub">vs others</span>' +
            '</div>' + rows;
        tt.classList.add("show");
    }

    const impactBody = document.getElementById("a3-impact-body");
    const impactSwitch = document.getElementById("a3-impact-switch");
    impactSwitch?.querySelectorAll(".a3-sw").forEach(btn => {
        btn.addEventListener("click", () => {
            impactView = btn.dataset.view;
            impactSwitch.querySelectorAll(".a3-sw").forEach(b => b.classList.toggle("active", b === btn));
            renderImpact();
        });
    });

    const IMPACT_TIPS = {
        rank:    "Sliders rebuild the top 10 in place. Arrows show each player's move from the EA ranking.",
        scatter: "Above the dashed line: under-rated by EA. Below: over-rated. Dot size is cosmetic; hover for details.",
        bump:    "Each line connects a player's EA rank to their rank under your weights. Hover a line for the name.",
        gap:     "Positive bars = under-rated by EA under your weights. Negative = over-rated."
    };

    function renderTip() {
        const el = document.getElementById("a3-tip");
        if (el) el.textContent = IMPACT_TIPS[impactView] || "";
    }

    function renderImpact() {
        if (!impactBody) return;
        const rows = computeNewComposites(activePos, weights);
        if (!rows.length) {
            impactBody.innerHTML = '<p class="a3-card-sub">No players for this position.</p>';
            renderTip();
            return;
        }
        renderTip();
        if (impactView === "rank")    return renderImpactRank(rows);
        if (impactView === "scatter") return renderImpactScatter(rows);
        if (impactView === "bump")    return renderImpactBump(rows);
        if (impactView === "gap")     return renderImpactGap(rows);
    }

    function renderImpactRank(rows) {
        const ovrTarg = OVR_STATS[activePos] || { mean: 75, std: 5 };
        const ovrMin = ovrTarg.mean - 2.5 * ovrTarg.std;
        const ovrMax = ovrTarg.mean + 2.5 * ovrTarg.std;
        const sorted = rows.slice().sort((a, b) => b.newComp - a.newComp);
        const top = sorted.slice(0, 10);
        const byOvr = rows.slice().sort((a, b) => b.player.ea.ovr - a.player.ea.ovr);
        const ovrRank = new Map(byOvr.map((r, i) => [r.player, i + 1]));
        const cMax = Math.max(...rows.map(r => r.newComp));
        const cMin = Math.min(...rows.map(r => r.newComp));
        const cRange = Math.max(1, cMax - cMin);

        const oldRects = new Map();
        impactBody.querySelectorAll(".a3-row[data-pid]").forEach(r => {
            oldRects.set(r.dataset.pid, r.getBoundingClientRect());
        });

        let html = "";
        top.forEach((r, i) => {
            const p = r.player;
            const newRank = i + 1;
            const oldRank = ovrRank.get(p) || newRank;
            const delta = oldRank - newRank;
            const arrow = delta > 0 ? "&#9650;" : delta < 0 ? "&#9660;" : "&middot;";
            const moveClass = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
            const fillPct = ((r.newComp - cMin) / cRange) * 100;
            const ovrPct = Math.min(100, Math.max(0, ((p.ea.ovr - ovrMin) / (ovrMax - ovrMin)) * 100));
            const topClass = i < 3 ? " is-top" + (i + 1) : "";
            html +=
                '<div class="a3-row' + topClass + '" data-pid="' + escapeAttr(pidOf(p)) + '">' +
                    '<span class="a3-rank">' + newRank + '</span>' +
                    '<div class="a3-player-cell">' +
                        avatarHTMLString(p.photo, p.name, "a3-avatar-img", "a3-avatar") +
                        '<div class="a3-player-info">' +
                            '<div class="a3-player-name">' + p.name + '</div>' +
                            '<div class="a3-player-club">' + (p.club || "") + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="a3-bar-wrap">' +
                        '<div class="a3-bar-track"><div class="a3-bar-fill" style="width:' + fillPct.toFixed(1) + '%"></div></div>' +
                        '<div class="a3-bar-ea" style="left:' + ovrPct.toFixed(1) + '%"></div>' +
                        '<span class="a3-bar-val">' + r.newComp.toFixed(1) + '</span>' +
                    '</div>' +
                    '<span class="a3-move ' + moveClass + '">' +
                        arrow + (delta === 0 ? '' : ' ' + Math.abs(delta)) +
                    '</span>' +
                '</div>';
        });
        impactBody.innerHTML = html;

        impactBody.querySelectorAll(".a3-row[data-pid]").forEach(r => {
            r.style.cursor = "pointer";
            r.addEventListener("click", () => openPlayerModal(findPlayerByPid(r.dataset.pid)));
            r.addEventListener("mouseenter", () => setHovered(r.dataset.pid));
            r.addEventListener("mouseleave", () => setHovered(null));
        });

        const topPid = top[0] ? pidOf(top[0].player) : null;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduce && lastTopPid && lastTopPid !== topPid) {
            const firstRow = impactBody.querySelector(".a3-row[data-pid]");
            if (firstRow) {
                firstRow.classList.add("a3-flash");
                setTimeout(() => firstRow.classList.remove("a3-flash"), 1000);
            }
        }
        lastTopPid = topPid;

        if (reduce) return;
        impactBody.querySelectorAll(".a3-row[data-pid]").forEach(r => {
            const old = oldRects.get(r.dataset.pid);
            if (!old) return;
            const now = r.getBoundingClientRect();
            const dy = old.top - now.top;
            if (!dy) return;
            r.style.transform = "translateY(" + dy + "px)";
            r.style.transition = "transform 0s";
            requestAnimationFrame(() => {
                r.style.transition = "transform 0.45s cubic-bezier(.5,.15,.2,1)";
                r.style.transform = "";
            });
        });
    }

    function renderImpactGap(rows) {
        const sorted = rows.slice().sort((a, b) => Math.abs(b.newGap) - Math.abs(a.newGap));
        const top = sorted.slice(0, 12);
        const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.newGap)));
        let html = "";
        top.forEach((r) => {
            const p = r.player;
            const g = r.newGap;
            const pct = (Math.abs(g) / maxAbs) * 46;
            const isUnder = g > 0;
            const color = isUnder ? "var(--green)" : "var(--red)";
            const left = isUnder ? "50%" : "calc(50% - " + pct + "%)";
            const arrow = isUnder ? "&#9650;" : "&#9660;";
            const moveClass = isUnder ? "up" : "down";
            html +=
                '<div class="a3-row gap-view" data-pid="' + escapeAttr(pidOf(p)) + '">' +
                    '<span class="a3-rank">' + (isUnder ? "+" : "-") + '</span>' +
                    '<div class="a3-player-cell">' +
                        avatarHTMLString(p.photo, p.name, "a3-avatar-img", "a3-avatar") +
                        '<div class="a3-player-info">' +
                            '<div class="a3-player-name">' + p.name + '</div>' +
                            '<div class="a3-player-club">OVR ' + p.ea.ovr + ' &middot; ' + (p.club || "") + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="a3-bar-wrap">' +
                        '<div class="a3-bar-track"></div>' +
                        '<div class="a3-bar-center"></div>' +
                        '<div class="a3-bar-gap" style="left:' + left + '; width:' + pct + '%; background:' + color + '"></div>' +
                    '</div>' +
                    '<span class="a3-move ' + moveClass + '">' + arrow + ' ' + formatGap(g) + '</span>' +
                '</div>';
        });
        impactBody.innerHTML = html;

        impactBody.querySelectorAll(".a3-row[data-pid]").forEach(r => {
            r.style.cursor = "pointer";
            r.addEventListener("click", () => openPlayerModal(findPlayerByPid(r.dataset.pid)));
            r.addEventListener("mouseenter", () => setHovered(r.dataset.pid));
            r.addEventListener("mouseleave", () => setHovered(null));
        });
    }

    function renderImpactScatter(rows) {
        impactBody.innerHTML = '<div class="a3-scatter" id="a3-scatter-inner"></div><div class="a3-scatter-tt" id="a3-scatter-tt"></div>';
        const host = document.getElementById("a3-scatter-inner");
        const tt = document.getElementById("a3-scatter-tt");
        const W = host.clientWidth, H = host.clientHeight;
        const m = { t: 14, r: 16, b: 34, l: 40 };
        const w = W - m.l - m.r, h = H - m.t - m.b;

        const xs = rows.map(r => r.player.ea.ovr);
        const ys = rows.map(r => r.newComp);
        const x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([0, w]);
        const y = d3.scaleLinear().domain(d3.extent(ys)).nice().range([h, 0]);

        const svg = d3.select(host).append("svg")
            .attr("width", W).attr("height", H);
        const g = svg.append("g").attr("transform", "translate(" + m.l + "," + m.t + ")");

        g.append("g").attr("class", "a3-scatter-axis").attr("transform", "translate(0," + h + ")")
            .call(d3.axisBottom(x).ticks(5));
        g.append("g").attr("class", "a3-scatter-axis")
            .call(d3.axisLeft(y).ticks(5));

        const linReg = pts => {
            const n = pts.length;
            let sx = 0, sy = 0, sxy = 0, sx2 = 0;
            for (const [a, b] of pts) { sx += a; sy += b; sxy += a * b; sx2 += a * a; }
            const denom = n * sx2 - sx * sx;
            if (!denom) return null;
            const mm = (n * sxy - sx * sy) / denom;
            return { m: mm, b: (sy - mm * sx) / n };
        };
        const lr = linReg(rows.map(r => [r.player.ea.ovr, r.newComp]));
        if (lr) {
            const xMin = x.domain()[0], xMax = x.domain()[1];
            g.append("line").attr("class", "a3-scatter-trend")
                .attr("x1", x(xMin)).attr("y1", y(lr.m * xMin + lr.b))
                .attr("x2", x(xMax)).attr("y2", y(lr.m * xMax + lr.b));
        }

        g.selectAll(".a3-scatter-dot").data(rows).enter().append("circle")
            .attr("class", "a3-scatter-dot")
            .attr("cx", r => x(r.player.ea.ovr))
            .attr("cy", r => y(r.newComp))
            .attr("r", 4)
            .attr("fill", r => r.newGap > 1 ? "var(--green)" : r.newGap < -1 ? "var(--red)" : "rgba(233,228,212,0.55)")
            .attr("data-pid", r => pidOf(r.player))
            .on("mouseenter", function (e, r) {
                setHovered(pidOf(r.player));
                tt.innerHTML = '<div class="a3-scatter-tt-name">' + r.player.name + '</div>' +
                               '<div class="a3-scatter-tt-meta">' + (r.player.club || "") + ' &middot; OVR ' + r.player.ea.ovr +
                               ' &middot; composite ' + r.newComp.toFixed(1) + ' &middot; gap ' + formatGap(r.newGap) + '</div>';
                tt.style.display = "block";
                const rect = host.getBoundingClientRect();
                tt.style.left = (e.clientX - rect.left + 14) + "px";
                tt.style.top  = (e.clientY - rect.top  + 14) + "px";
            })
            .on("mousemove", function (e) {
                const rect = host.getBoundingClientRect();
                tt.style.left = (e.clientX - rect.left + 14) + "px";
                tt.style.top  = (e.clientY - rect.top  + 14) + "px";
            })
            .on("mouseleave", function () { setHovered(null); tt.style.display = "none"; })
            .on("click", function (e, r) { openPlayerModal(r.player); });
    }

    function renderImpactBump(rows) {
        impactBody.innerHTML = '<svg class="a3-bump" id="a3-bump-svg"></svg>';
        const host = document.getElementById("a3-bump-svg");
        const W = impactBody.clientWidth, H = impactBody.clientHeight;
        host.setAttribute("viewBox", "0 0 " + W + " " + H);

        const byOvr = rows.slice().sort((a, b) => b.player.ea.ovr - a.player.ea.ovr);
        const byComp = rows.slice().sort((a, b) => b.newComp - a.newComp);
        const eaRank = new Map(byOvr.map((r, i) => [r.player, i + 1]));
        const coRank = new Map(byComp.map((r, i) => [r.player, i + 1]));

        const N = 10;
        const items = byComp.slice(0, N).map(r => ({
            p: r.player,
            rA: Math.min(N + 1, eaRank.get(r.player) || (N + 1)),
            rB: coRank.get(r.player) || (N + 1)
        }));

        const m = { t: 40, r: 20, b: 20, l: 20 };
        const xL = m.l, xR = W - m.r;
        const yRank = r => m.t + (r - 1) * (H - m.t - m.b) / N;

        const svg = d3.select(host);
        svg.selectAll("*").remove();

        for (let i = 1; i <= N; i++) {
            svg.append("line")
                .attr("x1", xL).attr("x2", xR)
                .attr("y1", yRank(i)).attr("y2", yRank(i))
                .attr("class", "a3-bump-guide");
        }

        svg.append("text").attr("x", xL).attr("y", m.t - 18)
            .attr("class", "a3-bump-head").text("EA rank");
        svg.append("text").attr("x", xR).attr("y", m.t - 18)
            .attr("class", "a3-bump-head").attr("text-anchor", "end").text("Your rank");
        svg.append("text").attr("x", (xL + xR) / 2).attr("y", m.t - 18)
            .attr("class", "a3-bump-head").attr("text-anchor", "middle")
            .attr("fill", "rgba(233,228,212,0.45)")
            .text("\u2192");

        // gold at rank 1 fading to red at rank 10
        const colorFor = i => {
            const t = (i - 1) / Math.max(1, N - 1);
            const r = Math.round(212 + (231 - 212) * t);
            const g = Math.round(175 + (76 - 175) * t);
            const b = Math.round(55  + (60 - 55)  * t);
            return "rgb(" + r + "," + g + "," + b + ")";
        };

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const truncate = (s, max) => s && s.length > max ? s.slice(0, max - 1) + "\u2026" : s;

        const labelG = svg.append("g").attr("class", "a3-bump-hover-label").style("display", "none");
        const labelText = labelG.append("text").attr("class", "a3-bump-name");

        items.forEach((it, idx) => {
            const { p, rA, rB } = it;
            const yA = yRank(rA), yB = yRank(rB);
            const color = colorFor(idx + 1);
            const d = "M" + xL + " " + yA +
                      " C " + (xL + (xR - xL) / 2) + " " + yA + ", " +
                              (xL + (xR - xL) / 2) + " " + yB + ", " +
                              xR + " " + yB;
            const path = svg.append("path")
                .attr("d", d)
                .attr("class", "a3-bump-line")
                .attr("stroke", color)
                .attr("data-pid", pidOf(p));

            if (!reduce) {
                const node = path.node();
                const len = node.getTotalLength();
                path.attr("stroke-dasharray", len + " " + len)
                    .attr("stroke-dashoffset", len)
                    .transition()
                    .delay(idx * 55)
                    .duration(620)
                    .ease(d3.easeCubicOut)
                    .attr("stroke-dashoffset", 0)
                    .on("end", function () { path.attr("stroke-dasharray", null); });
            }

            path.on("mouseenter", function () {
                    setHovered(pidOf(p));
                    labelText
                        .attr("x", xR - 6)
                        .attr("y", yB - 8)
                        .attr("text-anchor", "end")
                        .attr("fill", color)
                        .text(truncate(p.name, 22));
                    labelG.style("display", null);
                })
                .on("mouseleave", function () {
                    setHovered(null);
                    labelG.style("display", "none");
                })
                .on("click", function () { openPlayerModal(p); });
        });
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        if (scenes[3]?.hidden !== false) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (impactView === "bump") renderImpact();
            renderRadar();
        }, 180);
    });

    document.addEventListener("keydown", e => {
        if (scenes[1]?.hidden !== false) return;
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
        const active = A3_SLOTS.find(s => s.sub === activePos);
        if (!active) return;
        let best = null, bestD = Infinity;
        A3_SLOTS.forEach(s => {
            if (s.sub === activePos) return;
            const dx = s.x - active.x, dy = s.y - active.y;
            let ok = false;
            if (e.key === "ArrowUp")    ok = dy < -2;
            else if (e.key === "ArrowDown")  ok = dy > 2;
            else if (e.key === "ArrowLeft")  ok = dx < -2;
            else if (e.key === "ArrowRight") ok = dx > 2;
            else return;
            const d = dx * dx + dy * dy;
            if (ok && d < bestD) { best = s; bestD = d; }
        });
        if (best) { e.preventDefault(); selectPos(best.sub); }
    });

    const quiz2Body = document.getElementById("a3-quiz2-body");
    const quiz2Progress = document.getElementById("a3-quiz2-progress");
    let quiz2State = null;
    let quiz2Dirty = false;

    // recurate only if the user hasn't started the quiz
    function refreshQuiz2IfDirty() {
        if (!quiz2Dirty) return;
        if (quiz2State && quiz2State.idx > 0) return;
        quiz2Dirty = false;
        startQuiz2();
    }

    const quiz2Section = document.getElementById("act3-part2");
    if (quiz2Section && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) refreshQuiz2IfDirty(); });
        }, { threshold: 0.2 });
        io.observe(quiz2Section);
    }

    function curateQuizPlayers() {
        const pool = data.filter(p =>
            p.subPos === activePos &&
            p.subScores && p.ea?.ovr != null && p.photo &&
            (p.minutes || 0) >= 1200 && p.ea.ovr >= 75
        );
        if (!pool.length) return [];

        const rows = computeNewComposites(activePos, weights);
        const rowFor = new Map(rows.map(r => [r.player, r]));
        const withGap = pool
            .map(p => ({ p, baseGap: rowFor.get(p)?.newGap }))
            .filter(x => x.baseGap != null);
        if (withGap.length < 4) return withGap.slice(0, 6).map(x => x.p);

        const byGap = withGap.slice().sort((a, b) => a.baseGap - b.baseGap);
        const under = byGap.slice(-6).reverse();
        const over  = byGap.slice(0, 6);
        const fair  = byGap.slice()
            .sort((a, b) => Math.abs(a.baseGap) - Math.abs(b.baseGap))
            .slice(0, 6);

        const out = [];
        function push(x) {
            if (!x) return;
            if (out.find(y => y.p === x.p)) return;
            out.push(x);
        }
        for (let i = 0; i < under.length && out.length < 2; i++) push(under[i]);
        for (let i = 0; i < over.length  && out.length < 4; i++) push(over[i]);
        for (let i = 0; i < fair.length  && out.length < 6; i++) push(fair[i]);

        return out.slice(0, 6).map(x => x.p);
    }

    function startQuiz2() {
        if (!quiz2Body) return;
        if (quiz2Progress) quiz2Progress.innerHTML = "";
        const picks = curateQuizPlayers();
        if (!picks.length) {
            renderQuiz2Empty();
            return;
        }
        const order = picks.slice();
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        quiz2State = { idx: 0, score: 0, picks: order, results: [] };
        renderQuiz2Card();
    }

    function renderQuiz2Empty() {
        if (!quiz2Body) return;
        quiz2State = null;
        const hasPos = !!activePos;
        const headline = hasPos
            ? "Tune the weights first."
            : "Pick a position first.";
        const sub = hasPos
            ? "The quiz scores six players against your composite. Slide the dimensions in step 3 to bring them to life."
            : "Choose a role on the pitch, then tune the weights. The quiz uses your rebuilt rating to decide who's overrated or underrated.";
        const cta = hasPos ? "Go to the sliders" : "Pick a position";
        quiz2Body.innerHTML =
            '<div class="a3-q2-empty">' +
                '<div class="a3-q2-empty-mark" aria-hidden="true">' +
                    '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
                        '<path d="M8 36V14a2 2 0 0 1 2-2h28a2 2 0 0 1 2 2v22"/>' +
                        '<path d="M14 22h20M14 28h14"/>' +
                        '<circle cx="24" cy="40" r="2.4"/>' +
                    '</svg>' +
                '</div>' +
                '<h4 class="a3-q2-empty-title">' + headline + '</h4>' +
                '<p class="a3-q2-empty-sub">' + sub + '</p>' +
                '<button class="a3-btn a3-btn-primary a3-q2-empty-cta" type="button">' + cta + ' &rsaquo;</button>' +
            '</div>';
        const btn = quiz2Body.querySelector(".a3-q2-empty-cta");
        if (btn) {
            btn.addEventListener("click", () => {
                const target = hasPos
                    ? document.getElementById("a3-scene-3") || document.getElementById("act3")
                    : document.getElementById("a3-scene-1") || document.getElementById("act3");
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    function renderQuiz2Progress() {
        if (!quiz2Progress || !quiz2State) return;
        const n = quiz2State.picks.length;
        let h = '<span class="a3-q2-score">' + quiz2State.score + ' / ' + Math.min(quiz2State.idx, n) + '</span>';
        h += '<div class="a3-q2-bars">';
        for (let i = 0; i < n; i++) {
            const result = quiz2State.results[i];
            const cls = result == null
                ? (i === quiz2State.idx ? "now" : "pending")
                : (result ? "ok" : "ko");
            h += '<span class="a3-q2-bar ' + cls + '"></span>';
        }
        h += '</div>';
        quiz2Progress.innerHTML = h;
    }

    function truthForPlayer(p) {
        const rows = computeNewComposites(p.subPos, weights);
        const row = rows.find(r => r.player === p);
        if (!row) return null;
        return { newComp: row.newComp, newGap: row.newGap, truth: row.newGap >= 0 ? "under" : "over" };
    }

    function renderQuiz2Card() {
        if (!quiz2State) return;
        const st = quiz2State;
        if (st.idx >= st.picks.length) return renderQuiz2Summary();
        const p = st.picks[st.idx];

        renderQuiz2Progress();

        const posLabel = (SUBPOS_LABELS[p.subPos] || p.subPos).toLowerCase().replace(/s$/, "");
        quiz2Body.innerHTML =
            '<div class="a3-q2-card" data-name="' + escapeAttr(p.name) + '">' +
                '<div class="a3-q2-shot">' +
                    (p.photo
                        ? '<img src="' + escapeAttr(p.photo) + '" alt="' + escapeAttr(p.name) + '">'
                        : '<div class="a3-avatar-big a3-avatar" aria-label="' + escapeAttr(p.name) + '">' + initials(p.name) + '</div>') +
                    '<span class="a3-q2-ovr-chip"><span class="a3-q2-ovr-l">OVR</span><span class="a3-q2-ovr-v">' +
                        (p.ea?.ovr ?? "-") + '</span></span>' +
                '</div>' +
                '<div class="a3-q2-body">' +
                    '<div class="a3-q2-pos">' + posLabel + '</div>' +
                    '<div class="a3-q2-name">' + p.name + '</div>' +
                    '<div class="a3-q2-meta">' + (p.club || "") + ' &middot; ' + (p.league || "") + '</div>' +
                    '<div class="a3-q2-ask">By <em>your</em> weights, is he...</div>' +
                    '<div class="a3-q2-choices">' +
                        '<button class="a3-q2-btn is-over" data-guess="over">' +
                            '<span class="a3-q2-btn-ico">&#9660;</span>' +
                            '<span class="a3-q2-btn-l">Overrated</span>' +
                        '</button>' +
                        '<button class="a3-q2-btn is-under" data-guess="under">' +
                            '<span class="a3-q2-btn-ico">&#9650;</span>' +
                            '<span class="a3-q2-btn-l">Underrated</span>' +
                        '</button>' +
                    '</div>' +
                    '<div class="a3-q2-reveal" id="a3-q2-reveal"></div>' +
                '</div>' +
            '</div>';

        quiz2Body.querySelectorAll("[data-guess]").forEach(btn => {
            btn.addEventListener("click", () => revealQuiz2(btn.dataset.guess));
        });
    }

    function revealQuiz2(guess) {
        const st = quiz2State;
        const p = st.picks[st.idx];
        const t = truthForPlayer(p);
        if (!t) { st.idx++; renderQuiz2Card(); return; }

        const ok = guess === t.truth;
        if (ok) st.score++;
        st.results[st.idx] = ok;

        const card = quiz2Body.querySelector(".a3-q2-card");
        if (card) card.classList.add(ok ? "is-correct" : "is-wrong");
        quiz2Body.querySelectorAll(".a3-q2-btn").forEach(b => {
            b.disabled = true;
            if (b.dataset.guess === t.truth) b.classList.add("is-truth");
            else if (b.dataset.guess === guess) b.classList.add("is-miss");
        });

        const reveal = document.getElementById("a3-q2-reveal");
        if (reveal) {
            const line = ok
                ? "You nailed it."
                : "You disagreed with your own weights.";
            const verdict = t.truth === "under"
                ? '<span class="a3-q2-verdict is-under">Underrated</span> by your criteria'
                : '<span class="a3-q2-verdict is-over">Overrated</span> by your criteria';
            reveal.innerHTML =
                '<div class="a3-q2-line">' + line + '</div>' +
                '<div class="a3-q2-detail">' + verdict +
                    ' &middot; your composite <b>' + t.newComp.toFixed(1) + '</b>' +
                    ' &middot; gap <b>' + formatGap(t.newGap) + '</b></div>' +
                '<button class="a3-btn a3-btn-primary a3-q2-next" id="a3-q2-next">' +
                    (st.idx + 1 < st.picks.length ? "Next &rsaquo;" : "See the verdict &rsaquo;") +
                '</button>';
            reveal.classList.add("show");
            document.getElementById("a3-q2-next")?.addEventListener("click", () => {
                st.idx++;
                renderQuiz2Progress();
                renderQuiz2Card();
            });
        }
        renderQuiz2Progress();
    }

    function renderQuiz2Summary() {
        const st = quiz2State;
        const pct = Math.round((st.score / st.picks.length) * 100);
        let verdict, take;
        if (pct >= 83)      { verdict = "Sharp taste."; take = "Your weights describe exactly how you watch football."; }
        else if (pct >= 50) { verdict = "Mostly coherent."; take = "Your instincts line up with the numbers you wrote."; }
        else                { verdict = "A little surprising."; take = "Even your own weights can't fully predict how you feel about a name."; }

        quiz2Body.innerHTML =
            '<div class="a3-q2-summary">' +
                '<span class="a3-q2-sum-kicker">You are done</span>' +
                '<div class="a3-q2-score-big">' + st.score + '<span class="a3-q2-score-of">/</span>' + st.picks.length + '</div>' +
                '<div class="a3-q2-score-pct">' + pct + '% agreement with your own criteria</div>' +
                '<div class="a3-q2-verdict-line">' + verdict + '</div>' +
                '<p class="a3-q2-take">' + take + '</p>' +
                '<button class="a3-link a3-q2-retune" data-goto="3">&lsaquo; retune the weights</button>' +
                '<div class="a3-q2-scroll-hint">' +
                    '<span class="a3-q2-scroll-l">Keep scrolling for the full picture</span>' +
                    '<svg class="a3-q2-scroll-arrow" width="24" height="34" viewBox="0 0 24 34" fill="none">' +
                        '<line x1="12" y1="2" x2="12" y2="26" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
                        '<path d="M5 20l7 7 7-7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
                    '</svg>' +
                '</div>' +
            '</div>';
        quiz2Body.querySelectorAll("[data-goto]").forEach(btn => {
            btn.addEventListener("click", () => showScene(+btn.dataset.goto));
        });
        renderQuiz2Progress();
    }

    renderLineup();
    selectPos(activePos);
    showScene(1);
    startQuiz2();
}
