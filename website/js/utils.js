function escapeAttr(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Position labels ---

const POS_LABELS = { FW: "Forwards", MF: "Midfielders", DF: "Defenders", GK: "Goalkeepers" };

const SUBPOS_LABELS = {
    ST: "Strikers", WG: "Wingers", AM: "Attacking Midfielders",
    CM: "Central Midfielders", DM: "Defensive Midfielders",
    FB: "Full-backs", CB: "Centre-backs", GK: "Goalkeepers"
};

// --- EA stat labels ---

const EA_STAT_LABELS = {
    ovr: "Overall", pac: "Pace", sho: "Shooting", pas: "Passing",
    dri: "Dribbling", def: "Defending", phy: "Physical",
    acceleration: "Acceleration", sprintSpeed: "Sprint Speed",
    finishing: "Finishing", shotPower: "Shot Power", longShots: "Long Shots",
    volleys: "Volleys", penalties: "Penalties", positioning: "Positioning",
    vision: "Vision", crossing: "Crossing", fkAccuracy: "FK Accuracy",
    shortPassing: "Short Passing", longPassing: "Long Passing", curve: "Curve",
    dribbling: "Dribbling", agility: "Agility", balance: "Balance",
    reactions: "Reactions", ballControl: "Ball Control", composure: "Composure",
    interceptions: "Interceptions", headingAccuracy: "Heading Accuracy",
    defAwareness: "Def. Awareness", standingTackle: "Standing Tackle",
    slidingTackle: "Sliding Tackle",
    jumping: "Jumping", stamina: "Stamina", strength: "Strength", aggression: "Aggression",
    gkDiving: "GK Diving", gkHandling: "GK Handling", gkKicking: "GK Kicking",
    gkPositioning: "GK Positioning", gkReflexes: "GK Reflexes"
};

// --- Real stat labels ---

const REAL_STAT_LABELS = {
    // Scoring
    gls: "Goals", gpa: "Goals + Assists", gpk: "Non-Penalty Goals",
    xg90: "xG/90", npxg90: "npxG/90", gxg: "Goals - xG",
    sh90: "Shots/90", sot90: "SoT/90", sotpct: "Shot Accuracy %",
    npxgpsh: "npxG/Shot", dist: "Avg Shot Distance", fkGoals: "FK Goals",
    // Creation
    ast: "Assists", xag90: "xAG/90", axag: "Assists - xAG",
    sca90: "SCA/90", gca90: "GCA/90", kp90: "Key Passes/90",
    ppa90: "Passes into Pen. Area/90", crspa90: "Crosses into Pen. Area/90",
    tb90: "Through Balls/90", xa90: "xA/90",
    // Progression
    prgc90: "Prog. Carries/90", prgp90: "Prog. Passes/90",
    cpa90: "Carries into Pen. Area/90", final3rd90: "Passes into Final 3rd/90",
    // Dribbling
    to90: "Take-Ons/90", succpct: "Dribble Success %", mis90: "Miscontrols/90",
    // Defense
    tklint90: "Tkl+Int/90", tkl90: "Tackles/90", tklpct: "Tackle Win %",
    int90: "Interceptions/90", blocks90: "Blocks/90", clr90: "Clearances/90",
    shblocks90: "Shot Blocks/90", recov90: "Recoveries/90", aerialwon: "Aerial Won %",
    // Discipline
    fls90: "Fouls/90", fld90: "Fouled/90", offsides90: "Offsides/90",
    pkwon: "PKs Won", pkcon: "PKs Conceded",
    // Passing & misc
    cmppct: "Pass Completion %", npgxg: "npG - xG", minpct: "Minutes Played %",
    // GK
    psxgpm: "PSxG +/-", psxgpm90: "PSxG +/- per 90", savepct: "Save %",
    cspct: "Clean Sheet %", gkdist: "Distribution %",
    opa90: "Defensive Actions Outside Pen. Area/90", stppct: "Crosses Stopped %",
    launchpct: "Launch %", pka: "PKs Faced", pksv: "PKs Saved", pkm: "PKs Missed by Kicker",
    // Heatmap zones
    touches: "Touches", touchDefPen: "Def. Pen. Touches",
    touchDef3rd: "Def. 3rd Touches", touchMid3rd: "Mid. 3rd Touches",
    touchAtt3rd: "Att. 3rd Touches", touchAttPen: "Att. Pen. Touches",
    touchLive: "Live-Ball Touches",
    tklDef3rd: "Def. 3rd Tackles", tklMid3rd: "Mid. 3rd Tackles", tklAtt3rd: "Att. 3rd Tackles",
    // Playing time
    mp: "Matches Played", starts: "Starts", subs: "Sub Appearances",
    compl: "Complete Matches", mnPerMp: "Min / Match", mnPerStart: "Min / Start",
    mnPerSub: "Min / Sub", unSub: "Unused Sub",
    // Passing breakdown
    passCmp: "Passes Completed", passAtt: "Passes Attempted",
    passTotDist: "Total Pass Distance", passPrgDist: "Progressive Pass Dist.",
    passLive: "Live-Ball Passes", passDead: "Dead-Ball Passes",
    passFK: "Free Kick Passes", passTB: "Through Balls", passSw: "Switches",
    passCrs: "Crosses", passTI: "Throw-Ins", passCK: "Corners",
    passCKIn: "Inswinging Corners", passCKOut: "Outswinging Corners",
    passCKStr: "Straight Corners", passBlocked: "Passes Blocked", passOff: "Offsides (Pass)",
    // Carries
    carries: "Carries", carriesTotDist: "Carry Distance",
    carriesPrgDist: "Prog. Carry Dist.", carriesPrgC: "Progressive Carries",
    carries1_3: "Carries into Final 3rd", carriesCPA: "Carries into Pen. Area",
    carriesDis: "Dispossessed", carriesRec: "Receptions", carriesMis: "Miscontrols",
    toAtt: "Take-On Attempts", toSucc: "Successful Take-Ons",
    tkld: "Times Tackled", tkldPct: "Tackled %", prgR: "Progressive Receptions",
    // Discipline detail
    crdY: "Yellow Cards", crdR: "Red Cards", crd2Y: "2nd Yellows",
    fls: "Fouls Committed", fld: "Fouls Drawn", og: "Own Goals",
    err: "Errors Leading to Shot",
    // Team impact
    onG: "Goals (on pitch)", onGA: "Goals Against (on pitch)",
    plusMinus: "Goal +/-", plusMinus90: "Goal +/- per 90", onOff: "On-Off Impact",
    onxG: "xG (on pitch)", onxGA: "xGA (on pitch)",
    xgPlusMinus: "xG +/-", xgPlusMinus90: "xG +/- per 90", ppm: "Points per Match",
    // SCA/GCA breakdown
    scaPassLive: "SCA: Live Pass", scaPassDead: "SCA: Dead Ball",
    scaTO: "SCA: Take-On", scaSh: "SCA: Shot", scaFld: "SCA: Foul Drawn",
    scaDef: "SCA: Defensive Action", sca: "Shot-Creating Actions", gca: "Goal-Creating Actions",
    // Defense extra
    gPerSh: "Goals / Shot", gPerSoT: "Goals / Shot on Target",
    tklW: "Tackles Won", challengesLost: "Challenges Lost",
    passBlk: "Passes Blocked (Def.)", drblAtt: "Dribblers Challenged",
    aerialWon: "Aerial Duels Won", aerialLost: "Aerial Duels Lost",
    // GK detail
    ga: "Goals Against", ga90: "Goals Against / 90",
    sota: "Shots on Target Against", saves: "Saves",
    gkW: "Wins", gkD: "Draws", gkL: "Losses", cs: "Clean Sheets",
    psxg: "Post-Shot xG", psxgPerSoT: "PSxG / SoT",
    gkCmp: "GK Passes Completed", gkAtt: "GK Passes Attempted",
    gkCmpPct: "GK Pass Completion %", gkGoalKicks: "Goal Kicks",
    gkThr: "Throws", gkAvgLen: "Avg. Pass Length",
    gkOpp: "Crosses Faced", gkStp: "Crosses Stopped",
    gkOPA: "Sweeper Actions", gkAvgDist: "Avg. Distance from Goal",
    gkFKConceded: "Goals from FK", gkCKConceded: "Goals from Corners",
    gkOGConceded: "Own Goals (GK)"
};

// --- Stat tooltips (FBref definitions + EA context) ---

const STAT_INFO = {
    // Composite & gap
    composite: "Composite performance score. Each stat is percentile-ranked within the same sub-position (e.g. all Wingers), then combined as a weighted average using position-specific weights. Rescaled to match the EA OVR distribution (mean ~75, std ~5).",
    gap: "Composite minus the value predicted by linear regression from OVR. Positive = underrated (performs better than OVR suggests), negative = overrated.",
    composite_fw: "Forward composite: percentile-ranked stats across scoring (~30%), creation (~30%), progression (~30%) and discipline (~10%). ST weights emphasize npxG, SoT, and penalty area presence. WG weights balance scoring, creation and dribbling progression equally.",
    composite_mf: "Midfielder composite: percentile-ranked stats across creation, progression, defense, scoring and discipline. AM weights favor creation and progression. CM balances all dimensions. DM emphasizes tackles, interceptions and recoveries.",
    composite_df: "Defender composite: percentile-ranked stats. CB weights: defense ~53% (tackle win rate, aerial duels, interceptions), progression ~33% (progressive passes/carries, pass accuracy), discipline ~14%. FB weights balance progression, creation and defense.",
    composite_gk: "GK composite: 11 percentile-ranked stats. Shot-stopping (PSxG+/-/90, Save%, CS%) weighted ~55%, distribution (pass completion, launches, throws) ~10%, sweeping (actions outside box, cross stops, positioning) ~23%.",
    trendLine: "Linear regression line: players above outperform their EA rating, below underperform.",
    dotColor: "Green = underrated, Red = overrated, Grey = roughly fair.",
    dotSize: "Dot size = minutes played. Bigger = more reliable data.",
    marketValue: "Transfermarkt valuation from start of 2024-25 season (before Aug 31, 2024).",

    // EA
    ovr: "EA Overall rating. Weighted average of all in-game attributes.",

    // Scoring
    gls: "Total non-penalty goals + penalty goals scored.",
    gpk: "Goals minus penalty kicks made. Only counts goals from open play and free kicks.",
    xg90: "Expected Goals per 90 min. Estimated goals a player should score based on shot quality (position, body part, type of assist, etc.).",
    npxg90: "Non-Penalty xG per 90 min. Same as xG but excluding penalty kicks, giving a cleaner measure of open-play threat.",
    gxg: "Goals minus xG. Positive = finishing above expectation (clinical), negative = underperforming chances.",
    npgxg: "Non-penalty goals minus non-penalty xG. Like G-xG but removing penalties for a purer finishing signal.",
    sh90: "Total shots per 90 min. Includes all attempts (on target, off target, blocked).",
    sot90: "Shots on Target per 90 min. Shots that would have gone in without a save.",
    sotpct: "Shots on Target %. Percentage of shots that hit the target.",
    npxgpsh: "Non-penalty xG per shot. Average quality of each shot attempt (excluding PKs). Higher = better shot selection.",
    dist: "Average distance in yards from goal of all shots taken.",
    fkGoals: "Goals scored directly from free kicks.",
    gPerSh: "Goals per shot. Conversion rate from all shot attempts.",

    // Creation
    ast: "Total assists. Final pass or cross before a teammate scores.",
    xag90: "Expected Assisted Goals per 90 min. Likelihood that a completed pass becomes a goal assist, based on pass type, distance, and location.",
    axag: "Assists minus xAG. Positive = teammates finish above expectation on your passes.",
    sca90: "Shot-Creating Actions per 90 min. The two offensive actions (pass, dribble, foul drawn, shot) directly leading to a shot attempt.",
    gca90: "Goal-Creating Actions per 90 min. The two offensive actions directly leading to a goal. A stricter version of SCA.",
    kp90: "Key Passes per 90 min. Completed passes that directly lead to a shot (excluding goals).",
    ppa90: "Passes into Penalty Area per 90 min. Completed passes into the 18-yard box (excluding set pieces).",
    crspa90: "Crosses into Penalty Area per 90 min. Completed crosses into the 18-yard box.",
    tb90: "Through Balls per 90 min. Completed passes sent between defenders into open space.",
    xa90: "Expected Assists per 90 min. Likelihood that a completed pass becomes an assist based on pass characteristics.",

    // Progression
    prgc90: "Progressive Carries per 90 min. Carries that move the ball at least 10 yards toward the opponent goal or into the penalty area.",
    prgp90: "Progressive Passes per 90 min. Completed passes that move the ball at least 10 yards toward the opponent goal or into the penalty area.",
    cpa90: "Carries into Penalty Area per 90 min. Number of times a player dribbled the ball into the 18-yard box.",
    final3rd90: "Passes into Final Third per 90 min. Completed passes that enter the attacking third of the pitch.",

    // Dribbling
    to90: "Take-Ons Attempted per 90 min. Number of times a player attempted to dribble past an opponent.",
    succpct: "Dribble Success %. Percentage of take-on attempts that were successful.",
    mis90: "Miscontrols per 90 min. Number of times a player failed to control the ball with an errant touch.",

    // Defense
    tklint90: "Tackles + Interceptions per 90 min. Combined count of tackles won and passes intercepted. Core measure of defensive involvement.",
    tkl90: "Tackles per 90 min. Number of times a player won the ball by tackling an opponent.",
    tklpct: "Tackle Success %. Percentage of dribblers challenged where the tackle was won.",
    int90: "Interceptions per 90 min. Passes read and intercepted by the player.",
    blocks90: "Blocks per 90 min. Shots + passes blocked by standing in the path of the ball.",
    clr90: "Clearances per 90 min. Times a player intentionally cleared the ball away from danger.",
    shblocks90: "Shot Blocks per 90 min. Opponent shots blocked by the player.",
    recov90: "Ball Recoveries per 90 min. Number of times the player won back a loose ball.",
    aerialwon: "Aerial Duel Win %. Percentage of headed duels won.",
    drblAtt90: "Dribblers Challenged per 90 min. Number of times a player attempted to tackle a dribbler.",
    passBlk90: "Passes Blocked per 90 min. Opponent passes blocked by the player.",
    err90: "Errors per 90 min. Mistakes that directly led to an opponent shot.",

    // Discipline
    fls90: "Fouls Committed per 90 min. Fouls conceded by the player.",
    fld90: "Fouls Drawn per 90 min. Fouls won by the player.",
    offsides90: "Offsides per 90 min. Number of times caught in an offside position.",

    // Passing
    cmppct: "Pass Completion %. Total completed passes divided by total attempted passes.",
    minpct: "Minutes Played %. Percentage of total available league minutes the player was on the pitch.",

    // GK
    psxgpm: "Post-Shot xG +/-. Goals conceded minus Post-Shot xG (expected goals based on actual shot placement). Negative = saving better than expected.",
    psxgpm90: "Post-Shot xG +/- per 90 min. PSxG+/- normalized to 90 minutes. The best single stat for GK shot-stopping quality.",
    savepct: "Save %. Shots on target saved divided by shots on target faced (excluding PKs).",
    cspct: "Clean Sheet %. Percentage of matches played where the GK conceded zero goals.",
    gkdist: "Distribution %. Completed passes from the GK divided by total attempted passes (excluding goal kicks).",
    opa90: "Defensive Actions Outside Penalty Area per 90 min. Times the GK came off the line to sweep up play beyond the 18-yard box.",
    stppct: "Crosses Stopped %. Percentage of opponent crosses into the box that the GK successfully claimed.",
    launchpct: "Launch %. Percentage of GK passes that traveled over 40 yards.",
    ga90: "Goals Against per 90 min. Goals conceded per 90 minutes played.",
    psxgPerSoT: "Post-Shot xG per Shot on Target. Average quality of shots faced based on placement.",
    gkAvgDist: "Average Distance from Goal. How far from goal the GK positions on average during defensive actions.",

    // Playing time
    touchAttPen90: "Touches in Attacking Penalty Area per 90 min. Ball contacts inside the opponent 18-yard box.",
};

// --- Stat groups ---

const EA_GROUPS = {
    "Pace":        ["acceleration", "sprintSpeed"],
    "Shooting":    ["positioning", "finishing", "shotPower", "longShots", "volleys", "penalties"],
    "Passing":     ["vision", "crossing", "fkAccuracy", "shortPassing", "longPassing", "curve"],
    "Dribbling":   ["dribbling", "agility", "balance", "reactions", "ballControl", "composure"],
    "Defending":   ["interceptions", "headingAccuracy", "defAwareness", "standingTackle", "slidingTackle"],
    "Physical":    ["jumping", "stamina", "strength", "aggression"],
    "Goalkeeping": ["gkDiving", "gkHandling", "gkKicking", "gkPositioning", "gkReflexes"]
};

const REAL_GROUPS = {
    "Scoring":      ["gls", "gpk", "xg90", "npxg90", "gxg", "npgxg", "sh90", "sot90", "sotpct", "npxgpsh", "dist", "fkGoals"],
    "Creation":     ["ast", "gpa", "xag90", "axag", "sca90", "gca90", "kp90", "ppa90", "crspa90", "tb90", "xa90"],
    "Progression":  ["prgc90", "prgp90", "cpa90", "final3rd90"],
    "Dribbling":    ["to90", "succpct", "mis90"],
    "Defense":      ["tklint90", "tkl90", "tklpct", "int90", "blocks90", "clr90", "shblocks90", "recov90", "aerialwon"],
    "Discipline":   ["fls90", "fld90", "offsides90", "pkwon", "pkcon"],
    "Passing":      ["cmppct"],
    "Context":      ["minpct"],
    "Goalkeeping":  ["psxgpm", "psxgpm90", "savepct", "cspct", "gkdist", "opa90", "stppct", "launchpct", "pka", "pksv", "pkm"]
};

const POS_KEY_STATS = {
    FW: ["npxg90", "xag90", "sca90", "sh90", "prgc90", "succpct"],
    MF: ["kp90", "prgp90", "xag90", "tklint90", "sca90", "cmppct"],
    DF: ["tklint90", "blocks90", "clr90", "aerialwon", "prgp90", "cmppct"],
    GK: ["psxgpm90", "savepct", "cspct", "gkdist", "opa90", "stppct"],
    ST: ["npxg90", "sot90", "xag90", "sca90", "prgc90", "aerialwon"],
    WG: ["npxg90", "sca90", "to90", "succpct", "prgc90", "xag90"],
    AM: ["xag90", "sca90", "kp90", "prgc90", "npxg90", "tb90"],
    CM: ["xag90", "prgp90", "sca90", "tklint90", "npxg90", "cmppct"],
    DM: ["tklint90", "tkl90", "recov90", "prgp90", "prgc90", "cmppct"],
    FB: ["prgc90", "sca90", "xag90", "tklint90", "recov90", "cmppct"],
    CB: ["tklint90", "aerialwon", "clr90", "blocks90", "prgp90", "cmppct"]
};

// --- Helpers ---

const _PCT_STATS = new Set([
    "aerialwon", "sotpct", "succpct", "tklpct", "cmppct",
    "savepct", "cspct", "gkdist", "stppct", "launchpct", "minpct",
    "gkCmpPct", "tkldPct"
]);

const _SIGNED_STATS = new Set([
    "psxgpm", "psxgpm90", "gxg", "axag", "npgxg",
    "plusMinus", "plusMinus90", "onOff", "xgPlusMinus", "xgPlusMinus90"
]);

const _INTEGER_STATS = new Set([
    "gls", "ast", "fkGoals", "pkwon", "pkcon", "pka", "pksv", "pkm"
]);

function initials(name) {
    if (!name) return "?";
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatGap(gap) {
    return (gap > 0 ? "+" : "") + gap.toFixed(1);
}

function statLabel(key) {
    return REAL_STAT_LABELS[key] || EA_STAT_LABELS[key] || key;
}

function formatStat(key, val) {
    if (val == null || isNaN(val)) return "-";
    if (_PCT_STATS.has(key)) return val.toFixed(1) + "%";
    if (_SIGNED_STATS.has(key)) return (val > 0 ? "+" : "") + val.toFixed(2);
    if (_INTEGER_STATS.has(key)) return Math.round(val).toString();
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(2);
}

function formatMarketValue(val) {
    if (val == null || isNaN(val)) return "-";
    if (val >= 1000000) {
        const m = val / 1000000;
        return "EUR " + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
    }
    if (val >= 1000) {
        const k = val / 1000;
        return "EUR " + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "K";
    }
    return "EUR " + val;
}

function compositeInfo(pos, subPos) {
    if (subPos) {
        const label = SUBPOS_LABELS[subPos] || subPos;
        const nStats = { ST: 18, WG: 16, AM: 16, CM: 17, DM: 16, FB: 17, CB: 16, GK: 11 };
        return label + " composite: each of the " +
            (nStats[subPos] || 15) + " real stats is percentile-ranked among all " + label.toLowerCase() +
            ", then combined as a weighted average. Rescaled to match the EA OVR distribution.";
    }
    const key = "composite_" + (pos || "").toLowerCase();
    return STAT_INFO[key] || STAT_INFO.composite;
}

function getStatTooltip(key) {
    return STAT_INFO[key] || REAL_STAT_LABELS[key] || EA_STAT_LABELS[key] || key;
}

// Avatar img with fallback to initials on error
function avatarHTMLString(photo, name, imgClass, fallbackClass) {
    if (!photo) return '<div class="' + fallbackClass + '">' + initials(name) + '</div>';
    const escaped = escapeAttr(photo);
    const ini = initials(name);
    return '<img class="' + imgClass + '" src="' + escaped + '" alt="" loading="lazy"' +
        ' onerror="this.outerHTML=\'<div class=&quot;' + fallbackClass + '&quot;>' + ini + '</div>\'">';
}

// Info tooltip setup
function initInfoTooltips() {
    document.querySelectorAll(".info-i").forEach(function (el) {
        const text = el.getAttribute("data-info");
        if (!text || el.querySelector(".info-bubble")) return;
        const bubble = document.createElement("div");
        bubble.className = "info-bubble";
        bubble.textContent = text;
        el.appendChild(bubble);

        el.addEventListener("mouseenter", function () {
            bubble.classList.remove("flip-below");
            if (bubble.getBoundingClientRect().top < 0) bubble.classList.add("flip-below");
        });
    });
}

// Numeric sort helper
function numSort(a, b) { return a - b; }
