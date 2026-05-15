function buildPercentileCache(data) {
    const cache = {};
    const positions = ["ST", "WG", "AM", "CM", "DM", "FB", "CB", "GK"];
    const allKeys = Object.values(REAL_GROUPS).flat();

    for (const pos of positions) {
        cache[pos] = {};
        const players = data.filter(p => p.subPos === pos);
        for (const key of allKeys) {
            cache[pos][key] = players
                .map(p => p.real && p.real[key])
                .filter(v => v != null && !isNaN(v))
                .sort(numSort);
        }

        cache[pos]._composite = players
            .map(p => p.composite)
            .filter(v => v != null && !isNaN(v))
            .sort(numSort);
    }
    return cache;
}

function computePercentile(sorted, value) {
    if (!sorted || !sorted.length || value == null || isNaN(value)) return null;
    let count = 0;
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] < value) count++;
        else break;
    }
    return Math.round((count / sorted.length) * 100);
}

function pctColorClass(pct) {
    if (pct == null) return "";
    if (pct > 75) return "pct-green";
    if (pct >= 25) return "pct-yellow";
    return "pct-red";
}

function formatTmFoot(val) {
    if (!val) return null;
    const foot = String(val).trim();
    if (!foot) return null;
    return foot.charAt(0).toUpperCase() + foot.slice(1) + " foot";
}

function formatTmHeight(val) {
    if (val == null || isNaN(val)) return null;
    return Math.round(val) + " cm";
}

function getTmMarketValue(player) {
    if (player.marketValueLatest != null && !isNaN(player.marketValueLatest)) return player.marketValueLatest;
    if (player.marketValue != null && !isNaN(player.marketValue)) return player.marketValue;
    return null;
}

function getBestFacet(player, isGK) {
    if (isGK) {
        if (player.real?.savepct != null) return { label: "Save %", value: formatStat("savepct", player.real.savepct) };
        if (player.real?.psxgpm90 != null) return { label: "PSxG+/-", value: formatStat("psxgpm90", player.real.psxgpm90) };
        if (player.real?.launchpct != null) return { label: "Launch %", value: formatStat("launchpct", player.real.launchpct) };
        return null;
    }

    if (!player.subScores) return null;
    let bestKey = null;
    let bestVal = null;
    for (const [key, val] of Object.entries(player.subScores)) {
        if (val == null || isNaN(val)) continue;
        if (bestVal == null || val > bestVal) {
            bestKey = key;
            bestVal = val;
        }
    }
    if (bestKey == null || bestVal == null) return null;
    const label = {
        scoring: "Scoring",
        creation: "Creation",
        progression: "Progression",
        defense: "Defense",
        discipline: "Discipline"
    }[bestKey] || bestKey;
    return { label, value: bestVal.toFixed(1) };
}

