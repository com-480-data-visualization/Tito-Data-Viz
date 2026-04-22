const EA_FACE_STATS = [
    { label: "PAC", key: "pac" }, { label: "SHO", key: "sho" },
    { label: "PAS", key: "pas" }, { label: "DRI", key: "dri" },
    { label: "DEF", key: "def" }, { label: "PHY", key: "phy" }
];

const EA_CARD_STATS = {
    FW: EA_FACE_STATS, MF: EA_FACE_STATS, DF: EA_FACE_STATS,
    GK: [
        { label: "DIV", key: "gkDiving" }, { label: "HAN", key: "gkHandling" },
        { label: "KIC", key: "gkKicking" }, { label: "REF", key: "gkReflexes" },
        { label: "SPD", key: "sprintSpeed" }, { label: "POS", key: "gkPositioning" }
    ]
};

const CARD_SHORT = {
    npxg90: "npxG", xag90: "xAG", sca90: "SCA", sh90: "SH",
    prgc90: "PrgC", succpct: "Drib%", kp90: "KP", prgp90: "PrgP",
    tklint90: "T+I", cmppct: "Pass%", blocks90: "BLK", clr90: "CLR",
    aerialwon: "AER", psxgpm90: "PSxG", savepct: "SV%", cspct: "CS%",
    gkdist: "DIST", opa90: "OPA", stppct: "Stp%", sot90: "SoT"
};

function deltaChipHTML(thisRank, otherRank) {
    if (otherRank == null) return "";
    const diff = thisRank - otherRank; // positive = better on EA side
    let cls = "dc-neutral", arrow = "=", label = "Same rank on EA (#" + otherRank + ")";
    if (diff > 0) { cls = "dc-up"; arrow = "▲"; label = "EA ranks him " + diff + " higher (#" + otherRank + ")"; }
    else if (diff < 0) { cls = "dc-down"; arrow = "▼"; label = "EA ranks him " + (-diff) + " lower (#" + otherRank + ")"; }
    const mag = diff === 0 ? "" : Math.abs(diff);
    return '<span class="delta-chip ' + cls + '" data-tip="' + escapeAttr(label) + '">' +
        '<span class="dc-arrow">' + arrow + '</span>' +
        (mag !== "" ? '<span class="dc-mag">' + mag + '</span>' : "") +
        '</span>';
}

// --- EA card: FUT-inspired ---

function buildEACard(p, index, absent, pos, subPos) {
    const card = document.createElement("div");
    card.className = "fut-card ea-card fut-flavor" + (absent ? " absent" : "");
    card.setAttribute("data-player", p.name);

    const attrs = EA_CARD_STATS[pos] || EA_FACE_STATS;
    const miniHtml = attrs.map(a => {
        const val = p.ea[a.key];
        const shown = val != null ? val : "-";
        const pct = val != null ? Math.max(4, Math.min(100, (val / 99) * 100)) : 0;
        return '<div class="fut-stat" data-tip="' + escapeAttr(getStatTooltip(a.key)) + '">' +
            '<div class="fs-top">' +
                '<span class="fs-label">' + a.label + '</span>' +
                '<span class="fs-val">' + shown + '</span>' +
            '</div>' +
            '<span class="fs-track"><span class="fs-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
            '</div>';
    }).join("");

    card.innerHTML =
        '<div class="card-rank">#' + (index + 1) + '</div>' +
        '<div class="fut-corner" data-tip="' + escapeAttr(STAT_INFO.ovr) + '">' +
            '<span class="fut-ovr">' + p.ea.ovr + '</span>' +
            '<span class="fut-pos">' + (subPos || pos || "") + '</span>' +
        '</div>' +
        avatarHTMLString(p.photo, p.name, "card-photo ea-avatar", "card-avatar ea-avatar") +
        '<div class="card-info">' +
            '<div class="card-name">' + p.name + '</div>' +
            '<div class="card-club">' + p.club + '</div>' +
        '</div>' +
        '<div class="fut-stats">' + miniHtml + '</div>';

    return card;
}

// --- Stats card: analyst dashboard ---

function buildStatsCard(p, index, absent, pos, otherRank, statScales) {
    const card = document.createElement("div");
    card.className = "fut-card stats-card analyst-flavor" + (absent ? " absent" : "");
    card.setAttribute("data-player", p.name);

    const keys = POS_KEY_STATS[pos] || [];
    const barsHtml = keys.map(k => {
        const raw = p.real ? p.real[k] : null;
        const val = raw != null ? formatStat(k, raw) : "-";
        const scale = statScales && statScales[k];
        let pct = 0;
        if (raw != null && scale && scale.max > 0) pct = Math.max(4, Math.min(100, (raw / scale.max) * 100));
        return '<div class="analyst-stat" data-tip="' + escapeAttr(getStatTooltip(k)) + '">' +
            '<div class="as-top">' +
                '<span class="as-slabel">' + (CARD_SHORT[k] || statLabel(k)) + '</span>' +
                '<span class="as-sval">' + val + '</span>' +
            '</div>' +
            '<span class="as-track"><span class="as-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
            '</div>';
    }).join("");

    card.innerHTML =
        '<div class="card-rank">#' + (index + 1) + '</div>' +
        '<div class="analyst-score" data-tip="' + escapeAttr(compositeInfo(pos, p.subPos)) + '">' +
            '<span class="as-val">' + p.composite.toFixed(1) + '</span>' +
            '<span class="as-label">COMP</span>' +
        '</div>' +
        avatarHTMLString(p.photo, p.name, "card-photo stats-avatar", "card-avatar stats-avatar") +
        '<div class="card-info">' +
            '<div class="card-name">' + p.name + '</div>' +
            '<div class="card-club">' + p.club + '</div>' +
        '</div>' +
        '<div class="stat-bars">' + barsHtml + '</div>' +
        deltaChipHTML(index + 1, otherRank);

    return card;
}
