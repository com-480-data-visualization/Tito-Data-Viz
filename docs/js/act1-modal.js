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

const RADAR_LABEL_ABBREV = {
    gls: "Goals", gpk: "NP Goals", xg90: "xG", npxg90: "npxG", gxg: "G-xG", npgxg: "npG-xG",
    sh90: "Shots", sot90: "SoT", sotpct: "SoT%", npxgpsh: "npxG/Sh", dist: "Sh Dist", fkGoals: "FK",
    ast: "Assists", gpa: "G+A", xag90: "xAG", axag: "A-xAG", sca90: "SCA", gca90: "GCA",
    kp90: "Key P", ppa90: "PPA", crspa90: "CrsPA", tb90: "Through", xa90: "xA",
    prgc90: "Prog C", prgp90: "Prog P", cpa90: "CPA", final3rd90: "Final 3rd",
    to90: "Take-On", succpct: "TO Win%", mis90: "Miscntl",
    tklint90: "Tkl+Int", tkl90: "Tackles", tklpct: "Tkl%", int90: "Int",
    blocks90: "Blocks", clr90: "Clear", shblocks90: "Sh Blk", recov90: "Recov", aerialwon: "Aerial%",
    fls90: "Fouls", fld90: "Fouled", offsides90: "Offside",
    cmppct: "Pass%",
    psxgpm90: "PSxG+/-", savepct: "Save%", cspct: "CS%", gkdist: "Pass%",
    opa90: "OPA", stppct: "Cross Stp", launchpct: "Launch%"
};

