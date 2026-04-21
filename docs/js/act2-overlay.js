// Act 2 — The Overlay: 2-3 player radar comparison on 5 sub-score dimensions.

function initOverlay(data) {
    const ROOT = document.getElementById("overlay-section");
    if (!ROOT || !data || !data.length) return;

    const SLOTS = [
        { key: "A", color: "#d4af37", tint: "rgba(212, 175, 55, 0.18)" },
        { key: "B", color: "#4da6ff", tint: "rgba(77, 166, 255, 0.18)" },
        { key: "C", color: "#b37aa8", tint: "rgba(179, 122, 168, 0.18)" }
    ];
    const MAX_PLAYERS = 3;

    const AXES = [
        { key: "scoring",     label: "Scoring" },
        { key: "creation",    label: "Creation" },
        { key: "progression", label: "Progression" },
        { key: "defense",     label: "Defense" },
        { key: "discipline",  label: "Discipline" }
    ];

    const POOL = data.filter(p => p.subScores && typeof p.minutes === "number" && p.minutes > 600);
    if (POOL.length < 2) return;

    // Default pick: contrast one standout underrated vs one standout overrated starter (min 1500 min so the names are recognizable).
    const starters = POOL.filter(p => p.subPos !== "GK" && typeof p.gap === "number" && p.minutes >= 1500);
    const starterPool = starters.length >= 2 ? starters : POOL.filter(p => p.subPos !== "GK" && typeof p.gap === "number");
    const byGap = [...starterPool].sort((a, b) => b.gap - a.gap);
    const selection = [];
    if (byGap.length) selection.push(byGap[0]);
    if (byGap.length > 1) selection.push(byGap[byGap.length - 1]);

    // --- Render skeleton ---
    ROOT.innerHTML =
        '<div class="chapter-head">' +
            '<span class="chapter-kicker">&sect; 03 &middot; THE OVERLAY</span>' +
            '<h3 class="chapter-title">Two profiles, one pentagon.</h3>' +
            '<p class="chapter-sub">Add up to three players. See where their DNA matches &mdash; and where it breaks.</p>' +
        '</div>' +
        '<div class="overlay-picker">' +
            '<div class="overlay-chips" id="overlay-chips"></div>' +
            '<div class="overlay-search-wrap">' +
                '<input type="text" id="overlay-input" class="overlay-input" placeholder="Search a player by name or club..." autocomplete="off" spellcheck="false">' +
                '<div class="overlay-suggestions" id="overlay-suggestions" role="listbox"></div>' +
            '</div>' +
        '</div>' +
        '<div class="overlay-body">' +
            '<div class="overlay-radar-col">' +
                '<svg id="overlay-radar" class="overlay-radar-svg" viewBox="0 0 520 520" preserveAspectRatio="xMidYMid meet"></svg>' +
            '</div>' +
            '<div class="overlay-legend-col" id="overlay-legend"></div>' +
        '</div>' +
        '<div class="overlay-table-wrap">' +
            '<table class="overlay-table" id="overlay-table"></table>' +
        '</div>';

    const chipsEl  = ROOT.querySelector("#overlay-chips");
    const inputEl  = ROOT.querySelector("#overlay-input");
    const sugEl    = ROOT.querySelector("#overlay-suggestions");
    const legendEl = ROOT.querySelector("#overlay-legend");
    const tableEl  = ROOT.querySelector("#overlay-table");
    const svgEl    = ROOT.querySelector("#overlay-radar");

    // --- Chips ---
    function renderChips() {
        const parts = selection.map(function (p, i) {
            const slot = SLOTS[i];
            return '<span class="overlay-chip" data-index="' + i + '" style="--chip-color:' + slot.color + ';--chip-tint:' + slot.tint + '">' +
                       '<span class="overlay-chip-dot"></span>' +
                       '<span class="overlay-chip-name">' + escapeAttr(p.name) + '</span>' +
                       '<button class="overlay-chip-x" aria-label="Remove" data-remove="' + i + '">&times;</button>' +
                   '</span>';
        }).join("");
        const pill = selection.length < MAX_PLAYERS
            ? '<span class="overlay-chip-slot">Add ' + (selection.length === 0 ? "a" : "another") + ' player</span>'
            : '<span class="overlay-chip-slot overlay-chip-slot-full">Slots full &mdash; remove one to swap</span>';
        chipsEl.innerHTML = parts + pill;

        chipsEl.querySelectorAll("[data-remove]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                const i = parseInt(btn.getAttribute("data-remove"), 10);
                if (selection.length <= 1) return;
                selection.splice(i, 1);
                renderAll();
            });
        });
    }

    // --- Suggestions ---
    let activeSugIdx = -1;

    function openSuggestions(matches) {
        if (!matches.length) {
            sugEl.innerHTML = '<div class="overlay-sug-empty">No matches</div>';
            sugEl.classList.add("open");
            return;
        }
        sugEl.innerHTML = matches.map(function (p, i) {
            const isDup = selection.some(s => s && s.name === p.name && s.club === p.club);
            const avatar = avatarHTMLString(p.photo, p.name, "overlay-sug-avatar-img", "overlay-sug-avatar-fallback");
            return '<button class="overlay-sug-item' + (isDup ? " is-disabled" : "") +
                       '" data-idx="' + i + '"' + (isDup ? ' disabled' : '') + '>' +
                       '<span class="overlay-sug-avatar">' + avatar + '</span>' +
                       '<span class="overlay-sug-text">' +
                           '<span class="overlay-sug-name">' + escapeAttr(p.name) + '</span>' +
                           '<span class="overlay-sug-meta">' + escapeAttr(p.club || "-") + ' &middot; ' + escapeAttr(p.subPos || "-") +
                           ' &middot; OVR ' + (p.ea && p.ea.ovr != null ? p.ea.ovr : "-") + '</span>' +
                       '</span>' +
                   '</button>';
        }).join("");
        sugEl.classList.add("open");
        activeSugIdx = -1;

        sugEl.querySelectorAll(".overlay-sug-item").forEach(function (btn) {
            btn.addEventListener("mousedown", function (e) {
                e.preventDefault();
                if (btn.disabled) return;
                const idx = parseInt(btn.getAttribute("data-idx"), 10);
                pickPlayer(matches[idx]);
            });
        });
    }

    function closeSuggestions() {
        sugEl.classList.remove("open");
        sugEl.innerHTML = "";
        activeSugIdx = -1;
    }

    function pickPlayer(p) {
        if (!p) return;
        if (selection.some(s => s.name === p.name && s.club === p.club)) return;
        if (selection.length >= MAX_PLAYERS) return;
        selection.push(p);
        inputEl.value = "";
        closeSuggestions();
        renderAll();
    }

    function searchPlayers(q) {
        if (!q) return [];
        const qn = q.toLowerCase();
        const scored = [];
        for (let i = 0; i < POOL.length; i++) {
            const p = POOL[i];
            const name = (p.name || "").toLowerCase();
            const club = (p.club || "").toLowerCase();
            if (name.indexOf(qn) === -1 && club.indexOf(qn) === -1) continue;
            // Prioritize name prefix → name contains → club
            let score = 10;
            if (name.startsWith(qn)) score = 0;
            else if (name.indexOf(qn) !== -1) score = 1;
            else if (club.startsWith(qn)) score = 2;
            else score = 3;
            scored.push({ p: p, s: score, ovr: (p.ea && p.ea.ovr) || 0 });
        }
        scored.sort(function (a, b) { return a.s - b.s || b.ovr - a.ovr; });
        return scored.slice(0, 8).map(x => x.p);
    }

    inputEl.addEventListener("input", function () {
        const matches = searchPlayers(inputEl.value.trim());
        if (!inputEl.value.trim()) { closeSuggestions(); return; }
        openSuggestions(matches);
    });
    inputEl.addEventListener("focus", function () {
        if (inputEl.value.trim()) openSuggestions(searchPlayers(inputEl.value.trim()));
    });
    inputEl.addEventListener("keydown", function (e) {
        const items = sugEl.querySelectorAll(".overlay-sug-item:not(.is-disabled)");
        if (e.key === "ArrowDown" && items.length) {
            e.preventDefault();
            activeSugIdx = (activeSugIdx + 1) % items.length;
            items.forEach((el, i) => el.classList.toggle("is-active", i === activeSugIdx));
            items[activeSugIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "ArrowUp" && items.length) {
            e.preventDefault();
            activeSugIdx = (activeSugIdx - 1 + items.length) % items.length;
            items.forEach((el, i) => el.classList.toggle("is-active", i === activeSugIdx));
            items[activeSugIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
            if (activeSugIdx >= 0 && items[activeSugIdx]) {
                e.preventDefault();
                items[activeSugIdx].dispatchEvent(new MouseEvent("mousedown"));
            } else {
                const first = sugEl.querySelector(".overlay-sug-item:not(.is-disabled)");
                if (first) { e.preventDefault(); first.dispatchEvent(new MouseEvent("mousedown")); }
            }
        } else if (e.key === "Escape") {
            closeSuggestions();
        }
    });
    document.addEventListener("click", function (e) {
        if (!ROOT.contains(e.target)) closeSuggestions();
        else if (!sugEl.contains(e.target) && e.target !== inputEl) closeSuggestions();
    });

    // --- Radar ---
    const R = {
        cx: 260, cy: 260, radius: 178,
        rings: [0.2, 0.4, 0.6, 0.8, 1.0],
        labelOffset: 24
    };

    function axisPoint(idx, value) {
        const angle = -Math.PI / 2 + idx * (2 * Math.PI / AXES.length);
        const r = R.radius * Math.max(0, Math.min(100, value)) / 100;
        return [R.cx + r * Math.cos(angle), R.cy + r * Math.sin(angle)];
    }

    function gridPoint(idx, ratio) {
        const angle = -Math.PI / 2 + idx * (2 * Math.PI / AXES.length);
        const r = R.radius * ratio;
        return [R.cx + r * Math.cos(angle), R.cy + r * Math.sin(angle)];
    }

    function renderRadar() {
        let svg = '';

        // Concentric rings (pentagons)
        R.rings.forEach(function (ratio, rIdx) {
            const pts = AXES.map((_, i) => gridPoint(i, ratio).join(",")).join(" ");
            const isOuter = rIdx === R.rings.length - 1;
            svg += '<polygon points="' + pts + '" class="overlay-radar-ring' + (isOuter ? " is-outer" : "") + '"/>';
        });

        // Spokes
        AXES.forEach(function (_, i) {
            const [x, y] = gridPoint(i, 1.0);
            svg += '<line x1="' + R.cx + '" y1="' + R.cy + '" x2="' + x + '" y2="' + y + '" class="overlay-radar-spoke"/>';
        });

        // Ring labels (on the top spoke only, at ratio 0.2/0.4/.../1.0)
        R.rings.forEach(function (ratio) {
            const y = R.cy - R.radius * ratio;
            svg += '<text x="' + (R.cx + 3) + '" y="' + (y - 2) + '" class="overlay-radar-ringlabel">' + Math.round(ratio * 100) + '</text>';
        });

        // Axis labels
        AXES.forEach(function (ax, i) {
            const angle = -Math.PI / 2 + i * (2 * Math.PI / AXES.length);
            const lx = R.cx + (R.radius + R.labelOffset) * Math.cos(angle);
            const ly = R.cy + (R.radius + R.labelOffset) * Math.sin(angle);
            let anchor = "middle";
            if (Math.cos(angle) > 0.3) anchor = "start";
            else if (Math.cos(angle) < -0.3) anchor = "end";
            svg += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor +
                   '" dominant-baseline="middle" class="overlay-radar-axislabel">' + ax.label + '</text>';
        });

        // Player polygons
        selection.forEach(function (p, pi) {
            const slot = SLOTS[pi];
            const pts = AXES.map(function (ax, i) {
                const v = (p.subScores && p.subScores[ax.key]) || 0;
                return axisPoint(i, v).join(",");
            }).join(" ");
            svg += '<polygon points="' + pts + '" class="overlay-radar-poly" ' +
                   'style="fill:' + slot.tint + ';stroke:' + slot.color + '"/>';
        });

        // Vertex dots + value labels (drawn last so they sit on top)
        selection.forEach(function (p, pi) {
            const slot = SLOTS[pi];
            AXES.forEach(function (ax, i) {
                const v = (p.subScores && p.subScores[ax.key]) || 0;
                const [x, y] = axisPoint(i, v);
                svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" ' +
                       'class="overlay-radar-dot" style="fill:' + slot.color + '"><title>' +
                       escapeAttr(p.name) + ' &middot; ' + ax.label + ': ' + v.toFixed(1) + '</title></circle>';
            });
        });

        svgEl.innerHTML = svg;
    }

    // --- Legend / cards ---
    function renderLegend() {
        legendEl.innerHTML = selection.map(function (p, i) {
            const slot = SLOTS[i];
            const avatar = avatarHTMLString(p.photo, p.name, "overlay-card-avatar-img", "overlay-card-avatar-fallback");
            const gapCls = p.gap > 1 ? "is-under" : (p.gap < -1 ? "is-over" : "is-fair");
            return '<div class="overlay-card" style="--slot-color:' + slot.color + ';--slot-tint:' + slot.tint + '">' +
                       '<div class="overlay-card-swatch"></div>' +
                       '<div class="overlay-card-avatar">' + avatar + '</div>' +
                       '<div class="overlay-card-text">' +
                           '<div class="overlay-card-name">' + escapeAttr(p.name) + '</div>' +
                           '<div class="overlay-card-meta">' +
                               escapeAttr(p.club || "") + ' &middot; ' + escapeAttr(p.subPos || "") +
                           '</div>' +
                           '<div class="overlay-card-nums">' +
                               '<span class="overlay-card-num"><span class="overlay-card-num-l">OVR</span>' +
                                   '<span class="overlay-card-num-v">' + (p.ea && p.ea.ovr != null ? p.ea.ovr : "-") + '</span></span>' +
                               '<span class="overlay-card-num"><span class="overlay-card-num-l">CMP</span>' +
                                   '<span class="overlay-card-num-v">' + (p.composite != null ? p.composite.toFixed(0) : "-") + '</span></span>' +
                               '<span class="overlay-card-num overlay-card-gap ' + gapCls + '">' +
                                   '<span class="overlay-card-num-l">GAP</span>' +
                                   '<span class="overlay-card-num-v">' + (p.gap != null ? formatGap(p.gap) : "-") + '</span></span>' +
                           '</div>' +
                       '</div>' +
                   '</div>';
        }).join("");
    }

    // --- Comparison table ---
    function renderTable() {
        // Columns: metric | player slots
        const headCells = selection.map(function (p, i) {
            return '<th class="overlay-th" style="--slot-color:' + SLOTS[i].color + '">' +
                       '<span class="overlay-th-dot"></span>' +
                       '<span class="overlay-th-name">' + escapeAttr(p.name.split(" ").slice(-1)[0]) + '</span>' +
                   '</th>';
        }).join("");

        // Rows: 5 axes + OVR + Composite + Gap
        const rows = [];
        AXES.forEach(function (ax) {
            const values = selection.map(p => (p.subScores && p.subScores[ax.key]) != null ? p.subScores[ax.key] : null);
            const max = Math.max.apply(null, values.filter(v => v != null));
            const cells = values.map(function (v, i) {
                if (v == null) return '<td class="overlay-td">-</td>';
                const ratio = Math.max(0, Math.min(1, v / 100));
                const isMax = v === max;
                return '<td class="overlay-td' + (isMax ? " is-best" : "") + '" ' +
                       'style="--cell-ratio:' + ratio.toFixed(3) + ';--slot-color:' + SLOTS[i].color + '">' +
                       '<span class="overlay-td-bar"></span>' +
                       '<span class="overlay-td-val">' + v.toFixed(0) + '</span>' +
                       '</td>';
            }).join("");
            rows.push('<tr><th class="overlay-rowhead">' + ax.label + '</th>' + cells + '</tr>');
        });

        // OVR, Composite, Gap — separator row then these summary stats
        function summaryCells(valueFn, fmtFn, highBestFn, tintFn) {
            const values = selection.map(valueFn);
            const best = highBestFn(values);
            return values.map(function (v, i) {
                if (v == null) return '<td class="overlay-td overlay-td-summary">-</td>';
                const tint = tintFn ? tintFn(v, i) : '';
                const isBest = v === best;
                return '<td class="overlay-td overlay-td-summary' + (isBest ? " is-best" : "") +
                       '" style="--slot-color:' + SLOTS[i].color + (tint ? ';' + tint : '') + '">' +
                       '<span class="overlay-td-val">' + fmtFn(v) + '</span></td>';
            }).join("");
        }

        rows.push('<tr class="overlay-sep"><td colspan="' + (selection.length + 1) + '"></td></tr>');
        rows.push('<tr><th class="overlay-rowhead">OVR</th>' +
            summaryCells(p => (p.ea && p.ea.ovr) || null, v => v, arr => Math.max.apply(null, arr.filter(v => v != null))) + '</tr>');
        rows.push('<tr><th class="overlay-rowhead">Composite</th>' +
            summaryCells(p => p.composite, v => v.toFixed(1), arr => Math.max.apply(null, arr.filter(v => v != null))) + '</tr>');
        rows.push('<tr><th class="overlay-rowhead">Gap</th>' +
            summaryCells(
                p => p.gap,
                v => formatGap(v),
                arr => Math.max.apply(null, arr.filter(v => v != null)),
                function (v) {
                    if (v > 1) return '--gap-color:#6dbf8a';
                    if (v < -1) return '--gap-color:#e66a5c';
                    return '--gap-color:rgba(233, 228, 212, 0.5)';
                }
            ) + '</tr>');

        tableEl.innerHTML =
            '<thead><tr><th class="overlay-rowhead overlay-rowhead-top">Dimension</th>' + headCells + '</tr></thead>' +
            '<tbody>' + rows.join("") + '</tbody>';
    }

    function renderAll() {
        renderChips();
        renderRadar();
        renderLegend();
        renderTable();
    }

    renderAll();
}
