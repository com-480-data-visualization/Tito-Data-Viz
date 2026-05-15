(function () {
    const RAW_SOURCE_META = {
        ea: {
            id: "ea",
            mark: "EA",
            name: "EA FC 25",
            kicker: "Game Ratings",
            intro: "EA provides the reputation benchmark: the in-game card a player receives before we compare it to real 2024-25 output.",
            heroValue: "41",
            heroLabel: "used rating fields",
            rawFacts: [
                { label: "Source file", value: "fc25_players.csv" },
                { label: "Raw rows", value: "17,737" },
                { label: "Raw columns", value: "56" }
            ]
        },
        fbref: {
            id: "fbref",
            mark: "FB",
            name: "FBref 2024-25",
            kicker: "On-Pitch Output",
            intro: "FBref provides the on-pitch signal: production, efficiency, possession, defending, and goalkeeper output from the 2024-25 season.",
            heroValue: "49",
            heroLabel: "kept analysis metrics",
            rawFacts: [
                { label: "Source file", value: "players_data-2024_2025.csv" },
                { label: "Raw rows", value: "2,854" },
                { label: "Raw columns", value: "267" }
            ],
            pipeline: [
                "The 9-table FBref merge initially produced 267 raw columns.",
                "We dropped 97 duplicate or redundant identity columns, leaving 170 usable columns before project-level selection.",
                "Restricted to the top 5 European leagues before matching.",
                "Fuzzy-matched against the EA player list with manual overrides for edge cases.",
                "Filtered to players with at least 600 league minutes in the final analytical sample.",
                "Converted the retained performance columns to per-90 features where needed.",
                "Built a position-aware composite score and then the Reputation Gap by sub-position."
            ]
        },
        tm: {
            id: "tm",
            mark: "TM",
            name: "Transfermarkt",
            kicker: "Context And Market Signal",
            intro: "Transfermarkt adds identity, valuation, and availability context around the player, without feeding the composite performance score itself.",
            heroValue: "11",
            heroLabel: "kept context fields",
            rawTables: [
                { file: "player_profiles.csv", rows: "92,671", columns: "34" },
                { file: "player_market_value.csv", rows: "901,429", columns: "3" },
                { file: "player_injuries.csv", rows: "143,195", columns: "7" }
            ]
        }
    };

    const TM_FIELD_LABELS = {
        photo: "Photo",
        nationality: "Nationality",
        height: "Height",
        foot: "Preferred foot",
        positionDetail: "Detailed position",
        contractExpires: "Contract expiry",
        marketValue: "Market value (season start)",
        marketValueDate: "Season-start value date",
        marketValueLatest: "Latest market value",
        marketValueLatestDate: "Latest value date",
        injuries: "Injury summary"
    };

    const EA_BLUEPRINTS = [
        { title: "Core card ratings", keys: ["ovr", "pac", "sho", "pas", "dri", "def", "phy"] },
        { title: "Pace", keys: ["acceleration", "sprintSpeed"] },
        { title: "Shooting", keys: ["positioning", "finishing", "shotPower", "longShots", "volleys", "penalties"] },
        { title: "Passing", keys: ["vision", "crossing", "fkAccuracy", "shortPassing", "longPassing", "curve"] },
        { title: "Dribbling", keys: ["dribbling", "agility", "balance", "reactions", "ballControl", "composure"] },
        { title: "Defending", keys: ["interceptions", "headingAccuracy", "defAwareness", "standingTackle", "slidingTackle"] },
        { title: "Physical", keys: ["jumping", "stamina", "strength", "aggression"] },
        { title: "Goalkeeping", keys: ["gkDiving", "gkHandling", "gkKicking", "gkPositioning", "gkReflexes"] }
    ];

    const FBREF_KEPT_BLUEPRINTS = [
        { title: "Scoring", keys: ["xg90", "npxg90", "sh90", "sot90", "sotpct", "npxgpsh", "gPerSh", "touchAttPen90"] },
        { title: "Creation", keys: ["xag90", "sca90", "gca90", "kp90", "ppa90", "crspa90", "tb90", "xa90"] },
        { title: "Progression and dribbling", keys: ["prgc90", "prgp90", "cpa90", "final3rd90", "to90", "succpct"] },
        { title: "Defending", keys: ["tklint90", "tkl90", "tklpct", "int90", "blocks90", "clr90", "shblocks90", "recov90", "aerialwon", "drblAtt90", "passBlk90", "err90"] },
        { title: "Control and discipline", keys: ["cmppct", "mis90", "fld90", "fls90", "offsides90"] },
        { title: "Goalkeeping", keys: ["psxgpm90", "savepct", "cspct", "gkdist", "opa90", "stppct", "launchpct", "ga90", "psxgPerSoT", "gkAvgDist", "gkThr90"] },
        { title: "Workload and reliability", keys: ["minpct", "mp", "starts", "subs", "compl"] }
    ];

    const TM_BLUEPRINTS = [
        { title: "Identity and profile", keys: ["photo", "nationality", "height", "foot", "positionDetail"] },
        { title: "Contract and valuation", keys: ["contractExpires", "marketValue", "marketValueDate", "marketValueLatest", "marketValueLatestDate"] },
        { title: "Availability context", keys: ["injuries"] }
    ];

    const TM_KEYS = ["photo", "nationality", "height", "foot", "positionDetail", "contractExpires", "marketValue", "marketValueDate", "marketValueLatest", "marketValueLatestDate", "injuries"];

    function escapeHTML(str) {
        return escapeAttr(str == null ? "" : String(str));
    }

    const KEY_DEFINITIONS = {
        ovr: "Overall Rating: EA's weighted summary of all in-game attributes (0-99). The headline number on every FUT card.",
        pac: "Pace (face stat): combination of acceleration and sprint speed.",
        sho: "Shooting (face stat): finishing, shot power, positioning, long shots, volleys, penalties.",
        pas: "Passing (face stat): short passing, long passing, vision, crossing, FK accuracy, curve.",
        dri: "Dribbling (face stat): dribbling skill, agility, balance, reactions, ball control, composure.",
        def: "Defending (face stat): marking, standing tackle, sliding tackle, interceptions, defensive awareness, heading.",
        phy: "Physical (face stat): jumping, stamina, strength, aggression.",
        acceleration: "Acceleration sub-attribute: how quickly a player reaches top speed.",
        sprintSpeed: "Sprint Speed sub-attribute: top running speed once acceleration is done.",
        finishing: "Finishing sub-attribute: how accurate and reliable a player is in front of goal.",
        shotPower: "Shot Power sub-attribute: raw power behind shots.",
        longShots: "Long Shots sub-attribute: accuracy on shots from outside the box.",
        volleys: "Volleys sub-attribute: ability to strike the ball in the air without controlling it first.",
        penalties: "Penalties sub-attribute: accuracy and composure from the spot.",
        positioning: "Positioning sub-attribute: how well a player gets into goal-scoring positions.",
        vision: "Vision sub-attribute: how well a player spots and weighs creative passes.",
        crossing: "Crossing sub-attribute: quality of crosses from wide areas.",
        fkAccuracy: "FK Accuracy sub-attribute: accuracy on direct free kicks.",
        shortPassing: "Short Passing sub-attribute: accuracy on short and ground passes.",
        longPassing: "Long Passing sub-attribute: accuracy on long-range and lofted passes.",
        curve: "Curve sub-attribute: ability to bend the ball on shots and passes.",
        dribbling: "Dribbling sub-attribute: close control while moving with the ball.",
        agility: "Agility sub-attribute: balance and quickness while changing direction.",
        balance: "Balance sub-attribute: ability to stay on the feet during physical contact.",
        reactions: "Reactions sub-attribute: how quickly a player responds to a loose ball or situation.",
        ballControl: "Ball Control sub-attribute: quality of the first touch.",
        composure: "Composure sub-attribute: how well a player keeps their head under pressure.",
        interceptions: "Interceptions sub-attribute: ability to read passes and cut them out.",
        headingAccuracy: "Heading Accuracy sub-attribute: accuracy on headers (offensive and defensive).",
        defAwareness: "Defensive Awareness sub-attribute: positional sense without the ball.",
        standingTackle: "Standing Tackle sub-attribute: timing and success on standing tackles.",
        slidingTackle: "Sliding Tackle sub-attribute: timing and success on slide tackles.",
        jumping: "Jumping sub-attribute: vertical leap for headers and aerial duels.",
        stamina: "Stamina sub-attribute: endurance over the 90 minutes.",
        strength: "Strength sub-attribute: physical power in duels.",
        aggression: "Aggression sub-attribute: how often the player commits to challenges.",
        gkDiving: "GK Diving sub-attribute: reactive saves to either side.",
        gkHandling: "GK Handling sub-attribute: ability to catch and hold the ball.",
        gkKicking: "GK Kicking sub-attribute: distance and accuracy of goalkeeper kicks.",
        gkPositioning: "GK Positioning sub-attribute: angles and starting position in the box.",
        gkReflexes: "GK Reflexes sub-attribute: shot-stopping reaction speed.",
        photo: "URL of the Transfermarkt headshot used in the player card visuals.",
        nationality: "Player's primary nationality as listed on Transfermarkt.",
        height: "Player height in centimeters.",
        foot: "Preferred foot: right, left, or both.",
        positionDetail: "Transfermarkt's detailed position label (e.g. Right Winger, Defensive Midfielder).",
        contractExpires: "Contract expiry date with the player's current club.",
        marketValue: "Transfermarkt valuation captured at the start of the 2024-25 season.",
        marketValueDate: "Date the season-start market value was recorded.",
        marketValueLatest: "Most recent Transfermarkt valuation snapshot.",
        marketValueLatestDate: "Date of the most recent market value snapshot.",
        injuries: "Summary of injuries logged for the player over recent seasons.",
        gkThr90: "Goalkeeper Throws per 90 min: how often the keeper distributes by hand instead of kicking."
    };

    function defForKey(key) {
        if (KEY_DEFINITIONS[key]) return KEY_DEFINITIONS[key];
        if (typeof STAT_INFO !== "undefined" && STAT_INFO[key]) return STAT_INFO[key];
        return null;
    }

    function labelForCompositeKey(key) {
        if (key === "Mis_90") return "Miscontrols/90";
        if (key === "gkThr90") return "GK Throws/90";
        return statLabel(key);
    }

    function chipHTML(key, labelFn) {
        const def = defForKey(key);
        const tip = def ? ' data-tip="' + escapeAttr(def) + '"' : '';
        const cls = def ? 'dsm-chip dsm-chip-has-def' : 'dsm-chip';
        return '<li class="' + cls + '"' + tip + '>' +
            '<span class="dsm-chip-label">' + escapeHTML(labelFn(key)) + '</span>' +
            '<span class="dsm-chip-key">' + escapeHTML(key) + '</span>' +
        '</li>';
    }

    function sortByLabel(keys, labelFn) {
        return keys.slice().sort((a, b) => labelFn(a).localeCompare(labelFn(b)));
    }

    function groupKeys(allKeys, blueprints, labelFn) {
        const used = new Set();
        const groups = [];

        blueprints.forEach(group => {
            const keys = group.keys.filter(key => allKeys.includes(key) && !used.has(key));
            keys.forEach(key => used.add(key));
            if (keys.length) groups.push({ title: group.title, keys: sortByLabel(keys, labelFn) });
        });

        const remaining = sortByLabel(allKeys.filter(key => !used.has(key)), labelFn);
        if (remaining.length) groups.push({ title: "Additional imported fields", keys: remaining });

        return groups;
    }

    function unionCompositeMetrics(data) {
        const seen = new Set();
        const out = [];
        (data || []).forEach(player => {
            (player.compositeMetrics || []).forEach(key => {
                const normalized = key === "Mis_90" ? "mis90" : key;
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    out.push(normalized);
                }
            });
        });
        return out;
    }

    function buildSnapshot(data) {
        const sample = data?.length ? data[0] : {};
        const eaKeys = Object.keys(sample.ea || {});
        const fbrefKeys = Object.keys(sample.real || {});
        const tmKeys = TM_KEYS.filter(key => Object.prototype.hasOwnProperty.call(sample || {}, key));
        const compositeKeys = unionCompositeMetrics(data);
        const photoCoverage = data?.length ? (data.filter(player => player.photo).length / data.length) * 100 : 0;
        const marketCoverage = data?.length ? (data.filter(player => player.marketValue != null).length / data.length) * 100 : 0;

        return {
            eaKeys,
            fbrefKeys,
            tmKeys,
            compositeKeys,
            photoCoverage,
            marketCoverage
        };
    }

    function fieldGroupsHTML(groups, labelFn) {
        return groups.map(group =>
            '<section class="dsm-group">' +
                '<div class="dsm-group-title">' + escapeHTML(group.title) + '</div>' +
                '<ul class="dsm-chip-grid">' +
                    group.keys.map(key => chipHTML(key, labelFn)).join("") +
                '</ul>' +
            '</section>'
        ).join("");
    }

    function factGridHTML(facts) {
        return '<div class="dsm-fact-grid">' + facts.map(fact =>
            '<div class="dsm-fact">' +
                '<div class="dsm-fact-label">' + escapeHTML(fact.label) + '</div>' +
                '<div class="dsm-fact-value">' + escapeHTML(fact.value) + '</div>' +
            '</div>'
        ).join("") + '</div>';
    }

    function rawTableHTML(tables) {
        return '<div class="dsm-table-grid">' + tables.map(table =>
            '<div class="dsm-fact">' +
                '<div class="dsm-fact-label">' + escapeHTML(table.file) + '</div>' +
                '<div class="dsm-fact-value">' + escapeHTML(table.rows) + ' rows</div>' +
                '<div class="dsm-fact-sub">' + escapeHTML(table.columns) + ' columns</div>' +
            '</div>'
        ).join("") + '</div>';
    }

    function headerHTML(source) {
        return '<div class="dsm-header">' +
            '<div class="dsm-header-left">' +
                '<div class="dsm-mark dsm-mark-' + escapeHTML(source.id) + '">' + escapeHTML(source.mark) + '</div>' +
                '<div class="dsm-ident">' +
                    '<div class="dsm-kicker">' + escapeHTML(source.kicker) + '</div>' +
                    '<h2 class="dsm-title">' + escapeHTML(source.name) + '</h2>' +
                    '<p class="dsm-intro">' + escapeHTML(source.intro) + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="dsm-hero">' +
                '<div class="dsm-hero-value">' + escapeHTML(source.heroValue) + '</div>' +
                '<div class="dsm-hero-label">' + escapeHTML(source.heroLabel) + '</div>' +
            '</div>' +
        '</div>';
    }

    function noteHTML(title, text) {
        return '<section class="dsm-note">' +
            '<div class="dsm-section-kicker">' + escapeHTML(title) + '</div>' +
            '<p>' + escapeHTML(text) + '</p>' +
        '</section>';
    }

    function renderEA(snapshot) {
        const importedGroups = groupKeys(snapshot.eaKeys, EA_BLUEPRINTS, statLabel);

        return headerHTML(RAW_SOURCE_META.ea) +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Raw source</div>' +
                '<p class="dsm-section-copy">The EA source is the complete FC 25 player-rating table used as the reputation baseline throughout the project.</p>' +
                factGridHTML(RAW_SOURCE_META.ea.rawFacts) +
            '</section>' +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Used in dataset</div>' +
                '<p class="dsm-section-copy">These are the EA columns kept in the final dataset: the 7 headline ratings used for comparison, plus the detailed sub-attributes used in the player dossier.</p>' +
                fieldGroupsHTML(importedGroups, statLabel) +
            '</section>' +
            noteHTML("Why this source matters", "EA is the reputation signal. It tells us how the game sees the player before the real-world numbers get a say.");
    }

    function renderFBref(snapshot) {
        const keptKeys = Array.from(new Set(FBREF_KEPT_BLUEPRINTS.flatMap(group => group.keys))).filter(key => snapshot.fbrefKeys.includes(key) || snapshot.compositeKeys.includes(key));
        const keptGroups = groupKeys(keptKeys, FBREF_KEPT_BLUEPRINTS, labelForCompositeKey);

        return headerHTML(RAW_SOURCE_META.fbref) +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Raw source</div>' +
                '<p class="dsm-section-copy">The FBref export is the performance side of the project: one wide statistical table covering the 2024-25 season for players in the top 5 leagues.</p>' +
                factGridHTML(RAW_SOURCE_META.fbref.rawFacts) +
            '</section>' +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Pipeline rules</div>' +
                '<ul class="dsm-list">' +
                    RAW_SOURCE_META.fbref.pipeline.map(item => '<li>' + escapeHTML(item) + '</li>').join("") +
                '</ul>' +
            '</section>' +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Columns kept for the project</div>' +
                '<p class="dsm-section-copy">This dossier lists only the FBref columns we actually kept for the analysis: the core performance metrics and the workload columns used to filter or contextualize players.</p>' +
                fieldGroupsHTML(keptGroups, labelForCompositeKey) +
            '</section>' +
            noteHTML("Why this source matters", "FBref is the on-pitch signal. It is where the project measures output, efficiency, volume, and role-specific performance.");
    }

    function renderTM(snapshot) {
        const importedGroups = groupKeys(snapshot.tmKeys, TM_BLUEPRINTS, key => TM_FIELD_LABELS[key] || key);

        return headerHTML(RAW_SOURCE_META.tm) +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Raw source</div>' +
                '<p class="dsm-section-copy">Transfermarkt is used as a three-table context layer: player profile data, market-value history, and injury availability records.</p>' +
                rawTableHTML(RAW_SOURCE_META.tm.rawTables) +
            '</section>' +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Columns kept for the project</div>' +
                '<p class="dsm-section-copy">We keep a compact Transfermarkt context layer: identity, valuation, contract, and injury availability.</p>' +
                fieldGroupsHTML(importedGroups, key => TM_FIELD_LABELS[key] || key) +
            '</section>' +
            '<section class="dsm-section">' +
                '<div class="dsm-section-kicker">Used in the experience</div>' +
                '<p class="dsm-section-copy">Transfermarkt does <strong>not</strong> feed the composite performance score. It frames each player with market perception and profile details around the statistical comparison.</p>' +
                factGridHTML([
                    { label: "Photo coverage", value: snapshot.photoCoverage.toFixed(1) + "%" },
                    { label: "Market value coverage", value: snapshot.marketCoverage.toFixed(1) + "%" },
                    { label: "Role in project", value: "Context only" }
                ]) +
            '</section>' +
            noteHTML("Why this source matters", "Transfermarkt adds the market and identity layer: how valuable the player is seen, what role they are listed in, and how available they have been.");
    }

    function renderSourceBody(sourceId, snapshot) {
        if (sourceId === "ea") return renderEA(snapshot);
        if (sourceId === "fbref") return renderFBref(snapshot);
        return renderTM(snapshot);
    }

    function updateCardStats(snapshot) {
        const eaEl = document.getElementById("di-ea-fields");
        const fbUsableEl = document.getElementById("di-fb-usable");
        const fbCompEl = document.getElementById("di-fb-composite");
        const tmEl = document.getElementById("di-tm-fields");
        const tmCovEl = document.getElementById("di-tm-coverage");

        if (eaEl) eaEl.textContent = snapshot.eaKeys.length + " kept fields";
        if (fbUsableEl) fbUsableEl.textContent = "170 usable cols";
        if (fbCompEl) fbCompEl.textContent = snapshot.compositeKeys.length + " kept metrics";
        if (tmEl) tmEl.textContent = snapshot.tmKeys.length + " kept fields";
        if (tmCovEl) tmCovEl.textContent = snapshot.marketCoverage.toFixed(1) + "% value coverage";
    }

    window.initDatasetDossiers = function (data) {
        const snapshot = buildSnapshot(data);
        updateCardStats(snapshot);

        document.querySelectorAll(".source-card[data-source]").forEach(card => {
            card.addEventListener("click", function () {
                if (typeof window.createModalOverlay !== "function") return;

                const sourceId = card.getAttribute("data-source");
                window.createModalOverlay({
                    className: "dataset-source-overlay",
                    renderBody: function (body) {
                        body.classList.add("dsm-body");
                        body.innerHTML = renderSourceBody(sourceId, snapshot);
                        if (typeof attachDataTip === "function") attachDataTip(body);
                    }
                });
            });
        });
    };
})();
