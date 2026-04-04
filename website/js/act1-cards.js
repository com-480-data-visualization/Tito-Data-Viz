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
    gkdist: "DIST", opa90: "OPA", stppct: "Stp%"
};

function buildEACard(p, index, absent, pos) {
    const card = document.createElement("div");
    card.className = "fut-card ea-card" + (absent ? " absent" : "");
    card.setAttribute("data-player", p.name);

    const attrs = EA_CARD_STATS[pos] || EA_FACE_STATS;
    const miniHtml = attrs.map(a => {
        const val = p.ea[a.key];
        return '<div class="mini-stat"><span class="ms-label" data-tip="' +
            escapeAttr(getStatTooltip(a.key)) + '">' + a.label +
            '</span> <span class="ms-val">' + (val != null ? val : "-") + '</span></div>';
    }).join("");

    card.innerHTML =
        '<span class="card-rank">' + (index + 1) + '</span>' +
        avatarHTMLString(p.photo, p.name, "card-photo ea-avatar", "card-avatar ea-avatar") +
        '<div class="card-info">' +
            '<div class="card-name">' + p.name + '</div>' +
            '<div class="card-club">' + p.club + '</div>' +
        '</div>' +
        '<div class="mini-stats">' + miniHtml + '</div>' +
        '<span class="score-badge ea-badge" data-tip="' + escapeAttr(STAT_INFO.ovr) + '">' + p.ea.ovr + '</span>';

    return card;
}

function buildStatsCard(p, index, absent, pos) {
    const card = document.createElement("div");
    card.className = "fut-card stats-card" + (absent ? " absent" : "");
    card.setAttribute("data-player", p.name);

    const keys = POS_KEY_STATS[pos] || [];
    const metricsHtml = keys.map(k => {
        const val = (p.real && p.real[k] != null) ? formatStat(k, p.real[k]) : "-";
        return '<div class="mini-stat"><span class="ms-label" data-tip="' +
            escapeAttr(getStatTooltip(k)) + '">' + (CARD_SHORT[k] || statLabel(k)) +
            '</span> <span class="ms-val">' + val + '</span></div>';
    }).join("");

    card.innerHTML =
        '<span class="score-badge stats-badge" data-tip="' + escapeAttr(compositeInfo(pos, p.subPos)) + '">' + p.composite.toFixed(1) + '</span>' +
        '<div class="card-info">' +
            '<div class="card-name">' + p.name + '</div>' +
            '<div class="card-club">' + p.club + '</div>' +
        '</div>' +
        '<div class="mini-stats">' + metricsHtml + '</div>' +
        avatarHTMLString(p.photo, p.name, "card-photo stats-avatar", "card-avatar stats-avatar") +
        '<span class="card-rank">' + (index + 1) + '</span>';

    return card;
}
