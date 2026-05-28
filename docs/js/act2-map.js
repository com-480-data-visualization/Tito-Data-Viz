function initLeagueMap(data) {
    const root = document.getElementById("map-section");
    if (!root || !data?.length) return;
    window.__playersData = data;

    const LEAGUES = MAP_LEAGUES;
    const CLUB_COORDS = MAP_CLUB_COORDS;
    const HIGHLIGHT_IDS = new Set(Object.values(LEAGUES).map(l => l.countryId));

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
            const meta = players.find(p => p.clubLogo || p.clubFormation || p.clubColor) || players[0] || {};
            const inferred = (typeof window.inferBestFormation === "function")
                ? window.inferBestFormation(players)
                : null;
            return {
                name,
                players,
                avgGap: cMean,
                count: players.length,
                best: sortedByGap[0],
                worst: sortedByGap[sortedByGap.length - 1],
                coords: CLUB_COORDS[name] || null,
                logo: meta.clubLogo || null,
                formation: inferred || meta.clubFormation || null,
                color: meta.clubColor || null
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

    root.innerHTML =
        '<div class="map-head">' +
            '<span class="map-kicker">\u00a7 03 \u00b7 THE CONTINENT</span>' +
            '<h3 class="map-title">The gap, zoomed.</h3>' +
            '<p class="map-sub">' +
                'Europe\u2019s big five, peelable from <em>leagues</em> down to a single <em>club</em>. ' +
                'Click a league, drill into a country, then open the XI from the club view.' +
            '</p>' +
        '</div>' +
        '<nav class="map-breadcrumb" id="map-breadcrumb" aria-label="Map navigation"></nav>' +
        '<div class="map-layout">' +
            '<div class="map-stage" id="map-stage">' +
                '<div class="map-loading">Loading Europe\u2026</div>' +
            '</div>' +
            '<aside class="map-aside" id="map-aside"></aside>' +
        '</div>';

    const stage  = root.querySelector("#map-stage");
    const aside  = root.querySelector("#map-aside");
    const crumb  = root.querySelector("#map-breadcrumb");

    const tip = document.createElement("div");
    tip.className = "map-tip";
    document.body.appendChild(tip);

    let view = { level: "europe" };
    let currentLevel = 0;

    const LEVEL_DEPTH = { europe: 1, country: 2, cluster: 2, club: 3, player: 4 };
    let collapseTimer = null;

    function setView(next, opts) {
        const prevDepth = LEVEL_DEPTH[view.level] || 1;
        const nextDepth = LEVEL_DEPTH[next.level] || 1;
        const goingShallower = nextDepth < prevDepth;
        view = next;
        renderAside();
        renderBreadcrumb();
        if (goingShallower && svg) {
            svg.classList.add("is-dezooming");
            if (collapseTimer) clearTimeout(collapseTimer);
            collapseTimer = setTimeout(() => {
                svg.classList.remove("is-dezooming");
                collapseTimer = null;
                syncEntityVisibility();
            }, 760);
        }
        syncEntityVisibility();
        updateXiButton();
        if (opts?.animate !== false) animateToView();
        else applyViewInstant();
    }

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

    function renderAside() {
        const headline = buildHeadline();

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
                    clubLogoHTML(c, "map-row-logo") +
                    '<span class="map-row-name">' + escapeAttr(c.name) + '</span>' +
                    (c.formation ? '<span class="map-row-formation">' + escapeAttr(c.formation) + '</span>' : '') +
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

        if (view.level === "cluster") {
            const L = leagueStats[view.leagueKey];
            if (!L || !view.clusterMembers) return;
            const members = view.clusterMembers
                .map(name => L.clubByName[name])
                .filter(Boolean)
                .sort((a, b) => b.avgGap - a.avgGap);
            const rows = members.map(c => {
                const sign = c.avgGap >= 0 ? "+" : "";
                const cls  = c.avgGap >= 0 ? "gap-up" : "gap-down";
                return '<button class="map-row ' + cls + '" data-club="' + escapeAttr(c.name) + '">' +
                    clubLogoHTML(c, "map-row-logo") +
                    '<span class="map-row-name">' + escapeAttr(c.name) + '</span>' +
                    (c.formation ? '<span class="map-row-formation">' + escapeAttr(c.formation) + '</span>' : '') +
                    '<span class="map-row-count">' + c.count + ' players</span>' +
                    '<span class="map-row-gap">' + sign + c.avgGap.toFixed(2) + '</span>' +
                '</button>';
            }).join("");
            aside.innerHTML = headline +
                '<div class="map-list">' +
                    '<div class="map-list-label map-list-label-cluster">' +
                        '<button class="map-cluster-back" type="button">&lsaquo; Back to ' + escapeAttr(L.label) + '</button>' +
                        '<span class="map-list-label-text">SHARED SITE &middot; ' + members.length + ' CLUBS</span>' +
                    '</div>' +
                    rows +
                '</div>';
            aside.querySelector(".map-cluster-back")?.addEventListener("click", () => {
                setView({ level: "country", leagueKey: view.leagueKey });
            });
            aside.querySelectorAll(".map-row").forEach(btn => {
                btn.addEventListener("click", () => focusClub(view.leagueKey, btn.dataset.club));
            });
            return;
        }

        if (view.level === "club") {
            const L = leagueStats[view.leagueKey];
            const C = L?.clubByName[view.clubName];
            if (!L || !C) return;
            const players = C.players.slice().sort((a, b) => b.gap - a.gap);

            const clusterPeers = findClusterPeers(view.leagueKey, view.clubName);
            const switcher = (clusterPeers.length > 1)
                ? '<div class="map-cluster-switcher">' +
                    '<span class="map-cluster-switcher-lbl">Same site</span>' +
                    clusterPeers.map(peer => {
                        const isActive = peer.name === C.name ? " is-active" : "";
                        return '<button class="map-cluster-chip' + isActive + '" type="button" data-club="' + escapeAttr(peer.name) + '">' +
                            clubLogoHTML(peer, "map-cluster-chip-logo") +
                            '<span>' + escapeAttr(peer.name) + '</span>' +
                        '</button>';
                    }).join("") +
                '</div>'
                : '';

            const rows = players.map((p, i) => {
                const sign = p.gap >= 0 ? "+" : "";
                const cls  = p.gap >= 0 ? "gap-up" : "gap-down";
                return '<button class="map-row map-row-player ' + cls + '" type="button" data-player-idx="' + i + '" data-player-name="' + escapeAttr(p.name) + '">' +
                    '<span class="map-row-dot"></span>' +
                    '<span class="map-row-name">' + escapeAttr(p.name) + '</span>' +
                    '<span class="map-row-count">OVR ' + (p.ea?.ovr ?? "-") + '</span>' +
                    '<span class="map-row-gap">' + sign + p.gap.toFixed(2) + '</span>' +
                '</button>';
            }).join("");
            const headerInner =
                clubLogoHTML(C, "map-list-logo") +
                '<span class="map-list-label-text">SQUAD &middot; ' + escapeAttr(C.name.toUpperCase()) + '</span>' +
                (C.formation ? '<span class="map-list-formation">' + escapeAttr(C.formation) + '</span>' : '');
            aside.innerHTML = headline +
                switcher +
                '<div class="map-list">' +
                    '<div class="map-list-label map-list-label-club">' + headerInner + '</div>' +
                    rows +
                '</div>';
            aside.querySelectorAll(".map-cluster-chip").forEach(chip => {
                chip.addEventListener("click", () => focusClub(view.leagueKey, chip.dataset.club));
            });
            aside.querySelectorAll(".map-row-player").forEach(btn => {
                btn.addEventListener("click", () => {
                    if (typeof window.openAct2Stadium !== "function") return;
                    window.openAct2Stadium(C, { preselectPlayer: btn.dataset.playerName });
                });
            });
        }
    }

    function findClusterPeers(leagueKey, clubName) {
        const L = leagueStats[leagueKey];
        if (!L) return [];
        for (const [, cluster] of clubClusterEls) {
            if (cluster.league !== leagueKey) continue;
            const names = cluster.members.map(m => m.name);
            if (names.includes(clubName)) {
                return names
                    .map(n => L.clubByName[n])
                    .filter(Boolean)
                    .sort((a, b) => b.avgGap - a.avgGap);
            }
        }
        return [];
    }

    function buildHeadline() {
        const wrap = (kicker, body) =>
            '<div class="map-insight">' +
                '<span class="map-insight-kicker">' + kicker + '</span>' +
                '<p class="map-insight-body">' + body + '</p>' +
            '</div>';

        if (view.level === "europe") {
            const surplusClubs = Object.values(leagueStats)
                .reduce((acc, L) => acc + L.clubs.filter(c => c.avgGap >= 0).length, 0);
            const totalClubs = Object.values(leagueStats)
                .reduce((acc, L) => acc + L.clubs.length, 0);
            const body =
                '<strong>' + escapeAttr(mostUnder.label) + '</strong> runs the biggest reputation surplus ' +
                '(<span class="gap-up">+' + mostUnder.avgGap.toFixed(2) + '</span>). ' +
                '<strong>' + escapeAttr(mostOver.label) + '</strong> carries the heaviest tax ' +
                '(<span class="gap-down">' + mostOver.avgGap.toFixed(2) + '</span>). ' +
                'Across the top five, <strong>' + surplusClubs + '/' + totalClubs + '</strong> clubs land underrated on average.';
            return wrap("HEADLINE · EUROPE", body);
        }

        if (view.level === "country") {
            const L = leagueStats[view.leagueKey];
            if (!L) return "";
            const clubs = L.clubs.slice().sort((a, b) => b.avgGap - a.avgGap);
            const top = clubs[0];
            const bottom = clubs[clubs.length - 1];
            const fairest = clubs.slice().sort((a, b) => Math.abs(a.avgGap) - Math.abs(b.avgGap))[0];
            const body =
                '<strong>' + escapeAttr(top.name) + '</strong> tops the surplus list ' +
                '(<span class="gap-up">+' + top.avgGap.toFixed(2) + '</span>). ' +
                '<strong>' + escapeAttr(bottom.name) + '</strong> sits the heaviest in the red ' +
                '(<span class="gap-down">' + bottom.avgGap.toFixed(2) + '</span>). ' +
                'League average <strong>' + (L.avgGap >= 0 ? "+" : "") + L.avgGap.toFixed(2) + '</strong> on ' +
                '<strong>' + L.playerCount + '</strong> players. ' +
                'Closest to fair: <strong>' + escapeAttr(fairest.name) + '</strong>.';
            return wrap("HEADLINE · " + escapeAttr(L.label.toUpperCase()), body);
        }

        if (view.level === "cluster") {
            const L = leagueStats[view.leagueKey];
            if (!L) return "";
            const members = (view.clusterMembers || [])
                .map(n => L.clubByName[n])
                .filter(Boolean)
                .sort((a, b) => b.avgGap - a.avgGap);
            if (!members.length) return "";
            const top = members[0];
            const bottom = members[members.length - 1];
            const meanGap = members.reduce((s, m) => s + m.avgGap, 0) / members.length;
            const totalPlayers = members.reduce((s, m) => s + m.count, 0);
            const body =
                'Same metro, different verdicts. <strong>' + escapeAttr(top.name) + '</strong> tops ' +
                '(<span class="gap-up">+' + top.avgGap.toFixed(2) + '</span>), ' +
                '<strong>' + escapeAttr(bottom.name) + '</strong> at the bottom ' +
                '(<span class="gap-down">' + bottom.avgGap.toFixed(2) + '</span>). ' +
                'Cluster average <strong>' + (meanGap >= 0 ? "+" : "") + meanGap.toFixed(2) + '</strong> ' +
                'on <strong>' + totalPlayers + '</strong> players.';
            return wrap("HEADLINE · SHARED SITE · " + escapeAttr(L.label.toUpperCase()), body);
        }

        if (view.level === "club") {
            const L = leagueStats[view.leagueKey];
            const C = L && L.clubByName[view.clubName];
            if (!C) return "";
            const players = C.players.slice().sort((a, b) => b.gap - a.gap);
            const top = players[0];
            const bottom = players[players.length - 1];
            const upCount = players.filter(p => p.gap > 1).length;
            const dnCount = players.filter(p => p.gap < -1).length;
            const body =
                'Squad average <strong>' + (C.avgGap >= 0 ? "+" : "") + C.avgGap.toFixed(2) + '</strong> ' +
                'on <strong>' + C.count + '</strong> players. ' +
                'Most underrated: <strong>' + escapeAttr(top.name) + '</strong> ' +
                '(<span class="gap-up">+' + top.gap.toFixed(2) + '</span>). ' +
                'Heaviest tax on <strong>' + escapeAttr(bottom.name) + '</strong> ' +
                '(<span class="gap-down">' + bottom.gap.toFixed(2) + '</span>). ' +
                '<strong>' + upCount + '</strong> underrated · <strong>' + dnCount + '</strong> overrated.';
            const kicker = (C.formation ? C.formation + " · " : "") + escapeAttr(C.name.toUpperCase());
            return wrap("HEADLINE · " + kicker, body);
        }

        return "";
    }

    function clubLogoHTML(c, cls) {
        const fb = (c.color || "#444") + "";
        const initial = ((c.name || "?")[0] || "?").toUpperCase();
        if (c.logo) {
            return '<span class="' + cls + '-wrap" style="--club-color:' + escapeAttr(fb) + '">' +
                '<img class="' + cls + '" src="' + escapeAttr(c.logo) + '" alt="" loading="lazy" ' +
                'onerror="this.parentNode.classList.add(\'is-fallback\');this.remove();" />' +
                '<span class="' + cls + '-fb">' + escapeAttr(initial) + '</span>' +
            '</span>';
        }
        return '<span class="' + cls + '-wrap is-fallback" style="--club-color:' + escapeAttr(fb) + '">' +
            '<span class="' + cls + '-fb">' + escapeAttr(initial) + '</span>' +
        '</span>';
    }

    function renderBreadcrumb() {
        const parts = [{ label: "Europe", onClick: () => resetView() }];
        if (view.leagueKey) {
            const L = leagueStats[view.leagueKey];
            parts.push({ label: L.country, onClick: () => focusLeague(view.leagueKey) });
        }
        if (view.clubName) parts.push({ label: view.clubName, onClick: () => focusClub(view.leagueKey, view.clubName) });
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

    const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
    const W_DEFAULT = 720, H_DEFAULT = 540;
    let svg = null;
    let viewG = null;               // zoomable <g>
    let projection = null;
    let pathGen = null;
    let zoom = null;
    let width = W_DEFAULT, height = H_DEFAULT;
    let pathEls = new Map();
    let labelEls = new Map();
    let clubEls = new Map();
    let clubClusterEls = new Map();
    let countryBounds = new Map();
    let currentTransform = null;
    let xiButton = null;

    function paintCountries() {
        const focused = view.level !== "europe" && view.leagueKey;
        pathEls.forEach((el, id) => {
            if (!HIGHLIGHT_IDS.has(id)) return;
            const key = Object.keys(LEAGUES).find(k => LEAGUES[k].countryId === id);
            const L = leagueStats[key];
            if (!L) return;
            const isThis = key === view.leagueKey;
            if (focused && !isThis) {
                el.setAttribute("fill", "url(#map-country-fill)");
                el.classList.remove("is-up", "is-down", "is-selected");
                el.classList.add("is-faded");
            } else {
                el.setAttribute("fill", "url(#map-country-fill-live)");
                el.classList.remove("is-up", "is-down", "is-faded");
                el.classList.add(L.avgGap >= 0 ? "is-up" : "is-down");
                el.classList.toggle("is-selected", isThis);
            }
        });
    }

    function highlightCountry(leagueKey, on) {
        const id = LEAGUES[leagueKey]?.countryId;
        if (!id) return;
        const el = pathEls.get(id);
        if (el) el.classList.toggle("is-hover", !!on);
    }

    function syncEntityVisibility() {
        if (!svg) return;
        // cluster pins are shared, dedupe per node so focusing one member
        // doesn't hide the pin for the rest
        const nodeScope = new Map();
        clubEls.forEach((el, key) => {
            const parts = key.split("|");
            const leagueKey = parts[0];
            const clubName = parts.slice(1).join("|");
            let outOfScope = false;
            if (view.level === "country" || view.level === "cluster") {
                outOfScope = leagueKey !== view.leagueKey;
            } else if (view.level === "club") {
                const zoomedBackToCountry = currentLevel <= 2;
                outOfScope = leagueKey !== view.leagueKey || (!zoomedBackToCountry && clubName !== view.clubName);
            }
            const prev = nodeScope.get(el);
            if (prev === undefined || prev === true) nodeScope.set(el, outOfScope);
        });
        nodeScope.forEach((outOfScope, el) => {
            el.classList.toggle("is-out-of-scope", outOfScope);
        });
        morphClusterPins();
    }

    function morphClusterPins() {
        clubClusterEls.forEach((cluster) => {
            const node = cluster.node;
            if (!node._originalHtml) node._originalHtml = node.innerHTML;
            const focusName = view.level === "club" ? view.clubName : null;
            const focusMember = focusName
                ? cluster.members.find(m => m.name === focusName)
                : null;
            if (focusMember && cluster.league === view.leagueKey) {
                const sign = focusMember.avgGap >= 0 ? "+" : "";
                node.classList.add("is-focused-member");
                node.classList.toggle("is-up", focusMember.avgGap >= 0);
                node.classList.toggle("is-down", focusMember.avgGap < 0);
                const ringStroke = focusMember.color || "rgba(255,255,255,0.22)";
                const logoMark = focusMember.logo
                    ? '<g class="map-chev-logo" transform="translate(0, 0)">' +
                          '<circle cx="0" cy="0" r="11" fill="#0a0e18" stroke="' + escapeAttr(ringStroke) + '" stroke-width="1.1"></circle>' +
                          '<image href="' + escapeAttr(focusMember.logo) + '" x="-9" y="-9" width="18" height="18" clip-path="circle(8.5px at 9px 9px)" preserveAspectRatio="xMidYMid meet"></image>' +
                      '</g>'
                    : '<circle cx="0" cy="0" r="11" fill="' + escapeAttr(focusMember.color || "#444") + '" stroke="rgba(0,0,0,0.45)" stroke-width="0.9"></circle>';
                node.querySelector(".map-chev-counter").innerHTML =
                    '<rect class="map-chev-plate" x="-22" y="-30" width="44" height="14" rx="3"></rect>' +
                    '<text class="map-chev-gap" x="0" y="-20" text-anchor="middle">' + sign + focusMember.avgGap.toFixed(2) + '</text>' +
                    logoMark +
                    '<text class="map-chev-label" x="0" y="22" text-anchor="middle">' + escapeAttr(focusMember.name) + '</text>';
            } else {
                if (node.classList.contains("is-focused-member")) {
                    node.classList.remove("is-focused-member");
                    if (node._originalHtml) node.innerHTML = node._originalHtml;
                    const meanGap = cluster.members.reduce((s, m) => s + m.avgGap, 0) / cluster.members.length;
                    node.classList.toggle("is-up", meanGap >= 0);
                    node.classList.toggle("is-down", meanGap < 0);
                }
            }
        });
    }

    function updateXiButton() {
        if (!xiButton) return;
        const L = view.leagueKey ? leagueStats[view.leagueKey] : null;
        const C = L && view.clubName ? L.clubByName[view.clubName] : null;

        const wrap = xiButton.closest(".map-xi-cluster");
        const picker = wrap ? wrap.querySelector(".map-xi-picker") : null;

        const onClubLayer = view.level === "club" || view.level === "cluster";
        if (wrap) wrap.classList.toggle("is-visible", onClubLayer);

        if (picker) {
            const peers = view.level === "cluster"
                ? (view.clusterMembers || []).map(n => L?.clubByName[n]).filter(Boolean)
                : findClusterPeers(view.leagueKey, view.clubName);
            const showPicker = peers.length > 1;
            picker.classList.toggle("is-visible", showPicker);
            picker.classList.toggle("is-disabled", !showPicker);
            if (!showPicker) picker.classList.remove("is-open");

            const labelEl = picker.querySelector(".map-xi-picker-label");
            const menuEl = picker.querySelector(".map-xi-picker-menu");
            if (labelEl) {
                labelEl.innerHTML = C
                    ? clubLogoHTML(C, "map-xi-picker-logo") + '<span>' + escapeAttr(C.name) + '</span>'
                    : '<span class="map-xi-picker-placeholder">Pick a club</span>';
            }
            if (menuEl) {
                const sorted = peers.slice().sort((a, b) => b.avgGap - a.avgGap);
                menuEl.innerHTML = sorted.map(p => {
                    const isSel = C && p.name === C.name;
                    const sign = p.avgGap >= 0 ? "+" : "";
                    const cls = p.avgGap >= 0 ? "gap-up" : "gap-down";
                    return '<li class="map-xi-picker-item' + (isSel ? " is-selected" : "") + '" role="option" data-club="' + escapeAttr(p.name) + '">' +
                        clubLogoHTML(p, "map-xi-picker-logo") +
                        '<span class="map-xi-picker-name">' + escapeAttr(p.name) + '</span>' +
                        '<span class="map-xi-picker-gap ' + cls + '">' + sign + p.avgGap.toFixed(2) + '</span>' +
                    '</li>';
                }).join("");
            }
        }

        xiButton.classList.toggle("is-visible", onClubLayer);
        xiButton.disabled = !(onClubLayer && C);
        if (C) {
            xiButton.dataset.league = view.leagueKey;
            xiButton.dataset.club = C.name;
            xiButton.querySelector(".map-xi-club").textContent = C.name;
        } else {
            xiButton.removeAttribute("data-league");
            xiButton.removeAttribute("data-club");
            xiButton.querySelector(".map-xi-club").textContent = "";
        }
    }

    function openClubXI() {
        const L = view.leagueKey ? leagueStats[view.leagueKey] : null;
        const C = L && view.clubName ? L.clubByName[view.clubName] : null;
        if (!C || typeof window.openAct2Stadium !== "function") return;
        window.openAct2Stadium(C);
    }

    function drawMap(world) {
        const features = topojson.feature(world, world.objects.countries).features;

        width = stage.clientWidth || W_DEFAULT;
        height = Math.max(480, Math.round(width * 0.72));

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

        const bg = document.createElementNS(SVG_NS, "rect");
        bg.setAttribute("x", 0); bg.setAttribute("y", 0);
        bg.setAttribute("width", width); bg.setAttribute("height", height);
        bg.setAttribute("fill", "url(#map-bg-grad)");
        svg.appendChild(bg);

        viewG = document.createElementNS(SVG_NS, "g");
        viewG.setAttribute("class", "map-view");
        svg.appendChild(viewG);

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

                const b = pathGen.bounds(f);
                countryBounds.set(leagueKey, b);
            } else {
                el.setAttribute("class", "map-country map-country-dim");
                dimGroup.appendChild(el);
            }
            pathEls.set(id, el);
        }

        const clubLayer = document.createElementNS(SVG_NS, "g");
        clubLayer.setAttribute("class", "map-club-layer");
        viewG.appendChild(clubLayer);

        const chevronLayer = document.createElementNS(SVG_NS, "g");
        chevronLayer.setAttribute("class", "map-chev-layer");
        viewG.appendChild(chevronLayer);

        function makeChevron({ x, y, gap, label, sub, kind, dataset, logo, color }) {
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
            const sign = gap >= 0 ? "+" : "";
            const ringStroke = color || "rgba(255,255,255,0.18)";
            const logoMark = logo
                ? '<g class="map-chev-logo">' +
                    '<circle cx="0" cy="14" r="9" fill="#0a0e18" stroke="' + escapeAttr(ringStroke) + '" stroke-width="0.9"></circle>' +
                    '<image href="' + escapeAttr(logo) + '" x="-7.5" y="6.5" width="15" height="15" clip-path="circle(7px at 7.5px 7.5px)" preserveAspectRatio="xMidYMid meet"></image>' +
                  '</g>'
                : "";
            bob.innerHTML =
                '<path class="map-chev-glow" d="M -11 -30 L 11 -30 L 0 -14 Z"></path>' +
                '<path class="map-chev-shape" d="M -11 -30 L 11 -30 L 0 -14 Z"></path>' +
                '<rect class="map-chev-plate" x="-22" y="-46" width="44" height="14" rx="3"></rect>' +
                '<text class="map-chev-gap" x="0" y="-36" text-anchor="middle">' + sign + gap.toFixed(2) + '</text>' +
                logoMark +
                (label ? '<text class="map-chev-label" x="0" y="32" text-anchor="middle">' + escapeAttr(label) + '</text>' : "") +
                (sub   ? '<text class="map-chev-sub"   x="0" y="42" text-anchor="middle">' + escapeAttr(sub)   + '</text>' : "");
            counter.appendChild(bob);
            g.appendChild(counter);
            return g;
        }

        function makeCluster({ x, y, members, kind, dataset }) {
            const g = document.createElementNS(SVG_NS, "g");
            g.setAttribute("class", "map-chev " + kind + " map-chev-cluster");
            if (dataset) for (const k of Object.keys(dataset)) g.setAttribute("data-" + k, dataset[k]);
            g.setAttribute("data-tx", x.toFixed(2));
            g.setAttribute("data-ty", y.toFixed(2));
            g.setAttribute("transform", "translate(" + x.toFixed(2) + "," + y.toFixed(2) + ")");

            const counter = document.createElementNS(SVG_NS, "g");
            counter.setAttribute("class", "map-chev-counter");

            const meanGap = members.reduce((s, m) => s + m.avgGap, 0) / members.length;
            const sign = meanGap >= 0 ? "+" : "";
            g.classList.add("is-" + (meanGap >= 0 ? "up" : "down"));

            const ringStroke = members[0].color || "rgba(255,255,255,0.22)";
            const stack = members.slice(0, 3).map((m, i) => {
                const dx = (i - (Math.min(members.length, 3) - 1) / 2) * 8;
                if (m.logo) {
                    return '<g class="map-cluster-logo" transform="translate(' + dx + ', 0)">' +
                        '<circle cx="0" cy="0" r="8" fill="#0a0e18" stroke="' + escapeAttr(ringStroke) + '" stroke-width="0.9"></circle>' +
                        '<image href="' + escapeAttr(m.logo) + '" x="-6.5" y="-6.5" width="13" height="13" clip-path="circle(6px at 6.5px 6.5px)" preserveAspectRatio="xMidYMid meet"></image>' +
                    '</g>';
                }
                return '<circle cx="' + dx + '" cy="0" r="8" fill="' + escapeAttr(m.color || "#444") + '" stroke="rgba(0,0,0,0.45)" stroke-width="0.9"></circle>';
            }).join("");

            counter.innerHTML =
                '<rect class="map-chev-plate" x="-22" y="-22" width="44" height="14" rx="3"></rect>' +
                '<text class="map-chev-gap" x="0" y="-12" text-anchor="middle">' + sign + meanGap.toFixed(2) + '</text>' +
                stack +
                '<text class="map-cluster-count" x="0" y="22" text-anchor="middle">' + members.length + ' clubs</text>';
            g.appendChild(counter);
            return g;
        }

        function clusterClubs(clubsList, threshold) {
            const items = clubsList
                .filter(c => c.coords)
                .map(c => {
                    const [x, y] = projection(c.coords);
                    return { c, x, y };
                })
                .filter(it => isFinite(it.x) && isFinite(it.y));
            const taken = new Set();
            const out = [];
            for (let i = 0; i < items.length; i++) {
                if (taken.has(i)) continue;
                const group = [i];
                for (let j = i + 1; j < items.length; j++) {
                    if (taken.has(j)) continue;
                    const dx = items[i].x - items[j].x;
                    const dy = items[i].y - items[j].y;
                    if (dx * dx + dy * dy < threshold * threshold) {
                        group.push(j);
                        taken.add(j);
                    }
                }
                taken.add(i);
                const sx = group.reduce((s, k) => s + items[k].x, 0) / group.length;
                const sy = group.reduce((s, k) => s + items[k].y, 0) / group.length;
                out.push({
                    centroid: [sx, sy],
                    members: group.map(k => items[k].c)
                });
            }
            return out;
        }

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

        // clubs sharing a ground (inter/milan, roma/lazio) collapse into one pin
        clubEls = new Map();
        clubClusterEls = new Map();
        const CLUSTER_THRESHOLD = 6;
        for (const key of Object.keys(leagueStats)) {
            const clusters = clusterClubs(leagueStats[key].clubs, CLUSTER_THRESHOLD);
            for (const cluster of clusters) {
                if (cluster.members.length === 1) {
                    const c = cluster.members[0];
                    const [x, y] = cluster.centroid;
                    const g = makeChevron({
                        x, y,
                        gap: c.avgGap,
                        label: c.name,
                        kind: "map-chev-club",
                        dataset: { league: key, club: c.name },
                        logo: c.logo,
                        color: c.color
                    });
                    clubLayer.appendChild(g);
                    clubEls.set(key + "|" + c.name, g);
                } else {
                    const [x, y] = cluster.centroid;
                    const memberKeys = cluster.members.map(m => m.name).join(",");
                    const g = makeCluster({
                        x, y,
                        members: cluster.members,
                        kind: "map-chev-club",
                        dataset: { league: key, cluster: memberKeys }
                    });
                    clubLayer.appendChild(g);
                    clubClusterEls.set(key + "|" + memberKeys, { node: g, members: cluster.members, centroid: [x, y], league: key });
                    cluster.members.forEach(c => {
                        clubEls.set(key + "|" + c.name, g);
                    });
                }
            }
        }

        // metropolitan clubs only, the canaries/guyane wreck the bbox
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

        const vignette = document.createElementNS(SVG_NS, "rect");
        vignette.setAttribute("x", 0); vignette.setAttribute("y", 0);
        vignette.setAttribute("width", width); vignette.setAttribute("height", height);
        vignette.setAttribute("fill", "url(#map-vignette)");
        vignette.setAttribute("pointer-events", "none");
        svg.appendChild(vignette);

        stage.innerHTML = "";
        stage.appendChild(svg);

        const controls = document.createElement("div");
        controls.className = "map-zoom-ctrls";
        controls.innerHTML =
            '<button class="map-zoom-btn map-zoom-reset" data-zoom="reset" aria-label="Reset to Europe">\u21BB</button>';
        stage.appendChild(controls);
        controls.querySelector('[data-zoom="reset"]').addEventListener("click", () => resetView());

        const pill = document.createElement("div");
        pill.className = "map-level-pill";
        pill.id = "map-level-pill";
        pill.innerHTML =
            '<span class="map-level-dot l1"></span>' +
            '<span class="map-level-dot l2"></span>' +
            '<span class="map-level-dot l3"></span>' +
            '<span class="map-level-label" id="map-level-label">Europe</span>';
        stage.appendChild(pill);

        const xiCluster = document.createElement("div");
        xiCluster.className = "map-xi-cluster";
        xiCluster.innerHTML =
            '<div class="map-xi-picker" role="combobox" aria-haspopup="listbox" tabindex="0">' +
                '<button class="map-xi-picker-toggle" type="button">' +
                    '<span class="map-xi-picker-label">Pick a club</span>' +
                    '<span class="map-xi-picker-caret">▾</span>' +
                '</button>' +
                '<ul class="map-xi-picker-menu" role="listbox"></ul>' +
            '</div>';
        xiButton = document.createElement("button");
        xiButton.className = "map-xi-btn";
        xiButton.type = "button";
        xiButton.disabled = true;
        xiButton.innerHTML =
            '<span class="map-xi-kicker">Club View</span>' +
            '<span class="map-xi-main">View the XI</span>' +
            '<span class="map-xi-club"></span>';
        xiButton.addEventListener("click", openClubXI);
        xiCluster.appendChild(xiButton);
        stage.appendChild(xiCluster);

        const xiPicker = xiCluster.querySelector(".map-xi-picker");
        const xiPickerToggle = xiCluster.querySelector(".map-xi-picker-toggle");
        const xiPickerMenu = xiCluster.querySelector(".map-xi-picker-menu");

        xiPickerToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            if (xiPicker.classList.contains("is-disabled")) return;
            xiPicker.classList.toggle("is-open");
        });
        xiPickerMenu.addEventListener("click", (e) => {
            const item = e.target.closest("[data-club]");
            if (!item) return;
            const clubName = item.dataset.club;
            xiPicker.classList.remove("is-open");
            focusClub(view.leagueKey, clubName);
        });
        document.addEventListener("click", (e) => {
            if (!xiPicker.contains(e.target)) xiPicker.classList.remove("is-open");
        });

        // live collection, no dom rescan per zoom tick
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
                // counter-scale chevrons to keep them a constant on-screen size
                const invStr = "scale(" + (1 / k).toFixed(4) + ")";
                for (let i = 0, n = counterNodes.length; i < n; i++) {
                    counterNodes[i].setAttribute("transform", invStr);
                }
                updateLevelFromScale(k);
            });
        d3.select(svg).call(zoom)
            .on("wheel.zoom", null)
            .on("mousedown.zoom", null)
            .on("dblclick.zoom", null)
            .on("touchstart.zoom", null)
            .on("touchmove.zoom", null)
            .on("touchend.zoom", null);

        liveGroup.querySelectorAll(".map-country-live").forEach(el => {
            const key = el.dataset.league;
            const L = leagueStats[key];
            el.addEventListener("click", (e) => {
                if (view.level !== "europe") return;
                e.stopPropagation();
                focusLeague(key);
            });
            el.addEventListener("pointerenter", () => {
                if (view.level !== "europe") return;
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
            el.addEventListener("pointermove", (e) => {
                if (view.level !== "europe") { tip.style.opacity = "0"; return; }
                if (L) showLeagueTip(e, L);
            });
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
            const clusterKey = el.dataset.cluster;
            el.addEventListener("pointerenter", () => el.classList.add("is-hover"));
            el.addEventListener("pointerleave", () => { el.classList.remove("is-hover"); tip.style.opacity = "0"; });
            if (clusterKey) {
                const cluster = clubClusterEls.get(key + "|" + clusterKey);
                el.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (cluster && cluster.members.length) focusCluster(key, cluster);
                });
                el.addEventListener("pointermove", (e) => {
                    if (cluster) showClusterTip(e, cluster.members, leagueStats[key].label);
                });
            } else {
                el.addEventListener("click", (e) => { e.stopPropagation(); focusClub(key, clubName); });
                el.addEventListener("pointermove", (e) => {
                    const C = leagueStats[key]?.clubByName[clubName];
                    if (C) showClubTip(e, C, leagueStats[key].label);
                });
            }
        });

        // bg click pops a level, unless we just finished a drag
        svg.addEventListener("click", () => {
            if (Date.now() < suppressClickUntil) return;
            if (view.level === "club")        setView({ level: "country", leagueKey: view.leagueKey });
            else if (view.level === "cluster") setView({ level: "country", leagueKey: view.leagueKey });
            else if (view.level === "country") resetView();
        });

        paintCountries();
        syncEntityVisibility();
        updateXiButton();
        applyViewInstant();
    }

    function updateLevelFromScale(k) {
        let lvl = 1;
        if (k >= 2 && k < 5) lvl = 2;
        else if (k >= 5)     lvl = 3;
        if (lvl !== currentLevel) {
            currentLevel = lvl;
            const label = { 1: "Europe", 2: "Country", 3: "Club", 4: "Club" }[lvl];
            const pill = document.getElementById("map-level-pill");
            const lbl = document.getElementById("map-level-label");
            if (lbl) lbl.textContent = label;
            if (pill) {
                pill.classList.remove("is-l1", "is-l2", "is-l3", "is-l4");
                pill.classList.add("is-l" + lvl);
            }
            svg.classList.remove("lv-1", "lv-2", "lv-3", "lv-4");
            svg.classList.add("lv-" + lvl);
            syncEntityVisibility();
            syncAsideToLevel(lvl);
        }
    }

    // keep aside + breadcrumb in sync when the user wheel-zooms instead of clicking
    function syncAsideToLevel(lvl) {
        let next = view;
        if (lvl <= 1) {
            if (view.level !== "europe") next = { level: "europe" };
        } else if (lvl === 2) {
            const leagueKey = view.leagueKey || closestLeagueToViewportCenter();
            if (leagueKey) {
                if (view.level !== "country" || view.leagueKey !== leagueKey) {
                    next = { level: "country", leagueKey };
                }
            } else if (view.level !== "europe") {
                next = { level: "europe" };
            }
        } else if (lvl >= 3) {
            const leagueKey = view.leagueKey || closestLeagueToViewportCenter();
            if (leagueKey && view.clubName && view.level !== "club") {
                next = { level: "club", leagueKey, clubName: view.clubName };
            } else if (leagueKey && !view.clubName && view.level !== "country") {
                next = { level: "country", leagueKey };
            }
        }
        if (next === view) return;
        view = next;
        paintCountries();
        renderAside();
        renderBreadcrumb();
        syncEntityVisibility();
        updateXiButton();
    }

    function closestLeagueToViewportCenter() {
        if (!currentTransform || !projection) return null;
        const cx = (width / 2 - currentTransform.x) / currentTransform.k;
        const cy = (height / 2 - currentTransform.y) / currentTransform.k;
        let best = null, bestD = Infinity;
        for (const key of Object.keys(LEAGUES)) {
            const [px, py] = projection(LEAGUES[key].anchor);
            if (!isFinite(px) || !isFinite(py)) continue;
            const dx = px - cx, dy = py - cy;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; best = key; }
        }
        return best;
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
    function focusCluster(leagueKey, cluster) {
        if (!cluster || !cluster.members?.length) return;
        const top = cluster.members.slice().sort((a, b) => Math.abs(b.avgGap) - Math.abs(a.avgGap))[0];
        setView({
            level: "cluster",
            leagueKey,
            clubName: top?.name,
            clusterCentroid: cluster.centroid,
            clusterMembers: cluster.members.map(m => m.name)
        });
    }
    function resetView() { setView({ level: "europe" }); }

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
                const k = 22;
                t = d3.zoomIdentity.translate(width / 2 - x * k, height / 2 - y * k).scale(k);
            }
        } else if (view.level === "cluster") {
            const c = view.clusterCentroid;
            if (c) {
                const k = 14;
                t = d3.zoomIdentity.translate(width / 2 - c[0] * k, height / 2 - c[1] * k).scale(k);
            }
        } else {
            t = d3.zoomIdentity;
        }

        paintCountries();
        syncEntityVisibility();

        const sel = d3.select(svg);
        if (animate) sel.transition().duration(720).ease(d3.easeCubicInOut).call(zoom.transform, t);
        else         sel.call(zoom.transform, t);
    }

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
        const logoMark = C.logo
            ? '<img class="map-tip-logo" src="' + escapeAttr(C.logo) + '" alt="" />'
            : '';
        tip.innerHTML =
            '<div class="map-tip-head">' + logoMark + '<div class="map-tip-name">' + escapeAttr(C.name) + '</div></div>' +
            '<div class="map-tip-row"><span>' + escapeAttr(leagueLabel) + '</span>' + (C.formation ? '<strong>' + escapeAttr(C.formation) + '</strong>' : '') + '</div>' +
            '<div class="map-tip-row"><span>avg gap</span><strong class="' + (C.avgGap >= 0 ? "gap-up" : "gap-down") + '">' + sign + C.avgGap.toFixed(2) + '</strong></div>' +
            '<div class="map-tip-row"><span>players</span><strong>' + C.count + '</strong></div>' +
            '<div class="map-tip-hint">' + (view.level === "club" ? "use View the XI" : "click to focus club") + '</div>';
        placeTip(e);
    }
    function showClusterTip(e, members, leagueLabel) {
        const sorted = members.slice().sort((a, b) => b.avgGap - a.avgGap);
        const meanGap = members.reduce((s, m) => s + m.avgGap, 0) / members.length;
        const sign = meanGap >= 0 ? "+" : "";
        const list = sorted.map(m => {
            const ms = m.avgGap >= 0 ? "+" : "";
            const cls = m.avgGap >= 0 ? "gap-up" : "gap-down";
            return '<div class="map-tip-row"><span>' + escapeAttr(m.name) + '</span><strong class="' + cls + '">' + ms + m.avgGap.toFixed(2) + '</strong></div>';
        }).join("");
        tip.innerHTML =
            '<div class="map-tip-name">' + members.length + ' clubs &middot; same site</div>' +
            '<div class="map-tip-row"><span>' + escapeAttr(leagueLabel) + '</span></div>' +
            '<div class="map-tip-row"><span>cluster gap</span><strong class="' + (meanGap >= 0 ? "gap-up" : "gap-down") + '">' + sign + meanGap.toFixed(2) + '</strong></div>' +
            list +
            '<div class="map-tip-hint">click to drill in</div>';
        placeTip(e);
    }
    function placeTip(e) {
        tip.style.opacity = "1";
        tip.style.left = (e.clientX + 14) + "px";
        tip.style.top  = (e.clientY + 14) + "px";
    }

    renderAside();
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
            stage.innerHTML = '<div class="map-error">Could not load map. ' + escapeAttr(err.message) + '</div>';
        });

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
