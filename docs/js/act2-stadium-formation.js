const FORMATION_CANDIDATES = [
    "4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1", "4-5-1",
    "3-5-2", "3-4-2-1", "3-4-3",
    "5-3-2", "5-4-1"
];

const ROW_BUCKETS = {
    def3: ["CB", "CB", "CB"],
    def4: ["FB", "CB", "CB", "FB"],
    def5: ["FB", "CB", "CB", "CB", "FB"],
    mid2: ["DM", "DM"],
    mid3: ["CM", "CM", "CM"],
    mid4: ["WG", "CM", "CM", "WG"],
    mid5: ["WG", "CM", "AM", "CM", "WG"],
    att1: ["ST"],
    att2: ["ST", "ST"],
    att3: ["WG", "ST", "WG"]
};

// primary bucket first, then progressively looser fallbacks
const BUCKET_FALLBACKS = {
    GK: ["GK"],
    CB: ["CB", "FB"],
    FB: ["FB", "CB"],
    DM: ["DM", "CM", "AM"],
    CM: ["CM", "AM", "DM"],
    AM: ["AM", "CM", "WG"],
    WG: ["WG", "AM", "ST"],
    ST: ["ST", "WG", "AM"]
};

function clubFormation(club) {
    if (club && typeof club.formation === "string") return club.formation;
    const players = club && club.players;
    if (Array.isArray(players)) {
        for (const p of players) {
            if (p && typeof p.clubFormation === "string") return p.clubFormation;
        }
    }
    return "4-2-3-1";
}

// pick the formation whose def/mid/att line counts best match the xi
function inferBestFormation(players) {
    if (!Array.isArray(players) || !players.length) return null;
    const valid = players.filter(p => typeof p.minutes === "number" && p.minutes > 0);
    if (valid.length < 11) return null;
    const sorted = valid.slice().sort((a, b) => b.minutes - a.minutes);
    const gk = sorted.find(p => p.subPos === "GK");
    if (!gk) return null;
    const outfield = sorted.filter(p => p.subPos !== "GK").slice(0, 10);
    if (outfield.length < 10) return null;

    const c = {};
    for (const p of outfield) c[p.subPos] = (c[p.subPos] || 0) + 1;
    const defCount = (c.CB || 0) + (c.FB || 0);
    const midCount = (c.DM || 0) + (c.CM || 0) + (c.AM || 0);
    const attCount = (c.WG || 0) + (c.ST || 0);

    let best = null, bestScore = Infinity;
    for (const f of FORMATION_CANDIDATES) {
        const parts = f.split("-").map(Number);
        if (parts.reduce((a, b) => a + b, 0) !== 10) continue;
        const fDef = parts[0];
        const fAtt = parts[parts.length - 1];
        const fMid = parts.slice(1, -1).reduce((a, b) => a + b, 0);
        const score = Math.abs(fDef - defCount) + Math.abs(fMid - midCount) + Math.abs(fAtt - attCount);
        if (score < bestScore) { bestScore = score; best = f; }
    }
    return best;
}

window.inferBestFormation = inferBestFormation;

function labelFor(bucket) {
    return { GK: "Goalkeeper", CB: "Centre-back", FB: "Full-back",
        DM: "Defensive mid", CM: "Central mid", AM: "Attacking mid",
        WG: "Winger", ST: "Striker" }[bucket] || bucket;
}

// turn "4-3-3" etc into slot coords on a [-50,50] pitch
function parseFormation(str) {
    const parts = String(str || "4-2-3-1").split("-").map(n => parseInt(n, 10)).filter(n => n > 0);
    if (!parts.length || parts.reduce((a, b) => a + b, 0) !== 10) {
        return parseFormation("4-2-3-1");
    }
    const yStart = -30, yEnd = 36;
    const step = parts.length > 1 ? (yEnd - yStart) / (parts.length - 1) : 0;
    const slots = [{ id: "GK", label: "Goalkeeper", x: 0, y: -44, buckets: ["GK"] }];
    // shared counter so repeated buckets get distinct ids
    const bucketSeq = { GK: 1 };
    parts.forEach((n, i) => {
        const y = yStart + step * i;
        let row;
        if (i === 0) {
            row = ROW_BUCKETS["def" + n];
        } else if (i === parts.length - 1) {
            row = ROW_BUCKETS["att" + n];
        } else if (n === 3 && parts[i + 1] === 1) {
            row = ["WG", "AM", "WG"];
        } else if (n === 2 && i === parts.length - 2) {
            row = ["AM", "AM"];
        } else {
            row = ROW_BUCKETS["mid" + n];
        }
        if (!row) row = Array(n).fill(i === 0 ? "CB" : i === parts.length - 1 ? "ST" : "CM");
        const spread = 34;
        for (let k = 0; k < n; k++) {
            const t = n === 1 ? 0 : (k / (n - 1) - 0.5);
            const b = row[k] || row[row.length - 1];
            bucketSeq[b] = (bucketSeq[b] || 0) + 1;
            const id = b + bucketSeq[b];
            const buckets = BUCKET_FALLBACKS[b] || [b];
            slots.push({ id, label: labelFor(b), x: +(t * 2 * spread).toFixed(1), y, buckets });
        }
    });
    return slots;
}
