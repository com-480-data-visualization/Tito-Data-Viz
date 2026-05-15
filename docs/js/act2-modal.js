(function () {

    const DIM_STATS = {
        ST: {
            scoring:     [{key:"npxg90",label:"npxG/90"},{key:"sot90",label:"SoT/90"},{key:"gpa",label:"G/Sh"},{key:"sh90",label:"Sh/90"},{key:"npxgpsh",label:"npxG/Sh"},{key:"sotpct",label:"SoT %"}],
            creation:    [{key:"xag90",label:"xAG/90"},{key:"gca90",label:"GCA/90"},{key:"sca90",label:"SCA/90"},{key:"kp90",label:"KP/90"}],
            progression: [{key:"to90",label:"TO/90"},{key:"succpct",label:"Take-on %"},{key:"prgc90",label:"PrgC/90"},{key:"cpa90",label:"CPA/90"},{key:"mis90",label:"Miscontrols/90 (inv.)"}],
            defense:     [{key:"aerialwon",label:"Aerials %"}],
            discipline:  [{key:"offsides90",label:"Offsides/90 (inv.)"}]
        },
        WG: {
            scoring:     [{key:"npxg90",label:"npxG/90"},{key:"sh90",label:"Sh/90"},{key:"sot90",label:"SoT/90"}],
            creation:    [{key:"xag90",label:"xAG/90"},{key:"sca90",label:"SCA/90"},{key:"gca90",label:"GCA/90"},{key:"kp90",label:"KP/90"},{key:"crspa90",label:"CrsPA/90"},{key:"xa90",label:"xA/90"},{key:"tb90",label:"Through balls/90"},{key:"ppa90",label:"PPA/90"}],
            progression: [{key:"to90",label:"TO/90"},{key:"succpct",label:"Take-on %"},{key:"prgc90",label:"PrgC/90"}],
            discipline:  [{key:"fld90",label:"Fouls drawn/90"},{key:"mis90",label:"Miscontrols/90 (inv.)"}]
        },
        AM: {
            creation:    [{key:"xag90",label:"xAG/90"},{key:"sca90",label:"SCA/90"},{key:"gca90",label:"GCA/90"},{key:"kp90",label:"KP/90"},{key:"tb90",label:"Through balls/90"},{key:"ppa90",label:"PPA/90"},{key:"xa90",label:"xA/90"}],
            progression: [{key:"prgp90",label:"PrgP/90"},{key:"prgc90",label:"PrgC/90"},{key:"to90",label:"TO/90"},{key:"final3rd90",label:"Passes Final 3rd/90"},{key:"cmppct",label:"Pass %"}],
            scoring:     [{key:"npxg90",label:"npxG/90"},{key:"sot90",label:"SoT/90"}],
            discipline:  [{key:"fld90",label:"Fouls drawn/90"},{key:"mis90",label:"Miscontrols/90 (inv.)"}]
        },
        CM: {
            creation:    [{key:"xag90",label:"xAG/90"},{key:"sca90",label:"SCA/90"},{key:"kp90",label:"KP/90"},{key:"tb90",label:"Through balls/90"}],
            progression: [{key:"prgp90",label:"PrgP/90"},{key:"prgc90",label:"PrgC/90"},{key:"final3rd90",label:"Passes Final 3rd/90"},{key:"cmppct",label:"Pass %"}],
            defense:     [{key:"tklint90",label:"Tkl+Int/90"},{key:"int90",label:"Interceptions/90"},{key:"recov90",label:"Recoveries/90"},{key:"blocks90",label:"Blocks/90"},{key:"aerialwon",label:"Aerials %"}],
            scoring:     [{key:"npxg90",label:"npxG/90"}],
            discipline:  [{key:"fls90",label:"Fouls/90 (inv.)"},{key:"mis90",label:"Miscontrols/90 (inv.)"}]
        },
        DM: {
            defense:     [{key:"tklint90",label:"Tkl+Int/90"},{key:"int90",label:"Interceptions/90"},{key:"tkl90",label:"Tackles/90"},{key:"tklpct",label:"Tkl %"},{key:"recov90",label:"Recoveries/90"},{key:"blocks90",label:"Blocks/90"},{key:"clr90",label:"Clearances/90"},{key:"aerialwon",label:"Aerials %"}],
            progression: [{key:"prgp90",label:"PrgP/90"},{key:"prgc90",label:"PrgC/90"},{key:"cmppct",label:"Pass %"},{key:"final3rd90",label:"Passes Final 3rd/90"}],
            discipline:  [{key:"fls90",label:"Fouls/90 (inv.)"}]
        },
        FB: {
            progression: [{key:"prgc90",label:"PrgC/90"},{key:"prgp90",label:"PrgP/90"},{key:"to90",label:"TO/90"},{key:"succpct",label:"Take-on %"},{key:"cmppct",label:"Pass %"},{key:"cpa90",label:"CPA/90"}],
            creation:    [{key:"sca90",label:"SCA/90"},{key:"xag90",label:"xAG/90"},{key:"crspa90",label:"CrsPA/90"},{key:"kp90",label:"KP/90"},{key:"tb90",label:"Through balls/90"}],
            defense:     [{key:"tklint90",label:"Tkl+Int/90"},{key:"int90",label:"Interceptions/90"},{key:"recov90",label:"Recoveries/90"},{key:"blocks90",label:"Blocks/90"},{key:"aerialwon",label:"Aerials %"}],
            discipline:  [{key:"fls90",label:"Fouls/90 (inv.)"}]
        },
        CB: {
            defense:     [{key:"tklint90",label:"Tkl+Int/90"},{key:"aerialwon",label:"Aerials %"},{key:"clr90",label:"Clearances/90"},{key:"blocks90",label:"Blocks/90"},{key:"recov90",label:"Recoveries/90"},{key:"int90",label:"Interceptions/90"},{key:"tkl90",label:"Tackles/90"},{key:"tklpct",label:"Tkl %"}],
            progression: [{key:"prgp90",label:"PrgP/90"},{key:"prgc90",label:"PrgC/90"},{key:"cmppct",label:"Pass %"}],
            discipline:  [{key:"fls90",label:"Fouls/90 (inv.)"}]
        },
        GK: {
            scoring:     [{key:"psxgpm90",label:"PSxG-GA/90"},{key:"savepct",label:"Save %"},{key:"cspct",label:"Clean sheet %"}],
            creation:    [{key:"cmppct",label:"Pass %"},{key:"launchpct",label:"Launch %"}],
            defense:     [{key:"opa90",label:"Sweeper actions/90"},{key:"stppct",label:"Crosses stopped %"}]
        }
    };

    const EA_INFO = {
        sho: "EA FC 25 Shooting attribute (0-100): a single composite of finishing, shot power, positioning and long shots. The face stat shown on the EA card.",
        dri: "EA FC 25 Dribbling attribute (0-100): composite of agility, ball control, balance and dribbling skill.",
        pas: "EA FC 25 Passing attribute (0-100): composite of short pass, long pass, vision, crossing.",
        def: "EA FC 25 Defending attribute (0-100): composite of marking, tackling, interceptions and defensive awareness.",
        phy: "EA FC 25 Physical attribute (0-100): composite of strength, jumping, stamina and aggression.",
        gkReflexes: "EA FC 25 Goalkeeper Reflexes (0-100): face stat for shot-stopping reaction.",
        gkKicking:  "EA FC 25 Goalkeeper Kicking (0-100): face stat for distribution range and accuracy."
    };

    const BREAKDOWN_BY_POS = {
        ST:  [{ label: "Shooting",     dimKey: "scoring",     eaKey: "sho", realKey: "npxg90",   rf: v => v.toFixed(2) + " npxG/90" },
              { label: "Creation",     dimKey: "creation",    eaKey: "pas", realKey: "kp90",     rf: v => v.toFixed(2) + " KP/90" },
              { label: "Take-on play", dimKey: "progression", eaKey: "dri", realKey: "to90",     rf: v => v.toFixed(2) + " TO/90" }],
        WG:  [{ label: "Take-on play", dimKey: "progression", eaKey: "dri", realKey: "to90",     rf: v => v.toFixed(2) + " TO/90" },
              { label: "Shooting",     dimKey: "scoring",     eaKey: "sho", realKey: "npxg90",   rf: v => v.toFixed(2) + " npxG/90" },
              { label: "Creation",     dimKey: "creation",    eaKey: "pas", realKey: "sca90",    rf: v => v.toFixed(2) + " SCA/90" }],
        AM:  [{ label: "Creation",     dimKey: "creation",    eaKey: "pas", realKey: "sca90",    rf: v => v.toFixed(2) + " SCA/90" },
              { label: "Progression",  dimKey: "progression", eaKey: "dri", realKey: "prgc90",   rf: v => v.toFixed(2) + " PrgC/90" },
              { label: "Shooting",     dimKey: "scoring",     eaKey: "sho", realKey: "npxg90",   rf: v => v.toFixed(2) + " npxG/90" }],
        CM:  [{ label: "Build-up",     dimKey: "progression", eaKey: "pas", realKey: "prgp90",   rf: v => v.toFixed(2) + " PrgP/90" },
              { label: "Creation",     dimKey: "creation",    eaKey: "pas", realKey: "kp90",     rf: v => v.toFixed(2) + " KP/90" },
              { label: "Defense",      dimKey: "defense",     eaKey: "def", realKey: "tklint90", rf: v => v.toFixed(2) + " Tkl+Int/90" }],
        DM:  [{ label: "Defense",      dimKey: "defense",     eaKey: "def", realKey: "tklint90", rf: v => v.toFixed(2) + " Tkl+Int/90" },
              { label: "Build-up",     dimKey: "progression", eaKey: "pas", realKey: "prgp90",   rf: v => v.toFixed(2) + " PrgP/90" }],
        FB:  [{ label: "Defense",      dimKey: "defense",     eaKey: "def", realKey: "tklint90", rf: v => v.toFixed(2) + " Tkl+Int/90" },
              { label: "Progression",  dimKey: "progression", eaKey: "dri", realKey: "prgc90",   rf: v => v.toFixed(2) + " PrgC/90" },
              { label: "Creation",     dimKey: "creation",    eaKey: "pas", realKey: "crspa90",  rf: v => v.toFixed(2) + " CrsPA/90" }],
        CB:  [{ label: "Defense",      dimKey: "defense",     eaKey: "def", realKey: "tklint90", rf: v => v.toFixed(2) + " Tkl+Int/90" },
              { label: "Build-up",     dimKey: "progression", eaKey: "pas", realKey: "cmppct",   rf: v => v.toFixed(1) + "% cmp" }],
        GK:  [{ label: "Shot stopping",dimKey: "scoring",     eaKey: "gkReflexes", realKey: "savepct",  rf: v => v.toFixed(1) + "% save" },
              { label: "Distribution", dimKey: "creation",    eaKey: "gkKicking",  realKey: "launchpct",rf: v => v.toFixed(1) + "% launch" },
              { label: "Sweeping",     dimKey: "defense",     eaKey: "gkReflexes", realKey: "opa90",    rf: v => v.toFixed(2) + " OPA/90" }]
    };

    function fmtMarket(v) {
        if (v == null) return "-";
        if (typeof v === "number") {
            if (v >= 1e6) return "\u20ac" + (v / 1e6).toFixed(1) + "M";
            if (v >= 1e3) return "\u20ac" + Math.round(v / 1e3) + "K";
            return "\u20ac" + v;
        }
        return String(v);
    }

    function avatarMarkup(p) {
        if (typeof avatarHTMLString === "function") {
            return '<div class="a2m-photo">' + avatarHTMLString(p.photo, p.name, "a2m-photo-img", "a2m-photo-fallback") + '</div>';
        }
        if (p.photo) {
            return '<div class="a2m-photo"><img class="a2m-photo-img" src="' + p.photo + '" alt="' + p.name + '"/></div>';
        }
        return '<div class="a2m-photo"><span class="a2m-photo-fallback">' + (p.name || "?").charAt(0) + '</span></div>';
    }

    function clampScore(v) {
        return Math.max(0, Math.min(100, v || 0));
    }

    const _peerCache = new Map();
    function peerStats(allData, subPos, realKey) {
        const cacheKey = subPos + "|" + realKey;
        if (_peerCache.has(cacheKey)) return _peerCache.get(cacheKey);
        const values = [];
        if (Array.isArray(allData)) {
            for (const p of allData) {
                if (p.subPos !== subPos) continue;
                const v = p.real && p.real[realKey];
                if (typeof v === "number" && isFinite(v)) values.push(v);
            }
        }
        values.sort((a, b) => a - b);
        const out = {
            values,
            max: values.length ? values[values.length - 1] : 0,
            min: values.length ? values[0] : 0,
            count: values.length
        };
        _peerCache.set(cacheKey, out);
        return out;
    }

    function percentileOf(sorted, v) {
        if (!sorted.length || v == null) return null;
        let lo = 0, hi = sorted.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (sorted[mid] < v) lo = mid + 1;
            else hi = mid;
        }
        return Math.round((lo / sorted.length) * 100);
    }

    function signalRows(player, allData) {
        const rows = BREAKDOWN_BY_POS[player.subPos] || BREAKDOWN_BY_POS.CM;
        const dimMap = DIM_STATS[player.subPos] || DIM_STATS.CM;
        return rows.map(row => {
            const eaVal = player.ea && player.ea[row.eaKey] != null ? player.ea[row.eaKey] : null;
            const realScore = player.subScores && player.subScores[row.dimKey] != null
                ? player.subScores[row.dimKey] : null;
            const eaPct = eaVal != null ? clampScore(eaVal) : 0;
            const realPct = realScore != null ? clampScore(realScore) : 0;
            const delta = realScore != null && eaVal != null ? realPct - eaPct : null;
            const headlineVal = player.real && player.real[row.realKey] != null
                ? player.real[row.realKey] : null;
            const peers = peerStats(allData, player.subPos, row.realKey);
            const percentile = percentileOf(peers.values, headlineVal);
            const contributors = (dimMap[row.dimKey] || []).map(c => {
                const v = player.real && player.real[c.key] != null ? player.real[c.key] : null;
                return Object.assign({}, c, { value: v });
            });
            return {
                row,
                eaVal,
                headlineVal,
                realScore,
                eaPct,
                realPct,
                percentile,
                peerCount: peers.count,
                delta,
                contributors
            };
        });
    }

    function ordinalSuffix(n) {
        const v = n % 100;
        if (v >= 11 && v <= 13) return n + "th";
        switch (n % 10) {
            case 1: return n + "st";
            case 2: return n + "nd";
            case 3: return n + "rd";
            default: return n + "th";
        }
    }

    function pctBand(p) {
        if (p == null) return null;
        if (p >= 90) return { tag: "Top " + (100 - p) + "%", tone: "elite" };
        if (p >= 75) return { tag: "Top quartile",      tone: "high" };
        if (p >= 50) return { tag: "Above median",      tone: "mid" };
        if (p >= 25) return { tag: "Below median",      tone: "low" };
        return         { tag: "Bottom quartile",        tone: "weak" };
    }

    function renderBreakdown(player, allData) {
        const rows = signalRows(player, allData);
        const strongest = rows
            .filter(d => d.delta != null)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
        let html = "";
        html +=
            '<div class="a2m-bd-legend">' +
                '<span class="a2m-bd-legend-item a2m-bd-legend-ea">' +
                    '<span class="a2m-bd-legend-dot"></span>' +
                    'EA face stat (0-100, from the FC 25 card)' +
                '</span>' +
                '<span class="a2m-bd-legend-item a2m-bd-legend-real">' +
                    '<span class="a2m-bd-legend-dot"></span>' +
                    'Season metric (FBref 2024-25, scaled to the role\u2019s max)' +
                '</span>' +
            '</div>';
        if (strongest) {
            const ahead = strongest.delta >= 0;
            const verb = ahead
                ? "real output beats the EA card by "
                : "EA card runs ahead by ";
            html +=
                '<div class="a2m-signal-summary ' + (ahead ? 'is-real-ahead' : 'is-ea-ahead') + '">' +
                    '<span class="a2m-signal-summary-k">Biggest split</span>' +
                    '<strong>' + strongest.row.label + ': ' + verb +
                        Math.abs(strongest.delta).toFixed(0) + ' pts</strong>' +
                '</div>';
        }
        html += '<div class="a2m-breakdown">';
        rows.forEach(item => {
            const row = item.row;
            const headlineDisplay = item.headlineVal != null ? row.rf(item.headlineVal) : "-";
            const deltaText = item.delta == null ? "" : (item.delta >= 0 ? "+" : "") + item.delta.toFixed(0);
            const aheadClass = item.delta == null ? "" : item.delta >= 0 ? " is-real-ahead" : " is-ea-ahead";
            const band = pctBand(item.percentile);
            const eaInfo = EA_INFO[row.eaKey] || ("EA " + row.eaKey.toUpperCase());

            const usable = item.contributors.filter(c => c.value != null);
            const contribStr = usable.length
                ? usable.map(c => c.label + ": " + (typeof c.value === "number" ? c.value.toFixed(c.value < 10 ? 2 : 1) : c.value)).join(" \u00b7 ")
                : "no contributing stats found";
            const dimName = row.dimKey.charAt(0).toUpperCase() + row.dimKey.slice(1);
            const compositeInfo = dimName + " composite (FBref 2024-25, " + usable.length + " stats): " + contribStr;
            const labelInfo = row.label + ": both sides are composites of the same scale (0-100). EA " + row.eaKey.toUpperCase() + " is itself an aggregate (" + (eaInfo.split(":")[1] || "").trim() + "). Real composite aggregates: " + (usable.map(c => c.label).join(", ") || "-") + ".";

            const previewN = 3;
            const preview = usable.slice(0, previewN).map(c => c.label).join(" \u00b7 ") +
                            (usable.length > previewN ? " \u00b7 +" + (usable.length - previewN) + " more" : "");

            html +=
                '<div class="a2m-bd-row' + aheadClass + '">' +
                    '<div class="a2m-bd-head">' +
                        '<div class="a2m-bd-label">' + row.label +
                            '<span class="info-i a2m-bd-info" data-info="' + escapeAttr(labelInfo) + '">i</span>' +
                        '</div>' +
                        (band ? '<span class="a2m-bd-band a2m-bd-band-' + band.tone + '">' + band.tag + '</span>' : '') +
                        (deltaText ? '<span class="a2m-bd-delta">' + deltaText + '</span>' : '') +
                    '</div>' +
                    '<div class="a2m-bd-bars">' +
                        '<div class="a2m-bd-bar a2m-bd-ea" title="' + escapeAttr(eaInfo) + '">' +
                            '<span class="a2m-bd-bar-tag">EA ' + row.eaKey.toUpperCase() + '</span>' +
                            '<div class="a2m-bd-bar-track"><div class="a2m-bd-bar-fill a2m-bd-ea-fill" style="width:' + item.eaPct + '%"></div></div>' +
                            '<span class="a2m-bd-bar-val">' + (item.eaVal != null ? item.eaVal : "-") + '</span>' +
                        '</div>' +
                        '<div class="a2m-bd-bar a2m-bd-real" title="' + escapeAttr(compositeInfo) + '">' +
                            '<span class="a2m-bd-bar-tag">Real composite</span>' +
                            '<div class="a2m-bd-bar-track"><div class="a2m-bd-bar-fill a2m-bd-real-fill" style="width:' + item.realPct + '%"></div></div>' +
                            '<span class="a2m-bd-bar-val">' + (item.realScore != null ? item.realScore.toFixed(0) : "-") + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<p class="a2m-bd-contrib">' +
                        '<span class="a2m-bd-contrib-k">' + usable.length + ' stat' + (usable.length === 1 ? "" : "s") + '</span>' +
                        ' aggregated \u00b7 ' + preview +
                        ' <span class="info-i a2m-bd-info a2m-bd-info-list" data-info="' + escapeAttr(compositeInfo) + '">i</span>' +
                    '</p>' +
                    (item.percentile != null
                        ? '<p class="a2m-bd-note">' +
                            'Headline \u00b7 <strong>' + headlineDisplay + '</strong> \u00b7 ' +
                            '<span class="a2m-bd-pct">' + ordinalSuffix(item.percentile) + ' percentile</span>' +
                            ' of ' + item.peerCount + ' ' + (SUBPOS_LABELS[player.subPos]?.toLowerCase() || 'players') + '.' +
                          '</p>'
                        : '<p class="a2m-bd-note">Missing one side of the signal.</p>') +
                '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderUserWeights(weights) {
        if (!weights || typeof weights !== "object") return "";
        const keys = Object.keys(weights);
        if (!keys.length) return "";
        let rows = "";
        keys.forEach(k => {
            const raw = weights[k];
            const num = typeof raw === "number" ? raw : parseFloat(raw);
            const val = isFinite(num) ? (num <= 1 ? (num * 100).toFixed(0) + "%" : num.toFixed(2)) : "-";
            rows +=
                '<div class="a2m-uw-row">' +
                    '<span class="a2m-uw-label">' + k + '</span>' +
                    '<span class="a2m-uw-val">' + val + '</span>' +
                '</div>';
        });
        return (
            '<div class="a2m-user-weights">' +
                '<div class="a2m-side-title">Your weights</div>' +
                rows +
            '</div>'
        );
    }

    function renderSidebar(player) {
        const nat  = player.nationality || "-";
        const foot = player.foot || "-";
        const mv   = fmtMarket(player.marketValueLatest || player.marketValue);
        const age  = player.age != null ? player.age : "-";
        const mins = player.minutes != null ? player.minutes : "-";
        return (
            '<aside class="a2m-sidebar">' +
                '<div class="a2m-side-title">Profile</div>' +
                '<dl class="a2m-side-list">' +
                    '<div class="a2m-side-row"><dt>Nationality</dt><dd>' + nat + '</dd></div>' +
                    '<div class="a2m-side-row"><dt>Preferred foot</dt><dd>' + foot + '</dd></div>' +
                    '<div class="a2m-side-row"><dt>Age</dt><dd>' + age + '</dd></div>' +
                    '<div class="a2m-side-row"><dt>Market value</dt><dd>' + mv + '</dd></div>' +
                    '<div class="a2m-side-row"><dt>Minutes 24-25</dt><dd>' + mins + '</dd></div>' +
                '</dl>' +
                '<button class="a2m-full-card-btn a2m-side-btn" type="button">Open detailed card</button>' +
                renderUserWeights(player.userWeights) +
            '</aside>'
        );
    }

    function renderUserRankBadge(player) {
        if (player.userRank == null) return "";
        const eaRank = player.eaRank != null ? player.eaRank : "-";
        return (
            '<div class="a2m-your-rank">' +
                '<span class="a2m-yr-label">Your rank</span>' +
                '<span class="a2m-yr-num">#' + player.userRank + '</span>' +
                '<span class="a2m-yr-ea">vs EA #' + eaRank + '</span>' +
            '</div>'
        );
    }

    function rolePlayersFor(player, allData) {
        const source = Array.isArray(allData) && allData.length ? allData : [player];
        return source.filter(p => p.subPos === player.subPos);
    }

    function switchToAct1Dossier(bodyEl, player, allData) {
        if (typeof createModalManager !== "function") return;
        const overlay = bodyEl.closest(".shared-modal-overlay");
        const panel = overlay && overlay.querySelector(".shared-modal-panel");
        const tipEl = document.querySelector(".stat-tip") || document.createElement("div");
        if (!tipEl.parentNode) {
            tipEl.className = "stat-tip";
            document.body.appendChild(tipEl);
        }
        bodyEl.classList.add("a2m-view-leaving");
        window.setTimeout(() => {
            if (overlay) overlay.classList.add("act1m-overlay", "a2m-detail-mode");
            if (panel) panel.scrollTop = 0;
            bodyEl.className = "shared-modal-body";
            const modal = createModalManager(tipEl);
            modal.renderInline(bodyEl, player, allData);
            bodyEl.classList.add("a2m-view-entering");
            requestAnimationFrame(() => bodyEl.classList.remove("a2m-view-entering"));
        }, 180);
    }

    function bindActions(bodyEl, player, allData) {
        const buttons = bodyEl.querySelectorAll(".a2m-full-card-btn");
        buttons.forEach(btn => btn.addEventListener("click", () => {
            switchToAct1Dossier(bodyEl, player, allData);
        }));
    }

    function renderBody(bodyEl, player, allData) {
        const gap       = player.gap != null ? player.gap : 0;
        const ovr       = player.ea && player.ea.ovr != null ? player.ea.ovr : null;
        const composite = player.composite != null ? player.composite : null;
        const expected  = composite != null ? composite - gap : null;
        const diff      = (composite != null && ovr != null) ? (composite - ovr) : null;
        const heroColor = gap >= 0 ? "var(--win, #4ade80)" : "var(--accent-red, #ef4444)";
        const heroSign  = gap >= 0 ? "+" : "";
        const verdict   = gap > 5 ? "Underrated by EA" : gap < -5 ? "Overrated by EA" : "Close to the line";
        const gapMag    = Math.abs(gap).toFixed(1);
        const gapCopy   = gap > 5
            ? "His composite sits " + gapMag + " points above the trend line for his OVR. Among players rated similarly by EA, he produces more on the pitch."
            : gap < -5
                ? "His composite sits " + gapMag + " points below the trend line for his OVR. Players with the same EA rating tend to deliver more."
                : "His composite stays within " + gapMag + " of the trend line: the OVR matches his on-pitch output.";
        const rebuiltOvr = ovr != null ? Math.round(ovr + gap) : "-";
        const roleLabel = (typeof SUBPOS_LABELS !== "undefined" && SUBPOS_LABELS[player.subPos])
            || player.positionDetail || player.subPos || "";

        bodyEl.innerHTML =
            '<header class="a2m-header">' +
                '<div class="a2m-header-left">' +
                    avatarMarkup(player) +
                    '<div class="a2m-ident">' +
                        '<span class="a2m-kicker">\u00a7 ACT II \u00b7 GAP BREAKDOWN</span>' +
                        '<h2 class="a2m-name">' + (player.name || "Unknown") + '</h2>' +
                        '<p class="a2m-meta">' + (player.club || "") + ' \u00b7 ' + (player.league || "") + ' \u00b7 ' + roleLabel + '</p>' +
                    '</div>' +
                '</div>' +
                '<div class="a2m-hero" style="color:' + heroColor + '">' +
                    '<span class="a2m-hero-label">Reputation Gap</span>' +
                    '<span class="a2m-hero-num">' + heroSign + gap.toFixed(1) + '</span>' +
                    '<span class="a2m-hero-verdict">' + verdict + '</span>' +
                    renderUserRankBadge(player) +
                '</div>' +
            '</header>' +
            '<div class="a2m-grid">' +
                '<section class="a2m-main">' +
                    '<div class="a2m-gap-card">' +
                        '<div class="a2m-gap-math">' +
                            '<div><span>Real composite</span><strong>' + (composite != null ? composite.toFixed(1) : "-") + '</strong></div>' +
                            '<div><span>Expected from OVR</span><strong>' + (expected != null ? expected.toFixed(1) : "-") + '</strong></div>' +
                            '<div><span>EA OVR</span><strong>' + (ovr != null ? ovr : "-") + '</strong></div>' +
                            '<div><span>Composite minus OVR</span><strong>' + (diff != null ? (diff >= 0 ? "+" : "") + diff.toFixed(1) : "-") + '</strong></div>' +
                        '</div>' +
                        '<p class="a2m-gap-copy">' + gapCopy + '</p>' +
                    '</div>' +
                    '<div class="a2m-section-title">Signals behind the gap</div>' +
                    renderBreakdown(player, allData) +
                    '<div class="a2m-scenario">' +
                        '<span class="a2m-scenario-kicker">What-if</span>' +
                        '<p class="a2m-scenario-text">If EA rated him on pure performance, he would sit around ' +
                            '<strong>OVR ' + rebuiltOvr + '</strong>' +
                            ' <span class="a2m-scenario-dim">(current ' + (ovr != null ? ovr : "-") + ')</span>.</p>' +
                    '</div>' +
                '</section>' +
                renderSidebar(player) +
            '</div>';
        bindActions(bodyEl, player, allData);
        if (typeof initInfoTooltips === "function") initInfoTooltips();
    }

    window.openAct2Modal = function (player, allData) {
        if (!player) return null;
        if (typeof window.createModalOverlay !== "function") return null;
        return window.createModalOverlay({
            className: "a2m-overlay",
            renderBody: body => renderBody(body, player, allData)
        });
    };
})();
