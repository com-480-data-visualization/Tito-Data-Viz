function initAct1(data) {
    const TOP_N = 10;
    let currentPos = "FW";

    const toggle = document.getElementById("act1-pos-toggle");
    const eaCardsEl = document.getElementById("ea-cards");
    const statsCardsEl = document.getElementById("stats-cards");
    const splitContainer = document.querySelector(".split-container");
    if (!toggle || !eaCardsEl || !statsCardsEl || !splitContainer) return;

    // Shared tooltip element
    const tipEl = document.createElement("div");
    tipEl.className = "stat-tip";
    document.body.appendChild(tipEl);

    splitContainer.addEventListener("mouseover", e => {
        const t = e.target.closest("[data-tip]");
        if (t) { tipEl.textContent = t.getAttribute("data-tip"); tipEl.classList.add("visible"); }
    });
    splitContainer.addEventListener("mousemove", e => {
        tipEl.style.left = (e.clientX + 12) + "px";
        tipEl.style.top = (e.clientY - 10) + "px";
    });
    splitContainer.addEventListener("mouseout", e => {
        if (e.target.closest("[data-tip]")) tipEl.classList.remove("visible");
    });

    const lines = createLinesManager(splitContainer, eaCardsEl, statsCardsEl);
    const modal = createModalManager(tipEl);
    modal.init(data);

    const SUBPOS_TO_GROUP = { ST: "FW", WG: "FW", AM: "MF", CM: "MF", DM: "MF", FB: "DF", CB: "DF", GK: "GK" };

    function render(pos) {
        currentPos = pos;
        const players = data.filter(p => p.subPos === pos);
        const group = SUBPOS_TO_GROUP[pos] || pos;

        const eaTop = players.slice().sort((a, b) => b.ea.ovr - a.ea.ovr).slice(0, TOP_N);
        const statsTop = players.slice().sort((a, b) => b.composite - a.composite).slice(0, TOP_N);

        const eaNames = new Set(eaTop.map(p => p.name));
        const statsNames = new Set(statsTop.map(p => p.name));
        const shared = {};
        for (const p of eaTop) if (statsNames.has(p.name)) shared[p.name] = true;

        // Rank maps
        const byOvr = players.slice().sort((a, b) => b.ea.ovr - a.ea.ovr);
        const byComp = players.slice().sort((a, b) => b.composite - a.composite);
        const eaRankMap = {}, compRankMap = {};
        byOvr.forEach((p, i) => { eaRankMap[p.name] = i + 1; });
        byComp.forEach((p, i) => { compRankMap[p.name] = i + 1; });

        function onCardClick(p) {
            lines.activePlayer = p.name;
            lines.showLine(p.name, shared);
            modal.openModal(p, group, eaRankMap, compRankMap, players, () => {
                if (lines.activePlayer) {
                    lines.hideLine(lines.activePlayer);
                    lines.activePlayer = null;
                }
            });
        }

        eaCardsEl.innerHTML = "";
        eaTop.forEach((p, i) => {
            const card = buildEACard(p, i, !statsNames.has(p.name), group);
            card.addEventListener("click", () => onCardClick(p));
            eaCardsEl.appendChild(card);
        });

        statsCardsEl.innerHTML = "";
        statsTop.forEach((p, i) => {
            const card = buildStatsCard(p, i, !eaNames.has(p.name), pos);
            card.addEventListener("click", () => onCardClick(p));
            statsCardsEl.appendChild(card);
        });

        // Panel titles
        const label = SUBPOS_LABELS[pos] || POS_LABELS[pos] || pos;
        const eaTitle = document.querySelector(".panel-ea .panel-title");
        const stTitle = document.querySelector(".panel-stats .panel-title");
        if (eaTitle) eaTitle.textContent = "EA Ranking - " + label;
        if (stTitle) stTitle.textContent = "Real Ranking - " + label;

        updateCompositeTooltip();
        requestAnimationFrame(() => { lines.drawLines(shared); lines.attachHoverListeners(shared); });
    }

    // Resize
    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => lines.drawLines(getShared()), 150);
    });

    function getShared() {
        const players = data.filter(p => p.subPos === currentPos);
        const ea = new Set(players.slice().sort((a, b) => b.ea.ovr - a.ea.ovr).slice(0, TOP_N).map(p => p.name));
        const st = new Set(players.slice().sort((a, b) => b.composite - a.composite).slice(0, TOP_N).map(p => p.name));
        const shared = {};
        for (const n of ea) if (st.has(n)) shared[n] = true;
        return shared;
    }

    // Header tooltips
    function addHeaderTooltips() {
        const eaH = document.querySelector(".panel-ea .panel-title");
        const stH = document.querySelector(".panel-stats .panel-title");
        if (eaH && !eaH.querySelector(".info-i")) {
            const el = document.createElement("span");
            el.className = "info-i"; el.dataset.info = STAT_INFO.ovr; el.textContent = "i";
            eaH.appendChild(el);
        }
        if (stH && !stH.querySelector(".info-i")) {
            const el = document.createElement("span");
            el.className = "info-i"; el.dataset.info = compositeInfo(currentPos); el.textContent = "i";
            stH.appendChild(el);
        }
        initInfoTooltips();
    }

    function updateCompositeTooltip() {
        const info = document.querySelector(".panel-stats .panel-header .info-i");
        if (!info) return;
        const text = compositeInfo(currentPos, currentPos);
        info.dataset.info = text;
        const bubble = info.querySelector(".info-bubble");
        if (bubble) bubble.textContent = text;
    }

    addHeaderTooltips();

    // Position toggle
    toggle.addEventListener("click", e => {
        const btn = e.target.closest(".pos-btn");
        if (!btn) return;
        const pos = btn.dataset.pos;
        if (!pos || pos === currentPos) return;
        toggle.querySelectorAll(".pos-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        lines.activePlayer = null;
        render(pos);
    });

    render("ST");
}
