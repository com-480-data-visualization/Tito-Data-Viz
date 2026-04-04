// --- Percentile cache ---
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

        // Cache composite
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

// --- Radar chart (D3) ---

function drawRadarChart(container, axes, size) {
    if (!axes || axes.length < 3) return;

    const margin = 30;
    const radius = (size - margin * 2) / 2;
    const cx = size / 2, cy = size / 2;
    const n = axes.length;
    const slice = (2 * Math.PI) / n;

    const svg = d3.select(container).append("svg")
        .attr("width", size).attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`);
    const g = svg.append("g");

    // Grid
    for (let lvl = 1; lvl <= 4; lvl++) {
        g.append("circle").attr("cx", cx).attr("cy", cy)
            .attr("r", (radius / 4) * lvl).attr("class", "radar-grid-circle");
    }

    // Axes + polygon points
    const points = axes.map((a, i) => {
        const angle = slice * i - Math.PI / 2;
        const pct = (a.percentile != null) ? a.percentile / 100 : 0;
        const r = radius * pct;

        // Axis line
        g.append("line").attr("x1", cx).attr("y1", cy)
            .attr("x2", cx + radius * Math.cos(angle))
            .attr("y2", cy + radius * Math.sin(angle))
            .attr("class", "radar-axis-line");

        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle };
    });

    // Polygon
    const pathD = points.map((pt, i) =>
        (i === 0 ? "M" : "L") + pt.x.toFixed(1) + "," + pt.y.toFixed(1)
    ).join(" ") + " Z";
    g.append("path").attr("d", pathD).attr("class", "radar-polygon");

    // Dots
    points.forEach(pt => {
        g.append("circle").attr("cx", pt.x).attr("cy", pt.y)
            .attr("r", 2.5).attr("class", "radar-dot");
    });

    // Labels
    axes.forEach((a, i) => {
        const angle = slice * i - Math.PI / 2;
        const lR = radius + 12;
        const x = cx + lR * Math.cos(angle);
        const y = cy + lR * Math.sin(angle);
        const cos = Math.cos(angle);

        let tip = a.label;
        if (a.rawValue != null) tip += ": " + formatStat(a.key, a.rawValue);
        if (a.percentile != null) tip += " (P" + a.percentile + ")";

        // Truncate label to 6 chars
        let short = a.label.replace(/\/90$/, "").replace(/\s*%$/, "%");
        if (short.length > 6) short = short.substring(0, 5) + ".";

        g.append("text").attr("x", x).attr("y", y)
            .attr("text-anchor", cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle")
            .attr("dominant-baseline", "central")
            .attr("class", "radar-axis-label")
            .attr("data-tip", tip).text(short);
    });
}

// --- Modal manager ---

function createModalManager(statTipEl) {
    let pctCache = null;

    function getPct(pos, key, value) {
        if (!pctCache?.[pos]?.[key]) return null;
        return computePercentile(pctCache[pos][key], value);
    }

    function openModal(player, pos, eaRankMap, compRankMap, posPlayers, onClose) {
        const posLabel = POS_LABELS[pos] || pos;
        const subPosLabel = player.subPos ? (SUBPOS_LABELS[player.subPos] || pos) : posLabel;
        const eaRank = eaRankMap[player.name] || "-";
        const isGK = pos === "GK";

        // Sub-position rank
        let compRank = compRankMap[player.name] || "-";
        if (player.subPos) {
            const subs = posPlayers.filter(p => p.subPos === player.subPos)
                .sort((a, b) => (b.composite || 0) - (a.composite || 0));
            const idx = subs.findIndex(p => p.name === player.name);
            if (idx >= 0) compRank = idx + 1;
        }

        // Sub-score bars
        let subScoreHtml = "";
        if (player.subScores) {
            const dims = [
                { key: "scoring", label: "Scoring" }, { key: "creation", label: "Creation" },
                { key: "progression", label: "Progression" }, { key: "defense", label: "Defense" },
                { key: "discipline", label: "Discipline" }
            ];
            subScoreHtml += '<div class="modal-dim-bars">';
            for (const dim of dims) {
                const sv = player.subScores[dim.key];
                if (sv == null) continue;
                const w = player.dimWeights ? player.dimWeights[dim.key] : 0;
                subScoreHtml +=
                    '<div class="modal-stat-row" data-tip="' + escapeAttr(dim.label + " | " + sv.toFixed(1) + "/100 | Weight: " + (w * 100).toFixed(0) + "%") + '">' +
                        '<span class="modal-stat-label">' + dim.label + '</span>' +
                        '<div class="modal-stat-bar"><div class="modal-stat-fill blue-fill" style="width:' + sv + '%"></div></div>' +
                        '<span class="modal-stat-val ' + pctColorClass(Math.round(sv)) + '">' + Math.round(sv) + '</span>' +
                    '</div>';
            }
            subScoreHtml += '</div>';
        }

        // --- Build modal ---
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const card = document.createElement("div");
        card.className = "modal-card";

        const closeBtn = document.createElement("button");
        closeBtn.className = "modal-close";
        closeBtn.innerHTML = "&#x2715;";
        closeBtn.onclick = e => { e.stopPropagation(); close(); };

        // LEFT: EA side
        const fifaSide = document.createElement("div");
        fifaSide.className = "modal-half modal-fifa";

        let eaGroupsHtml = "";
        for (const [groupName, groupKeys] of Object.entries(EA_GROUPS)) {
            if (groupName === "Goalkeeping" && !isGK) continue;
            if (groupName !== "Goalkeeping" && isGK) continue;
            if (!groupKeys.some(k => player.ea[k] != null)) continue;

            eaGroupsHtml += '<hr class="modal-divider"><div class="modal-section-title">' + groupName + '</div>';
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

                eaGroupsHtml +=
                    '<div class="modal-stat-row" data-tip="' + escapeAttr(tip) + '">' +
                        '<span class="modal-stat-label">' + (EA_STAT_LABELS[key] || key) + '</span>' +
                        '<div class="modal-stat-bar"><div class="modal-stat-fill gold-fill" style="width:' + pct + '%"></div></div>' +
                        '<span class="modal-stat-val">' + val + pctBadge + '</span>' +
                    '</div>';
            }
        }

        fifaSide.innerHTML =
            '<div class="modal-side-label gold">EA FC 25</div>' +
            '<div class="modal-player-header">' +
                avatarHTMLString(player.photo, player.name, "modal-player-photo", "modal-player-avatar") +
                '<div><div class="modal-player-name">' + player.name + '</div>' +
                '<div class="modal-player-meta">' + player.club + ' - ' + player.league + '<br>Age ' + player.age + '</div></div>' +
            '</div>' +
            '<div class="modal-big-score gold" data-tip="' + escapeAttr(STAT_INFO.ovr) + '">' + player.ea.ovr + '</div>' +
            '<div class="modal-score-sub">#' + eaRank + ' among ' + posLabel + '</div>' +
            eaGroupsHtml;

        // RIGHT: Real side
        const realSide = document.createElement("div");
        realSide.className = "modal-half modal-real";

        // Transfermarkt info
        let tmHtml = '<div class="modal-tm-info">';
        if (player.marketValue != null) tmHtml += '<strong>Market Value:</strong> ' + formatMarketValue(player.marketValue) + '<br>';
        if (player.nationality) tmHtml += '<strong>Nationality:</strong> ' + player.nationality + '<br>';
        if (player.height) tmHtml += '<strong>Height:</strong> ' + player.height + ' cm<br>';
        if (player.foot) tmHtml += '<strong>Foot:</strong> ' + player.foot + '<br>';
        if (player.contractExpires) tmHtml += '<strong>Contract:</strong> ' + player.contractExpires + '<br>';
        tmHtml += '</div>';

        let injuryHtml = "";
        if (player.injuries?.count) {
            injuryHtml = '<div class="modal-injury-info">' +
                player.injuries.count + ' injury/injuries in 24/25, ' + player.injuries.daysMissed + ' days missed' +
                (player.injuries.latest ? ', latest: ' + player.injuries.latest : '') + '</div>';
        }

        const subPos = player.subPos || pos;
        const compPct = getPct(subPos, "_composite", player.composite);
        const compTip = compositeInfo(pos, player.subPos);

        realSide.innerHTML =
            '<div class="modal-side-label blue">Real Performance</div>' +
            '<div class="modal-big-score blue" data-tip="' + escapeAttr(compTip) + '">' + player.composite.toFixed(1) + '</div>' +
            '<div class="modal-score-sub">#' + compRank + ' among ' + subPosLabel + '</div>' +
            (compPct != null
                ? '<div class="composite-bar-wrap" data-tip="' + escapeAttr("Top " + (100 - compPct) + "% of " + subPosLabel) + '">' +
                    '<div class="composite-bar-track"><div class="composite-bar-fill" style="width:' + compPct + '%"></div></div>' +
                    '<div class="composite-bar-label">Top ' + (100 - compPct) + '% of ' + subPosLabel + '</div></div>'
                : '') +
            subScoreHtml + tmHtml + injuryHtml;

        // Radar charts
        realSide.appendChild(buildRadarSection(player, subPos, subPosLabel, isGK));

        // Accordion: detailed stats
        realSide.appendChild(buildStatsAccordion(player, pos, subPos, subPosLabel, isGK));

        card.appendChild(fifaSide);
        card.appendChild(realSide);
        card.appendChild(closeBtn);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Tooltip delegation
        overlay.addEventListener("mouseover", e => {
            const t = e.target.closest("[data-tip]");
            if (t) { statTipEl.textContent = t.getAttribute("data-tip"); statTipEl.classList.add("visible"); }
        });
        overlay.addEventListener("mousemove", e => {
            statTipEl.style.left = (e.clientX + 12) + "px";
            statTipEl.style.top = (e.clientY - 10) + "px";
        });
        overlay.addEventListener("mouseout", e => {
            if (e.target.closest("[data-tip]")) statTipEl.classList.remove("visible");
        });

        initInfoTooltips();
        requestAnimationFrame(() => overlay.classList.add("visible"));

        overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
        const onKey = e => { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
        document.addEventListener("keydown", onKey);

        function close() {
            statTipEl.classList.remove("visible");
            if (onClose) onClose();
            overlay.classList.remove("visible");
            setTimeout(() => overlay.remove(), 260);
        }
    }

    function buildRadarSection(player, subPos, subPosLabel, isGK) {
        const container = document.createElement("div");
        container.innerHTML = '<hr class="modal-divider"><div class="modal-section-title">Performance Radar (Percentiles vs. ' + subPosLabel + ')</div>';

        const groups = [];
        for (const [name, keys] of Object.entries(REAL_GROUPS)) {
            if (name === "Goalkeeping" && !isGK) continue;
            if ((name === "Scoring" || name === "Creation") && isGK) continue;
            if (name === "Discipline" || name === "Passing") continue;

            const axes = [];
            let nulls = 0;
            for (const k of keys) {
                const val = player.real?.[k];
                if (val == null || isNaN(val)) { nulls++; continue; }
                axes.push({ key: k, label: statLabel(k), percentile: getPct(subPos, k, val), rawValue: val });
            }
            if (nulls > keys.length / 2 || axes.length < 3) continue;
            groups.push({ name, axes });
        }

        let row = null;
        groups.forEach((grp, i) => {
            if (i % 2 === 0) {
                row = document.createElement("div");
                row.className = "radar-row";
                container.appendChild(row);
            }
            const cell = document.createElement("div");
            cell.className = "radar-cell";
            cell.innerHTML = '<div class="radar-cell-title">' + grp.name + '</div>';
            drawRadarChart(cell, grp.axes, 180);
            row.appendChild(cell);
        });

        return container;
    }

    function buildStatsAccordion(player, pos, subPos, subPosLabel, isGK) {
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

        const wrap = document.createElement("div");
        wrap.className = "modal-accordion-wrap";

        const toggle = document.createElement("div");
        toggle.className = "modal-accordion-toggle";
        toggle.innerHTML = '<span class="modal-accordion-label">See all detailed stats</span><span class="modal-accordion-chevron">\u25BC</span>';

        const body = document.createElement("div");
        body.className = "modal-accordion-body";
        body.innerHTML = html;

        const chevron = toggle.querySelector(".modal-accordion-chevron");
        toggle.onclick = e => {
            e.stopPropagation();
            const open = body.classList.toggle("open");
            chevron.classList.toggle("open", open);
            body.style.maxHeight = open ? body.scrollHeight + "px" : "0";
        };

        wrap.appendChild(toggle);
        wrap.appendChild(body);
        return wrap;
    }

    return {
        init(data) { pctCache = buildPercentileCache(data); },
        openModal
    };
}
