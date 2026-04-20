// --- Act 2: Wall of Fame / Wall of Shame ---
// Two dual-scroll ledgers: Hidden Gems (underrated) vs Reputation Tax (overrated).
// Click a card -> opens the existing Act 1 modal for the full player dossier.

function initWallOfFameShame(data) {
    const section = document.getElementById("wall-fame-shame");
    if (!section || !data?.length) return;

    const MIN_MINUTES = 900;
    const TOP_N = 20;
    const GROUP_BY_SUBPOS = { ST: "FW", WG: "FW", AM: "MF", CM: "MF", DM: "MF", FB: "DF", CB: "DF", GK: "GK" };
    const DIM_LABELS = { scoring: "scoring", creation: "creation", progression: "progression", defense: "defense", discipline: "discipline" };
    const DIM_TO_EA  = { scoring: "sho", creation: "pas", progression: "dri", defense: "def", discipline: "phy" };

    // Shared modal (Act 1). Lazy-init our own instance so Act 2 is self-contained.
    let modalManager = null;
    const lazyModal = () => {
        if (modalManager) return modalManager;
        const tipEl = document.createElement("div");
        tipEl.className = "stat-tip";
        document.body.appendChild(tipEl);
        modalManager = createModalManager(tipEl);
        modalManager.init(data);
        return modalManager;
    };

    // Precompute percentile ranks of subScores within each sub-position.
    // subScorePct[subPos][dim] = function(value) -> 0..100 percentile
    const subScorePct = {};
    const subPositions = ["ST", "WG", "AM", "CM", "DM", "FB", "CB", "GK"];
    for (const sp of subPositions) {
        subScorePct[sp] = {};
        const pool = data.filter(p => p.subPos === sp);
        for (const dim of Object.keys(DIM_LABELS)) {
            const sorted = pool.map(p => p.subScores?.[dim]).filter(v => v != null && !isNaN(v)).sort(numSort);
            subScorePct[sp][dim] = value => {
                if (value == null || !sorted.length) return null;
                let i = 0;
                while (i < sorted.length && sorted[i] < value) i++;
                return Math.round((i / sorted.length) * 100);
            };
        }
    }

    // Rank maps for modal (ea OVR rank within 4-way position group, composite rank within sub-position).
    function buildRankMaps(posPlayers) {
        const byOvr = posPlayers.slice().sort((a, b) => (b.ea?.ovr || 0) - (a.ea?.ovr || 0));
        const byComp = posPlayers.slice().sort((a, b) => (b.composite || 0) - (a.composite || 0));
        const eaRankMap = {}, compRankMap = {};
        byOvr.forEach((p, i) => eaRankMap[p.name] = i + 1);
        byComp.forEach((p, i) => compRankMap[p.name] = i + 1);
        return { eaRankMap, compRankMap };
    }

    // --- Static chrome ---
    section.innerHTML =
        '<div class="wall-head">' +
            '<span class="wall-kicker">\u00a7 02 \u00b7 REPUTATION LEDGER</span>' +
            '<h3 class="wall-title">Two Walls, Twenty Names.</h3>' +
            '<p class="wall-sub">Minimum 900 minutes played. Click any entry for the full dossier.</p>' +
        '</div>' +
        '<div class="wall-filter-row">' +
            '<div class="wall-filter-label">FILTER BY ROLE</div>' +
            '<div class="position-toggle wall-pos-toggle" id="wall-pos-toggle">' +
                '<button class="pos-btn active" data-pos="ALL" data-label="All Positions">ALL</button>' +
                '<button class="pos-btn" data-pos="ST" data-label="Strikers">ST</button>' +
                '<button class="pos-btn" data-pos="WG" data-label="Wingers">WG</button>' +
                '<button class="pos-btn" data-pos="AM" data-label="Attacking Midfielders">AM</button>' +
                '<button class="pos-btn" data-pos="CM" data-label="Central Midfielders">CM</button>' +
                '<button class="pos-btn" data-pos="DM" data-label="Defensive Midfielders">DM</button>' +
                '<button class="pos-btn" data-pos="FB" data-label="Full-backs">FB</button>' +
                '<button class="pos-btn" data-pos="CB" data-label="Centre-backs">CB</button>' +
                '<button class="pos-btn" data-pos="GK" data-label="Goalkeepers">GK</button>' +
            '</div>' +
        '</div>' +
        '<div class="wall-grid">' +
            '<section class="wall-col wall-col-gems" aria-label="Hidden Gems">' +
                '<header class="wall-col-header">' +
                    '<span class="wall-col-num">01</span>' +
                    '<div class="wall-col-heading">' +
                        '<h4 class="wall-col-title">Hidden Gems</h4>' +
                        '<span class="wall-col-tag"><span class="wall-tri wall-tri-up">\u25B2</span> underrated by EA</span>' +
                    '</div>' +
                    '<span class="wall-col-count" id="wall-gems-count">0</span>' +
                '</header>' +
                '<div class="wall-col-scroll" id="wall-gems-list"></div>' +
            '</section>' +
            '<div class="wall-divider" aria-hidden="true">' +
                '<div class="wall-divider-rule"></div>' +
                '<div class="wall-divider-text">' +
                    '<span class="wall-quote-mark">\u201C</span>' +
                    '<p class="wall-quote">The gap is not a bug in the ratings \u2014 it is the ratings.</p>' +
                    '<span class="wall-quote-caption">\u2014 regression residual, 2024\u201325</span>' +
                '</div>' +
                '<div class="wall-divider-rule"></div>' +
            '</div>' +
            '<section class="wall-col wall-col-tax" aria-label="Reputation Tax">' +
                '<header class="wall-col-header">' +
                    '<span class="wall-col-num">02</span>' +
                    '<div class="wall-col-heading">' +
                        '<h4 class="wall-col-title">Reputation Tax</h4>' +
                        '<span class="wall-col-tag"><span class="wall-tri wall-tri-dn">\u25BC</span> overrated by EA</span>' +
                    '</div>' +
                    '<span class="wall-col-count" id="wall-tax-count">0</span>' +
                '</header>' +
                '<div class="wall-col-scroll" id="wall-tax-list"></div>' +
            '</section>' +
        '</div>';

    const gemsList = section.querySelector("#wall-gems-list");
    const taxList  = section.querySelector("#wall-tax-list");
    const gemsCount = section.querySelector("#wall-gems-count");
    const taxCount  = section.querySelector("#wall-tax-count");
    const posToggle = section.querySelector("#wall-pos-toggle");

    let activePos = "ALL";

    // --- Insight generation ---
    function makeInsight(p, isGem) {
        const sp = p.subPos;
        if (!sp || !p.subScores) return "";
        const dims = Object.keys(DIM_LABELS).filter(d => p.subScores[d] != null);
        if (!dims.length) return "";

        const ranked = dims
            .map(d => ({ d, val: p.subScores[d], pct: subScorePct[sp]?.[d]?.(p.subScores[d]) }))
            .filter(x => x.pct != null);
        if (!ranked.length) return "";
        ranked.sort((a, b) => b.pct - a.pct);

        const strongest = ranked[0];
        const weakest = ranked[ranked.length - 1];
        const eaKey = DIM_TO_EA[strongest.d];
        const eaVal = eaKey && p.ea?.[eaKey] != null ? p.ea[eaKey] : null;
        const subLabel = SUBPOS_LABELS[sp] || sp;

        if (isGem) {
            // Underrated: lead with the strongest real-world dimension.
            if (eaVal != null) {
                return 'P' + strongest.pct + ' in ' + strongest.d +
                    ' among ' + subLabel + ' \u2014 EA sees only ' + eaKey.toUpperCase() + ' ' + eaVal + '.';
            }
            return 'P' + strongest.pct + ' in ' + strongest.d + ' among ' + subLabel +
                ' \u2014 the OVR ' + p.ea.ovr + ' buries it.';
        }
        // Overrated: lead with how low even their best dimension ranks.
        return 'Top dimension is only P' + strongest.pct + ' (' + strongest.d + ') among ' + subLabel +
            ' \u2014 production doesn\u2019t back up OVR ' + p.ea.ovr + '.';
    }

    // --- Card rendering ---
    function cardHTML(p, rank, isGem) {
        const gap = p.gap || 0;
        const color = isGem ? "var(--wall-green)" : "var(--wall-red)";
        const tri = isGem ? "\u25B2" : "\u25BC";
        const subLabel = SUBPOS_LABELS[p.subPos] || p.subPos || "";
        const ovr = p.ea?.ovr ?? "\u2013";
        const comp = p.composite != null ? p.composite.toFixed(1) : "\u2013";

        // Dumbbell scale: map 55..95 to 0..100% of the rail.
        const railLo = 55, railHi = 95;
        const railPct = v => Math.max(0, Math.min(100, ((v - railLo) / (railHi - railLo)) * 100));
        const ovrX = p.ea?.ovr != null ? railPct(p.ea.ovr) : 50;
        const cmpX = p.composite != null ? railPct(p.composite) : 50;
        const left = Math.min(ovrX, cmpX), right = Math.max(ovrX, cmpX);
        const railFillStyle = 'left:' + left + '%;width:' + (right - left) + '%;background:' + color + ';';

        const insight = makeInsight(p, isGem);

        return (
            '<button class="wall-card ' + (isGem ? 'wall-card-gem' : 'wall-card-tax') + '" ' +
                'data-name="' + escapeAttr(p.name) + '" data-subpos="' + (p.subPos || "") + '">' +
                '<span class="wall-rank">' + String(rank).padStart(2, "0") + '</span>' +
                '<div class="wall-avatar">' + avatarHTMLString(p.photo, p.name, "wall-avatar-img", "wall-avatar-fallback") + '</div>' +
                '<div class="wall-card-body">' +
                    '<div class="wall-card-top">' +
                        '<div class="wall-name-block">' +
                            '<span class="wall-name">' + p.name + '</span>' +
                            '<span class="wall-meta">' + p.club + ' \u00b7 ' + (p.league || "") + ' \u00b7 ' + subLabel + '</span>' +
                        '</div>' +
                        '<div class="wall-gap" style="color:' + color + '">' +
                            '<span class="wall-gap-tri">' + tri + '</span>' +
                            '<span class="wall-gap-num">' + formatGap(gap) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="wall-rail">' +
                        '<div class="wall-rail-track"></div>' +
                        '<div class="wall-rail-fill" style="' + railFillStyle + '"></div>' +
                        '<div class="wall-rail-dot wall-rail-ovr" style="left:' + ovrX + '%" data-val="OVR ' + ovr + '"></div>' +
                        '<div class="wall-rail-dot wall-rail-cmp" style="left:' + cmpX + '%" data-val="CMP ' + comp + '"></div>' +
                        '<div class="wall-rail-scale"><span>60</span><span>70</span><span>80</span><span>90</span></div>' +
                    '</div>' +
                    '<div class="wall-numbers">' +
                        '<span class="wall-num-ea"><i class="wall-num-dot"></i>OVR <b>' + ovr + '</b></span>' +
                        '<span class="wall-num-cmp"><i class="wall-num-dot"></i>CMP <b>' + comp + '</b></span>' +
                        '<span class="wall-num-min">' + (p.minutes || 0) + '\u2032 played</span>' +
                    '</div>' +
                    (insight ? '<p class="wall-insight">' + insight + '</p>' : '') +
                '</div>' +
            '</button>'
        );
    }

    function filtered(data) {
        return data.filter(p =>
            (p.minutes || 0) >= MIN_MINUTES &&
            p.gap != null &&
            p.ea?.ovr != null &&
            p.composite != null &&
            (activePos === "ALL" || p.subPos === activePos)
        );
    }

    function render() {
        const pool = filtered(data);
        const sortedByGap = pool.slice().sort((a, b) => (a.gap || 0) - (b.gap || 0));
        const tax = sortedByGap.slice(0, TOP_N);                          // most negative
        const gems = sortedByGap.slice(-TOP_N).reverse();                  // most positive

        gemsList.innerHTML  = gems.map((p, i) => cardHTML(p, i + 1, true)).join("") ||
            '<div class="wall-empty">No qualifying underrated players for this filter.</div>';
        taxList.innerHTML   = tax.map((p, i)  => cardHTML(p, i + 1, false)).join("") ||
            '<div class="wall-empty">No qualifying overrated players for this filter.</div>';
        gemsCount.textContent = gems.length;
        taxCount.textContent  = tax.length;

        // Entrance stagger
        const allCards = section.querySelectorAll(".wall-card");
        allCards.forEach((c, i) => {
            c.style.animationDelay = (i % TOP_N) * 28 + "ms";
        });

        bindCardClicks();
    }

    function bindCardClicks() {
        section.querySelectorAll(".wall-card").forEach(card => {
            card.addEventListener("click", () => {
                const name = card.dataset.name;
                const player = data.find(p => p.name === name);
                if (!player) return;
                const subPos = player.subPos;
                const group = GROUP_BY_SUBPOS[subPos] || "FW";
                // Match Act 1's modal contract: posPlayers is the sub-position pool.
                const posPlayers = data.filter(p => p.subPos === subPos);
                const { eaRankMap, compRankMap } = buildRankMaps(posPlayers);
                lazyModal().openModal(player, group, eaRankMap, compRankMap, posPlayers, null);
            });
        });
    }

    // Filter buttons
    posToggle.querySelectorAll(".pos-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            posToggle.querySelectorAll(".pos-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activePos = btn.dataset.pos;
            render();
        });
    });

    render();
}
