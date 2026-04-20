function createLinesManager(splitContainer, eaCardsEl, statsCardsEl) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "split-link-overlay");
    splitContainer.appendChild(svg);

    let activePlayer = null;
    let eaRankMap = {}, statsRankMap = {};

    function setRankMaps(ea, st) { eaRankMap = ea || {}; statsRankMap = st || {}; }

    function findPath(name) {
        return svg.querySelector('path[data-player="' + CSS.escape(name) + '"]');
    }

    function deltaClass(name) {
        const ea = eaRankMap[name], st = statsRankMap[name];
        if (ea == null || st == null) return "link-fair";
        const diff = ea - st; // + = better on real (underrated)
        if (diff >= 3) return "link-under";
        if (diff <= -3) return "link-over";
        return "link-fair";
    }

    function drawLines(sharedNames) {
        svg.innerHTML = "";
        const box = splitContainer.getBoundingClientRect();
        svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
        svg.style.width = box.width + "px";
        svg.style.height = box.height + "px";

        for (const name of Object.keys(sharedNames)) {
            const ea = eaCardsEl.querySelector('[data-player="' + CSS.escape(name) + '"]');
            const st = statsCardsEl.querySelector('[data-player="' + CSS.escape(name) + '"]');
            if (!ea || !st) continue;

            const eaR = ea.getBoundingClientRect();
            const stR = st.getBoundingClientRect();
            const x1 = eaR.right - box.left;
            const y1 = eaR.top + eaR.height / 2 - box.top;
            const x2 = stR.left - box.left;
            const y2 = stR.top + stR.height / 2 - box.top;
            const midX = (x1 + x2) / 2;
            const cpY = (y1 + y2) / 2 + (y2 - y1) * 0.15;

            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${x1} ${y1} Q ${midX} ${cpY} ${x2} ${y2}`);
            path.setAttribute("data-player", name);
            path.setAttribute("class", deltaClass(name));
            svg.appendChild(path);

            if (activePlayer === name) path.classList.add("link-bright");
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
        cards.forEach(card => {
            card.addEventListener("mouseenter", () => {
                const name = card.dataset.player;
                cards.forEach(c => {
                    const match = c.dataset.player === name;
                    c.classList.toggle("highlighted", match);
                    c.classList.toggle("dimmed", !match);
                });
                if (sharedNames[name]) showLine(name, sharedNames);
            });
            card.addEventListener("mouseleave", () => {
                cards.forEach(c => c.classList.remove("highlighted", "dimmed"));
                if (card.dataset.player !== activePlayer) hideLine(card.dataset.player);
            });
        });
    }

    return {
        drawLines, showLine, hideLine, attachHoverListeners, setRankMaps,
        get activePlayer() { return activePlayer; },
        set activePlayer(v) { activePlayer = v; }
    };
}
