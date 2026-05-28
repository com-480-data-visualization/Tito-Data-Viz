function createLinesManager(splitContainer, eaCardsEl, statsCardsEl) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "split-link-overlay");
    splitContainer.appendChild(svg);

    let activePlayer = null;
    let hoveredPlayer = null;
    let eaRankMap = {}, statsRankMap = {};

    function setRankMaps(ea, st) { eaRankMap = ea || {}; statsRankMap = st || {}; }

    function findPath(name) {
        return svg.querySelector('path[data-player="' + CSS.escape(name) + '"]');
    }

    function deltaClass(name) {
        const ea = eaRankMap[name], st = statsRankMap[name];
        if (ea == null || st == null) return "link-fair";
        const diff = ea - st; // + = better on real (underrated)
        if (diff > 0) return "link-under";
        if (diff < 0) return "link-over";
        return "link-fair";
    }

    function drawLines(sharedNames) {
        svg.innerHTML = "";
        const box = splitContainer.getBoundingClientRect();
        const eaListBox = eaCardsEl.getBoundingClientRect();
        const statsListBox = statsCardsEl.getBoundingClientRect();
        svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
        svg.style.width = box.width + "px";
        svg.style.height = box.height + "px";

        for (const name of Object.keys(sharedNames)) {
            const ea = eaCardsEl.querySelector('[data-player="' + CSS.escape(name) + '"]');
            const st = statsCardsEl.querySelector('[data-player="' + CSS.escape(name) + '"]');
            if (!ea || !st) continue;

            const eaR = ea.getBoundingClientRect();
            const stR = st.getBoundingClientRect();
            const eaMid = eaR.top + eaR.height / 2;
            const stMid = stR.top + stR.height / 2;
            const eaVisible = eaMid >= eaListBox.top && eaMid <= eaListBox.bottom;
            const stVisible = stMid >= statsListBox.top && stMid <= statsListBox.bottom;
            if (!eaVisible || !stVisible) continue;

            const x1 = eaR.right - box.left;
            const y1 = eaMid - box.top;
            const x2 = stR.left - box.left;
            const y2 = stMid - box.top;
            const midX = (x1 + x2) / 2;
            const cpY = (y1 + y2) / 2 + (y2 - y1) * 0.15;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${x1} ${y1} Q ${midX} ${cpY} ${x2} ${y2}`);
            path.setAttribute("data-player", name);
            path.setAttribute("class", deltaClass(name));
            svg.appendChild(path);
            const len = path.getTotalLength();
            path.style.setProperty("--path-length", len.toFixed(2));

            if (activePlayer === name) path.classList.add("link-bright");
            if (hoveredPlayer === name) path.classList.add("link-bright");
        }
    }

    function showLine(name, sharedNames) {
        if (!sharedNames[name]) return;
        const path = findPath(name);
        if (path) path.classList.add("link-bright");
    }

    function hideLine(name) {
        const path = findPath(name);
        if (path) path.classList.remove("link-bright");
    }

    function attachHoverListeners(sharedNames) {
        const cards = splitContainer.querySelectorAll(".fut-card");
        const LEAVE_DELAY = 80;
        let leaveTimer = null;
        let hoveredName = null;

        function clearTransientLines(keepName) {
            svg.querySelectorAll("path.link-bright").forEach(p => {
                const isActive = activePlayer && p.dataset.player === activePlayer;
                const shouldKeep = keepName && p.dataset.player === keepName;
                if (!isActive && !shouldKeep) {
                    p.classList.remove("link-bright");
                }
            });
        }

        function applyHighlight(name) {
            clearTransientLines(name);
            hoveredName = name;
            hoveredPlayer = name;
            cards.forEach(c => {
                const match = c.dataset.player === name;
                c.classList.toggle("highlighted", match);
                c.classList.toggle("dimmed", !match);
            });
            if (sharedNames[name]) showLine(name, sharedNames);
        }

        function clearHighlight() {
            cards.forEach(c => c.classList.remove("highlighted", "dimmed"));
            clearTransientLines(null);
            hoveredName = null;
            hoveredPlayer = null;
        }

        cards.forEach(card => {
            card.addEventListener("mouseenter", () => {
                const name = card.dataset.player;
                clearTimeout(leaveTimer);
                leaveTimer = null;
                if (hoveredName === name) return;
                applyHighlight(name);
            });
            card.addEventListener("mouseleave", e => {
                const nextCard = e.relatedTarget?.closest?.(".fut-card");
                if (nextCard && splitContainer.contains(nextCard)) return;
                clearTimeout(leaveTimer);
                leaveTimer = setTimeout(clearHighlight, LEAVE_DELAY);
            });
        });
    }

    function resetState() {
        activePlayer = null;
        hoveredPlayer = null;
        splitContainer.querySelectorAll(".fut-card").forEach(c => c.classList.remove("highlighted", "dimmed"));
        svg.querySelectorAll("path.link-bright").forEach(p => p.classList.remove("link-bright"));
    }

    return {
        drawLines, showLine, hideLine, attachHoverListeners, setRankMaps, resetState,
        get activePlayer() { return activePlayer; },
        set activePlayer(v) { activePlayer = v; }
    };
}
