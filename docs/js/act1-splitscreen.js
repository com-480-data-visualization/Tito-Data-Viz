function initAct1(data) {
    const TOP_N = 10;
    let currentPos = "FW";

    const toggle = document.getElementById("act1-pos-toggle");
    const eaCardsEl = document.getElementById("ea-cards");
    const statsCardsEl = document.getElementById("stats-cards");
    const splitContainer = document.querySelector(".split-container");
    const compareShell = document.querySelector(".act1-compare-shell");
    const fullscreenBtn = document.getElementById("act1-fullscreen-btn");
    if (!toggle || !eaCardsEl || !statsCardsEl || !splitContainer || !compareShell) return;

    const tipEl = document.createElement("div");
    tipEl.className = "stat-tip";
    document.body.appendChild(tipEl);

    function positionTip(e) {
        const pad = 12;
        const rect = tipEl.getBoundingClientRect();
        const w = rect.width || 260;
        const h = rect.height || 40;
        const x = Math.min(window.innerWidth - w - pad, Math.max(pad, e.clientX + 12));
        const y = Math.min(window.innerHeight - h - pad, Math.max(pad, e.clientY - 10));
        tipEl.style.left = x + "px";
        tipEl.style.top = y + "px";
    }

    splitContainer.addEventListener("mouseover", e => {
        const t = e.target.closest("[data-tip]");
        if (t) {
            tipEl.textContent = t.getAttribute("data-tip");
            tipEl.classList.add("visible");
            positionTip(e);
        }
    });
    splitContainer.addEventListener("mousemove", e => {
        if (tipEl.classList.contains("visible")) positionTip(e);
    });
    splitContainer.addEventListener("mouseout", e => {
        if (e.target.closest("[data-tip]")) tipEl.classList.remove("visible");
    });

    const lines = createLinesManager(splitContainer, eaCardsEl, statsCardsEl);
    const modal = createModalManager(tipEl);
    modal.init(data);

    let syncFrame = null;
    let syncSourceEl = null;
    let syncTargetEl = null;
    const programmaticScrollTop = new WeakMap();
    let focusMode = false;
    let currentShared = {};
    let redrawFrame = null;
    let focusRedrawFrame = null;
    let focusRedrawUntil = 0;
    let focusTransitionTimer = null;
    let renderDelayTimer = null;
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function drawCurrentLines() {
        lines.drawLines(currentShared);
    }

    function requestLinesRedraw() {
        if (redrawFrame !== null) cancelAnimationFrame(redrawFrame);
        redrawFrame = requestAnimationFrame(() => {
            redrawFrame = null;
            drawCurrentLines();
        });
    }

    function requestFocusRedraw(extraDelay = 0) {
        focusRedrawUntil = Math.max(focusRedrawUntil, performance.now() + 520 + extraDelay);
        if (focusRedrawFrame !== null) return;
        const step = () => {
            focusRedrawFrame = null;
            drawCurrentLines();
            if (performance.now() < focusRedrawUntil) {
                focusRedrawFrame = requestAnimationFrame(step);
            }
        };
        focusRedrawFrame = requestAnimationFrame(step);
    }

    function syncScroll(source, target) {
        syncSourceEl = source;
        syncTargetEl = target;
        if (syncFrame !== null) return;
        syncFrame = requestAnimationFrame(() => {
            syncFrame = null;
            if (!syncSourceEl || !syncTargetEl) return;
            const sourceMax = Math.max(0, syncSourceEl.scrollHeight - syncSourceEl.clientHeight);
            const targetMax = Math.max(0, syncTargetEl.scrollHeight - syncTargetEl.clientHeight);
            const ratio = sourceMax > 0 ? (syncSourceEl.scrollTop / sourceMax) : 0;
            const nextTop = Math.round(targetMax * ratio);
            if (Math.abs(syncTargetEl.scrollTop - nextTop) > 0) {
                programmaticScrollTop.set(syncTargetEl, nextTop);
                syncTargetEl.scrollTop = nextTop;
            }
            requestLinesRedraw();
        });
    }

    function consumeProgrammaticScroll(el) {
        const expected = programmaticScrollTop.get(el);
        if (expected === undefined) return false;
        if (Math.abs(expected - el.scrollTop) <= 1) {
            programmaticScrollTop.delete(el);
            return true;
        }
        return false;
    }

    eaCardsEl.addEventListener("scroll", e => {
        if (consumeProgrammaticScroll(e.currentTarget)) return;
        syncScroll(eaCardsEl, statsCardsEl);
    }, { passive: true });
    statsCardsEl.addEventListener("scroll", e => {
        if (consumeProgrammaticScroll(e.currentTarget)) return;
        syncScroll(statsCardsEl, eaCardsEl);
    }, { passive: true });

    function setFocusButtonLabel(isFocused) {
        if (!fullscreenBtn) return;
        fullscreenBtn.setAttribute("aria-label", isFocused ? "Exit ranking focus mode" : "Open ranking focus mode");
        fullscreenBtn.setAttribute("title", isFocused ? "Exit ranking focus mode" : "Open ranking focus mode");
        fullscreenBtn.setAttribute("aria-pressed", isFocused ? "true" : "false");
        const label = fullscreenBtn.querySelector(".act1-fs-label");
        if (label) label.textContent = isFocused ? "Exit" : "Focus";
    }

    function syncFocusModeUI() {
        const viewport = window.visualViewport || null;
        const viewportWidth = viewport ? viewport.width : window.innerWidth;
        const viewportHeight = viewport ? viewport.height : window.innerHeight;
        const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        document.body.style.setProperty("--act1-focus-scrollbar-gap", focusMode ? scrollbarGap + "px" : "0px");
        document.body.style.setProperty("--act1-focus-width", focusMode ? viewportWidth + "px" : "100vw");
        document.body.style.setProperty("--act1-focus-height", focusMode ? viewportHeight + "px" : "100vh");
        document.body.classList.toggle("act1-focus-mode", focusMode);
        compareShell.classList.toggle("is-focused", focusMode);
        setFocusButtonLabel(focusMode);
        requestFocusRedraw();
    }

    function markFocusTransition(isOpening) {
        clearTimeout(focusTransitionTimer);
        compareShell.classList.remove("is-focus-entering", "is-focus-leaving");
        if (!isOpening) return;
        compareShell.classList.add("is-focus-entering");
        focusTransitionTimer = window.setTimeout(() => {
            compareShell.classList.remove("is-focus-entering", "is-focus-leaving");
        }, 540);
    }

    function setFocusMode(nextFocused) {
        if (focusMode === nextFocused) return;
        focusMode = nextFocused;
        markFocusTransition(focusMode);
        syncFocusModeUI();
    }

    window.addEventListener("scroll", () => {
        if (focusMode) requestFocusRedraw(80);
    }, { passive: true });

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
            setFocusMode(!focusMode);
        });
    }

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && focusMode) {
            setFocusMode(false);
        }
    });

    syncFocusModeUI();

    function animateScore(el, decimals) {
        if (!el || reduceMotion) return;
        const target = Number(el.textContent.replace(/,/g, ""));
        if (!Number.isFinite(target)) return;
        const start = Math.max(0, target - (decimals ? 4.8 : 7));
        const startTime = performance.now();
        const duration = 620;
        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const value = start + (target - start) * eased;
            el.textContent = decimals ? value.toFixed(decimals) : Math.round(value);
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function runCardMotion(reason) {
        const eaCards = Array.from(eaCardsEl.querySelectorAll(".fut-card"));
        const statsCards = Array.from(statsCardsEl.querySelectorAll(".fut-card"));
        const allCards = eaCards.concat(statsCards);
        if (!allCards.length) return;

        function deal(cards) {
            cards.forEach((card, i) => {
                const delay = reduceMotion ? 0 : Math.min(i, 9) * 22;
                card.style.setProperty("--deal-delay", delay + "ms");
                card.classList.remove("is-dealing");
                if (!reduceMotion) {
                    void card.offsetWidth;
                    card.classList.add("is-dealing");
                    window.setTimeout(() => card.classList.remove("is-dealing"), 420 + delay);
                }
            });
        }

        deal(eaCards);
        deal(statsCards);

        splitContainer.querySelectorAll(".fut-ovr").forEach(el => animateScore(el, 0));
        splitContainer.querySelectorAll(".as-val").forEach(el => animateScore(el, 1));

        splitContainer.querySelectorAll(".fs-fill, .as-fill").forEach((bar, i) => {
            const target = bar.dataset.targetWidth || bar.style.width || "0%";
            bar.dataset.targetWidth = target;
            if (reduceMotion) {
                bar.style.width = target;
                return;
            }
            bar.style.transitionDelay = (80 + (i % 6) * 34) + "ms";
            bar.style.width = "0%";
            requestAnimationFrame(() => {
                requestAnimationFrame(() => { bar.style.width = target; });
            });
        });

        compareShell.dataset.motionReason = reason || "render";
    }

    function render(pos) {
        if (pos === currentPos && (eaCardsEl.children.length || statsCardsEl.children.length)) return;
        currentPos = pos;
        clearTimeout(renderDelayTimer);
        const hasCards = eaCardsEl.children.length || statsCardsEl.children.length;
        if (!reduceMotion && hasCards) {
            splitContainer.querySelectorAll(".fut-card").forEach(card => card.classList.add("is-leaving"));
            renderDelayTimer = window.setTimeout(() => renderNow(pos), 90);
            return;
        }
        renderNow(pos);
    }

    function renderNow(pos) {
        compareShell.classList.add("is-switching");
        lines.resetState();
        if (syncFrame !== null) {
            cancelAnimationFrame(syncFrame);
            syncFrame = null;
        }
        syncSourceEl = null;
        syncTargetEl = null;
        const players = data.filter(p => p.subPos === pos);
        const group = SUBPOS_TO_GROUP[pos] || pos;

        const eaTop = players.slice().sort((a, b) => b.ea.ovr - a.ea.ovr).slice(0, TOP_N);
        const statsTop = players.slice().sort((a, b) => b.composite - a.composite).slice(0, TOP_N);

        const eaNames = new Set(eaTop.map(p => p.name));
        const statsNames = new Set(statsTop.map(p => p.name));
        const shared = {};
        for (const p of eaTop) if (statsNames.has(p.name)) shared[p.name] = true;
        currentShared = shared;

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

        const eaTopRank = {}, statsTopRank = {};
        eaTop.forEach((p, i) => { eaTopRank[p.name] = i + 1; });
        statsTop.forEach((p, i) => { statsTopRank[p.name] = i + 1; });

        const posKeys = POS_KEY_STATS[pos] || [];
        const statScales = {};
        posKeys.forEach(k => {
            let max = 0;
            for (const pl of statsTop) {
                const v = pl.real ? pl.real[k] : null;
                if (v != null && v > max) max = v;
            }
            statScales[k] = { max };
        });

        eaCardsEl.innerHTML = "";
        eaTop.forEach((p, i) => {
            const card = buildEACard(p, i, !statsNames.has(p.name), group, pos);
            card.addEventListener("click", () => onCardClick(p));
            eaCardsEl.appendChild(card);
        });

        statsCardsEl.innerHTML = "";
        statsTop.forEach((p, i) => {
            const card = buildStatsCard(p, i, !eaNames.has(p.name), pos, eaRankMap[p.name], statScales);
            card.addEventListener("click", () => onCardClick(p));
            statsCardsEl.appendChild(card);
        });

        const label = SUBPOS_LABELS[pos] || POS_LABELS[pos] || pos;
        const eaTitle = document.querySelector(".panel-ea .panel-title");
        const stTitle = document.querySelector(".panel-stats .panel-title");
        if (eaTitle) eaTitle.textContent = "EA Ranking - " + label;
        if (stTitle) stTitle.textContent = "Real Ranking - " + label;

        eaCardsEl.scrollTop = 0;
        statsCardsEl.scrollTop = 0;
        updateCompositeTooltip();
        lines.setRankMaps(eaTopRank, statsTopRank);
        requestAnimationFrame(() => {
            runCardMotion("render");
            lines.drawLines(shared);
            lines.attachHoverListeners(shared);
            window.setTimeout(() => compareShell.classList.remove("is-switching"), 360);
        });
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            syncFocusModeUI();
            drawCurrentLines();
        }, 150);
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
            syncFocusModeUI();
            requestFocusRedraw(120);
        });
    }

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
        info.setAttribute("data-info", text);
        const bubble = info.querySelector(".info-bubble");
        if (bubble) bubble.textContent = text;
    }

    addHeaderTooltips();

    toggle.addEventListener("click", e => {
        const btn = e.target.closest(".pos-btn");
        if (!btn) return;
        const pos = btn.dataset.pos;
        if (!pos || pos === currentPos) return;
        toggle.querySelectorAll(".pos-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        lines.resetState();
        render(pos);
    });

    render("ST");
}
