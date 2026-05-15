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

    const fInt = v => v.toFixed(0);
    const fDec = v => v.toFixed(2);
    const fPct = v => v.toFixed(0) + "%";
    const REAL_SIGNALS_BY_POS = {
        ST: [
            { key: "gls",       label: "Goals",       fmt: fInt },
            { key: "npxg90",    label: "npxG/90",     fmt: fDec },
            { key: "sh90",      label: "Shots/90",    fmt: fDec },
            { key: "aerialwon", label: "Aerials %",   fmt: fPct }
        ],
        WG: [
            { key: "gls",       label: "Goals",       fmt: fInt },
            { key: "ast",       label: "Assists",     fmt: fInt },
            { key: "xag90",     label: "xAG/90",      fmt: fDec },
            { key: "to90",      label: "Take-ons/90", fmt: fDec }
        ],
        AM: [
            { key: "ast",       label: "Assists",     fmt: fInt },
            { key: "kp90",      label: "KP/90",       fmt: fDec },
            { key: "sca90",     label: "SCA/90",      fmt: fDec },
            { key: "xag90",     label: "xAG/90",      fmt: fDec }
        ],
        CM: [
            { key: "cmppct",    label: "Pass %",      fmt: fPct },
            { key: "kp90",      label: "KP/90",       fmt: fDec },
            { key: "prgp90",    label: "PrgP/90",     fmt: fDec },
            { key: "tklint90",  label: "Tkl+Int/90",  fmt: fDec }
        ],
        DM: [
            { key: "tklint90",  label: "Tkl+Int/90",  fmt: fDec },
            { key: "recov90",   label: "Recoveries/90", fmt: fDec },
            { key: "cmppct",    label: "Pass %",      fmt: fPct },
            { key: "aerialwon", label: "Aerials %",   fmt: fPct }
        ],
        FB: [
            { key: "tklint90",  label: "Tkl+Int/90",  fmt: fDec },
            { key: "crspa90",   label: "CrsPA/90",    fmt: fDec },
            { key: "prgc90",    label: "PrgC/90",     fmt: fDec },
            { key: "cmppct",    label: "Pass %",      fmt: fPct }
        ],
        CB: [
            { key: "tklint90",  label: "Tkl+Int/90",  fmt: fDec },
            { key: "aerialwon", label: "Aerials %",   fmt: fPct },
            { key: "clr90",     label: "Clearances/90", fmt: fDec },
            { key: "cmppct",    label: "Pass %",      fmt: fPct }
        ],
        GK: [
            { key: "savepct",   label: "Save %",      fmt: v => v.toFixed(1) + "%" },
            { key: "cs",        label: "Clean sheets", fmt: fInt },
            { key: "cspct",     label: "Clean sheet %", fmt: fPct },
            { key: "ga90",      label: "GA/90",       fmt: fDec, inv: true }
        ]
    };

    const POOL = data.filter(p => p.subScores && typeof p.minutes === "number" && p.minutes > 600);
    if (POOL.length < 2) return;

    const SUBPOS_ORDER = ["ST", "WG", "AM", "CM", "DM", "FB", "CB", "GK"];
    const SUBPOS_LABEL = {
        ST: "Strikers", WG: "Wingers", AM: "Attacking mids",
        CM: "Central mids", DM: "Defensive mids",
        FB: "Full-backs", CB: "Centre-backs", GK: "Goalkeepers"
    };

    function poolForSubPos(subPos) {
        return POOL.filter(p => p.subPos === subPos && typeof p.gap === "number");
    }

    function defaultSubPos() {
        for (const sp of SUBPOS_ORDER) {
            if (poolForSubPos(sp).length >= 2) return sp;
        }
        return POOL[0].subPos;
    }

    let activeSubPos = defaultSubPos();
    let selection = pickContrastingPair(activeSubPos);

    function pickContrastingPair(subPos) {
        const pool = poolForSubPos(subPos);
        if (!pool.length) return [];
        const starters = pool.filter(p => p.minutes >= 1500);
        const sorted = (starters.length >= 2 ? starters : pool).slice().sort((a, b) => b.gap - a.gap);
        const out = [];
        if (sorted.length) out.push(sorted[0]);
        if (sorted.length > 1) out.push(sorted[sorted.length - 1]);
        return out;
    }

    const posTabs = SUBPOS_ORDER
        .filter(sp => poolForSubPos(sp).length >= 2)
        .map(sp =>
            '<button class="overlay-pos-tab" type="button" data-pos="' + sp + '">' +
                '<span class="overlay-pos-tab-code">' + sp + '</span>' +
                '<span class="overlay-pos-tab-name">' + SUBPOS_LABEL[sp] + '</span>' +
            '</button>'
        ).join("");

    ROOT.innerHTML =
        '<div class="chapter-head">' +
            '<span class="chapter-kicker">&sect; 04 &middot; THE OVERLAY</span>' +
            '<h3 class="chapter-title">Same role, different DNA.</h3>' +
            '<p class="chapter-sub">Pick a position, then stack up to three players from that role and see where their fingerprints diverge.</p>' +
        '</div>' +
        '<div class="overlay-pos-tabs" id="overlay-pos-tabs">' + posTabs + '</div>' +
        '<div class="overlay-picker">' +
            '<div class="overlay-chips" id="overlay-chips"></div>' +
            '<div class="overlay-search-wrap">' +
                '<input type="text" id="overlay-input" class="overlay-input" placeholder="Search within the active role..." autocomplete="off" spellcheck="false">' +
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

    const tabsEl = ROOT.querySelector("#overlay-pos-tabs");
    function renderPosTabs() {
        tabsEl.querySelectorAll(".overlay-pos-tab").forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.pos === activeSubPos);
        });
    }
    tabsEl.querySelectorAll(".overlay-pos-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            const sp = btn.dataset.pos;
            if (sp === activeSubPos) return;
            activeSubPos = sp;
            selection = pickContrastingPair(activeSubPos);
            renderAll();
        });
    });

    const chipsEl  = ROOT.querySelector("#overlay-chips");
    const inputEl  = ROOT.querySelector("#overlay-input");
    const sugEl    = ROOT.querySelector("#overlay-suggestions");
    const legendEl = ROOT.querySelector("#overlay-legend");
    const tableEl  = ROOT.querySelector("#overlay-table");
    const svgEl    = ROOT.querySelector("#overlay-radar");

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
            : '<span class="overlay-chip-slot overlay-chip-slot-full">Slots full. Remove one to swap.</span>';
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
        const subPool = poolForSubPos(activeSubPos);
        if (!q) {
            return subPool
                .slice()
                .sort((a, b) => (b.minutes || 0) - (a.minutes || 0))
                .slice(0, 8);
        }
        const qn = q.toLowerCase();
        const scored = [];
        for (let i = 0; i < subPool.length; i++) {
            const p = subPool[i];
            const name = (p.name || "").toLowerCase();
            const club = (p.club || "").toLowerCase();
            if (name.indexOf(qn) === -1 && club.indexOf(qn) === -1) continue;
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
        const q = inputEl.value.trim();
        openSuggestions(searchPlayers(q));
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

        R.rings.forEach(function (ratio, rIdx) {
            const pts = AXES.map((_, i) => gridPoint(i, ratio).join(",")).join(" ");
            const isOuter = rIdx === R.rings.length - 1;
            svg += '<polygon points="' + pts + '" class="overlay-radar-ring' + (isOuter ? " is-outer" : "") + '"/>';
        });

        AXES.forEach(function (_, i) {
            const [x, y] = gridPoint(i, 1.0);
            svg += '<line x1="' + R.cx + '" y1="' + R.cy + '" x2="' + x + '" y2="' + y + '" class="overlay-radar-spoke"/>';
        });

        R.rings.forEach(function (ratio) {
            const y = R.cy - R.radius * ratio;
            svg += '<text x="' + (R.cx + 3) + '" y="' + (y - 2) + '" class="overlay-radar-ringlabel">' + Math.round(ratio * 100) + '</text>';
        });

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

        selection.forEach(function (p, pi) {
            const slot = SLOTS[pi];
            const pts = AXES.map(function (ax, i) {
                const v = (p.subScores && p.subScores[ax.key]) || 0;
                return axisPoint(i, v).join(",");
            }).join(" ");
            svg += '<polygon points="' + pts + '" class="overlay-radar-poly" ' +
                   'style="fill:' + slot.tint + ';stroke:' + slot.color + '"/>';
        });

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

    function renderLegend() {
        legendEl.innerHTML = selection.map(function (p, i) {
            const slot = SLOTS[i];
            const avatar = avatarHTMLString(p.photo, p.name, "overlay-card-avatar-img", "overlay-card-avatar-fallback");
            const gapCls = p.gap > 1 ? "is-under" : (p.gap < -1 ? "is-over" : "is-fair");
            return '<button type="button" class="overlay-card" data-name="' + escapeAttr(p.name) + '" ' +
                       'style="--slot-color:' + slot.color + ';--slot-tint:' + slot.tint + '">' +
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
                       '<span class="overlay-card-open">Open dossier &rsaquo;</span>' +
                   '</button>';
        }).join("");

        legendEl.querySelectorAll(".overlay-card").forEach(card => {
            card.addEventListener("mouseenter", (ev) => showOverlayTip(card, ev));
            card.addEventListener("mousemove", (ev) => moveOverlayTip(ev));
            card.addEventListener("mouseleave", () => hideOverlayTip());
            card.addEventListener("click", () => {
                const name = card.dataset.name;
                const p = selection.find(x => x.name === name) || data.find(x => x.name === name);
                if (!p) return;
                hideOverlayTip();
                openOverlayPlayerModal(p);
            });
        });
    }

    const GROUP_BY_SUBPOS = { ST: "FW", WG: "FW", AM: "MF", CM: "MF", DM: "MF", FB: "DF", CB: "DF", GK: "GK" };
    let overlayModal = null;
    function ensureOverlayModal() {
        if (overlayModal) return overlayModal;
        if (typeof createModalManager !== "function") return null;
        const tipEl = document.createElement("div");
        tipEl.className = "stat-tip";
        document.body.appendChild(tipEl);
        overlayModal = createModalManager(tipEl);
        overlayModal.init(data);
        return overlayModal;
    }
    function openOverlayPlayerModal(p) {
        const mgr = ensureOverlayModal();
        if (!mgr) return;
        const group = GROUP_BY_SUBPOS[p.subPos] || "FW";
        const posPlayers = data.filter(x => x.subPos === p.subPos);
        const byOvr = posPlayers.slice().sort((a, b) => (b.ea?.ovr || 0) - (a.ea?.ovr || 0));
        const byComp = posPlayers.slice().sort((a, b) => (b.composite || 0) - (a.composite || 0));
        const eaRankMap = {}, compRankMap = {};
        byOvr.forEach((x, i) => eaRankMap[x.name] = i + 1);
        byComp.forEach((x, i) => compRankMap[x.name] = i + 1);
        mgr.openModal(p, group, eaRankMap, compRankMap, posPlayers, null);
    }

    let overlayTipEl = null;
    function ensureOverlayTip() {
        if (overlayTipEl) return overlayTipEl;
        overlayTipEl = document.createElement("div");
        overlayTipEl.className = "wall-card-tip";
        document.body.appendChild(overlayTipEl);
        return overlayTipEl;
    }
    function showOverlayTip(card, ev) {
        const name = card.dataset.name;
        const p = selection.find(x => x.name === name) || data.find(x => x.name === name);
        if (!p || !p.subScores) return;
        const tip = ensureOverlayTip();
        const ovr = p.ea?.ovr ?? null;
        const comp = p.composite != null ? p.composite.toFixed(1) : "-";
        const gap = p.gap != null ? p.gap : 0;
        const gapStr = (gap >= 0 ? "+" : "") + gap.toFixed(1);
        const gapColor = gap > 1 ? "var(--win,#4ade80)" : gap < -1 ? "var(--red,#ef4444)" : "var(--text-muted)";
        const dims = ["scoring", "creation", "progression", "defense", "discipline"];
        const subLabel = SUBPOS_LABEL[p.subPos] || p.subPos || "";
        let bars = "";
        for (const d of dims) {
            const v = p.subScores[d];
            if (v == null) continue;
            const w = Math.max(2, Math.min(100, v));
            bars +=
                '<div class="wct-row">' +
                    '<span class="wct-l">' + d + '</span>' +
                    '<span class="wct-bar"><span class="wct-fill" style="width:' + w.toFixed(0) + '%"></span></span>' +
                    '<span class="wct-v">' + v.toFixed(0) + '</span>' +
                '</div>';
        }
        const verdict = gap > 5
            ? "Outperforms his OVR by " + Math.abs(gap).toFixed(1) + " points."
            : gap < -5
                ? "Underperforms his OVR by " + Math.abs(gap).toFixed(1) + " points."
                : "Composite is within " + Math.abs(gap).toFixed(1) + " of his OVR.";
        tip.innerHTML =
            '<div class="wct-head">' +
                '<strong class="wct-name">' + p.name + '</strong>' +
                '<span class="wct-meta">' + (p.club || "") + ' · ' + subLabel + '</span>' +
            '</div>' +
            '<div class="wct-stats">' +
                '<span><b>OVR</b> ' + (ovr != null ? ovr : "-") + '</span>' +
                '<span><b>CMP</b> ' + comp + '</span>' +
                '<span style="color:' + gapColor + '"><b>Gap</b> ' + gapStr + '</span>' +
            '</div>' +
            '<div class="wct-bars">' + bars + '</div>' +
            '<p class="wct-verdict">' + verdict + '</p>' +
            '<div class="wct-foot">Click for the full dossier</div>';
        tip.classList.add("show");
        moveOverlayTip(ev);
    }
    function moveOverlayTip(ev) {
        if (!overlayTipEl || !overlayTipEl.classList.contains("show")) return;
        const margin = 14;
        const w = overlayTipEl.offsetWidth || 280;
        const h = overlayTipEl.offsetHeight || 220;
        let left = ev.clientX + margin;
        let top = ev.clientY + margin;
        if (left + w > window.innerWidth - 8) left = ev.clientX - w - margin;
        if (top + h > window.innerHeight - 8) top = ev.clientY - h - margin;
        if (left < 8) left = 8;
        if (top < 8) top = 8;
        overlayTipEl.style.left = left + "px";
        overlayTipEl.style.top = top + "px";
    }
    function hideOverlayTip() {
        if (!overlayTipEl) return;
        overlayTipEl.classList.remove("show");
    }

    function renderTable() {
        const headCells = selection.map(function (p, i) {
            return '<th class="overlay-th" style="--slot-color:' + SLOTS[i].color + '">' +
                       '<span class="overlay-th-dot"></span>' +
                       '<span class="overlay-th-name">' + escapeAttr(p.name.split(" ").slice(-1)[0]) + '</span>' +
                   '</th>';
        }).join("");

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

        const signals = (REAL_SIGNALS_BY_POS[activeSubPos] || [])
            .filter(s => selection.some(p => p.real && p.real[s.key] != null));
        if (signals.length) {
            rows.push('<tr class="overlay-sep"><td colspan="' + (selection.length + 1) + '"></td></tr>');
            rows.push('<tr class="overlay-subhead"><th class="overlay-rowhead overlay-rowhead-sub" colspan="' + (selection.length + 1) + '">Real signals</th></tr>');
            signals.forEach(function (sig) {
                const values = selection.map(p => (p.real && p.real[sig.key] != null) ? p.real[sig.key] : null);
                const present = values.filter(v => v != null);
                if (!present.length) return;
                const best = sig.inv
                    ? Math.min.apply(null, present)
                    : Math.max.apply(null, present);
                const max = Math.max.apply(null, present.map(Math.abs));
                const cells = values.map(function (v, i) {
                    if (v == null) return '<td class="overlay-td">-</td>';
                    const ratio = max > 0 ? Math.max(0, Math.min(1, Math.abs(v) / max)) : 0;
                    const isBest = v === best;
                    return '<td class="overlay-td' + (isBest ? " is-best" : "") + '" ' +
                           'style="--cell-ratio:' + ratio.toFixed(3) + ';--slot-color:' + SLOTS[i].color + '">' +
                           '<span class="overlay-td-bar"></span>' +
                           '<span class="overlay-td-val">' + sig.fmt(v) + '</span>' +
                           '</td>';
                }).join("");
                rows.push('<tr><th class="overlay-rowhead">' + sig.label + '</th>' + cells + '</tr>');
            });
        }

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
        renderPosTabs();
        renderChips();
        renderRadar();
        renderLegend();
        renderTable();
        if (inputEl) inputEl.placeholder = "Search a " + (SUBPOS_LABEL[activeSubPos] || "player").toLowerCase().replace(/s$/, "") + "...";
    }

    renderAll();
}
