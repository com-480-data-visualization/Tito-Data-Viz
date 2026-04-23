// --- Act 2: League Map ---
// Flat Europe, semantically zoomable through 4 levels:
//   L1 Leagues  -> L2 Country  -> L3 Clubs  -> L4 Players
// Pan + wheel-zoom via d3.zoom; click-to-drill animates the transform.

function initLeagueMap(data) {
    const root = document.getElementById("map-section");
    if (!root || !data?.length) return;

    // ---------------------------------------------------------------
    // Static tables: league meta + club city coords (top-5 leagues)
    // ---------------------------------------------------------------
    // `anchor` is [lon, lat] — explicit label point per country. Bbox
    // centroids misfire for features with overseas territories
    // (France -> Guyane/Réunion pull the centroid south), so we pick a
    // reliable on-land point per country instead.
    const LEAGUES = {
        "PL":         { country: "England", countryId: "826", label: "Premier League", anchor: [-1.50, 52.80] },
        "La Liga":    { country: "Spain",   countryId: "724", label: "La Liga",         anchor: [-3.70, 40.10] },
        "Bundesliga": { country: "Germany", countryId: "276", label: "Bundesliga",      anchor: [10.30, 51.10] },
        "Serie A":    { country: "Italy",   countryId: "380", label: "Serie A",         anchor: [12.50, 43.50] },
        "Ligue 1":    { country: "France",  countryId: "250", label: "Ligue 1",         anchor: [ 2.35, 46.70] }
    };
    const HIGHLIGHT_IDS = new Set(Object.values(LEAGUES).map(l => l.countryId));

    // [lon, lat] per club. Canary/island clubs land at real coords and
    // sit outside the default Europe viewport — that's intentional.
    const CLUB_COORDS = {
        // Premier League
        "Arsenal":         [-0.108, 51.555],
        "Aston Villa":     [-1.884, 52.509],
        "Bournemouth":     [-1.838, 50.735],
        "Brentford":       [-0.289, 51.490],
        "Brighton":        [-0.083, 50.862],
        "Chelsea":         [-0.192, 51.481],
        "Crystal Palace":  [-0.085, 51.398],
        "Everton":         [-2.966, 53.439],
        "Fulham":          [-0.222, 51.475],
        "Ipswich Town":    [ 1.145, 52.055],
        "Leicester City":  [-1.142, 52.620],
        "Liverpool":       [-2.960, 53.431],
        "Manchester City": [-2.200, 53.483],
        "Manchester Utd":  [-2.291, 53.463],
        "Newcastle Utd":   [-1.618, 54.976],
        "Nott'ham Forest": [-1.133, 52.940],
        "Southampton":     [-1.391, 50.906],
        "Tottenham":       [-0.066, 51.604],
        "West Ham":        [-0.016, 51.539],
        "Wolves":          [-2.130, 52.590],

        // La Liga
        "Alavés":          [-2.672, 42.846],
        "Athletic Club":   [-2.949, 43.264],
        "Atlético Madrid": [-3.599, 40.436],
        "Barcelona":       [ 2.120, 41.380],
        "Betis":           [-5.981, 37.356],
        "Celta Vigo":      [-8.739, 42.212],
        "Espanyol":        [ 2.074, 41.347],
        "Getafe":          [-3.714, 40.325],
        "Girona":          [ 2.828, 41.961],
        "Las Palmas":      [-15.456, 28.100],
        "Leganés":         [-3.760, 40.340],
        "Mallorca":        [ 2.632, 39.589],
        "Osasuna":         [-1.637, 42.796],
        "Rayo Vallecano":  [-3.658, 40.391],
        "Real Madrid":     [-3.688, 40.453],
        "Real Sociedad":   [-1.973, 43.301],
        "Sevilla":         [-5.970, 37.384],
        "Valencia":        [-0.358, 39.474],
        "Valladolid":      [-4.761, 41.644],
        "Villarreal":      [-0.103, 39.944],

        // Bundesliga
        "Augsburg":        [10.884, 48.324],
        "Bayern Munich":   [11.625, 48.218],
        "Bochum":          [ 7.236, 51.490],
        "Dortmund":        [ 7.452, 51.492],
        "Eint Frankfurt":  [ 8.645, 50.069],
        "Freiburg":        [ 7.830, 48.021],
        "Gladbach":        [ 6.386, 51.175],
        "Heidenheim":      [10.144, 48.676],
        "Hoffenheim":      [ 8.888, 49.239],
        "Holstein Kiel":   [10.122, 54.349],
        "Leverkusen":      [ 7.002, 51.038],
        "Mainz 05":        [ 8.224, 49.983],
        "RB Leipzig":      [12.348, 51.346],
        "St. Pauli":       [ 9.968, 53.554],
        "Stuttgart":       [ 9.232, 48.792],
        "Union Berlin":    [13.568, 52.457],
        "Werder Bremen":   [ 8.838, 53.066],
        "Wolfsburg":       [10.803, 52.432],

        // Serie A
        "Atalanta":        [ 9.680, 45.709],
        "Bologna":         [11.310, 44.492],
        "Cagliari":        [ 9.137, 39.200],
        "Como":            [ 9.085, 45.817],
        "Empoli":          [10.955, 43.726],
        "Fiorentina":      [11.283, 43.780],
        "Genoa":           [ 8.952, 44.417],
        "Hellas Verona":   [10.969, 45.435],
        "Inter":           [ 9.124, 45.478],
        "Juventus":        [ 7.642, 45.109],
        "Lazio":           [12.455, 41.934],
        "Lecce":           [18.209, 40.365],
        "Milan":           [ 9.124, 45.478],
        "Monza":           [ 9.268, 45.583],
        "Napoli":          [14.193, 40.828],
        "Parma":           [10.338, 44.795],
        "Roma":            [12.455, 41.934],
        "Torino":          [ 7.650, 45.042],
        "Udinese":         [13.200, 46.081],
        "Venezia":         [12.365, 45.419],

        // Ligue 1
        "Angers":          [-0.532, 47.460],
        "Auxerre":         [ 3.592, 47.786],
        "Brest":           [-4.462, 48.402],
        "Le Havre":        [ 0.108, 49.498],
        "Lens":            [ 2.815, 50.433],
        "Lille":           [ 3.130, 50.612],
        "Lyon":            [ 4.982, 45.765],
        "Marseille":       [ 5.395, 43.270],
        "Monaco":          [ 7.416, 43.728],
        "Montpellier":     [ 3.812, 43.622],
        "Nantes":          [-1.525, 47.256],
        "Nice":            [ 7.193, 43.705],
        "Paris S-G":       [ 2.253, 48.841],
        "Reims":           [ 4.024, 49.247],
        "Rennes":          [-1.713, 48.108],
        "Saint-Étienne":   [ 4.390, 45.461],
        "Strasbourg":      [ 7.755, 48.561],
        "Toulouse":        [ 1.434, 43.583]
    };

    // ---------------------------------------------------------------
    // Aggregate league / club stats from the player pool
    // ---------------------------------------------------------------
    const leagueStats = {};
    for (const key of Object.keys(LEAGUES)) {
        const pool = data.filter(p => p.league === key && typeof p.gap === "number");
        if (!pool.length) continue;
        const gaps = pool.map(p => p.gap);
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const byClub = {};
        for (const p of pool) {
            if (!p.club) continue;
            (byClub[p.club] = byClub[p.club] || []).push(p);
        }
        const clubs = Object.keys(byClub).map(name => {
            const players = byClub[name];
            const cgaps = players.map(p => p.gap);
            const cMean = cgaps.reduce((a, b) => a + b, 0) / cgaps.length;
            const sortedByGap = players.slice().sort((a, b) => b.gap - a.gap);
            return {
                name,
                players,
                avgGap: cMean,
                count: players.length,
                best: sortedByGap[0],
                worst: sortedByGap[sortedByGap.length - 1],
                coords: CLUB_COORDS[name] || null
            };
        });
        clubs.sort((a, b) => b.avgGap - a.avgGap);
        leagueStats[key] = {
            ...LEAGUES[key],
            leagueKey: key,
            avgGap: mean,
            playerCount: pool.length,
            clubCount: clubs.length,
            clubs,
            clubByName: Object.fromEntries(clubs.map(c => [c.name, c]))
        };
    }

    const leaguesByGap = Object.values(leagueStats).slice().sort((a, b) => b.avgGap - a.avgGap);
    const mostUnder = leaguesByGap[0];
    const mostOver  = leaguesByGap[leaguesByGap.length - 1];

    // ---------------------------------------------------------------
    // Skeleton
    // ---------------------------------------------------------------
    root.innerHTML =
        '<div class="map-head">' +
            '<span class="map-kicker">\u00a7 04 \u00b7 THE CONTINENT</span>' +
            '<h3 class="map-title">The gap, zoomed.</h3>' +
            '<p class="map-sub">' +
                'Europe\u2019s big five, peelable from <em>leagues</em> down to a single <em>player</em>. ' +
                'Scroll to zoom, drag to pan, click anything to dive.' +
            '</p>' +
        '</div>' +
        '<nav class="map-breadcrumb" id="map-breadcrumb" aria-label="Map navigation"></nav>' +
        '<div class="map-layout">' +
            '<div class="map-stage" id="map-stage">' +
                '<div class="map-loading">Loading Europe\u2026</div>' +
            '</div>' +
            '<aside class="map-aside" id="map-aside"></aside>' +
        '</div>' +
        '<div class="map-drawer" id="map-drawer"></div>';

    const stage  = root.querySelector("#map-stage");
    const aside  = root.querySelector("#map-aside");
    const drawer = root.querySelector("#map-drawer");
    const crumb  = root.querySelector("#map-breadcrumb");

    // Shared floating tooltip
    const tip = document.createElement("div");
    tip.className = "map-tip";
    document.body.appendChild(tip);

    // ---------------------------------------------------------------
    // State machine
    // ---------------------------------------------------------------
    // view: { level: "europe"|"country"|"club"|"player", leagueKey?, clubName?, playerIdx? }
    let view = { level: "europe" };
    let currentLevel = 0;   // derived numeric level (1..4); 0 forces first apply
    let lastPulsedClub = null; // suppress redundant CTA entrance when drawer re-renders at same club

    function setView(next, opts) {
        view = next;
        renderAside();
        renderDrawer();
        renderBreadcrumb();
        if (opts?.animate !== false) animateToView();
        else applyViewInstant();
    }

    // ---------------------------------------------------------------
    // Colour ramp: diverging around 0, clamped to ~|2.5|
    // ---------------------------------------------------------------
    function colorForGap(gap) {
        const t = Math.max(-1, Math.min(1, gap / 2.5));
        if (t >= 0) return interpolateHex("#2a3344", "#2ecc71", t);
        return interpolateHex("#2a3344", "#e74c3c", -t);
    }
    function interpolateHex(a, b, t) {
        const pa = hexToRgb(a), pb = hexToRgb(b);
        const r  = Math.round(pa[0] + (pb[0] - pa[0]) * t);
        const g  = Math.round(pa[1] + (pb[1] - pa[1]) * t);
        const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
        return "rgb(" + r + "," + g + "," + bl + ")";
    }
    function hexToRgb(hex) {
        const h = hex.replace("#", "");
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }

    // ---------------------------------------------------------------
    // Side panel: header insight + ranked list scoped by level
    // ---------------------------------------------------------------
    function renderAside() {
        const headline =
            '<div class="map-insight">' +
                '<span class="map-insight-kicker">HEADLINE</span>' +
                '<p class="map-insight-body">' +
                    '<strong>' + escapeAttr(mostUnder.label) + '</strong> runs the biggest ' +
                    'reputation surplus (<span class="gap-up">+' + mostUnder.avgGap.toFixed(2) + '</span>).' +
                    ' <strong>' + escapeAttr(mostOver.label) + '</strong> carries the heaviest ' +
                    'tax (<span class="gap-down">' + mostOver.avgGap.toFixed(2) + '</span>).' +
                '</p>' +
            '</div>';

        if (view.level === "europe") {
            const rows = Object.values(leagueStats)
                .slice()
                .sort((a, b) => b.avgGap - a.avgGap)
                .map(l => {
                    const sign = l.avgGap >= 0 ? "+" : "";
                    const cls  = l.avgGap >= 0 ? "gap-up" : "gap-down";
                    return '<button class="map-row ' + cls + '" data-league="' + escapeAttr(l.leagueKey) + '">' +
                        '<span class="map-row-dot"></span>' +
                        '<span class="map-row-name">' + escapeAttr(l.label) + '</span>' +
                        '<span class="map-row-count">' + l.clubCount + ' clubs</span>' +
                        '<span class="map-row-gap">' + sign + l.avgGap.toFixed(2) + '</span>' +
                    '</button>';
                }).join("");
            aside.innerHTML = headline +
                '<div class="map-list">' +
                    '<div class="map-list-label">BY AVERAGE GAP</div>' +
                    rows +
                '</div>';
            aside.querySelectorAll(".map-row").forEach(btn => {
                btn.addEventListener("click", () => focusLeague(btn.dataset.league));
                btn.addEventListener("mouseenter", () => highlightCountry(btn.dataset.league, true));
                btn.addEventListener("mouseleave", () => highlightCountry(btn.dataset.league, false));
            });
            return;
        }

        if (view.level === "country") {
            const L = leagueStats[view.leagueKey];
            if (!L) return;
            const rows = L.clubs.map(c => {
                const sign = c.avgGap >= 0 ? "+" : "";
                const cls  = c.avgGap >= 0 ? "gap-up" : "gap-down";
                return '<button class="map-row ' + cls + '" data-club="' + escapeAttr(c.name) + '">' +
                    '<span class="map-row-dot"></span>' +
                    '<span class="map-row-name">' + escapeAttr(c.name) + '</span>' +
                    '<span class="map-row-count">' + c.count + ' players</span>' +
                    '<span class="map-row-gap">' + sign + c.avgGap.toFixed(2) + '</span>' +
                '</button>';
            }).join("");
            aside.innerHTML = headline +
                '<div class="map-list">' +
                    '<div class="map-list-label">CLUBS &middot; ' + escapeAttr(L.label.toUpperCase()) + '</div>' +
                    rows +
                '</div>';
            aside.querySelectorAll(".map-row").forEach(btn => {
                btn.addEventListener("click", () => focusClub(view.leagueKey, btn.dataset.club));
            });
            return;
        }

        if (view.level === "club" || view.level === "player") {
            const L = leagueStats[view.leagueKey];
            const C = L?.clubByName[view.clubName];
            if (!L || !C) return;
            const players = C.players.slice().sort((a, b) => b.gap - a.gap);
            const rows = players.map((p, i) => {
                const sign = p.gap >= 0 ? "+" : "";
                const cls  = p.gap >= 0 ? "gap-up" : "gap-down";
                const sel  = (view.level === "player" && players[view.playerIdx]?.name === p.name) ? " is-selected" : "";
                return '<button class="map-row ' + cls + sel + '" data-player="' + i + '">' +
                    '<span class="map-row-dot"></span>' +
                    '<span class="map-row-name">' + escapeAttr(p.name) + '</span>' +
                    '<span class="map-row-count">OVR ' + (p.ea ?? "-") + '</span>' +
                    '<span class="map-row-gap">' + sign + p.gap.toFixed(2) + '</span>' +
                '</button>';
            }).join("");
            aside.innerHTML = headline +
                '<div class="map-list">' +
                    '<div class="map-list-label">SQUAD &middot; ' + escapeAttr(C.name.toUpperCase()) + '</div>' +
                    rows +
                '</div>';
            aside.querySelectorAll(".map-row").forEach(btn => {
                btn.addEventListener("click", () => focusPlayer(view.leagueKey, C.name, +btn.dataset.player));
            });
        }
    }

    // ---------------------------------------------------------------
    // Drawer: the clubs table (kept for L2) / player card (L4)
    // ---------------------------------------------------------------
    function renderDrawer() {
        if (view.level === "europe") {
            drawer.innerHTML = '<div class="map-drawer-empty">Pick a league above to drill into its clubs.</div>';
            drawer.classList.remove("is-open");
            return;
        }
        if (view.level === "country") {
            const L = leagueStats[view.leagueKey];
            const max = Math.max(...L.clubs.map(c => Math.abs(c.avgGap)), 1);
            const rows = L.clubs.map((c, i) => {
                const sign = c.avgGap >= 0 ? "+" : "";
                const cls  = c.avgGap >= 0 ? "gap-up" : "gap-down";
                const side = c.avgGap >= 0 ? "right" : "left";
                const pct  = (Math.abs(c.avgGap) / max) * 100;
                return '<div class="map-club-row" data-club="' + escapeAttr(c.name) + '">' +
                    '<span class="map-club-rank">' + (i + 1).toString().padStart(2, "0") + '</span>' +
                    '<span class="map-club-name">' + escapeAttr(c.name) + '</span>' +
                    '<span class="map-club-count">' + c.count + '</span>' +
                    '<div class="map-club-bar"><div class="map-club-bar-fill map-club-bar-' + side + ' ' + cls + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
                    '<span class="map-club-gap ' + cls + '">' + sign + c.avgGap.toFixed(2) + '</span>' +
                '</div>';
            }).join("");

            drawer.innerHTML =
                '<div class="map-drawer-head">' +
                    '<div class="map-drawer-title">' +
                        '<span class="map-drawer-kicker">' + escapeAttr(L.country.toUpperCase()) + '</span>' +
                        '<h4 class="map-drawer-h">' + escapeAttr(L.label) + '</h4>' +
                    '</div>' +
                    '<div class="map-drawer-stats">' +
                        '<div><span class="map-drawer-stat-val">' + L.clubCount + '</span><span class="map-drawer-stat-lbl">clubs</span></div>' +
                        '<div><span class="map-drawer-stat-val">' + L.playerCount + '</span><span class="map-drawer-stat-lbl">players</span></div>' +
                        '<div><span class="map-drawer-stat-val ' + (L.avgGap >= 0 ? "gap-up" : "gap-down") + '">' + (L.avgGap >= 0 ? "+" : "") + L.avgGap.toFixed(2) + '</span><span class="map-drawer-stat-lbl">avg gap</span></div>' +
                    '</div>' +
                '</div>' +
                '<div class="map-club-head">' +
                    '<span>#</span><span>CLUB</span><span>N</span><span>GAP</span><span></span>' +
                '</div>' +
                '<div class="map-club-list">' + rows + '</div>';
            drawer.classList.add("is-open");
            drawer.querySelectorAll(".map-club-row").forEach(r => {
                r.addEventListener("click", () => focusClub(view.leagueKey, r.dataset.club));
            });
            return;
        }
        if (view.level === "club" || view.level === "player") {
            const L = leagueStats[view.leagueKey];
            const C = L?.clubByName[view.clubName];
            if (!L || !C) return;
            const players = C.players.slice().sort((a, b) => b.gap - a.gap);
            const P = view.level === "player" ? players[view.playerIdx] : null;

            // The player-level detail lives inside the stadium now — the map
            // drawer stays at club granularity and just announces who is armed
            // for the stadium when a squad row is picked.
            const ctaKicker = P ? "§ 05 &middot; STEP INSIDE &middot; " + escapeAttr(P.name.toUpperCase())
                                : "§ 05 &middot; STEP INSIDE";
            const ctaText   = P ? "Walk onto the pitch &mdash; land on " + escapeAttr(P.name) + "."
                                : "Walk onto the pitch &mdash; see the squad where they stand.";

            drawer.innerHTML =
                '<div class="map-drawer-head">' +
                    '<div class="map-drawer-title">' +
                        '<span class="map-drawer-kicker">' + escapeAttr(L.label.toUpperCase()) + '</span>' +
                        '<h4 class="map-drawer-h">' + escapeAttr(C.name) + '</h4>' +
                    '</div>' +
                    '<div class="map-drawer-stats">' +
                        '<div><span class="map-drawer-stat-val">' + C.count + '</span><span class="map-drawer-stat-lbl">players</span></div>' +
                        '<div><span class="map-drawer-stat-val ' + (C.avgGap >= 0 ? "gap-up" : "gap-down") + '">' + (C.avgGap >= 0 ? "+" : "") + C.avgGap.toFixed(2) + '</span><span class="map-drawer-stat-lbl">avg gap</span></div>' +
                    '</div>' +
                '</div>' +
                '<button class="map-stad-cta' + (P ? ' is-armed' : '') + '" type="button" data-club="' + escapeAttr(C.name) + '"' + (P ? ' data-player="' + escapeAttr(P.name) + '"' : '') + '>' +
                    '<span class="map-stad-cta-label">' +
                        '<span class="map-stad-cta-kicker">' + ctaKicker + '</span>' +
                        '<span class="map-stad-cta-text">' + ctaText + '</span>' +
                    '</span>' +
                    '<span class="map-stad-cta-arrow">&rsaquo;</span>' +
                '</button>';
            drawer.classList.add("is-open");

            const cta = drawer.querySelector(".map-stad-cta");
            if (cta) {
                cta.addEventListener("click", () => {
                    if (typeof window.openAct2Stadium === "function") {
                        const opts = P ? { preselectPlayer: P.name } : undefined;
                        window.openAct2Stadium(C, opts);
                    }
                });
                // Draw the eye to the doorway only on a fresh club — cycling
                // through players inside the same club shouldn't re-pulse.
                if (lastPulsedClub !== C.name) {
                    lastPulsedClub = C.name;
                    try { cta.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) {}
                    setTimeout(() => {
                        cta.classList.remove("is-pulsing");
                        void cta.offsetWidth;
                        cta.classList.add("is-pulsing");
                        setTimeout(() => cta.classList.remove("is-pulsing"), 2100);
                    }, 420);
                }
            }
        } else {
            lastPulsedClub = null;
        }
    }

    // ---------------------------------------------------------------
    // Breadcrumb
    // ---------------------------------------------------------------
    function renderBreadcrumb() {
        const parts = [{ label: "Europe", onClick: () => resetView() }];
        if (view.leagueKey) {
            const L = leagueStats[view.leagueKey];
            parts.push({ label: L.country, onClick: () => focusLeague(view.leagueKey) });
        }
        if (view.clubName) parts.push({ label: view.clubName, onClick: () => focusClub(view.leagueKey, view.clubName) });
        if (view.level === "player") {
            const L = leagueStats[view.leagueKey];
            const C = L?.clubByName[view.clubName];
            const P = C?.players.slice().sort((a, b) => b.gap - a.gap)[view.playerIdx];
            if (P) parts.push({ label: P.name, onClick: null });
        }
        crumb.innerHTML = parts.map((p, i) => {
            const last = i === parts.length - 1;
            const cls = "map-crumb" + (last ? " is-current" : "");
            const sep = i > 0 ? '<span class="map-crumb-sep">\u203A</span>' : "";
            return sep + '<button class="' + cls + '" data-idx="' + i + '"' + (last ? ' aria-current="page"' : '') + '>' +
                escapeAttr(p.label) + '</button>';
        }).join("");
        crumb.querySelectorAll(".map-crumb").forEach(btn => {
            const p = parts[+btn.dataset.idx];
            if (p.onClick) btn.addEventListener("click", p.onClick);
        });
    }

    // ---------------------------------------------------------------
    // Map (d3 + topojson)
    // ---------------------------------------------------------------
    const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
    const W_DEFAULT = 720, H_DEFAULT = 540;
    let svg = null;
    let viewG = null;               // zoomable <g>
    let projection = null;
    let pathGen = null;
    let countriesGeo = null;
    let countryById = null;
    let zoom = null;
    let width = W_DEFAULT, height = H_DEFAULT;
    let pathEls = new Map();        // country id -> <path>
    let labelEls = new Map();       // league key -> <g>
    let clubEls = new Map();        // club name -> <g>
    let playerEls = new Map();      // key leagueKey|club|idx -> <g>
    let countryBounds = new Map();  // league key -> [[x0,y0],[x1,y1]] in projected coords
    let currentTransform = null;

    function paintCountries() {
        pathEls.forEach((el, id) => {
            if (!HIGHLIGHT_IDS.has(id)) return;
            const key = Object.keys(LEAGUES).find(k => LEAGUES[k].countryId === id);
            const L = leagueStats[key];
            if (!L) return;
            el.setAttribute("fill", "url(#map-country-fill-live)");
            el.classList.remove("is-up", "is-down");
            el.classList.add(L.avgGap >= 0 ? "is-up" : "is-down");
            el.classList.toggle("is-selected", key === view.leagueKey);
        });
    }

    function highlightCountry(leagueKey, on) {
        const id = LEAGUES[leagueKey]?.countryId;
        if (!id) return;
        const el = pathEls.get(id);
        if (el) el.classList.toggle("is-hover", !!on);
    }

    function drawMap(world) {
        const features = topojson.feature(world, world.objects.countries).features;
        countriesGeo = features;
        countryById = new Map(features.map(f => [String(f.id), f]));

        width = stage.clientWidth || W_DEFAULT;
        height = Math.max(480, Math.round(width * 0.72));

        // Plain Mercator centered on continental Europe. Scale chosen so
        // lon ~[-12, 32] fits the width with a small margin.
        const scaleFor = Math.min(width * 0.9, height * 1.25);
        projection = d3.geoMercator()
            .center([10, 52])
            .scale(scaleFor)
            .translate([width / 2, height / 2]);
        pathGen = d3.geoPath(projection);

        const SVG_NS = "http://www.w3.org/2000/svg";
        svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        svg.setAttribute("class", "map-svg");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        const defs = document.createElementNS(SVG_NS, "defs");
        defs.innerHTML =
            '<linearGradient id="map-bg-grad" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%"   stop-color="#111a2e"/>' +
                '<stop offset="100%" stop-color="#070b14"/>' +
            '</linearGradient>' +
            '<linearGradient id="map-country-fill" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%"   stop-color="#2a3656"/>' +
                '<stop offset="100%" stop-color="#1a2238"/>' +
            '</linearGradient>' +
            '<linearGradient id="map-country-fill-live" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%"   stop-color="#3a4a72"/>' +
                '<stop offset="100%" stop-color="#26304d"/>' +
            '</linearGradient>' +
            '<radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">' +
                '<stop offset="55%" stop-color="rgba(0,0,0,0)"/>' +
                '<stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>' +
            '</radialGradient>' +
            '<filter id="country-lift" x="-15%" y="-15%" width="130%" height="130%">' +
                '<feDropShadow dx="0" dy="1.2" stdDeviation="1.4" flood-color="#000" flood-opacity="0.55"/>' +
            '</filter>' +
            '<filter id="glow-green" x="-80%" y="-80%" width="260%" height="260%">' +
                '<feGaussianBlur stdDeviation="3" in="SourceGraphic" result="blur"/>' +
                '<feFlood flood-color="#2ecc71" flood-opacity="0.9" result="flood"/>' +
                '<feComposite in="flood" in2="blur" operator="in" result="tint"/>' +
                '<feMerge><feMergeNode in="tint"/><feMergeNode in="SourceGraphic"/></feMerge>' +
            '</filter>' +
            '<filter id="glow-red" x="-80%" y="-80%" width="260%" height="260%">' +
                '<feGaussianBlur stdDeviation="3" in="SourceGraphic" result="blur"/>' +
                '<feFlood flood-color="#e74c3c" flood-opacity="0.9" result="flood"/>' +
                '<feComposite in="flood" in2="blur" operator="in" result="tint"/>' +
                '<feMerge><feMergeNode in="tint"/><feMergeNode in="SourceGraphic"/></feMerge>' +
            '</filter>' +
            '<filter id="chevron-drop" x="-60%" y="-60%" width="220%" height="220%">' +
                '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.7"/>' +
            '</filter>';
        svg.appendChild(defs);

        // Background (not transformed)
        const bg = document.createElementNS(SVG_NS, "rect");
        bg.setAttribute("x", 0); bg.setAttribute("y", 0);
        bg.setAttribute("width", width); bg.setAttribute("height", height);
        bg.setAttribute("fill", "url(#map-bg-grad)");
        svg.appendChild(bg);

        // Zoomable group
        viewG = document.createElementNS(SVG_NS, "g");
        viewG.setAttribute("class", "map-view");
        svg.appendChild(viewG);

        // Country groups (dim then live)
        const dimGroup = document.createElementNS(SVG_NS, "g");
        dimGroup.setAttribute("class", "map-dim-group");
        viewG.appendChild(dimGroup);
        const liveGroup = document.createElementNS(SVG_NS, "g");
        liveGroup.setAttribute("class", "map-live-group");
        viewG.appendChild(liveGroup);

        pathEls = new Map();
        for (const f of features) {
            const id = String(f.id);
            const d = pathGen(f);
            if (!d) continue;
            const el = document.createElementNS(SVG_NS, "path");
            el.setAttribute("d", d);
            el.setAttribute("data-id", id);
            if (HIGHLIGHT_IDS.has(id)) {
                const leagueKey = Object.keys(LEAGUES).find(k => LEAGUES[k].countryId === id);
                el.setAttribute("data-league", leagueKey);
                el.setAttribute("class", "map-country map-country-live");
                liveGroup.appendChild(el);

                // Cache projected bounds for zoom-to-country
                const b = pathGen.bounds(f);
                countryBounds.set(leagueKey, b);
            } else {
                el.setAttribute("class", "map-country map-country-dim");
                dimGroup.appendChild(el);
            }
            pathEls.set(id, el);
        }

        // Club layer
        const clubLayer = document.createElementNS(SVG_NS, "g");
        clubLayer.setAttribute("class", "map-club-layer");
        viewG.appendChild(clubLayer);

        // Player layer
        const playerLayer = document.createElementNS(SVG_NS, "g");
        playerLayer.setAttribute("class", "map-player-layer");
        viewG.appendChild(playerLayer);

        // Chevron layer (FIFA-style floating indicator above each target)
        const chevronLayer = document.createElementNS(SVG_NS, "g");
        chevronLayer.setAttribute("class", "map-chev-layer");
        viewG.appendChild(chevronLayer);

        // Build a single chevron at projected (x,y). Outer <g> translates,
        // inner <g> counter-scales (fixed on-screen size), innermost <g.bob>
        // carries the CSS bob animation.
        function makeChevron({ x, y, gap, label, sub, kind, dataset }) {
            const polarity = gap >= 0 ? "up" : "down";
            const g = document.createElementNS(SVG_NS, "g");
            g.setAttribute("class", "map-chev " + kind + " is-" + polarity);
            if (dataset) for (const k of Object.keys(dataset)) g.setAttribute("data-" + k, dataset[k]);
            g.setAttribute("data-tx", x.toFixed(2));
            g.setAttribute("data-ty", y.toFixed(2));
            g.setAttribute("transform", "translate(" + x.toFixed(2) + "," + y.toFixed(2) + ")");

            const counter = document.createElementNS(SVG_NS, "g");
            counter.setAttribute("class", "map-chev-counter");
            const bob = document.createElementNS(SVG_NS, "g");
            bob.setAttribute("class", "map-chev-bob");
            // Chevron geometry: filled triangle pointing DOWN at the entity,
            // sitting ~22px above it. Ring lifts it off the map.
            const sign = gap >= 0 ? "+" : "";
            bob.innerHTML =
                '<path class="map-chev-glow" d="M -11 -30 L 11 -30 L 0 -14 Z"></path>' +
                '<path class="map-chev-shape" d="M -11 -30 L 11 -30 L 0 -14 Z"></path>' +
                '<rect class="map-chev-plate" x="-22" y="-46" width="44" height="14" rx="3"></rect>' +
                '<text class="map-chev-gap" x="0" y="-36" text-anchor="middle">' + sign + gap.toFixed(2) + '</text>' +
                (label ? '<text class="map-chev-label" x="0" y="12" text-anchor="middle">' + escapeAttr(label) + '</text>' : "") +
                (sub   ? '<text class="map-chev-sub"   x="0" y="22" text-anchor="middle">' + escapeAttr(sub)   + '</text>' : "");
            counter.appendChild(bob);
            g.appendChild(counter);
            return g;
        }

        // L1 chevrons — one per target country, positioned at the hand-picked
        // anchor (not the bbox centroid — see LEAGUES table for why).
        labelEls = new Map();
        for (const key of Object.keys(LEAGUES)) {
            const L = leagueStats[key];
            if (!L) continue;
            const anchor = LEAGUES[key].anchor;
            const [cx, cy] = projection(anchor);
            if (!isFinite(cx) || !isFinite(cy)) continue;
            const g = makeChevron({
                x: cx, y: cy,
                gap: L.avgGap,
                label: L.label,
                sub: L.country,
                kind: "map-chev-league",
                dataset: { league: key }
            });
            chevronLayer.appendChild(g);
            labelEls.set(key, g);
        }

        // Club chevrons (L2/L3). Small pin at the club's city; same geometry
        // as the league chevron but scaled down + no sub-label.
        clubEls = new Map();
        for (const key of Object.keys(leagueStats)) {
            for (const c of leagueStats[key].clubs) {
                if (!c.coords) continue;
                const [x, y] = projection(c.coords);
                if (!isFinite(x) || !isFinite(y)) continue;
                const g = makeChevron({
                    x, y,
                    gap: c.avgGap,
                    label: c.name,
                    kind: "map-chev-club",
                    dataset: { league: key, club: c.name }
                });
                clubLayer.appendChild(g);
                clubEls.set(key + "|" + c.name, g);
            }
        }

        // Refine per-country bounds to "metropolitan clubs only" — otherwise
        // Spain's bbox stretches to the Canaries and France's to Guyane,
        // and the country zoom frames half the Atlantic.
        for (const key of Object.keys(LEAGUES)) {
            const L = leagueStats[key];
            if (!L) continue;
            const anchor = LEAGUES[key].anchor;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            let n = 0;
            for (const c of L.clubs) {
                if (!c.coords) continue;
                if (Math.abs(c.coords[0] - anchor[0]) > 12) continue;
                if (Math.abs(c.coords[1] - anchor[1]) > 8)  continue;
                const [x, y] = projection(c.coords);
                if (!isFinite(x) || !isFinite(y)) continue;
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
                n++;
            }
            if (n >= 2) {
                const pad = 28;
                countryBounds.set(key, [[x0 - pad, y0 - pad], [x1 + pad, y1 + pad]]);
            }
        }

        // Player chevrons (L4). Fanned around the club city in projected
        // units; counter-scaled inner so screen size stays constant.
        function buildPlayersFor(leagueKey, clubName) {
            playerLayer.innerHTML = "";
            playerEls = new Map();
            const C = leagueStats[leagueKey]?.clubByName[clubName];
            if (!C || !C.coords) return;
            const [cx, cy] = projection(C.coords);
            const players = C.players.slice().sort((a, b) => b.gap - a.gap);
            const N = players.length;
            // Ring radius in projected units. At L4 (k~22) we want ~110px
            // on-screen radius, so R ~= 5 projected units.
            const R = 5;
            players.forEach((p, i) => {
                const theta = (i / N) * Math.PI * 2 - Math.PI / 2;
                const px = cx + Math.cos(theta) * R;
                const py = cy + Math.sin(theta) * R;
                const last = (p.name || "").split(" ").slice(-1)[0];
                const g = makeChevron({
                    x: px, y: py,
                    gap: p.gap,
                    label: last,
                    kind: "map-chev-player",
                    dataset: { idx: i }
                });
                playerLayer.appendChild(g);
                playerEls.set(leagueKey + "|" + clubName + "|" + i, g);
                g.addEventListener("click", (e) => { e.stopPropagation(); focusPlayer(leagueKey, clubName, i); });
                g.addEventListener("pointermove", (e) => showPlayerTip(e, p));
                g.addEventListener("pointerleave", () => { tip.style.opacity = "0"; });
            });
        }

        // Vignette + top-level interactions
        const vignette = document.createElementNS(SVG_NS, "rect");
        vignette.setAttribute("x", 0); vignette.setAttribute("y", 0);
        vignette.setAttribute("width", width); vignette.setAttribute("height", height);
        vignette.setAttribute("fill", "url(#map-vignette)");
        vignette.setAttribute("pointer-events", "none");
        svg.appendChild(vignette);

        stage.innerHTML = "";
        stage.appendChild(svg);

        // Zoom controls
        const controls = document.createElement("div");
        controls.className = "map-zoom-ctrls";
        controls.innerHTML =
            '<button class="map-zoom-btn" data-zoom="in"  aria-label="Zoom in">+</button>' +
            '<button class="map-zoom-btn" data-zoom="out" aria-label="Zoom out">\u2212</button>' +
            '<button class="map-zoom-btn map-zoom-reset" data-zoom="reset" aria-label="Reset view">\u21BB</button>';
        stage.appendChild(controls);
        controls.querySelector('[data-zoom="in"]').addEventListener("click",   () => nudgeZoom(1.6));
        controls.querySelector('[data-zoom="out"]').addEventListener("click",  () => nudgeZoom(1 / 1.6));
        controls.querySelector('[data-zoom="reset"]').addEventListener("click", () => resetView());

        // Level indicator pill
        const pill = document.createElement("div");
        pill.className = "map-level-pill";
        pill.id = "map-level-pill";
        pill.innerHTML =
            '<span class="map-level-dot l1"></span>' +
            '<span class="map-level-dot l2"></span>' +
            '<span class="map-level-dot l3"></span>' +
            '<span class="map-level-dot l4"></span>' +
            '<span class="map-level-label" id="map-level-label">Leagues</span>';
        stage.appendChild(pill);

        // d3.zoom. Live HTMLCollection for the counter nodes — cheaper than
        // rescanning the DOM every zoom tick (the handler fires 60+Hz during drag).
        const counterNodes = viewG.getElementsByClassName("map-chev-counter");
        let zoomStartK = 1, zoomStartX = 0, zoomStartY = 0;
        let suppressClickUntil = 0;
        zoom = d3.zoom()
            .scaleExtent([1, 40])
            .translateExtent([[-width, -height], [width * 2, height * 2]])
            .on("start", (event) => {
                if (!event.sourceEvent) return;
                zoomStartK = event.transform.k;
                zoomStartX = event.transform.x;
                zoomStartY = event.transform.y;
            })
            .on("end", (event) => {
                if (!event.sourceEvent) return;
                const dx = Math.abs(event.transform.x - zoomStartX);
                const dy = Math.abs(event.transform.y - zoomStartY);
                const dk = Math.abs(event.transform.k - zoomStartK);
                if (dx > 3 || dy > 3 || dk > 0.01) suppressClickUntil = Date.now() + 180;
            })
            .on("zoom", (event) => {
                currentTransform = event.transform;
                const k = event.transform.k;
                viewG.setAttribute("transform", "translate(" + event.transform.x.toFixed(2) + "," + event.transform.y.toFixed(2) + ") scale(" + k.toFixed(4) + ")");
                // Counter-scale chevrons so they keep a constant screen size
                // regardless of zoom. Outer <g> keeps its translate; inner
                // .map-chev-counter carries scale(1/k).
                const invStr = "scale(" + (1 / k).toFixed(4) + ")";
                for (let i = 0, n = counterNodes.length; i < n; i++) {
                    counterNodes[i].setAttribute("transform", invStr);
                }
                updateLevelFromScale(k);
            });
        d3.select(svg).call(zoom);

        // Clicks + hover: countries light up their border in the gap colour;
        // chevrons are clickable drill-down targets.
        liveGroup.querySelectorAll(".map-country-live").forEach(el => {
            const key = el.dataset.league;
            const L = leagueStats[key];
            el.addEventListener("click", (e) => { e.stopPropagation(); focusLeague(key); });
            el.addEventListener("pointerenter", () => {
                el.classList.add("is-hover");
                const lbl = labelEls.get(key);
                if (lbl) lbl.classList.add("is-hover");
            });
            el.addEventListener("pointerleave", () => {
                el.classList.remove("is-hover");
                const lbl = labelEls.get(key);
                if (lbl) lbl.classList.remove("is-hover");
                tip.style.opacity = "0";
            });
            el.addEventListener("pointermove", (e) => { if (L) showLeagueTip(e, L); });
        });
        chevronLayer.querySelectorAll(".map-chev-league").forEach(el => {
            const key = el.dataset.league;
            const L = leagueStats[key];
            el.addEventListener("click", (e) => { e.stopPropagation(); focusLeague(key); });
            el.addEventListener("pointerenter", () => {
                el.classList.add("is-hover");
                const cty = pathEls.get(LEAGUES[key].countryId);
                if (cty) cty.classList.add("is-hover");
            });
            el.addEventListener("pointerleave", () => {
                el.classList.remove("is-hover");
                const cty = pathEls.get(LEAGUES[key].countryId);
                if (cty) cty.classList.remove("is-hover");
                tip.style.opacity = "0";
            });
            el.addEventListener("pointermove", (e) => { if (L) showLeagueTip(e, L); });
        });
        clubLayer.querySelectorAll(".map-chev-club").forEach(el => {
            const key = el.dataset.league;
            const clubName = el.dataset.club;
            el.addEventListener("click", (e) => { e.stopPropagation(); focusClub(key, clubName); });
            el.addEventListener("pointerenter", () => el.classList.add("is-hover"));
            el.addEventListener("pointerleave", () => { el.classList.remove("is-hover"); tip.style.opacity = "0"; });
            el.addEventListener("pointermove", (e) => {
                const C = leagueStats[key]?.clubByName[clubName];
                if (C) showClubTip(e, C, leagueStats[key].label);
            });
        });

        // Background click -> pop a level (ignored if we just finished a drag)
        svg.addEventListener("click", () => {
            if (Date.now() < suppressClickUntil) return;
            if (view.level === "player")      setView({ level: "club",    leagueKey: view.leagueKey, clubName: view.clubName });
            else if (view.level === "club")   setView({ level: "country", leagueKey: view.leagueKey });
            else if (view.level === "country") resetView();
        });

        // Expose build fn for focusPlayer
        drawMap._buildPlayersFor = buildPlayersFor;

        // First paint
        paintCountries();
        applyViewInstant();
    }

    // ---------------------------------------------------------------
    // Level derivation + focus transitions
    // ---------------------------------------------------------------
    function updateLevelFromScale(k) {
        let lvl = 1;
        if (k >= 2 && k < 5)       lvl = 2;
        else if (k >= 5 && k < 14) lvl = 3;
        else if (k >= 14)          lvl = 4;
        if (lvl !== currentLevel) {
            currentLevel = lvl;
            const label = { 1: "Leagues", 2: "Country", 3: "Clubs", 4: "Players" }[lvl];
            const pill = document.getElementById("map-level-pill");
            const lbl = document.getElementById("map-level-label");
            if (lbl) lbl.textContent = label;
            if (pill) {
                pill.classList.remove("is-l1", "is-l2", "is-l3", "is-l4");
                pill.classList.add("is-l" + lvl);
            }
            svg.classList.remove("lv-1", "lv-2", "lv-3", "lv-4");
            svg.classList.add("lv-" + lvl);
        }
    }

    function focusLeague(leagueKey) {
        if (!leagueKey || !leagueStats[leagueKey]) return;
        setView({ level: "country", leagueKey });
    }
    function focusClub(leagueKey, clubName) {
        const L = leagueStats[leagueKey];
        if (!L?.clubByName[clubName]) return;
        setView({ level: "club", leagueKey, clubName });
    }
    function focusPlayer(leagueKey, clubName, playerIdx) {
        const L = leagueStats[leagueKey];
        if (!L?.clubByName[clubName]) return;
        setView({ level: "player", leagueKey, clubName, playerIdx });
    }
    function resetView() { setView({ level: "europe" }); }

    // Compute a d3.zoomIdentity transform that frames the given projected bbox.
    function zoomForBounds(bounds, padding) {
        const pad = padding ?? 0.15;
        const [[x0, y0], [x1, y1]] = bounds;
        const w = x1 - x0, h = y1 - y0;
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const k = Math.max(1, Math.min(40, (1 - pad) / Math.max(w / width, h / height)));
        const tx = width / 2 - cx * k;
        const ty = height / 2 - cy * k;
        return d3.zoomIdentity.translate(tx, ty).scale(k);
    }

    function applyViewInstant() { doFocus(false); }
    function animateToView()    { doFocus(true); }

    function doFocus(animate) {
        if (!svg || !zoom) return;
        let t = d3.zoomIdentity;
        if (view.level === "europe") {
            t = d3.zoomIdentity;
        } else if (view.level === "country") {
            const b = countryBounds.get(view.leagueKey);
            if (b) t = zoomForBounds(b, 0.2);
        } else if (view.level === "club") {
            const C = leagueStats[view.leagueKey]?.clubByName[view.clubName];
            if (C?.coords) {
                const [x, y] = projection(C.coords);
                const k = 9;
                t = d3.zoomIdentity.translate(width / 2 - x * k, height / 2 - y * k).scale(k);
            }
        } else if (view.level === "player") {
            const C = leagueStats[view.leagueKey]?.clubByName[view.clubName];
            if (C?.coords) {
                const [x, y] = projection(C.coords);
                const k = 22;
                t = d3.zoomIdentity.translate(width / 2 - x * k, height / 2 - y * k).scale(k);
                if (drawMap._buildPlayersFor) drawMap._buildPlayersFor(view.leagueKey, view.clubName);
            }
        } else {
            t = d3.zoomIdentity;
        }

        // Wipe player markers when leaving L4
        if (view.level !== "player" && viewG) {
            const pl = viewG.querySelector(".map-player-layer");
            if (pl) pl.innerHTML = "";
        }

        paintCountries();

        const sel = d3.select(svg);
        if (animate) sel.transition().duration(720).ease(d3.easeCubicInOut).call(zoom.transform, t);
        else         sel.call(zoom.transform, t);
    }

    function nudgeZoom(factor) {
        if (!svg || !zoom) return;
        d3.select(svg).transition().duration(220).call(zoom.scaleBy, factor);
    }

    // ---------------------------------------------------------------
    // Tooltips
    // ---------------------------------------------------------------
    function showLeagueTip(e, L) {
        const sign = L.avgGap >= 0 ? "+" : "";
        tip.innerHTML =
            '<div class="map-tip-name">' + escapeAttr(L.label) + '</div>' +
            '<div class="map-tip-row"><span>avg gap</span><strong class="' + (L.avgGap >= 0 ? "gap-up" : "gap-down") + '">' + sign + L.avgGap.toFixed(2) + '</strong></div>' +
            '<div class="map-tip-row"><span>clubs</span><strong>' + L.clubCount + '</strong></div>' +
            '<div class="map-tip-row"><span>players</span><strong>' + L.playerCount + '</strong></div>' +
            '<div class="map-tip-hint">click to drill into clubs</div>';
        placeTip(e);
    }
    function showClubTip(e, C, leagueLabel) {
        const sign = C.avgGap >= 0 ? "+" : "";
        tip.innerHTML =
            '<div class="map-tip-name">' + escapeAttr(C.name) + '</div>' +
            '<div class="map-tip-row"><span>' + escapeAttr(leagueLabel) + '</span></div>' +
            '<div class="map-tip-row"><span>avg gap</span><strong class="' + (C.avgGap >= 0 ? "gap-up" : "gap-down") + '">' + sign + C.avgGap.toFixed(2) + '</strong></div>' +
            '<div class="map-tip-row"><span>players</span><strong>' + C.count + '</strong></div>' +
            '<div class="map-tip-hint">click to drill into players</div>';
        placeTip(e);
    }
    function showPlayerTip(e, p) {
        const sign = p.gap >= 0 ? "+" : "";
        tip.innerHTML =
            '<div class="map-tip-name">' + escapeAttr(p.name) + '</div>' +
            '<div class="map-tip-row"><span>OVR</span><strong>' + (p.ea ?? "-") + '</strong></div>' +
            '<div class="map-tip-row"><span>composite</span><strong>' + (p.real?.toFixed ? p.real.toFixed(1) : "-") + '</strong></div>' +
            '<div class="map-tip-row"><span>gap</span><strong class="' + (p.gap >= 0 ? "gap-up" : "gap-down") + '">' + sign + p.gap.toFixed(2) + '</strong></div>';
        placeTip(e);
    }
    function placeTip(e) {
        tip.style.opacity = "1";
        tip.style.left = (e.clientX + 14) + "px";
        tip.style.top  = (e.clientY + 14) + "px";
    }

    // ---------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------
    renderAside();
    renderDrawer();
    renderBreadcrumb();

    if (!window.topojson) {
        stage.innerHTML = '<div class="map-error">Map data could not be loaded (topojson-client missing).</div>';
        return;
    }

    let cachedWorld = null;
    fetch(TOPO_URL)
        .then(r => r.ok ? r.json() : Promise.reject(new Error("map data " + r.status)))
        .then(world => { cachedWorld = world; drawMap(world); })
        .catch(err => {
            console.error("League map failed:", err);
            stage.innerHTML = '<div class="map-error">Could not load map. ' + escapeAttr(err.message) + '</div>';
        });

    // Debounced resize re-layout (keeps view state)
    let resizeTimer = null;
    let lastW = stage.clientWidth;
    window.addEventListener("resize", () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!cachedWorld) return;
            const w = stage.clientWidth;
            if (Math.abs(w - lastW) < 40) return;
            lastW = w;
            drawMap(cachedWorld);
            applyViewInstant();
        }, 300);
    });
}
