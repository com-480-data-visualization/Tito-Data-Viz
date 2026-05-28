function initConclusion(data) {
    if (!data?.length) return;
    const section = document.getElementById("conclusion");
    if (!section) return;

    const gridEl = document.getElementById("conc-grid");
    const ledeEl = document.getElementById("conc-lede");
    const insightEl = document.getElementById("conc-insight");
    const h1 = section.querySelector(".conc-headline");

    const DIM_LABELS = {
        scoring: "goals", creation: "creation", progression: "progression",
        defense: "defensive work", discipline: "composure"
    };
    const DIM_LABELS_GK = {
        scoring: "shot-stopping", creation: "distribution",
        progression: "long distribution", defense: "sweeping", discipline: "composure"
    };

    function pidOf(p) { return p.name + "|" + (p.club || ""); }
    function dimsForPos(sub) {
        return typeof a3DimsFor === "function" ? a3DimsFor(sub)
            : ["scoring", "creation", "progression", "defense", "discipline"];
    }

    let rendered = false;

    function splitHeadline() {
        if (!h1 || h1.dataset.split === "1") return;
        const parts = h1.querySelectorAll("span");
        parts.forEach(part => {
            const text = part.textContent;
            part.textContent = "";
            text.split("").forEach((ch, i) => {
                const s = document.createElement("span");
                s.className = "conc-letter";
                s.textContent = ch === " " ? " " : ch;
                s.style.transitionDelay = (i * 28) + "ms";
                part.appendChild(s);
            });
        });
        h1.dataset.split = "1";
    }

    function revealHeadline() {
        if (!h1) return;
        h1.classList.add("revealed");
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
    const OURS = {};
    for (const p of data) {
        if (p.subPos && !OURS[p.subPos] && p.dimWeights) OURS[p.subPos] = { ...p.dimWeights };
    }
    function normalizeWeights(w, dims) {
        let s = 0;
        for (const d of dims) s += Math.max(0, w[d] || 0);
        if (s === 0) return Object.fromEntries(dims.map(d => [d, 1 / dims.length]));
        const out = {};
        for (const d of dims) out[d] = Math.max(0, w[d] || 0) / s;
        return out;
    }
    function rawScore(player, w, dims) {
        const s = player.subScores || {};
        let total = 0;
        for (const d of dims) total += (w[d] || 0) * (s[d] || 0);
        return total;
    }
    function fallbackCompute(sub, w) {
        const players = data.filter(p => p.subPos === sub && p.ea?.ovr != null && p.subScores);
        if (!players.length) return [];
        const dims = dimsForPos(sub);
        const raws = players.map(p => rawScore(p, w, dims));
        const mean = raws.reduce((a, b) => a + b, 0) / raws.length;
        const variance = raws.reduce((s, v) => s + (v - mean) ** 2, 0) / raws.length;
        const std = Math.sqrt(variance) || 1;
        const targ = OVR_STATS[sub] || { mean: 75, std: 5 };
        const rescaled = raws.map(r => ((r - mean) / std) * targ.std + targ.mean);
        return players.map((p, i) => ({ player: p, newComp: rescaled[i] }));
    }

    function currentState() {
        const st = typeof window._act3_getState === "function" ? window._act3_getState() : null;
        const fallbackPos = "ST";
        if (st && st.pos) {
            return {
                hasRebuild: true,
                pos: st.pos,
                weights: st.weights || normalizeWeights(OURS[st.pos] || {}, dimsForPos(st.pos)),
                computeNewComposites: st.computeNewComposites || fallbackCompute,
                quiz2: st.quiz2
            };
        }
        return {
            hasRebuild: false,
            pos: fallbackPos,
            weights: normalizeWeights(OURS[fallbackPos] || {}, dimsForPos(fallbackPos)),
            computeNewComposites: fallbackCompute
        };
    }

    function getTop5(pos, weights, computeFn) {
        const rows = computeFn(pos, weights);
        const byUser = rows.slice().sort((a, b) => b.newComp - a.newComp).slice(0, 5);
        const byEa   = rows.slice().filter(r => r.player.ea?.ovr != null)
                            .sort((a, b) => b.player.ea.ovr - a.player.ea.ovr).slice(0, 5);
        return { byEa, byUser };
    }

    function playerRow(p, rank, scoreLabel, score, isShared, slotClass) {
        const name = p.name;
        const club = p.club || "";
        const avatar = avatarHTMLString(p.photo, p.name, "conc-row-img", "conc-row-fallback");
        return '<div class="conc-row ' + slotClass + (isShared ? ' is-shared' : '') + '" data-pid="' + escapeAttr(pidOf(p)) + '">' +
                   '<span class="conc-row-rank">' + rank + '</span>' +
                   '<div class="conc-row-avatar">' + avatar + '</div>' +
                   '<div class="conc-row-text">' +
                       '<div class="conc-row-name">' + escapeAttr(name) + '</div>' +
                       '<div class="conc-row-club">' + escapeAttr(club) + '</div>' +
                   '</div>' +
                   '<div class="conc-row-score"><span class="conc-row-score-v">' + score + '</span>' +
                       '<span class="conc-row-score-l">' + scoreLabel + '</span></div>' +
               '</div>';
    }

    function render() {
        if (!gridEl) return;
        const state = currentState();
        const { pos, weights, computeNewComposites, hasRebuild } = state;
        const { byEa, byUser } = getTop5(pos, weights, computeNewComposites);
        const posLabel = (SUBPOS_LABELS[pos] || pos).toLowerCase();

        const eaPids = new Set(byEa.map(r => pidOf(r.player)));
        const userPids = new Set(byUser.map(r => pidOf(r.player)));
        const shared = hasRebuild ? new Set([...eaPids].filter(p => userPids.has(p))) : new Set();

        let html = '';
        html += '<div class="conc-col conc-col-ea">';
        html += '<div class="conc-col-head">';
        html += '<span class="conc-col-badge ea-badge">EA FC 25</span>';
        html += '<span class="conc-col-sub">Top 5 ' + posLabel + '</span>';
        html += '</div>';
        html += '<div class="conc-list">';
        byEa.forEach((r, i) => {
            html += playerRow(r.player, i + 1, "OVR", r.player.ea.ovr, shared.has(pidOf(r.player)), "conc-row-ea");
        });
        html += '</div></div>';

        html += '<div class="conc-vs-wrap">';
        html += '<svg class="conc-wires" id="conc-wires" preserveAspectRatio="none"></svg>';
        html += '<span class="conc-vs">VS</span>';
        html += '</div>';

        if (hasRebuild) {
            html += '<div class="conc-col conc-col-you">';
            html += '<div class="conc-col-head">';
            html += '<span class="conc-col-badge you-badge">You</span>';
            html += '<span class="conc-col-sub">Your top 5 ' + posLabel + '</span>';
            html += '</div>';
            html += '<div class="conc-list">';
            byUser.forEach((r, i) => {
                html += playerRow(r.player, i + 1, "YOURS", r.newComp.toFixed(1), shared.has(pidOf(r.player)), "conc-row-you");
            });
            html += '</div></div>';
        } else {
            html += '<div class="conc-col conc-col-you conc-col-empty">';
            html += '<div class="conc-col-head">';
            html += '<span class="conc-col-badge you-badge">You</span>';
            html += '<span class="conc-col-sub">Not rebuilt yet</span>';
            html += '</div>';
            html += '<div class="conc-empty">';
            html += '<div class="conc-empty-mark" aria-hidden="true">';
            html += '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
            html += '<path d="M8 36V14a2 2 0 0 1 2-2h28a2 2 0 0 1 2 2v22"/>';
            html += '<path d="M14 22h20M14 28h14"/>';
            html += '<circle cx="24" cy="40" r="2.4"/>';
            html += '</svg></div>';
            html += '<h4 class="conc-empty-title">Your top 5 is empty.</h4>';
            html += '<p class="conc-empty-sub">Pick a position, tune the weights, and your own ranking will land here next to EA\'s.</p>';
            html += '<button class="conc-empty-cta" type="button" id="conc-empty-rebuild">Open the rebuild &rsaquo;</button>';
            html += '</div></div>';
        }

        gridEl.innerHTML = html;

        const emptyBtn = gridEl.querySelector("#conc-empty-rebuild");
        if (emptyBtn) {
            emptyBtn.addEventListener("click", () => {
                const target = document.getElementById("act2-to-act3-bridge")
                    || document.getElementById("act3");
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }

        if (ledeEl) {
            if (!hasRebuild) {
                ledeEl.textContent = "EA's lineup is on the left. The right side is yours to build.";
            } else {
                const same = shared.size;
                let line;
                if (same === 5)      line = "Your top five are EA's top five. You think the same way they do.";
                else if (same >= 3)  line = same + " of your five match EA. The other " + (5 - same) + " are your signature.";
                else if (same >= 1)  line = "Only " + same + " of five match EA. Your criteria draw a different team.";
                else                 line = "Zero overlap with EA. You see an entirely different game.";
                ledeEl.textContent = line;
            }
        }

        if (insightEl) {
            if (!hasRebuild) {
                insightEl.innerHTML =
                    '<div class="conc-insight-l">Nothing built yet</div>' +
                    '<p class="conc-insight-t">Open the rebuild to weigh the five dimensions yourself, then come back to see how your lineup stacks up against EA\'s.</p>';
            } else {
                const dims = dimsForPos(pos);
                const top = dims.slice().sort((a, b) => (weights[b] || 0) - (weights[a] || 0))[0];
                const labelMap = pos === "GK" ? DIM_LABELS_GK : DIM_LABELS;
                const topLabel = labelMap[top] || top;
                const topPct = Math.round((weights[top] || 0) * 100);
                const posName = SUBPOS_LABELS[pos] || pos;
                const same = shared.size;
                const diffLine = same >= 4
                    ? "mostly the same names EA picks, but weighted on <b>" + topLabel + "</b> ("  + topPct + "%)."
                    : same >= 2
                        ? "a new top five for " + posName.toLowerCase() + ", built around <b>" + topLabel + "</b> (" + topPct + "% of your weights)."
                        : "a lineup almost unrecognisable next to EA's, anchored on <b>" + topLabel + "</b> (" + topPct + "% of your weights).";
                insightEl.innerHTML =
                    '<div class="conc-insight-l">What you just built</div>' +
                    '<p class="conc-insight-t">You wrote ' + diffLine + '</p>';
            }
        }

        if (hasRebuild) drawWires(shared);
    }

    function drawWires(shared) {
        const wireSvg = document.getElementById("conc-wires");
        if (!wireSvg) return;
        const host = wireSvg.parentElement;
        const W = host.clientWidth;
        const H = host.clientHeight;
        wireSvg.setAttribute("viewBox", "0 0 " + W + " " + H);
        const hostRect = host.getBoundingClientRect();

        const eaRows  = section.querySelectorAll(".conc-row-ea");
        const youRows = section.querySelectorAll(".conc-row-you");
        const eaByPid = {};
        const youByPid = {};
        eaRows.forEach(r => { eaByPid[r.dataset.pid] = r; });
        youRows.forEach(r => { youByPid[r.dataset.pid] = r; });

        let paths = "";
        shared.forEach(pid => {
            const a = eaByPid[pid], b = youByPid[pid];
            if (!a || !b) return;
            const ar = a.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            const y1 = ar.top + ar.height / 2 - hostRect.top;
            const y2 = br.top + br.height / 2 - hostRect.top;
            const mx = W / 2;
            const delta = y1 - y2;
            const up = delta > 4;
            const down = delta < -4;
            const color = up ? "var(--green)" : down ? "var(--red)" : "rgba(255,255,255,0.35)";
            paths += '<path d="M 0 ' + y1 + ' C ' + mx + ' ' + y1 + ', ' + mx + ' ' + y2 + ', ' + W + ' ' + y2 +
                     '" stroke="' + color + '" stroke-width="1.6" fill="none" opacity="0.7"/>';
        });
        wireSvg.innerHTML = paths;
    }

    function onFirstView() {
        if (rendered) return;
        rendered = true;
        splitHeadline();
        render();
        revealHeadline();
    }

    function checkVisible() {
        if (rendered) return;
        const r = section.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.9 && r.bottom > window.innerHeight * 0.1) {
            onFirstView();
        }
    }

    if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) onFirstView();
            });
        }, { threshold: 0 });
        io.observe(section);
    }

    window.addEventListener("scroll", checkVisible, { passive: true });
    window.addEventListener("resize", checkVisible);
    window.addEventListener("load", checkVisible);
    checkVisible();
    setTimeout(checkVisible, 300);
    setTimeout(checkVisible, 1000);

    document.addEventListener("visibilitychange", () => { if (!document.hidden && rendered) render(); });
    window.addEventListener("hashchange", () => {
        if (location.hash === "#conclusion") {
            if (!rendered) onFirstView();
            else render();
        }
    });
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        if (!rendered) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(render, 180);
    });
}