function drawRadarChart(container, axes, size) {
    if (!axes || axes.length < 3) return;

    const margin = 36;
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

    // Ring labels (25/50/75 at the top)
    [25, 50, 75].forEach(p => {
        g.append("text")
            .attr("x", cx + 2).attr("y", cy - (radius * p / 100))
            .attr("class", "radar-ring-label")
            .text("P" + p);
    });

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
            .attr("r", 2.8).attr("class", "radar-dot");
    });

    // Labels
    axes.forEach((a, i) => {
        const angle = slice * i - Math.PI / 2;
        const lR = radius + 16;
        const x = cx + lR * Math.cos(angle);
        const y = cy + lR * Math.sin(angle);
        const cos = Math.cos(angle);

        let tip = a.label;
        if (a.rawValue != null) tip += ": " + formatStat(a.key, a.rawValue);
        if (a.percentile != null) tip += " (P" + a.percentile + ")";

        const short = RADAR_LABEL_ABBREV[a.key] ||
            a.label.replace(/\/90$/, "").replace(/\s*%$/, "%").slice(0, 8);

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

        // Enhanced sections (between radar and accordion)
        if (isGK) {
            realSide.appendChild(buildGoalkeeperPanel(player));
        } else {
            appendIfDefined(realSide, buildPitchHeatmap(player));
            appendIfDefined(realSide, buildPlayingTime(player));
            appendIfDefined(realSide, buildPassingBreakdown(player));
            appendIfDefined(realSide, buildCarriesSection(player));
            appendIfDefined(realSide, buildTeamImpact(player));
            appendIfDefined(realSide, buildSCABreakdown(player));
        }
        appendIfDefined(realSide, buildDisciplineSection(player));

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
            drawRadarChart(cell, grp.axes, 260);
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

    // ==== Enhanced modal sections ====

    function appendIfDefined(parent, node) { if (node) parent.appendChild(node); }

    function hasAnyValue(player, keys) {
        return keys.some(k => player.real?.[k] != null && !isNaN(player.real[k]));
    }

    function makeSection(titleText, tip, extraClass) {
        const sec = document.createElement("div");
        sec.className = "modal-new-section" + (extraClass ? " " + extraClass : "");
        const title = document.createElement("div");
        title.className = "modal-new-section-title";
        title.textContent = titleText;
        if (tip) title.setAttribute("data-tip", tip);
        sec.appendChild(title);
        return sec;
    }

    // --- Pitch heatmap ---

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
        return sec;
    }

    function pitchHeatmapSvg(player, mode) {
        const wrap = document.createElement("div");
        wrap.className = "pitch-wrap";

        const W = 125, H = 170;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", H);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

        const r = player.real || {};
        let zones, interp, title;
        if (mode === "touches") {
            const att3rdOuter = Math.max(0, (r.touchAtt3rd || 0) - (r.touchAttPen || 0));
            const def3rdOuter = Math.max(0, (r.touchDef3rd || 0) - (r.touchDefPen || 0));
            zones = [
                { key: "touchAttPen", label: "Att. Pen.", value: r.touchAttPen, x: 32, y: 4, w: 61, h: 32 },
                { key: "touchAtt3rd", label: "Att. 3rd (outside box)", value: att3rdOuter, rawKey: r.touchAtt3rd,
                  x: 4, y: 4, w: 117, h: 54, exclude: { x: 32, y: 4, w: 61, h: 32 },
                  labelX: 62, labelY: 47 },
                { key: "touchMid3rd", label: "Mid. 3rd", value: r.touchMid3rd, x: 4, y: 58, w: 117, h: 54 },
                { key: "touchDef3rd", label: "Def. 3rd (outside box)", value: def3rdOuter, rawKey: r.touchDef3rd,
                  x: 4, y: 112, w: 117, h: 54, exclude: { x: 32, y: 134, w: 61, h: 32 },
                  labelX: 62, labelY: 123 },
                { key: "touchDefPen", label: "Def. Pen.", value: r.touchDefPen, x: 32, y: 134, w: 61, h: 32 }
            ];
            interp = (typeof d3 !== "undefined") ? d3.interpolateBlues : null;
            title = "Touches";
        } else {
            zones = [
                { key: "tklAtt3rd", label: "Att. 3rd Tackles", value: r.tklAtt3rd, x: 4, y: 4, w: 117, h: 54 },
                { key: "tklMid3rd", label: "Mid. 3rd Tackles", value: r.tklMid3rd, x: 4, y: 58, w: 117, h: 54 },
                { key: "tklDef3rd", label: "Def. 3rd Tackles", value: r.tklDef3rd, x: 4, y: 112, w: 117, h: 54 }
            ];
            interp = (typeof d3 !== "undefined") ? d3.interpolateReds : null;
            title = "Tackles";
        }

        const maxVal = Math.max(1, ...zones.map(z => z.value || 0));

        zones.forEach(z => {
            const v = z.value || 0;
            const t = 0.15 + 0.85 * (v / maxVal);
            const fill = interp ? interp(t) : `rgba(96,165,250,${t.toFixed(2)})`;

            if (z.exclude) {
                // Render a path: outer rect minus inner rect
                const path = document.createElementNS(svgNS, "path");
                const o = z, e = z.exclude;
                path.setAttribute("d",
                    `M${o.x},${o.y} h${o.w} v${o.h} h-${o.w} Z ` +
                    `M${e.x},${e.y} h${e.w} v${e.h} h-${e.w} Z`
                );
                path.setAttribute("fill", fill);
                path.setAttribute("fill-rule", "evenodd");
                path.setAttribute("stroke", "rgba(255,255,255,0.15)");
                path.setAttribute("stroke-width", "0.6");
                path.setAttribute("data-tip", z.label + ": " + v + (z.rawKey != null ? " (" + z.rawKey + " incl. penalty area)" : ""));
                svg.appendChild(path);
            } else {
                const rect = document.createElementNS(svgNS, "rect");
                rect.setAttribute("x", z.x);
                rect.setAttribute("y", z.y);
                rect.setAttribute("width", z.w);
                rect.setAttribute("height", z.h);
                rect.setAttribute("fill", fill);
                rect.setAttribute("stroke", "rgba(255,255,255,0.15)");
                rect.setAttribute("stroke-width", "0.6");
                rect.setAttribute("data-tip", z.label + ": " + v);
                svg.appendChild(rect);
            }

            // Zone count label (custom position for path zones, center for rects)
            const label = document.createElementNS(svgNS, "text");
            const cx = z.labelX != null ? z.labelX : z.x + z.w / 2;
            const cy = z.labelY != null ? z.labelY : z.y + z.h / 2;
            label.setAttribute("x", cx);
            label.setAttribute("y", cy);
            label.setAttribute("class", "pitch-zone-count");
            label.textContent = v;
            svg.appendChild(label);
        });

        // Midline
        const mid = document.createElementNS(svgNS, "line");
        mid.setAttribute("x1", 4); mid.setAttribute("x2", W - 4);
        mid.setAttribute("y1", H / 2); mid.setAttribute("y2", H / 2);
        mid.setAttribute("stroke", "rgba(255,255,255,0.25)");
        mid.setAttribute("stroke-width", "0.8");
        svg.appendChild(mid);

        wrap.appendChild(svg);
        const lbl = document.createElement("div");
        lbl.className = "pitch-label";
        lbl.textContent = title;
        wrap.appendChild(lbl);
        return wrap;
    }

    // --- Playing time ---

    function buildPlayingTime(player) {
        const r = player.real || {};
        if (player.minutes == null && r.mp == null) return null;

        const sec = makeSection("Playing Time", "Season minutes, starts, and substitute appearances. Bar scaled to a 3420-minute full season.");

        // Minutes bar
        const maxMin = 3420;
        const pct = Math.min(100, ((player.minutes || 0) / maxMin) * 100);
        const barWrap = document.createElement("div");
        barWrap.innerHTML =
            '<div class="pt-bar-track" data-tip="' + escapeAttr((player.minutes || 0) + " minutes of ~" + maxMin + " possible") + '">' +
                '<div class="pt-bar-fill" style="width:' + pct.toFixed(1) + '%"></div>' +
            '</div>' +
            '<div class="pt-bar-label">' + (player.minutes || 0) + " min" +
                (player.nineties != null ? " · " + player.nineties.toFixed(1) + " 90s" : "") +
            '</div>';
        sec.appendChild(barWrap);

        // Dots row (starts + subs + unused subs; cap at 40)
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

    // --- Passing breakdown ---

    const PASS_TYPES = [
        { key: "passLive", label: "Live", color: "#60a5fa" },
        { key: "passDead", label: "Dead", color: "#a3a3a3" },
        { key: "passCrs", label: "Crosses", color: "#f472b6" },
        { key: "passTB", label: "Through", color: "#4ade80" },
        { key: "passSw", label: "Switches", color: "#c084fc" },
        { key: "passFK", label: "Free Kicks", color: "#fbbf24" }
    ];

    function buildPassingBreakdown(player) {
        const r = player.real || {};
        if (r.passAtt == null || r.passAtt <= 0) return null;

        const sec = makeSection("Passing Breakdown", "Pass completion and pass-type distribution across the season.");
        const container = document.createElement("div");
        container.className = "pass-container";

        // Donut
        const donutSize = 110;
        const cmpPct = r.cmppct != null ? r.cmppct : (r.passCmp / r.passAtt) * 100;
        container.appendChild(passDonut(r.passAtt, cmpPct, donutSize));

        // Type bars
        const bars = document.createElement("div");
        bars.className = "pass-bars";
        const maxVal = Math.max(1, ...PASS_TYPES.map(t => r[t.key] || 0));
        PASS_TYPES.forEach(t => {
            const v = r[t.key];
            if (v == null) return;
            const w = (v / maxVal) * 100;
            bars.insertAdjacentHTML("beforeend",
                '<div class="pass-bar-row" data-tip="' + escapeAttr(getStatTooltip(t.key) || t.label) + '">' +
                    '<div class="pass-bar-header">' +
                        '<span class="pass-bar-name">' + t.label + '</span>' +
                        '<span class="pass-bar-val">' + v + '</span>' +
                    '</div>' +
                    '<div class="pass-bar-track"><div class="pass-bar-fill" style="width:' + w.toFixed(1) + '%;background:' + t.color + '"></div></div>' +
                '</div>'
            );
        });
        container.appendChild(bars);
        sec.appendChild(container);

        // Bonus stats row
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

        // Background ring
        const bg = document.createElementNS(svgNS, "circle");
        bg.setAttribute("cx", cx); bg.setAttribute("cy", cy);
        bg.setAttribute("r", (outer + inner) / 2);
        bg.setAttribute("fill", "none");
        bg.setAttribute("stroke", "rgba(255,255,255,0.06)");
        bg.setAttribute("stroke-width", outer - inner);
        svg.appendChild(bg);

        // Completed arc
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

    // --- Carries ---

    function buildCarriesSection(player) {
        const r = player.real || {};
        if (r.carries == null) return null;

        const sec = makeSection("Ball Carrying", "How often and how far the player moves the ball while in possession.");
        const container = document.createElement("div");
        container.className = "carries-container";

        // Mini pitch with progressive arrow
        container.appendChild(carriesPitch(r));

        // Stats
        const stats = document.createElement("div");
        stats.className = "carries-stats";
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
        container.appendChild(stats);

        sec.appendChild(container);
        return sec;
    }

    function carriesPitch(r) {
        const wrap = document.createElement("div");
        wrap.className = "carries-pitch-wrap";
        const W = 90, H = 130;
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", H);
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

        // Pitch bg
        const bg = document.createElementNS(svgNS, "rect");
        bg.setAttribute("x", 2); bg.setAttribute("y", 2);
        bg.setAttribute("width", W - 4); bg.setAttribute("height", H - 4);
        bg.setAttribute("fill", "rgba(74,222,128,0.05)");
        bg.setAttribute("stroke", "rgba(255,255,255,0.15)");
        bg.setAttribute("stroke-width", "0.8");
        svg.appendChild(bg);

        const midY = H / 2;
        const mid = document.createElementNS(svgNS, "line");
        mid.setAttribute("x1", 2); mid.setAttribute("x2", W - 2);
        mid.setAttribute("y1", midY); mid.setAttribute("y2", midY);
        mid.setAttribute("stroke", "rgba(255,255,255,0.15)");
        mid.setAttribute("stroke-width", "0.5");
        svg.appendChild(mid);

        // Progressive arrow: length encodes prgDist / totDist ratio
        const totDist = r.carriesTotDist || 0;
        const prgDist = r.carriesPrgDist || 0;
        const ratio = totDist > 0 ? Math.min(1, prgDist / totDist) : 0;
        const arrowLen = 18 + (H - 40) * ratio;
        const ax = W / 2, ay1 = H - 18, ay2 = H - 18 - arrowLen;

        const arrow = document.createElementNS(svgNS, "line");
        arrow.setAttribute("x1", ax); arrow.setAttribute("y1", ay1);
        arrow.setAttribute("x2", ax); arrow.setAttribute("y2", ay2);
        arrow.setAttribute("stroke", "#4ade80");
        arrow.setAttribute("stroke-width", "2.5");
        arrow.setAttribute("stroke-linecap", "round");
        arrow.setAttribute("data-tip", "Progressive distance " + prgDist + " of " + totDist + " total yards");
        svg.appendChild(arrow);

        // Arrowhead
        const head = document.createElementNS(svgNS, "polygon");
        head.setAttribute("points", `${ax - 4},${ay2 + 5} ${ax + 4},${ay2 + 5} ${ax},${ay2 - 3}`);
        head.setAttribute("fill", "#4ade80");
        svg.appendChild(head);

        wrap.appendChild(svg);
        const lbl = document.createElement("div");
        lbl.className = "pitch-label";
        lbl.textContent = prgDist + " prog. yd";
        wrap.appendChild(lbl);
        return wrap;
    }

    // --- Discipline ---

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
            { icon: "\u26A1", label: "Fouls committed", val: r.fls, key: "fls" },
            { icon: "\uD83E\uDEE4", label: "Fouls drawn", val: r.fld, key: "fld" },
            { icon: "\uD83D\uDCA5", label: "Own goals", val: r.og, key: "og" },
            { icon: "\u274C", label: "Errors", val: r.err, key: "err" }
        ].filter(i => i.val != null && i.val !== 0);

        if (incidents.length) {
            const row = document.createElement("div");
            row.className = "disc-incidents";
            row.innerHTML = incidents.map(i =>
                '<div class="disc-incident" data-tip="' + escapeAttr(getStatTooltip(i.key) || i.label) + '">' +
                    '<span class="disc-incident-icon">' + i.icon + '</span> ' +
                    '<span class="disc-incident-val">' + i.val + '</span> ' +
                    '<span style="opacity:0.55">' + i.label + '</span>' +
                '</div>'
            ).join("");
            sec.appendChild(row);
        }

        return sec;
    }

    // --- Team impact ---

    function buildTeamImpact(player) {
        const r = player.real || {};
        if (r.onG == null && r.plusMinus == null && r.onOff == null) return null;

        const sec = makeSection("Team Impact (On-Pitch)", "How the team performs when this player is on the pitch. Based on FBref team metrics.");

        // On/Off block
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

        // Per-90 bars
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

        // Badges
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

    // --- SCA/GCA breakdown ---

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

        // SCA stacked bar
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

        // GCA summary
        if (r.gca != null && r.gca > 0) {
            const row = document.createElement("div");
            row.className = "sca-bar-row";
            row.innerHTML =
                '<div class="sca-bar-header">' +
                    '<span class="sca-bar-title">Goal-Creating Actions</span>' +
                    '<span class="sca-bar-total">' + r.gca + ' total</span>' +
                '</div>' +
                '<div class="sca-stacked-bar">' +
                    '<div class="sca-segment" style="flex:1;background:#f59e0b" data-tip="GCA: ' + r.gca + '">' + r.gca + '</div>' +
                '</div>';
            container.appendChild(row);
        }

        sec.appendChild(container);
        return sec;
    }

    // --- Goalkeeper panel ---

    function buildGoalkeeperPanel(player) {
        const r = player.real || {};
        if (r.ga == null && r.saves == null && r.psxg == null) return null;

        const sec = makeSection("Goalkeeping", "Shot-stopping, distribution, and sweeper actions for this keeper.", "gk-panel");

        // Shot-stopping
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

        // Record
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
                        '<span class="gk-icon-stat-icon">\uD83E\uDDF1</span>' +
                        '<span class="gk-icon-stat-val">' + r.cs + '</span>' +
                        '<span style="opacity:0.55">clean sheets' + (r.cspct != null ? " (" + r.cspct.toFixed(1) + "%)" : "") + '</span>' +
                    '</div>'
                );
            }
            sec.appendChild(rec);
        }

        // Distribution
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

        // Sweeping
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

        // Penalties faced
        if (r.pka != null && r.pka > 0) {
            const pk = document.createElement("div");
            pk.className = "gk-sub-section";
            pk.innerHTML =
                '<div class="gk-sub-title">Penalties Faced</div>' +
                '<div class="gk-icon-stat" data-tip="Penalties faced / saved">' +
                    '<span class="gk-icon-stat-icon">\u26BD</span>' +
                    '<span class="gk-icon-stat-val">' + (r.pksv || 0) + ' / ' + r.pka + '</span>' +
                    '<span style="opacity:0.55">saved</span>' +
                '</div>';
            sec.appendChild(pk);
        }

        return sec;
    }

    return {
        init(data) { pctCache = buildPercentileCache(data); },
        openModal
    };
}
