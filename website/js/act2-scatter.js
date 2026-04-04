function initScatter(data) {
    if (!data?.length) return;

    const plotArea = document.getElementById("scatter-plot-area");
    const sidebarEl = document.getElementById("scatter-sidebar");
    const posToggle = document.getElementById("act2-pos-toggle");
    const leagueSelect = document.getElementById("league-select");
    if (!plotArea || !sidebarEl) return;

    // Populate league dropdown
    const leagues = [...new Set(data.map(d => d.league).filter(Boolean))].sort();
    if (leagueSelect) {
        for (const lg of leagues) {
            const opt = document.createElement("option");
            opt.value = lg; opt.textContent = lg;
            leagueSelect.appendChild(opt);
        }
    }

    let activePos = "ST";
    let activeLeague = "all";

    const pid = d => d.name + "|" + d.club;
    const lastName = name => (name || "").trim().split(/\s+/).pop();

    function linReg(pts) {
        const n = pts.length;
        if (n < 2) return null;
        let sx = 0, sy = 0, sxy = 0, sx2 = 0;
        for (const [x, y] of pts) { sx += x; sy += y; sxy += x * y; sx2 += x * x; }
        const denom = n * sx2 - sx * sx;
        if (denom === 0) return null;
        const slope = (n * sxy - sx * sy) / denom;
        return { slope, intercept: (sy - slope * sx) / n };
    }

    // SVG setup
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    let width = plotArea.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(plotArea).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);
    const rScale = d3.scaleSqrt().range([3, 14]);

    const xAxisG = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    const yAxisG = g.append("g").attr("class", "y-axis");

    svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle")
        .attr("x", margin.left + width / 2).attr("y", margin.top + height + margin.bottom - 6)
        .text("EA FC 25 Overall Rating (OVR)");

    svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)").attr("x", -(margin.top + height / 2)).attr("y", 16)
        .text("Real Performance Composite");

    const trendLine = g.append("line").attr("class", "trend-line");
    const dotGroup = g.append("g");
    const labelGroup = g.append("g");

    const tooltip = d3.select("body").append("div").attr("class", "scatter-tooltip hidden");

    // Legend
    const legendBar = document.getElementById("scatter-legend-bar");
    if (legendBar) {
        legendBar.innerHTML =
            '<span class="scatter-leg-item"><span class="scatter-leg-dot" style="background:var(--red)"></span> Overrated</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-dot" style="background:rgba(255,255,255,0.25)"></span> Fair</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-dot" style="background:var(--green)"></span> Underrated</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-line"></span> Expected (regression)</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-dot scatter-leg-sm"></span><span class="scatter-leg-dot scatter-leg-lg"></span> Minutes played</span>';
    }

    function gapColor(gap) {
        if (gap < -5) return "var(--red)";
        if (gap > 5) return "var(--green)";
        return "rgba(255,255,255,0.25)";
    }
    function gapStroke(gap) {
        if (gap < -5) return "rgba(231,76,60,0.6)";
        if (gap > 5) return "rgba(46,204,113,0.6)";
        return "rgba(255,255,255,0.15)";
    }

    function filterData() {
        return data.filter(d =>
            d.subPos === activePos &&
            (activeLeague === "all" || d.league === activeLeague) &&
            d.ea?.ovr != null && d.composite != null
        );
    }

    function tooltipHTML(d) {
        const gap = d.gap || 0;
        const dir = gap < -5 ? "Overrated" : gap > 5 ? "Underrated" : "Fairly rated";
        const color = gap < -5 ? "var(--red)" : gap > 5 ? "var(--green)" : "var(--text-dim)";
        const sub = SUBPOS_LABELS[d.subPos] || d.subPos;

        let html =
            '<div class="tt-header">' + avatarHTMLString(d.photo, d.name, "tt-avatar-img", "tt-avatar") +
                '<strong>' + d.name + '</strong></div>' +
            '<div class="tt-dim">' + d.club + ' &middot; ' + d.league + ' &middot; ' + sub + '</div>' +
            '<div class="tt-row"><span class="tt-gold">EA OVR: ' + d.ea.ovr + '</span>' +
                '<span class="tt-blue">Composite: ' + d.composite.toFixed(1) + '</span></div>' +
            '<div class="tt-gap" style="color:' + color + '">Gap: ' + formatGap(gap) + ' &middot; ' + dir + '</div>';

        if (d.marketValue) html += '<div class="tt-dim">Market Value: ' + formatMarketValue(d.marketValue) + '</div>';

        const keys = POS_KEY_STATS[d.subPos] || [];
        if (keys.length) {
            html += '<div class="tt-stats">';
            for (const k of keys) {
                const v = d.real?.[k];
                if (v != null) html += '<span class="tt-stat">' + statLabel(k) + ': ' + formatStat(k, v) + '</span>';
            }
            html += '</div>';
        }
        html += '<div class="tt-dim">' + (d.minutes || 0) + ' minutes played</div>';
        return html;
    }

    function update() {
        const filtered = filterData();
        const pts = filtered.map(d => [d.ea.ovr, d.composite]);
        const reg = linReg(pts);

        const xExt = d3.extent(filtered, d => d.ea.ovr);
        const yExt = d3.extent(filtered, d => d.composite);
        const mExt = d3.extent(data, d => d.minutes);
        const xPad = ((xExt[1] || 1) - (xExt[0] || 0)) * 0.06;
        const yPad = ((yExt[1] || 1) - (yExt[0] || 0)) * 0.06;

        x.domain([(xExt[0] || 60) - xPad, (xExt[1] || 95) + xPad]);
        y.domain([(yExt[0] || 0) - yPad, (yExt[1] || 100) + yPad]);
        rScale.domain(mExt[0] != null ? mExt : [300, 3000]);

        xAxisG.transition().duration(500).call(d3.axisBottom(x).ticks(8));
        yAxisG.transition().duration(500).call(d3.axisLeft(y).ticks(8));

        if (reg) {
            const [x0, x1] = x.domain();
            trendLine.transition().duration(500)
                .attr("x1", x(x0)).attr("y1", y(reg.slope * x0 + reg.intercept))
                .attr("x2", x(x1)).attr("y2", y(reg.slope * x1 + reg.intercept))
                .style("display", null);
        } else {
            trendLine.style("display", "none");
        }

        // Dots
        const dots = dotGroup.selectAll(".dot").data(filtered, pid);
        dots.exit().transition().duration(500).attr("r", 0).style("opacity", 0).remove();

        const enter = dots.enter().append("circle").attr("class", "dot")
            .attr("cx", d => x(d.ea.ovr)).attr("cy", d => y(d.composite))
            .attr("r", 0).style("opacity", 0.8).attr("stroke-width", 1.5);

        enter
            .on("mouseenter", function (ev, d) {
                tooltip.classed("hidden", false).html(tooltipHTML(d));
                d3.select(this).transition().duration(150).attr("r", rScale(d.minutes) + 3);
                sidebarEl.querySelectorAll(".player-row").forEach(r =>
                    r.classList.toggle("active", r.dataset.pid === pid(d)));
            })
            .on("mousemove", ev => tooltip.style("left", (ev.clientX + 14) + "px").style("top", (ev.clientY - 10) + "px"))
            .on("mouseleave", function (ev, d) {
                tooltip.classed("hidden", true);
                d3.select(this).transition().duration(150).attr("r", rScale(d.minutes));
                sidebarEl.querySelectorAll(".player-row.active").forEach(r => r.classList.remove("active"));
            });

        enter.merge(dots).transition().duration(500)
            .attr("cx", d => x(d.ea.ovr)).attr("cy", d => y(d.composite))
            .attr("r", d => rScale(d.minutes))
            .attr("fill", d => gapColor(d.gap || 0))
            .attr("stroke", d => gapStroke(d.gap || 0));

        // Outlier labels
        const sorted = filtered.slice().sort((a, b) => (a.gap || 0) - (b.gap || 0));
        const outliers = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()];

        const labels = labelGroup.selectAll(".dot-label").data(outliers, pid);
        labels.exit().transition().duration(300).style("opacity", 0).remove();
        labels.enter().append("text").attr("class", "dot-label").style("opacity", 0)
            .merge(labels).transition().duration(500)
            .attr("x", d => x(d.ea.ovr) + rScale(d.minutes) + 4)
            .attr("y", d => y(d.composite) + 3)
            .text(d => lastName(d.name)).style("opacity", 1);

        updateSidebar(filtered);
    }

    function updateSidebar(filtered) {
        const sorted = filtered.slice().sort((a, b) => (a.gap || 0) - (b.gap || 0));
        const over = sorted.slice(0, 5);
        const under = sorted.slice(-5).reverse();
        const maxAbs = Math.max(1, ...filtered.map(d => Math.abs(d.gap || 0)));

        const sub = SUBPOS_LABELS[activePos] || activePos;
        let html = '<div class="sidebar-title">Reputation Gap <span class="info-i info-i-below" data-info="' +
            escapeAttr("Residual from regression of composite on OVR within " + sub + ". Negative = overrated, positive = underrated.") + '">i</span></div>';

        html += '<div class="section-header overrated-header">\u25BC Overrated by EA (' + over.length + ')</div>';
        over.forEach(p => { html += playerRow(p, maxAbs); });
        html += '<div class="section-header underrated-header">\u25B2 Underrated by EA (' + under.length + ')</div>';
        under.forEach(p => { html += playerRow(p, maxAbs); });

        sidebarEl.innerHTML = html;
        initInfoTooltips();

        // Sidebar hover
        sidebarEl.querySelectorAll(".player-row").forEach(row => {
            row.addEventListener("mouseenter", () => {
                row.classList.add("active");
                const id = row.dataset.pid;
                dotGroup.selectAll(".dot").each(function (d) {
                    if (pid(d) === id) d3.select(this).transition().duration(150).attr("r", rScale(d.minutes) * 1.8).attr("stroke-width", 3);
                });
            });
            row.addEventListener("mouseleave", () => {
                row.classList.remove("active");
                dotGroup.selectAll(".dot").each(function (d) {
                    d3.select(this).transition().duration(150).attr("r", rScale(d.minutes)).attr("stroke-width", 1.5);
                });
            });
        });
    }

    function playerRow(p, maxAbs) {
        const gap = p.gap || 0;
        const color = gap < -5 ? "var(--red)" : gap > 5 ? "var(--green)" : "var(--text-dim)";
        const barPct = Math.min(100, (Math.abs(gap) / maxAbs) * 100);

        return (
            '<div class="player-row" data-pid="' + pid(p) + '">' +
                avatarHTMLString(p.photo, p.name, "player-avatar-img", "player-avatar") +
                '<div class="player-info">' +
                    '<div class="p-name">' + p.name + '</div>' +
                    '<div class="p-club">' + p.club + ' &middot; ' + p.league + '</div>' +
                    '<div class="p-meta">' +
                        '<span class="c-gold">OVR ' + p.ea.ovr + '</span> &middot; ' +
                        '<span class="c-blue">Comp ' + p.composite.toFixed(1) + '</span>' +
                    '</div>' +
                    '<div class="gap-bar-track"><div class="gap-bar-fill" style="width:' + barPct.toFixed(0) + '%;background:' + color + '"></div></div>' +
                '</div>' +
                '<div class="gap-badge" style="color:' + color + '">' + formatGap(gap) + '</div>' +
            '</div>'
        );
    }

    // Filters
    if (posToggle) {
        posToggle.querySelectorAll(".pos-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                posToggle.querySelectorAll(".pos-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                activePos = btn.dataset.pos;
                update();
            });
        });
    }
    if (leagueSelect) leagueSelect.addEventListener("change", () => { activeLeague = leagueSelect.value; update(); });

    // Resize
    window.addEventListener("resize", () => {
        const w = plotArea.clientWidth - margin.left - margin.right;
        if (Math.abs(w - width) < 10) return;
        width = w;
        svg.attr("width", width + margin.left + margin.right);
        x.range([0, width]);
        update();
    });

    update();
}