function createModalManager(statTipEl) {
    let pctCache = null;

    function getPct(pos, key, value) {
        if (!pctCache?.[pos]?.[key]) return null;
        return computePercentile(pctCache[pos][key], value);
    }

    function openModal(player, pos, eaRankMap, compRankMap, posPlayers, onClose) {
        const posLabel = POS_LABELS[pos] || pos;
        const subPosLabel = player.subPos ? (SUBPOS_LABELS[player.subPos] || posLabel) : posLabel;
        const eaRank = eaRankMap[player.name] || null;
        const isGK = pos === "GK";

        let compRank = compRankMap[player.name] || null;
        if (player.subPos) {
            const subs = posPlayers.filter(p => p.subPos === player.subPos)
                .sort((a, b) => (b.composite || 0) - (a.composite || 0));
            const idx = subs.findIndex(p => p.name === player.name);
            if (idx >= 0) compRank = idx + 1;
        }

        const subPos = player.subPos || pos;
        const ctx = { player, pos, posLabel, subPos, subPosLabel, isGK, eaRank, compRank, posPlayers };

        const ctrl = window.createModalOverlay({
            className: "act1m-overlay",
            onClose: () => { if (onClose) onClose(); statTipEl.classList.remove("visible"); },
            renderBody: (bodyEl) => renderAct1ModalBody(bodyEl, ctx)
        });
        const panelEl = ctrl.overlay.querySelector(".shared-modal-panel");

        function positionStatTip(e) {
            const pad = 12;
            const rect = statTipEl.getBoundingClientRect();
            const w = rect.width || 260;
            const h = rect.height || 40;
            const x = Math.min(window.innerWidth - w - pad, Math.max(pad, e.clientX + 12));
            const y = Math.min(window.innerHeight - h - pad, Math.max(pad, e.clientY - 10));
            statTipEl.style.left = x + "px";
            statTipEl.style.top = y + "px";
        }

        panelEl.addEventListener("mouseover", e => {
            const t = e.target.closest("[data-tip]");
            if (t) {
                statTipEl.textContent = t.getAttribute("data-tip");
                statTipEl.classList.add("visible");
                positionStatTip(e);
            }
        });
        panelEl.addEventListener("mousemove", e => {
            if (statTipEl.classList.contains("visible")) positionStatTip(e);
        });
        panelEl.addEventListener("mouseout", e => {
            if (e.target.closest("[data-tip]")) statTipEl.classList.remove("visible");
        });

        initInfoTooltips();
    }

    function buildHeaderHtml(player, posLabel, subPosLabel, eaRank, compRank) {
        const roleLabel = player.positionDetail || subPosLabel || posLabel || "";
        const club = player.club || "-";
        const nationality = player.nationality || "-";
        const age = player.age != null ? player.age : "-";
        const mv = getTmMarketValue(player);
        const chips = [];

        if (mv != null) chips.push({ label: "Market value", value: formatMarketValue(mv), tip: "Transfermarkt market value" });
        if (player.foot) chips.push({ label: "Strong foot", value: formatTmFoot(player.foot), tip: "Transfermarkt preferred foot" });
        if (player.height != null) chips.push({ label: "Height", value: formatTmHeight(player.height), tip: "Transfermarkt height" });

        let meta = "";
        if (player.contractExpires) {
            meta += '<span><strong>Contract</strong> ' + escapeAttr(player.contractExpires) + '</span>';
        }

        const chipHtml = chips.map(chip =>
            '<span class="a1m-chip" data-tip="' + escapeAttr(chip.tip + ": " + chip.value) + '">' +
                '<span class="a1m-chip-label">' + escapeAttr(chip.label) + '</span>' +
                '<span class="a1m-chip-value">' + escapeAttr(chip.value) + '</span>' +
            '</span>'
        ).join("");

        const diff = (eaRank != null && compRank != null) ? (eaRank - compRank) : null;
        let gapCls = "is-flat";
        let gapTxt = "-";
        let gapTip = "Ranking gap between EA and real performance";
        if (diff != null) {
            gapTxt = (diff > 0 ? "+" : "") + diff;
            gapCls = diff > 0 ? "is-up" : diff < 0 ? "is-down" : "is-flat";
            gapTip = "EA rank minus real rank among " + subPosLabel;
        }

        return (
            '<div class="a1m-header-main">' +
                '<div class="a1m-photo">' + avatarHTMLString(player.photo, player.name, "a1m-avatar-img", "a1m-photo-fallback") + '</div>' +
                '<div class="a1m-ident">' +
                    '<div class="a1m-kicker">&sect; ACT I &middot; DOSSIER</div>' +
                    '<h2 class="a1m-name">' + escapeAttr(player.name || "Unknown player") + '</h2>' +
                    '<div class="a1m-role">' + escapeAttr(roleLabel) + '</div>' +
                    '<div class="a1m-meta">' +
                        '<span>' + escapeAttr(club) + '</span>' +
                        '<span>' + escapeAttr(nationality) + '</span>' +
                        '<span>Age ' + escapeAttr(String(age)) + '</span>' +
                    '</div>' +
                    '<div class="a1m-tm-chips">' + chipHtml + '</div>' +
                    (meta ? '<div class="a1m-tm-meta">' + meta + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<aside class="a1m-rankbox">' +
                '<div class="a1m-rank-kicker">Ranking summary</div>' +
                '<div class="a1m-rank-grid">' +
                    '<div class="a1m-rank-item"><span>EA rank</span><strong>' + (eaRank != null ? "#" + eaRank : "-") + '</strong></div>' +
                    '<div class="a1m-rank-item"><span>Real rank</span><strong>' + (compRank != null ? "#" + compRank : "-") + '</strong></div>' +
                '</div>' +
                '<div class="a1m-rank-gap ' + gapCls + '" data-tip="' + escapeAttr(gapTip) + '">' + gapTxt + '</div>' +
                '<div class="a1m-rank-note">Reputation gap among ' + escapeAttr(subPosLabel) + '</div>' +
            '</aside>'
        );
    }

    function buildQuickReadHtml(player, compPct, subPosLabel, isGK) {
        const bestFacet = getBestFacet(player, isGK);
        const minutes = player.minutes != null ? player.minutes : null;
        const nineties = player.nineties != null ? player.nineties.toFixed(1) : null;
        const topShare = compPct != null ? Math.max(1, 100 - compPct) : null;
        const compScore = player.composite != null ? player.composite.toFixed(1) : "-";
        const cards = [
            {
                label: "Composite",
                value: compScore,
                tip: compositeInfo(player.pos, player.subPos)
            },
            {
                label: "Top share",
                value: topShare != null ? "Top " + topShare + "%" : "-",
                tip: "How the composite ranks within " + subPosLabel
            },
            {
                label: "Minutes",
                value: minutes != null ? (minutes + " min" + (nineties != null ? " · " + nineties + " 90s" : "")) : "-",
                tip: "Playing time across the league season"
            },
            {
                label: bestFacet ? bestFacet.label : "Facet",
                value: bestFacet ? bestFacet.value : "-",
                tip: bestFacet ? bestFacet.label : "Top real-performance signal"
            }
        ];

        return (
            '<div class="a1m-section-title">Fast read</div>' +
            '<div class="a1m-quick-grid">' +
                cards.map(card =>
                    '<div class="a1m-quick-card" data-tip="' + escapeAttr(card.tip) + '">' +
                        '<div class="a1m-quick-label">' + escapeAttr(card.label) + '</div>' +
                        '<div class="a1m-quick-value">' + escapeAttr(card.value) + '</div>' +
                    '</div>'
                ).join("") +
            '</div>'
        );
    }

    function buildRadarCells(gridEl, player, subPos, subPosLabel, isGK) {
        const groups = [];
        for (const [name, keys] of Object.entries(REAL_GROUPS)) {
            if (name === "Passing" || name === "Context") continue;
            if (name === "Goalkeeping" && !isGK) continue;
            if ((name === "Scoring" || name === "Creation") && isGK) continue;

            const axes = [];
            for (const k of keys) {
                const val = player.real?.[k];
                if (val == null || isNaN(val)) continue;
                axes.push({ key: k, label: statLabel(k), percentile: getPct(subPos, k, val), rawValue: val });
            }
            if (!axes.length) continue;
            groups.push({ name, axes });
        }

        if (!groups.length) return;

        const head = document.createElement("div");
        head.className = "a1m-radar-head a1m-panel-head";
        head.innerHTML =
            '<div class="a1m-section-title">FBref radar panels</div>' +
            '<div class="a1m-radar-sub">Percentiles vs. ' + escapeAttr(subPosLabel) + '</div>';
        gridEl.appendChild(head);

        groups.forEach(grp => {
            const cell = document.createElement("div");
            cell.className = "radar-cell a1m-radar-cell";
            cell.innerHTML = '<div class="radar-cell-title">' + escapeAttr(grp.name) + '</div>';
            drawRadarChart(cell, grp.axes, 280);
            gridEl.appendChild(cell);
        });
    }

    function buildEaColumn(player, pos, posLabel, isGK, posPlayers) {
        const wrap = document.createElement("div");
        wrap.className = "a1m-col-inner";

        const head = document.createElement("div");
        head.className = "act1m-col-head a1m-col-head";
        head.innerHTML =
            '<div class="act1m-col-kicker gold">EA FC 25</div>' +
            '<div class="act1m-col-score a1m-col-score gold" data-tip="' + escapeAttr(STAT_INFO.ovr) + '">' + player.ea.ovr + '</div>' +
            '<div class="act1m-col-sub">Overall rating</div>';
        wrap.appendChild(head);

        for (const [groupName, groupKeys] of Object.entries(EA_GROUPS)) {
            if (groupName === "Goalkeeping" && !isGK) continue;
            if (groupName !== "Goalkeeping" && isGK) continue;
            if (!groupKeys.some(k => player.ea[k] != null)) continue;

            let html = '<hr class="modal-divider"><div class="modal-section-title">' + groupName + '</div>';
            for (const key of groupKeys) {
                const val = player.ea[key];
                if (val == null) continue;
                const pct = Math.round((val / 99) * 100);
                let tip = getStatTooltip(key);
                const eaVals = posPlayers.map(pp => pp.ea[key]).filter(v => v != null).sort(numSort);
                const eaPctile = eaVals.length ? computePercentile(eaVals, val) : null;
                let pctBadge = "";
                if (eaPctile != null) {
                    tip += " | P" + eaPctile + " among " + posLabel;
                    pctBadge = ' <span class="' + pctColorClass(eaPctile) + ' modal-pctile">P' + eaPctile + '</span>';
                }
                html +=
                    '<div class="modal-stat-row" data-tip="' + escapeAttr(tip) + '">' +
                        '<span class="modal-stat-label">' + (EA_STAT_LABELS[key] || key) + '</span>' +
                        '<div class="modal-stat-bar"><div class="modal-stat-fill gold-fill" style="width:' + pct + '%"></div></div>' +
                        '<span class="modal-stat-val">' + val + pctBadge + '</span>' +
                    '</div>';
            }
            const sec = document.createElement("div");
            sec.className = "act1m-group a1m-ea-group";
            sec.innerHTML = html;
            wrap.appendChild(sec);
        }

        return wrap;
    }

    function buildRealColumn(player, pos, subPos, subPosLabel, isGK, eaRank, compRank) {
        const wrap = document.createElement("div");
        wrap.className = "a1m-col-inner";
        const intro = document.createElement("div");
        intro.className = "a1m-real-intro";

        const compPct = getPct(subPos, "_composite", player.composite);
        const compTip = compositeInfo(pos, player.subPos);
        const compScore = player.composite != null ? player.composite.toFixed(1) : "-";

        const head = document.createElement("div");
        head.className = "act1m-col-head a1m-col-head";
        head.innerHTML =
            '<div class="act1m-col-kicker blue">Real Performance</div>' +
            '<div class="act1m-col-score a1m-col-score blue" data-tip="' + escapeAttr(compTip) + '">' + compScore + '</div>' +
            '<div class="act1m-col-sub">Composite score &middot; ' + escapeAttr(subPosLabel) + '</div>';
        wrap.appendChild(head);

        if (compPct != null) {
            const cb = document.createElement("div");
            cb.className = "composite-bar-wrap";
            const topPct = Math.max(1, 100 - compPct);
            cb.setAttribute("data-tip", "Top " + topPct + "% of " + subPosLabel);
            cb.innerHTML =
                '<div class="composite-bar-track"><div class="composite-bar-fill" style="width:' + compPct + '%"></div></div>' +
                '<div class="composite-bar-label">Top ' + topPct + '% of ' + subPosLabel + '</div>';
            intro.appendChild(cb);
        }

        const quick = document.createElement("div");
        quick.className = "a1m-real-quick";
        quick.innerHTML = buildQuickReadHtml(player, compPct, subPosLabel, isGK);
        intro.appendChild(quick);

        if (player.subScores) {
            const dims = [
                { key: "scoring", label: "Scoring" }, { key: "creation", label: "Creation" },
                { key: "progression", label: "Progression" }, { key: "defense", label: "Defense" },
                { key: "discipline", label: "Discipline" }
            ];
            let html = '<hr class="modal-divider"><div class="modal-section-title">Dimensions</div><div class="modal-dim-bars">';
            for (const dim of dims) {
                const sv = player.subScores[dim.key];
                if (sv == null) continue;
                const w = player.dimWeights ? player.dimWeights[dim.key] : 0;
                html +=
                    '<div class="modal-stat-row" data-tip="' + escapeAttr(dim.label + " | " + sv.toFixed(1) + "/100 | Weight: " + (w * 100).toFixed(0) + "%") + '">' +
                        '<span class="modal-stat-label">' + dim.label + '</span>' +
                        '<div class="modal-stat-bar"><div class="modal-stat-fill blue-fill" style="width:' + sv + '%"></div></div>' +
                        '<span class="modal-stat-val ' + pctColorClass(Math.round(sv)) + '">' + Math.round(sv) + '</span>' +
                    '</div>';
            }
            html += '</div>';
            const sec = document.createElement("div");
            sec.className = "act1m-group a1m-dimensions-card";
            sec.innerHTML = html;
            intro.appendChild(sec);
        }

        wrap.appendChild(intro);
        return wrap;
    }

    function renderAct1ModalBody(bodyEl, ctx) {
        const { player, pos, posLabel, subPos, subPosLabel, isGK, eaRank, compRank, posPlayers } = ctx;
        bodyEl.classList.add("act1m-body");

        const header = document.createElement("header");
        header.className = "a1m-header";
        header.innerHTML = buildHeaderHtml(player, posLabel, subPosLabel, eaRank, compRank);
        bodyEl.appendChild(header);

        const cols = document.createElement("div");
        cols.className = "a1m-cols";

        const eaCol = document.createElement("div");
        eaCol.className = "a1m-col a1m-col-ea a1m-col-panel";
        eaCol.appendChild(buildEaColumn(player, pos, posLabel, isGK, posPlayers));

        const realCol = document.createElement("div");
        realCol.className = "a1m-col a1m-col-real a1m-col-panel";
        realCol.appendChild(buildRealColumn(player, pos, subPos, subPosLabel, isGK, eaRank, compRank));

        const radarGrid = document.createElement("div");
        radarGrid.className = "a1m-radar-grid";
        buildRadarCells(radarGrid, player, subPos, subPosLabel, isGK);
        if (radarGrid.children.length) {
            const radarShell = document.createElement("div");
            radarShell.className = "a1m-radar-shell";
            radarShell.appendChild(radarGrid);
            realCol.appendChild(radarShell);
        }

        const realTail = document.createElement("div");
        realTail.className = "a1m-real-tail";
        const extras = document.createElement("div");
        extras.className = "act1m-extras";
        if (isGK) {
            appendIfDefined(extras, buildGoalkeeperPanel(player));
        } else {
            appendIfDefined(extras, buildPitchHeatmap(player));
            appendIfDefined(extras, buildPlayingTime(player));
            appendIfDefined(extras, buildPassingBreakdown(player));
            appendIfDefined(extras, buildCarriesSection(player));
            appendIfDefined(extras, buildTeamImpact(player));
            appendIfDefined(extras, buildSCABreakdown(player));
        }
        appendIfDefined(extras, buildDisciplineSection(player));
        if (extras.children.length) realTail.appendChild(extras);

        const details = document.createElement("details");
        details.className = "a1m-stats-details a1m-real-stats-details";
        const summary = document.createElement("summary");
        summary.textContent = "Show all stats";
        details.appendChild(summary);
        const inner = document.createElement("div");
        inner.className = "a1m-stats-details-body";
        inner.appendChild(buildStatsAccordionContent(player, pos, subPos, subPosLabel, isGK));
        details.appendChild(inner);
        realTail.appendChild(details);
        realCol.appendChild(realTail);

        cols.appendChild(eaCol);
        cols.appendChild(realCol);
        bodyEl.appendChild(cols);
    }

    function buildStatsAccordionContent(player, pos, subPos, subPosLabel, isGK) {
        const container = document.createElement("div");
        let html = "";
        for (const [name, keys] of Object.entries(REAL_GROUPS)) {
            if (name === "Goalkeeping" && !isGK) continue;
            if ((name === "Scoring" || name === "Creation") && isGK) continue;
            if (!keys.some(k => player.real?.[k] != null)) continue;

            html += '<hr class="modal-divider"><div class="modal-section-title">' + name + '</div>';
            for (const key of keys) {
                const val = player.real?.[key];
                if (val == null) continue;
                const pctile = getPct(subPos, key, val);
                const pctSpan = pctile != null
                    ? ' <span class="' + pctColorClass(pctile) + ' modal-pctile" data-tip="P' + pctile + ' among ' + subPosLabel + '">(P' + pctile + ')</span>'
                    : '';
                html +=
                    '<div class="modal-detail-row" data-tip="' + escapeAttr(getStatTooltip(key)) + '">' +
                        '<span class="modal-detail-label">' + (REAL_STAT_LABELS[key] || key) + '</span>' +
                        '<span class="modal-detail-val">' + formatStat(key, val) + pctSpan + '</span>' +
                    '</div>';
            }
        }

        container.innerHTML = html;
        return container;
    }

    function appendIfDefined(parent, node) { if (node) parent.appendChild(node); }

    function hasAnyValue(player, keys) {
        return keys.some(k => player.real?.[k] != null && !isNaN(player.real[k]));
    }

    function makeSection(titleText, tip, extraClass) {
        const sec = document.createElement("div");
        sec.className = "modal-new-section a1m-viz-card" + (extraClass ? " " + extraClass : "");
        const title = document.createElement("div");
        title.className = "modal-new-section-title";
        title.textContent = titleText;
        if (tip) title.setAttribute("data-tip", tip);
        sec.appendChild(title);
        return sec;
    }

    const PITCH_TOUCH_KEYS = ["touchDefPen", "touchDef3rd", "touchMid3rd", "touchAtt3rd", "touchAttPen"];
    const PITCH_TKL_KEYS = ["tklDef3rd", "tklMid3rd", "tklAtt3rd"];

    function buildPitchHeatmap(player) {
        const hasTouches = hasAnyValue(player, PITCH_TOUCH_KEYS);
        const hasTkls = hasAnyValue(player, PITCH_TKL_KEYS);
        if (!hasTouches && !hasTkls) return null;

        const sec = makeSection("Zones of Activity", "Distribution of touches and tackles across pitch thirds. Penalty area touches are subset of attacking/defensive third.");
        const container = document.createElement("div");
        container.className = "pitch-container";

        if (hasTouches) container.appendChild(pitchHeatmapSvg(player, "touches"));
        if (hasTkls) container.appendChild(pitchHeatmapSvg(player, "tackles"));
        sec.appendChild(container);

        const r = player.real || {};
        const totalTouches = r.touches != null ? r.touches : PITCH_TOUCH_KEYS.reduce((sum, key) => sum + (r[key] || 0), 0);
        const totalTackles = PITCH_TKL_KEYS.reduce((sum, key) => sum + (r[key] || 0), 0);
        const note = document.createElement("div");
        note.className = "pitch-summary-strip";
        note.innerHTML =
            (hasTouches ? '<span><strong>' + Math.round(totalTouches) + '</strong> touches mapped</span>' : '') +
            (hasTkls ? '<span><strong>' + Math.round(totalTackles) + '</strong> tackles by third</span>' : '');
        sec.appendChild(note);
        return sec;
    }

    function pitchHeatmapSvg(player, mode) {
        const wrap = document.createElement("div");
        wrap.className = "pitch-wrap pitch-variant-heat";

        const W = 230, H = 158;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", H);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

        const r = player.real || {};
        let zones, title;
        if (mode === "touches") {
            zones = [
                { key: "touchDefPen", label: "Def. Box", value: r.touchDefPen, x: 24, y: 82, rx: 28, ry: 30 },
                { key: "touchDef3rd", label: "Def. 3rd", value: r.touchDef3rd, x: 54, y: 70, rx: 48, ry: 50 },
                { key: "touchMid3rd", label: "Mid. 3rd", value: r.touchMid3rd, x: 112, y: 75, rx: 54, ry: 50 },
                { key: "touchAtt3rd", label: "Att. 3rd", value: r.touchAtt3rd, x: 172, y: 72, rx: 56, ry: 52 },
                { key: "touchAttPen", label: "Att. Box", value: r.touchAttPen, x: 198, y: 78, rx: 34, ry: 38 }
            ];
            title = "Touches";
        } else {
            zones = [
                { key: "tklDef3rd", label: "Def. 3rd", value: r.tklDef3rd, x: 56, y: 84, rx: 48, ry: 48 },
                { key: "tklMid3rd", label: "Mid. 3rd", value: r.tklMid3rd, x: 115, y: 76, rx: 52, ry: 48 },
                { key: "tklAtt3rd", label: "Att. 3rd", value: r.tklAtt3rd, x: 174, y: 68, rx: 54, ry: 50 }
            ];
            title = "Tackles";
        }

        const maxVal = Math.max(1, ...zones.map(z => z.value || 0));
        const safeId = "activity-heat-" + mode + "-" + Math.random().toString(36).slice(2);
        const defs = document.createElementNS(svgNS, "defs");
        defs.innerHTML =
            '<clipPath id="' + safeId + '-clip"><rect x="6" y="6" width="' + (W - 12) + '" height="' + (H - 12) + '" rx="18"></rect></clipPath>' +
            '<filter id="' + safeId + '-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"></feGaussianBlur></filter>';
        svg.appendChild(defs);

        const bg = document.createElementNS(svgNS, "rect");
        bg.setAttribute("x", 6);
        bg.setAttribute("y", 6);
        bg.setAttribute("width", W - 12);
        bg.setAttribute("height", H - 12);
        bg.setAttribute("rx", 18);
        bg.setAttribute("fill", "#043f8f");
        bg.setAttribute("opacity", "0.86");
        svg.appendChild(bg);

        const heat = document.createElementNS(svgNS, "g");
        heat.setAttribute("clip-path", "url(#" + safeId + "-clip)");
        heat.setAttribute("filter", "url(#" + safeId + "-blur)");
        svg.appendChild(heat);

        const addBlob = (z, fill, scale, opacity, dx, dy) => {
            const blob = document.createElementNS(svgNS, "ellipse");
            blob.setAttribute("cx", z.x + (dx || 0));
            blob.setAttribute("cy", z.y + (dy || 0));
            blob.setAttribute("rx", z.rx * scale);
            blob.setAttribute("ry", z.ry * scale);
            blob.setAttribute("fill", fill);
            blob.setAttribute("opacity", opacity);
            blob.setAttribute("data-tip", z.label + ": " + (z.value || 0));
            heat.appendChild(blob);
        };

        zones.forEach(z => {
            const v = z.value || 0;
            const pct = v / maxVal;
            addBlob(z, "#22c55e", 0.95 + pct * 0.35, (0.24 + pct * 0.42).toFixed(2), 0, 0);
            addBlob(z, "#fde047", 0.48 + pct * 0.35, (0.12 + pct * 0.48).toFixed(2), pct > 0.55 ? 3 : 0, pct > 0.55 ? 2 : 0);
            if (pct > 0.28) addBlob(z, "#f97316", 0.26 + pct * 0.28, (pct * 0.58).toFixed(2), 0, 0);
            if (pct > 0.72) addBlob(z, "#ef2d1f", 0.18 + pct * 0.22, (pct * 0.72).toFixed(2), 1, 0);
        });

        addHorizontalPitchLines(svg, svgNS, W, H);

        wrap.appendChild(svg);
        const lbl = document.createElement("div");
        lbl.className = "pitch-label";
        const total = zones.reduce((sum, z) => sum + (z.value || 0), 0);
        const topZone = zones.reduce((best, z) => (z.value || 0) > (best.value || 0) ? z : best, zones[0]);
        lbl.innerHTML =
            '<span>' + title + '</span>' +
            '<strong>' + Math.round(total) + '</strong>' +
            '<em>Peak: ' + escapeAttr(topZone?.label || "") + '</em>';
        wrap.appendChild(lbl);
        return wrap;
    }

    function addHorizontalPitchLines(svg, svgNS, W, H) {
        const mark = (name, attrs) => {
            const el = document.createElementNS(svgNS, name);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            svg.appendChild(el);
            return el;
        };
        const stroke = "rgba(255,255,255,0.68)";
        const x = 6, y = 6, w = W - 12, h = H - 12;
        mark("rect", { x, y, width: w, height: h, rx: 18, fill: "none", stroke, "stroke-width": 1.1 });
        mark("line", { x1: W / 2, y1: y, x2: W / 2, y2: y + h, stroke, "stroke-width": 1 });
        mark("circle", { cx: W / 2, cy: H / 2, r: 27, fill: "none", stroke, "stroke-width": 1 });
        mark("rect", { x, y: H / 2 - 34, width: 24, height: 68, fill: "none", stroke, "stroke-width": 1 });
        mark("rect", { x: W - 30, y: H / 2 - 34, width: 24, height: 68, fill: "none", stroke, "stroke-width": 1 });
        mark("rect", { x, y: H / 2 - 16, width: 8, height: 32, fill: "none", stroke, "stroke-width": 0.85 });
        mark("rect", { x: W - 14, y: H / 2 - 16, width: 8, height: 32, fill: "none", stroke, "stroke-width": 0.85 });
    }

    function addModernPitchLines(svg, svgNS, W, H) {
        const mark = (name, attrs) => {
            const el = document.createElementNS(svgNS, name);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
            svg.appendChild(el);
            return el;
        };
        const stroke = "rgba(142,197,255,0.26)";
        mark("rect", { x: 4, y: 4, width: W - 8, height: H - 8, rx: 10, fill: "rgba(8,20,34,0.58)", stroke, "stroke-width": 0.9 });
        const boxW = W * 0.55;
        const sixW = W * 0.31;
        const boxX = (W - boxW) / 2;
        const sixX = (W - sixW) / 2;
        const boxH = H * 0.14;
        const sixH = H * 0.06;
        const spotGap = H * 0.18;
        mark("line", { x1: 4, x2: W - 4, y1: H / 2, y2: H / 2, stroke, "stroke-width": 0.8 });
        mark("circle", { cx: W / 2, cy: H / 2, r: 13, fill: "none", stroke, "stroke-width": 0.7 });
        mark("rect", { x: boxX, y: 4, width: boxW, height: boxH, fill: "none", stroke, "stroke-width": 0.7 });
        mark("rect", { x: sixX, y: 4, width: sixW, height: sixH, fill: "none", stroke, "stroke-width": 0.65 });
        mark("rect", { x: boxX, y: H - 4 - boxH, width: boxW, height: boxH, fill: "none", stroke, "stroke-width": 0.7 });
        mark("rect", { x: sixX, y: H - 4 - sixH, width: sixW, height: sixH, fill: "none", stroke, "stroke-width": 0.65 });
        mark("circle", { cx: W / 2, cy: spotGap, r: 1.3, fill: stroke });
        mark("circle", { cx: W / 2, cy: H - spotGap, r: 1.3, fill: stroke });
    }

    function buildPlayingTime(player) {
        const r = player.real || {};
        if (player.minutes == null && r.mp == null) return null;

        const sec = makeSection("Playing Time", "Season minutes, starts, and substitute appearances. Bar scaled to a 3420-minute full season.");

        const maxMin = 3420;
        const minutes = player.minutes != null ? player.minutes : (r.mp != null ? r.mp : 0);
        const nineties = player.nineties != null ? player.nineties : (minutes > 0 ? minutes / 90 : null);
        const pct = Math.min(100, (minutes / maxMin) * 100);
        const barWrap = document.createElement("div");
        barWrap.innerHTML =
            '<div class="pt-bar-track" data-tip="' + escapeAttr(minutes + " minutes of ~" + maxMin + " possible") + '">' +
                '<div class="pt-bar-fill" style="width:' + pct.toFixed(1) + '%"></div>' +
            '</div>' +
            '<div class="pt-bar-label">' + minutes + " min" +
                (nineties != null ? " · " + nineties.toFixed(1) + " 90s" : "") +
            '</div>';
        sec.appendChild(barWrap);

        const starts = r.starts || 0;
        const subs = r.subs || 0;
        const unSub = r.unSub || 0;
        const total = Math.min(40, starts + subs + unSub);
        if (total > 0) {
            const dots = document.createElement("div");
            dots.className = "pt-dots";
            for (let i = 0; i < Math.min(starts, total); i++) {
                dots.insertAdjacentHTML("beforeend", '<span class="pt-dot pt-dot-starter" data-tip="Start"></span>');
            }
            const remainingAfterStarts = total - Math.min(starts, total);
            for (let i = 0; i < Math.min(subs, remainingAfterStarts); i++) {
                dots.insertAdjacentHTML("beforeend", '<span class="pt-dot pt-dot-sub" data-tip="Sub appearance"></span>');
            }
            const remainingAfterSubs = remainingAfterStarts - Math.min(subs, remainingAfterStarts);
            for (let i = 0; i < Math.min(unSub, remainingAfterSubs); i++) {
                dots.insertAdjacentHTML("beforeend", '<span class="pt-dot pt-dot-absent" data-tip="Unused substitute"></span>');
            }
            sec.appendChild(dots);

            const legend = document.createElement("div");
            legend.className = "pt-legend";
            legend.innerHTML =
                '<span><span class="pt-legend-dot" style="background:var(--blue)"></span>Starts ' + starts + '</span>' +
                '<span><span class="pt-legend-dot" style="border:1.5px solid #60a5fa"></span>Subs ' + subs + '</span>' +
                (unSub ? '<span><span class="pt-legend-dot" style="border:1px solid rgba(255,255,255,0.2)"></span>Unused ' + unSub + '</span>' : '');
            sec.appendChild(legend);
        }

        if (player.injuries?.count) {
            const inj = document.createElement("div");
            inj.className = "pt-availability";
            inj.setAttribute(
                "data-tip",
                player.injuries.count + " injury/injuries in 24/25, " + player.injuries.daysMissed + " days missed" +
                (player.injuries.latest ? ", latest: " + player.injuries.latest : "")
            );
            inj.innerHTML =
                '<div class="pt-availability-kicker">Availability</div>' +
                '<div class="pt-availability-main">' +
                    '<div class="pt-availability-count">' + player.injuries.count + '</div>' +
                    '<div class="pt-availability-copy">' + (player.injuries.count === 1 ? "injury" : "injuries") + ' · ' + player.injuries.daysMissed + ' days lost</div>' +
                '</div>' +
                (player.injuries.latest ? '<div class="pt-availability-note">Latest setback: ' + escapeAttr(player.injuries.latest) + '</div>' : '');
            sec.appendChild(inj);
        }

        const extras = [];
        if (r.mp != null) extras.push("MP: " + r.mp);
        if (r.compl != null && r.compl > 0) extras.push("Complete: " + r.compl);
        if (r.mnPerStart != null && r.mnPerStart > 0) extras.push("Min/start: " + r.mnPerStart);
        if (r.mnPerSub != null && r.mnPerSub > 0) extras.push("Min/sub: " + r.mnPerSub);
        if (extras.length) {
            const ex = document.createElement("div");
            ex.className = "pt-extra-stats";
            ex.innerHTML = extras.map(t => "<span>" + t + "</span>").join("");
            sec.appendChild(ex);
        }

        return sec;
    }

    const PASS_TYPES = [
        { key: "passLive", label: "Live", icon: "●", color: "#60a5fa" },
        { key: "passDead", label: "Dead", icon: "◌", color: "#a3a3a3" },
        { key: "passCrs", label: "Crosses", icon: "↗", color: "#f472b6" },
        { key: "passTB", label: "Through", icon: "→", color: "#4ade80" },
        { key: "passSw", label: "Switches", icon: "⇄", color: "#c084fc" },
        { key: "passFK", label: "Free Kicks", icon: "⌖", color: "#fbbf24" }
    ];

    function buildPassingBreakdown(player) {
        const r = player.real || {};
        if (r.passAtt == null || r.passAtt <= 0) return null;

        const sec = makeSection("Passing Breakdown", "Pass completion and pass-type distribution across the season.");
        const container = document.createElement("div");
        container.className = "pass-container";

        const cmp = r.passCmp != null ? r.passCmp : Math.round(r.passAtt * ((r.cmppct || 0) / 100));
        const donutSize = 128;
        const cmpPct = r.cmppct != null ? r.cmppct : (r.passCmp / r.passAtt) * 100;
        const completion = document.createElement("div");
        completion.className = "pass-completion-card";
        completion.appendChild(passDonut(r.passAtt, cmpPct, donutSize));
        completion.insertAdjacentHTML("beforeend",
            '<div class="pass-completion-copy">' +
                '<span>Completion</span>' +
                '<strong>' + Math.round(cmp) + ' / ' + Math.round(r.passAtt) + '</strong>' +
                '<em>completed passes</em>' +
            '</div>'
        );
        container.appendChild(completion);

        const bars = document.createElement("div");
        bars.className = "pass-bars";
        const passBase = Math.max(1, r.passAtt || PASS_TYPES.reduce((sum, t) => sum + (r[t.key] || 0), 0));
        PASS_TYPES.forEach(t => {
            const v = r[t.key];
            if (v == null) return;
            const w = Math.min(100, (v / passBase) * 100);
            bars.insertAdjacentHTML("beforeend",
                '<div class="pass-bar-row" data-tip="' + escapeAttr(getStatTooltip(t.key) || t.label) + '">' +
                    '<div class="pass-bar-header">' +
                        '<span class="pass-bar-name"><span class="pass-bar-icon" style="color:' + t.color + '">' + t.icon + '</span>' + t.label + '</span>' +
                        '<span class="pass-bar-val">' + v + ' <em>' + w.toFixed(0) + '%</em></span>' +
                    '</div>' +
                    '<div class="pass-bar-track"><div class="pass-bar-fill" style="width:' + w.toFixed(1) + '%;background:' + t.color + '"></div></div>' +
                '</div>'
            );
        });
        container.appendChild(bars);
        sec.appendChild(container);

        const bonus = [];
        if (r.passTotDist != null) bonus.push("Total dist: " + r.passTotDist);
        if (r.passPrgDist != null) bonus.push("Prog. dist: " + r.passPrgDist);
        if (r.passBlocked != null) bonus.push("Blocked: " + r.passBlocked);
        const ckTotal = (r.passCKIn || 0) + (r.passCKOut || 0) + (r.passCKStr || 0);
        if (ckTotal > 0) bonus.push("Corners: " + ckTotal);
        if (bonus.length) {
            const b = document.createElement("div");
            b.className = "pass-bonus";
            b.innerHTML = bonus.map(t => "<span>" + t + "</span>").join("");
            sec.appendChild(b);
        }

        return sec;
    }

    function passDonut(attempts, cmpPct, size) {
        const wrap = document.createElement("div");
        wrap.className = "pass-donut-wrap";
        wrap.style.width = size + "px";
        wrap.style.height = size + "px";

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", size);
        svg.setAttribute("height", size);
        svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

        const cx = size / 2, cy = size / 2;
        const outer = size / 2 - 2;
        const inner = outer * 0.7;

        const bg = document.createElementNS(svgNS, "circle");
        bg.setAttribute("cx", cx); bg.setAttribute("cy", cy);
        bg.setAttribute("r", (outer + inner) / 2);
        bg.setAttribute("fill", "none");
        bg.setAttribute("stroke", "rgba(255,255,255,0.06)");
        bg.setAttribute("stroke-width", outer - inner);
        svg.appendChild(bg);

        const pct = Math.max(0, Math.min(100, cmpPct || 0)) / 100;
        const angle = pct * 2 * Math.PI - Math.PI / 2;
        const startX = cx, startY = cy - (outer + inner) / 2;
        const endX = cx + ((outer + inner) / 2) * Math.cos(angle);
        const endY = cy + ((outer + inner) / 2) * Math.sin(angle);
        const largeArc = pct > 0.5 ? 1 : 0;
        const arcRadius = (outer + inner) / 2;

        if (pct > 0) {
            const arc = document.createElementNS(svgNS, "path");
            arc.setAttribute("d",
                `M ${startX} ${startY} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${endX} ${endY}`
            );
            arc.setAttribute("fill", "none");
            arc.setAttribute("stroke", "#60a5fa");
            arc.setAttribute("stroke-width", outer - inner);
            arc.setAttribute("stroke-linecap", "round");
            arc.setAttribute("data-tip", "Completed " + cmpPct.toFixed(1) + "%");
            svg.appendChild(arc);
        }

        wrap.appendChild(svg);

        const center = document.createElement("div");
        center.className = "pass-donut-center";
        center.innerHTML =
            '<div class="pass-donut-total">' + (cmpPct != null ? cmpPct.toFixed(0) + "%" : "-") + '</div>' +
            '<div class="pass-donut-label">' + attempts + " ATT</div>";
        wrap.appendChild(center);

        return wrap;
    }

    function buildCarriesSection(player) {
        const r = player.real || {};
        if (r.carries == null) return null;

        const sec = makeSection("Ball Carrying", "How often and how far the player moves the ball while in possession.");
        const container = document.createElement("div");
        container.className = "carries-container";

        container.appendChild(carriesPitch(r));

        const panel = document.createElement("div");
        panel.className = "carries-panel";
        const stats = document.createElement("div");
        stats.className = "carries-stats";
        const carryTotal = r.carries || 0;
        const prgC = r.carriesPrgC || 0;
        const carryShare = carryTotal > 0 ? Math.min(100, (prgC / carryTotal) * 100) : 0;
        const finalShare = carryTotal > 0 ? Math.min(100, ((r.carries1_3 || 0) / carryTotal) * 100) : 0;
        const boxShare = carryTotal > 0 ? Math.min(100, ((r.carriesCPA || 0) / carryTotal) * 100) : 0;
        panel.insertAdjacentHTML("beforeend",
            '<div class="carries-flow-summary" data-tip="How total carries narrow into more dangerous territory">' +
                '<div><span>Carry funnel</span><strong>' + carryShare.toFixed(0) + '%</strong></div>' +
                '<div class="carries-funnel">' +
                    '<div><span>Total</span><b style="width:100%"></b><strong>' + carryTotal + '</strong></div>' +
                    '<div><span>Progressive</span><b style="width:' + carryShare.toFixed(1) + '%"></b><strong>' + prgC + '</strong></div>' +
                    '<div><span>Final 3rd</span><b style="width:' + finalShare.toFixed(1) + '%"></b><strong>' + (r.carries1_3 || 0) + '</strong></div>' +
                    '<div><span>Box</span><b style="width:' + boxShare.toFixed(1) + '%"></b><strong>' + (r.carriesCPA || 0) + '</strong></div>' +
                '</div>' +
            '</div>'
        );
        const rows = [
            { label: "Total carries", val: r.carries, key: "carries" },
            { label: "Progressive", val: r.carriesPrgC, key: "carriesPrgC" },
            { label: "Into final 3rd", val: r.carries1_3, key: "carries1_3" },
            { label: "Into pen. area", val: r.carriesCPA, key: "carriesCPA" },
            { label: "Take-ons", val: r.toAtt != null ? r.toAtt + (r.toSucc != null ? " (" + r.toSucc + " won)" : "") : null, key: "toAtt" },
            { label: "Dribble success", val: r.succpct != null ? r.succpct.toFixed(1) + "%" : null, key: "succpct" },
            { label: "Dispossessed", val: r.carriesDis, key: "carriesDis" },
            { label: "Miscontrols", val: r.carriesMis, key: "carriesMis" },
            { label: "Receptions", val: r.carriesRec, key: "carriesRec" }
        ].filter(row => row.val != null && row.val !== "");
        stats.innerHTML = rows.map(row =>
            '<div class="carries-stat-row" data-tip="' + escapeAttr(getStatTooltip(row.key) || row.label) + '">' +
                '<span class="carries-stat-label">' + row.label + '</span>' +
                '<span class="carries-stat-val">' + row.val + '</span>' +
            '</div>'
        ).join("");
        panel.appendChild(stats);
        container.appendChild(panel);

        sec.appendChild(container);
        return sec;
    }

    function carriesPitch(r) {
        const wrap = document.createElement("div");
        wrap.className = "carries-pitch-wrap";
        const W = 150, H = 366;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", H);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

        addModernPitchLines(svg, svgNS, W, H);

        const totDist = r.carriesTotDist || 0;
        const prgDist = r.carriesPrgDist || 0;
        const carries = r.carries || 0;
        const prgC = r.carriesPrgC || 0;
        const finalThird = r.carries1_3 || 0;
        const cpa = r.carriesCPA || 0;
        const ratio = totDist > 0 ? Math.min(1, prgDist / totDist) : 0;
        const route = [
            { label: "Carries", val: carries, x: 43, y: H - 48, r: 9 + Math.min(15, Math.sqrt(carries || 0) * 0.22) },
            { label: "Progressive", val: prgC, x: 75, y: H - 164 - ratio * 34, r: 9 + Math.min(14, Math.sqrt(prgC || 0) * 0.42) },
            { label: "Final 3rd", val: finalThird, x: 103, y: 116, r: 9 + Math.min(13, Math.sqrt(finalThird || 0) * 0.72) },
            { label: "Box", val: cpa, x: 112, y: 48, r: 9 + Math.min(12, Math.sqrt(cpa || 0) * 1.18) }
        ];

        const arrow = document.createElementNS(svgNS, "path");
        arrow.setAttribute("d", `M ${route[0].x} ${route[0].y} C 32 246, 88 232, ${route[1].x} ${route[1].y} S 121 156, ${route[2].x} ${route[2].y} S 124 72, ${route[3].x} ${route[3].y}`);
        arrow.setAttribute("stroke", "#8ec5ff");
        arrow.setAttribute("stroke-width", "4.5");
        arrow.setAttribute("stroke-linecap", "round");
        arrow.setAttribute("stroke-linejoin", "round");
        arrow.setAttribute("fill", "none");
        arrow.setAttribute("opacity", "0.88");
        arrow.setAttribute("data-tip", "Progressive distance " + prgDist + " of " + totDist + " total yards");
        svg.appendChild(arrow);

        route.forEach((node, idx) => {
            const ring = document.createElementNS(svgNS, "circle");
            ring.setAttribute("cx", node.x);
            ring.setAttribute("cy", node.y);
            ring.setAttribute("r", node.r + 5);
            ring.setAttribute("fill", "rgba(96,165,250,0.09)");
            svg.appendChild(ring);

            const dot = document.createElementNS(svgNS, "circle");
            dot.setAttribute("cx", node.x);
            dot.setAttribute("cy", node.y);
            dot.setAttribute("r", node.r);
            dot.setAttribute("fill", idx === 0 ? "rgba(142,197,255,0.62)" : "#60a5fa");
            dot.setAttribute("stroke", "rgba(255,255,255,0.42)");
            dot.setAttribute("stroke-width", "0.8");
            dot.setAttribute("data-tip", node.label + ": " + node.val);
            svg.appendChild(dot);

            const value = document.createElementNS(svgNS, "text");
            value.setAttribute("x", node.x);
            value.setAttribute("y", node.y + 1);
            value.setAttribute("class", "carry-node-value");
            value.textContent = node.val;
            svg.appendChild(value);

            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", node.x);
            label.setAttribute("y", node.y + node.r + 14);
            label.setAttribute("class", "carry-node-label");
            label.textContent = node.label;
            svg.appendChild(label);
        });

        wrap.appendChild(svg);
        const lbl = document.createElement("div");
        lbl.className = "pitch-label carries-route-label";
        const pct = totDist > 0 ? Math.round((prgDist / totDist) * 100) : 0;
        const tip = "Out of " + Math.round(totDist) + " total yards carried with the ball this season, " +
                    Math.round(prgDist) + " (" + pct + "%) advanced the ball toward the opponent goal. " +
                    "The rest was lateral or backward, recycling possession.";
        lbl.setAttribute("data-tip", tip);
        lbl.innerHTML =
            '<span>Forward yards carried</span>' +
            '<strong>' + Math.round(prgDist) + '</strong>' +
            '<em>of ' + Math.round(totDist) + ' total yards (' + pct + '%)</em>';
        wrap.appendChild(lbl);
        return wrap;
    }

    function buildDisciplineSection(player) {
        const r = player.real || {};
        const keys = ["crdY", "crdR", "crd2Y", "fls", "fld", "og", "err"];
        if (!hasAnyValue(player, keys)) return null;

        const sec = makeSection("Discipline", "Cards, fouls and errors across the season.");

        const cards = document.createElement("div");
        cards.className = "disc-cards";

        if ((r.crdY || 0) > 0) {
            cards.insertAdjacentHTML("beforeend",
                '<div class="disc-card disc-card-yellow" data-tip="' + r.crdY + ' yellow cards">' + r.crdY + '</div>'
            );
        }
        if ((r.crdR || 0) > 0) {
            cards.insertAdjacentHTML("beforeend",
                '<div class="disc-card disc-card-red" data-tip="' + r.crdR + ' red cards">' + r.crdR + '</div>'
            );
        }
        if ((r.crd2Y || 0) > 0) {
            cards.insertAdjacentHTML("beforeend",
                '<div class="disc-card-2y" data-tip="' + r.crd2Y + ' second-yellow sendings off">' +
                    '<div class="disc-card-2y-yellow"></div>' +
                    '<div class="disc-card-2y-red">' + r.crd2Y + '</div>' +
                '</div>'
            );
        }

        if (!cards.children.length) {
            cards.innerHTML = '<div style="font-size:0.7rem;opacity:0.45">No cards</div>';
        }
        sec.appendChild(cards);

        const incidents = [
            { label: "Fouls committed", val: r.fls, key: "fls" },
            { label: "Fouls drawn", val: r.fld, key: "fld" },
            { label: "Own goals", val: r.og, key: "og" },
            { label: "Errors", val: r.err, key: "err" }
        ].filter(i => i.val != null && i.val !== 0);

        if (incidents.length) {
            const row = document.createElement("div");
            row.className = "disc-incidents";
            row.innerHTML = incidents.map(i =>
                '<div class="disc-incident" data-tip="' + escapeAttr(getStatTooltip(i.key) || i.label) + '">' +
                    '<span class="disc-incident-val">' + i.val + '</span> ' +
                    '<span style="opacity:0.55">' + i.label + '</span>' +
                '</div>'
            ).join("");
            sec.appendChild(row);
        }

        return sec;
    }

    function buildTeamImpact(player) {
        const r = player.real || {};
        if (r.onG == null && r.plusMinus == null && r.onOff == null) return null;

        const sec = makeSection("Team Impact (On-Pitch)", "How the team performs when this player is on the pitch. Based on FBref team metrics.");

        if (r.onG != null && r.onGA != null) {
            const delta = r.onG - r.onGA;
            const deltaCls = delta > 0 ? "positive" : (delta < 0 ? "negative" : "");
            const wrap = document.createElement("div");
            wrap.className = "impact-onoff-wrap";
            wrap.innerHTML =
                '<div class="impact-onoff-col" data-tip="Goals scored by team while this player was on the pitch">' +
                    '<div class="impact-onoff-val" style="color:#4ade80">' + Math.round(r.onG) + '</div>' +
                    '<div class="impact-onoff-sub">For</div>' +
                '</div>' +
                '<div class="impact-onoff-center" data-tip="Goal differential while on pitch">' +
                    '<div class="impact-onoff-delta ' + deltaCls + '">' + (delta > 0 ? "+" : "") + Math.round(delta) + '</div>' +
                    '<div class="impact-onoff-sub">Diff</div>' +
                '</div>' +
                '<div class="impact-onoff-col" data-tip="Goals conceded while this player was on the pitch">' +
                    '<div class="impact-onoff-val" style="color:#f87171">' + Math.round(r.onGA) + '</div>' +
                    '<div class="impact-onoff-sub">Against</div>' +
                '</div>';
            sec.appendChild(wrap);
        }

        const bars = [
            { key: "plusMinus90", label: "G +/- /90", val: r.plusMinus90, scale: 2 },
            { key: "xgPlusMinus90", label: "xG +/- /90", val: r.xgPlusMinus90, scale: 1.5 },
            { key: "onOff", label: "On-Off", val: r.onOff, scale: 2 },
            { key: "ppm", label: "Pts / Match", val: r.ppm, scale: 3, signed: false }
        ].filter(b => b.val != null && !isNaN(b.val));

        if (bars.length) {
            const wrap = document.createElement("div");
            wrap.className = "impact-bars";
            bars.forEach(b => {
                const v = b.val;
                const pos = b.signed === false ? (v / b.scale) * 100 : (Math.abs(v) / b.scale) * 100;
                const width = Math.min(100, pos);
                const color = b.signed === false
                    ? "#60a5fa"
                    : (v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#a3a3a3");
                const displayVal = b.signed === false ? v.toFixed(2) : (v > 0 ? "+" : "") + v.toFixed(2);
                wrap.insertAdjacentHTML("beforeend",
                    '<div class="impact-bar-row" data-tip="' + escapeAttr(getStatTooltip(b.key) || b.label) + '">' +
                        '<span class="impact-bar-label">' + b.label + '</span>' +
                        '<div class="impact-bar-track"><div class="impact-bar-fill" style="width:' + width.toFixed(1) + '%;background:' + color + '"></div></div>' +
                        '<span class="impact-bar-val" style="color:' + color + '">' + displayVal + '</span>' +
                    '</div>'
                );
            });
            sec.appendChild(wrap);
        }

        const badges = [];
        if (r.ppm != null) {
            if (r.ppm >= 2.0) badges.push({ cls: "positive", text: "Winning team (" + r.ppm.toFixed(2) + " ppm)" });
            else if (r.ppm < 1.0) badges.push({ cls: "negative", text: "Struggling side (" + r.ppm.toFixed(2) + " ppm)" });
            else badges.push({ cls: "neutral", text: r.ppm.toFixed(2) + " ppm" });
        }
        if (r.plusMinus != null) {
            const pm = Math.round(r.plusMinus);
            if (pm > 0) badges.push({ cls: "positive", text: "+" + pm + " goal diff" });
            else if (pm < 0) badges.push({ cls: "negative", text: pm + " goal diff" });
        }

        if (badges.length) {
            const bWrap = document.createElement("div");
            bWrap.className = "impact-badges";
            bWrap.innerHTML = badges.map(b =>
                '<span class="impact-badge impact-badge-' + b.cls + '">' + b.text + '</span>'
            ).join("");
            sec.appendChild(bWrap);
        }

        return sec;
    }

    const SCA_TYPES = [
        { key: "scaPassLive", label: "Live Pass", color: "#60a5fa" },
        { key: "scaPassDead", label: "Dead Pass", color: "#a3a3a3" },
        { key: "scaTO", label: "Take-On", color: "#c084fc" },
        { key: "scaSh", label: "Shot", color: "#fbbf24" },
        { key: "scaFld", label: "Fouled", color: "#f472b6" },
        { key: "scaDef", label: "Defense", color: "#4ade80" }
    ];

    function buildSCABreakdown(player) {
        const r = player.real || {};
        if ((r.sca || 0) === 0 && (r.gca || 0) === 0) return null;

        const sec = makeSection("Chance Creation", "SCA = the two offensive actions (pass, dribble, foul, shot) leading to a shot. GCA is the same but for a goal.");

        const container = document.createElement("div");
        container.className = "sca-container";

        const scaTotal = r.sca || SCA_TYPES.reduce((a, t) => a + (r[t.key] || 0), 0);
        if (scaTotal > 0) {
            const row = document.createElement("div");
            row.className = "sca-bar-row";
            let segHtml = "";
            SCA_TYPES.forEach(t => {
                const v = r[t.key];
                if (v == null || v === 0) return;
                segHtml += '<div class="sca-segment" style="flex:' + v + ';background:' + t.color + '" data-tip="' + escapeAttr(t.label + ": " + v) + '">' + v + '</div>';
            });
            row.innerHTML =
                '<div class="sca-bar-header">' +
                    '<span class="sca-bar-title">Shot-Creating Actions</span>' +
                    '<span class="sca-bar-total">' + scaTotal + ' total</span>' +
                '</div>' +
                '<div class="sca-stacked-bar">' + segHtml + '</div>';
            container.appendChild(row);

            const legend = document.createElement("div");
            legend.className = "sca-legend";
            legend.innerHTML = SCA_TYPES.filter(t => r[t.key]).map(t =>
                '<span><span class="sca-legend-dot" style="background:' + t.color + '"></span>' + t.label + '</span>'
            ).join("");
            container.appendChild(legend);
        }

        if (r.gca != null && r.gca > 0) {
            const row = document.createElement("div");
            row.className = "sca-gca-row";
            row.innerHTML =
                '<div class="sca-gca-title">' +
                    '<span>Goal-Creating Actions</span>' +
                '</div>' +
                '<div class="sca-gca-metric">' +
                    '<span class="sca-gca-main">' + r.gca + '</span>' +
                    '<span class="sca-gca-total">total</span>' +
                    (r.gca90 != null ? '<span class="sca-gca-rate">' + r.gca90.toFixed(2) + ' <span>per 90 minutes</span></span>' : '') +
                '</div>' +
                '<span class="sca-gca-info" data-tip="GCA has no subtype breakdown in FBref. It is shown as one total goal-creating action metric.">?</span>';
            container.appendChild(row);
        }

        sec.appendChild(container);
        return sec;
    }

    function buildGoalkeeperPanel(player) {
        const r = player.real || {};
        if (r.ga == null && r.saves == null && r.psxg == null) return null;

        const sec = makeSection("Goalkeeping", "Shot-stopping, distribution, and sweeper actions for this keeper.", "gk-panel");

        const ss = document.createElement("div");
        ss.className = "gk-sub-section";
        ss.innerHTML = '<div class="gk-sub-title">Shot Stopping</div>';

        if (r.savepct != null) {
            ss.insertAdjacentHTML("beforeend",
                '<div class="gk-big-stat">' +
                    '<div class="gk-big-stat-val">' + r.savepct.toFixed(1) + '%</div>' +
                    '<div class="gk-big-stat-label">Save Rate</div>' +
                '</div>'
            );
        }

        const ssCells = [
            { k: "saves", label: "Saves" },
            { k: "sota", label: "Shots faced" },
            { k: "ga", label: "Goals against" },
            { k: "ga90", label: "GA / 90", fmt: v => v.toFixed(2) },
            { k: "psxg", label: "PSxG", fmt: v => v.toFixed(1) },
            { k: "psxgPerSoT", label: "PSxG / SoT", fmt: v => v.toFixed(2) }
        ].filter(c => r[c.k] != null);
        if (ssCells.length) {
            const grid = document.createElement("div");
            grid.className = "gk-stat-grid";
            grid.innerHTML = ssCells.map(c =>
                '<div class="gk-stat-cell" data-tip="' + escapeAttr(getStatTooltip(c.k) || c.label) + '">' +
                    '<span class="gk-stat-cell-label">' + c.label + '</span>' +
                    '<span class="gk-stat-cell-val">' + (c.fmt ? c.fmt(r[c.k]) : r[c.k]) + '</span>' +
                '</div>'
            ).join("");
            ss.appendChild(grid);
        }
        sec.appendChild(ss);

        if (r.gkW != null || r.gkD != null || r.gkL != null) {
            const rec = document.createElement("div");
            rec.className = "gk-sub-section";
            rec.innerHTML = '<div class="gk-sub-title">Record</div>';

            const w = r.gkW || 0, d = r.gkD || 0, l = r.gkL || 0;
            const total = w + d + l;
            if (total > 0) {
                const bar = document.createElement("div");
                bar.className = "gk-record-bar";
                if (w > 0) bar.insertAdjacentHTML("beforeend", '<div class="gk-record-segment gk-record-w" style="flex:' + w + '" data-tip="Wins: ' + w + '">' + w + '</div>');
                if (d > 0) bar.insertAdjacentHTML("beforeend", '<div class="gk-record-segment gk-record-d" style="flex:' + d + '" data-tip="Draws: ' + d + '">' + d + '</div>');
                if (l > 0) bar.insertAdjacentHTML("beforeend", '<div class="gk-record-segment gk-record-l" style="flex:' + l + '" data-tip="Losses: ' + l + '">' + l + '</div>');
                rec.appendChild(bar);

                const legend = document.createElement("div");
                legend.className = "gk-record-legend";
                legend.innerHTML =
                    '<span><span class="pt-legend-dot" style="background:#4ade80"></span>W ' + w + '</span>' +
                    '<span><span class="pt-legend-dot" style="background:#a3a3a3"></span>D ' + d + '</span>' +
                    '<span><span class="pt-legend-dot" style="background:#f87171"></span>L ' + l + '</span>';
                rec.appendChild(legend);
            }

            if (r.cs != null) {
                rec.insertAdjacentHTML("beforeend",
                    '<div class="gk-icon-stat" data-tip="Clean sheets kept">' +
                        '<span class="gk-icon-stat-val">' + r.cs + '</span>' +
                        '<span style="opacity:0.55">clean sheets' + (r.cspct != null ? " (" + r.cspct.toFixed(1) + "%)" : "") + '</span>' +
                    '</div>'
                );
            }
            sec.appendChild(rec);
        }

        const distCells = [
            { k: "gkCmpPct", label: "Pass Cmp %", fmt: v => v.toFixed(1) + "%" },
            { k: "gkAvgLen", label: "Avg length (yd)", fmt: v => v.toFixed(1) },
            { k: "launchpct", label: "Launch %", fmt: v => v.toFixed(1) + "%" },
            { k: "gkThr", label: "Throws" }
        ].filter(c => r[c.k] != null);
        if (distCells.length) {
            const dist = document.createElement("div");
            dist.className = "gk-sub-section";
            dist.innerHTML = '<div class="gk-sub-title">Distribution</div>';
            const grid = document.createElement("div");
            grid.className = "gk-stat-grid";
            grid.innerHTML = distCells.map(c =>
                '<div class="gk-stat-cell" data-tip="' + escapeAttr(getStatTooltip(c.k) || c.label) + '">' +
                    '<span class="gk-stat-cell-label">' + c.label + '</span>' +
                    '<span class="gk-stat-cell-val">' + (c.fmt ? c.fmt(r[c.k]) : r[c.k]) + '</span>' +
                '</div>'
            ).join("");
            dist.appendChild(grid);
            sec.appendChild(dist);
        }

        const swCells = [
            { k: "gkOPA", label: "Sweeper actions" },
            { k: "opa90", label: "Sweep / 90", fmt: v => v.toFixed(2) },
            { k: "gkAvgDist", label: "Avg dist (yd)", fmt: v => v.toFixed(1) },
            { k: "stppct", label: "Crosses stopped %", fmt: v => v.toFixed(1) + "%" }
        ].filter(c => r[c.k] != null);
        if (swCells.length) {
            const sw = document.createElement("div");
            sw.className = "gk-sub-section";
            sw.innerHTML = '<div class="gk-sub-title">Sweeping &amp; Crosses</div>';
            const grid = document.createElement("div");
            grid.className = "gk-stat-grid";
            grid.innerHTML = swCells.map(c =>
                '<div class="gk-stat-cell" data-tip="' + escapeAttr(getStatTooltip(c.k) || c.label) + '">' +
                    '<span class="gk-stat-cell-label">' + c.label + '</span>' +
                    '<span class="gk-stat-cell-val">' + (c.fmt ? c.fmt(r[c.k]) : r[c.k]) + '</span>' +
                '</div>'
            ).join("");
            sw.appendChild(grid);
            sec.appendChild(sw);
        }

        if (r.pka != null && r.pka > 0) {
            const pk = document.createElement("div");
            pk.className = "gk-sub-section";
            pk.innerHTML =
                '<div class="gk-sub-title">Penalties Faced</div>' +
                '<div class="gk-icon-stat" data-tip="Penalties faced / saved">' +
                    '<span class="gk-icon-stat-val">' + (r.pksv || 0) + ' / ' + r.pka + '</span>' +
                    '<span style="opacity:0.55">saved</span>' +
                '</div>';
            sec.appendChild(pk);
        }

        return sec;
    }

    function renderInline(bodyEl, player, allData) {
        const data = Array.isArray(allData) && allData.length ? allData : [player];
        pctCache = buildPercentileCache(data);

        const pos = SUBPOS_TO_GROUP[player.subPos] || player.pos || player.subPos || "FW";
        const posLabel = POS_LABELS[pos] || pos;
        const subPos = player.subPos || pos;
        const subPosLabel = SUBPOS_LABELS[subPos] || player.positionDetail || posLabel;
        const isGK = pos === "GK";
        const posPlayers = data.filter(p => p.subPos === subPos);
        const byOvr = posPlayers.slice().sort((a, b) => (b.ea?.ovr || 0) - (a.ea?.ovr || 0));
        const byComp = posPlayers.slice().sort((a, b) => (b.composite || 0) - (a.composite || 0));
        const eaRankMap = {};
        const compRankMap = {};
        byOvr.forEach((p, i) => { eaRankMap[p.name] = i + 1; });
        byComp.forEach((p, i) => { compRankMap[p.name] = i + 1; });

        bodyEl.innerHTML = "";
        bodyEl.classList.add("act1m-body");
        renderAct1ModalBody(bodyEl, {
            player,
            pos,
            posLabel,
            subPos,
            subPosLabel,
            isGK,
            eaRank: eaRankMap[player.name] || null,
            compRank: compRankMap[player.name] || null,
            posPlayers
        });
        initInfoTooltips();
    }

    return {
        init(data) { pctCache = buildPercentileCache(data); },
        openModal,
        renderInline
    };
}
