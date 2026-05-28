const RADAR_LABEL_ABBREV = {
    gls: "Goals", gpk: "NP Goals", xg90: "xG", npxg90: "npxG", gxg: "G-xG", npgxg: "npG-xG",
    sh90: "Shots", sot90: "SoT", sotpct: "SoT%", npxgpsh: "npxG/Sh", dist: "Sh Dist", fkGoals: "FK",
    ast: "Assists", gpa: "G+A", xag90: "xAG", axag: "A-xAG", sca90: "SCA", gca90: "GCA",
    kp90: "Key P", ppa90: "PPA", crspa90: "CrsPA", tb90: "Through", xa90: "xA",
    prgc90: "Prog C", prgp90: "Prog P", cpa90: "CPA", final3rd90: "Final 3rd",
    to90: "Take-On", succpct: "TO Win%", mis90: "Miscntl",
    tklint90: "Tkl+Int", tkl90: "Tackles", tklpct: "Tkl%", int90: "Int",
    blocks90: "Blocks", clr90: "Clear", shblocks90: "Sh Blk", recov90: "Recov", aerialwon: "Aerial%",
    fls90: "Fouls", fld90: "Fouled", offsides90: "Offside",
    cmppct: "Pass%",
    psxgpm90: "PSxG+/-", savepct: "Save%", cspct: "CS%", gkdist: "Distribution",
    opa90: "OPA", stppct: "Cross Stp", launchpct: "Launch%"
};

function splitRadarLabel(label) {
    const text = String(label || "").replace(/\s+/g, " ").trim();
    if (!text) return [""];
    if (text.length <= 13) return [text];

    const parts = text.split(" ");
    if (parts.length === 1) return [text];

    let bestIdx = 0;
    let bestDiff = Infinity;
    let acc = 0;
    for (let i = 1; i < parts.length; i++) {
        acc += parts[i - 1].length + 1;
        const diff = Math.abs(acc - text.length / 2);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
        }
    }

    const first = parts.slice(0, bestIdx).join(" ");
    const second = parts.slice(bestIdx).join(" ");
    if (!first || !second) return [text];
    return [first, second];
}

function getRadarLabel(key, label) {
    return RADAR_LABEL_ABBREV[key] || label;
}

function drawRadarChart(container, axes, size) {
    if (!axes || !axes.length) return;

    const margin = 48;
    const radius = (size - margin * 2) / 2;
    const cx = size / 2, cy = size / 2;
    const n = axes.length;
    const slice = n > 2 ? (2 * Math.PI) / n : 0;
    const angleForIndex = i => {
        if (n === 1) return -Math.PI / 2;
        if (n === 2) return -Math.PI / 2 + i * Math.PI;
        return slice * i - Math.PI / 2;
    };

    const svg = d3.select(container).append("svg")
        .attr("width", size).attr("height", size)
        .attr("viewBox", `0 0 ${size} ${size}`);
    const g = svg.append("g");

    for (let lvl = 1; lvl <= 4; lvl++) {
        g.append("circle").attr("cx", cx).attr("cy", cy)
            .attr("r", (radius / 4) * lvl).attr("class", "radar-grid-circle");
    }

    [25, 50, 75].forEach(p => {
        g.append("text")
            .attr("x", cx + 2).attr("y", cy - (radius * p / 100))
            .attr("class", "radar-ring-label")
            .text("P" + p);
    });

    const points = axes.map((a, i) => {
        const angle = angleForIndex(i);
        const pct = (a.percentile != null) ? a.percentile / 100 : 0;
        const r = radius * pct;

        g.append("line").attr("x1", cx).attr("y1", cy)
            .attr("x2", cx + radius * Math.cos(angle))
            .attr("y2", cy + radius * Math.sin(angle))
            .attr("class", "radar-axis-line");

        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle };
    });

    let pathD = "";
    if (points.length === 1) {
        pathD = "M" + cx.toFixed(1) + "," + cy.toFixed(1) + " L" + points[0].x.toFixed(1) + "," + points[0].y.toFixed(1);
    } else if (points.length === 2) {
        pathD =
            "M" + cx.toFixed(1) + "," + cy.toFixed(1) +
            " L" + points[0].x.toFixed(1) + "," + points[0].y.toFixed(1) +
            " L" + points[1].x.toFixed(1) + "," + points[1].y.toFixed(1) +
            " Z";
    } else {
        pathD = points.map((pt, i) =>
            (i === 0 ? "M" : "L") + pt.x.toFixed(1) + "," + pt.y.toFixed(1)
        ).join(" ") + " Z";
    }
    g.append("path").attr("d", pathD).attr("class", "radar-polygon");

    points.forEach(pt => {
        g.append("circle").attr("cx", pt.x).attr("cy", pt.y)
            .attr("r", 2.8).attr("class", "radar-dot");
    });

    axes.forEach((a, i) => {
        const angle = angleForIndex(i);
        const lR = radius + 22;
        const x = cx + lR * Math.cos(angle);
        const y = cy + lR * Math.sin(angle);
        const cos = Math.cos(angle);

        let tip = a.label;
        if (a.rawValue != null) tip += ": " + formatStat(a.key, a.rawValue);
        if (a.percentile != null) tip += " (P" + a.percentile + ")";

        const shortLabel = getRadarLabel(a.key, a.label);
        const lines = splitRadarLabel(shortLabel);
        const label = g.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle")
            .attr("class", "radar-axis-label")
            .attr("data-tip", tip);

        const lineHeight = 10;
        const startDy = lines.length > 1 ? -((lines.length - 1) * lineHeight) / 2 : 0;
        lines.forEach((line, idx) => {
            label.append("tspan")
                .attr("x", x)
                .attr("dy", idx === 0 ? startDy : lineHeight)
                .text(line);
        });
    });
}
