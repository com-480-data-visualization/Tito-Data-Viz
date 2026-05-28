function initScatter(data) {
    if (!data?.length) return;

    const plotArea = document.getElementById("scatter-plot-area");
    const posToggle = document.getElementById("act2-pos-toggle");
    const leagueSelect = document.getElementById("league-select");
    const yAxisSelect = document.getElementById("yaxis-select");
    if (!plotArea) return;

    const leagues = [...new Set(data.map(d => d.league).filter(Boolean))].sort();
    if (leagueSelect && leagueSelect.options.length <= 1) {
        for (const lg of leagues) {
            const opt = document.createElement("option");
            opt.value = lg; opt.textContent = lg;
            leagueSelect.appendChild(opt);
        }
    }

    const Y_AXES = [
        { id: "composite", label: "Composite", axisLabel: "Real Performance Composite",
          get: d => d.composite,
          fmt: v => v.toFixed(1) },
        { id: "xg",       label: "xG",        axisLabel: "Expected Goals (per 90)",
          get: d => d.real?.xg90 ?? d.real?.npxg90 ?? null,
          fmt: v => v.toFixed(2) },
        { id: "xag",      label: "xAG",       axisLabel: "Expected Assisted Goals (per 90)",
          get: d => d.real?.xag90 ?? null,
          fmt: v => v.toFixed(2) },
        { id: "tklint",   label: "Tkl+Int",   axisLabel: "Tackles + Interceptions (per 90)",
          get: d => d.real?.tklint90 ?? null,
          fmt: v => v.toFixed(2) },
        { id: "goals",    label: "Goals",     axisLabel: "Goals (season total)",
          get: d => d.real?.gls ?? null,
          fmt: v => v.toFixed(0) },
        { id: "passpct",  label: "Pass%",     axisLabel: "Pass completion %",
          get: d => d.real?.cmppct ?? null,
          fmt: v => v.toFixed(1) + "%" },
        { id: "xgxag",    label: "xG + xAG",  axisLabel: "xG + xAG (per 90)",
          get: d => {
              const a = d.real?.xg90 ?? d.real?.npxg90 ?? null;
              const b = d.real?.xag90 ?? null;
              if (a == null && b == null) return null;
              return (a || 0) + (b || 0);
          },
          fmt: v => v.toFixed(2) }
    ];

    const POS_BEST_Y = {
        ST: "goals",
        WG: "xgxag",
        AM: "xgxag",
        CM: "passpct",
        DM: "tklint",
        FB: "tklint",
        CB: "tklint",
        GK: "passpct"
    };

    let activePos = "ST";
    let activeLeague = "all";
    let yMode = Y_AXES[0];
    let dynThreshold = 0;

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

    const fullMargin = { top: 24, right: 32, bottom: 58, left: 66 };
    const miniMargin = { top: 12, right: 14, bottom: 18, left: 24 };
    const margin = { ...fullMargin };
    let width = Math.max(360, plotArea.clientWidth - margin.left - margin.right);
    let height = 520 - margin.top - margin.bottom;

    const svg = d3.select(plotArea).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom));
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);
    const rScale = d3.scaleSqrt().range([3, 14]);

    const xAxisG = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
    const yAxisG = g.append("g").attr("class", "y-axis");

    const xAxisLabel = svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle")
        .attr("x", margin.left + width / 2).attr("y", margin.top + height + margin.bottom - 6)
        .text("EA FC 25 Overall Rating (OVR)");

    const yAxisLabel = svg.append("text").attr("class", "axis-label").attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)").attr("x", -(margin.top + height / 2)).attr("y", 16)
        .text(yMode.axisLabel);

    const trendLine = g.append("line").attr("class", "trend-line");
    const dotGroup = g.append("g");
    const labelGroup = g.append("g");

    const tooltip = d3.select("body").append("div").attr("class", "scatter-tooltip hidden");
    const GROUP_BY_SUBPOS = { ST: "FW", WG: "FW", AM: "MF", CM: "MF", DM: "MF", FB: "DF", CB: "DF", GK: "GK" };
    let modalManager = null;

    function lazyAct1Modal() {
        if (modalManager) return modalManager;
        if (typeof createModalManager !== "function") return null;
        const tipEl = document.createElement("div");
        tipEl.className = "stat-tip";
        document.body.appendChild(tipEl);
        modalManager = createModalManager(tipEl);
        modalManager.init(data);
        return modalManager;
    }

    function buildRankMaps(posPlayers) {
        const byOvr = posPlayers.slice().sort((a, b) => (b.ea?.ovr || 0) - (a.ea?.ovr || 0));
        const byComp = posPlayers.slice().sort((a, b) => (b.composite || 0) - (a.composite || 0));
        const eaRankMap = {}, compRankMap = {};
        byOvr.forEach((p, i) => { eaRankMap[p.name] = i + 1; });
        byComp.forEach((p, i) => { compRankMap[p.name] = i + 1; });
        return { eaRankMap, compRankMap };
    }

    function openAct1Card(player) {
        const modal = lazyAct1Modal();
        if (!modal || !player) return;
        const subPos = player.subPos;
        const group = GROUP_BY_SUBPOS[subPos] || "FW";
        const posPlayers = data.filter(p => p.subPos === subPos);
        const ranks = buildRankMaps(posPlayers);
        modal.openModal(player, group, ranks.eaRankMap, ranks.compRankMap, posPlayers, null);
    }

    function openGapBreakdown(player) {
        if (typeof window.openAct2Modal === "function") {
            window.openAct2Modal(player, data);
            return;
        }
        openAct1Card(player);
    }

    const legendBar = document.getElementById("scatter-legend-bar");

    function legendLabels() {
        if (yMode.id === "composite") {
            return { low: "Overrated", mid: "Fair", high: "Underrated" };
        }
        return { low: "Underdelivers", mid: "On trend", high: "Outperforms" };
    }

    function renderLegend() {
        if (!legendBar) return;
        const { low, mid, high } = legendLabels();
        legendBar.innerHTML =
            '<span class="scatter-leg-item"><span class="scatter-leg-dot" style="background:var(--red)"></span> ' + low + '</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-dot" style="background:rgba(255,255,255,0.25)"></span> ' + mid + '</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-dot" style="background:var(--green)"></span> ' + high + '</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-line"></span> Expected (regression)</span>' +
            '<span class="scatter-leg-item"><span class="scatter-leg-dot scatter-leg-sm"></span><span class="scatter-leg-dot scatter-leg-lg"></span> Minutes played</span>';
    }
    renderLegend();

    function dynColor(gap) {
        if (dynThreshold <= 0) return "rgba(255,255,255,0.25)";
        if (gap < -dynThreshold) return "var(--red)";
        if (gap > dynThreshold) return "var(--green)";
        return "rgba(255,255,255,0.25)";
    }
    function dynStroke(gap) {
        if (dynThreshold <= 0) return "rgba(255,255,255,0.15)";
        if (gap < -dynThreshold) return "rgba(231,76,60,0.6)";
        if (gap > dynThreshold) return "rgba(46,204,113,0.6)";
        return "rgba(255,255,255,0.15)";
    }

    let recoEl = null;
    function ensureRecoEl() {
        if (recoEl) return recoEl;
        const wrapper = yAxisSelect ? yAxisSelect.closest(".dropdown-wrapper") : null;
        if (!wrapper) return null;
        recoEl = document.createElement("span");
        recoEl.className = "yaxis-reco";
        wrapper.appendChild(recoEl);
        return recoEl;
    }
    function renderRecommendation() {
        const el = ensureRecoEl();
        if (!el) return;
        const best = POS_BEST_Y[activePos];
        if (!best || best === yMode.id) { el.textContent = ""; el.classList.remove("on"); return; }
        const axis = Y_AXES.find(a => a.id === best);
        if (!axis) { el.textContent = ""; el.classList.remove("on"); return; }
        el.innerHTML = '<span class="yaxis-reco-star">★</span> Try ' + axis.label;
        el.classList.add("on");
        el.onclick = () => {
            yMode = axis;
            if (yAxisSelect) yAxisSelect.value = axis.id;
            update();
        };
    }

    function filterData() {
        return data.filter(d =>
            d.subPos === activePos &&
            (activeLeague === "all" || d.league === activeLeague) &&
            d.ea?.ovr != null && yMode.get(d) != null
        );
    }

    function tooltipHTML(d) {
        const sub = SUBPOS_LABELS[d.subPos] || d.subPos;
        const yVal = yMode.get(d);
        const isComp = yMode.id === "composite";
        const dynGap = d._dynGap || 0;
        const expectedY = yVal != null ? yVal - dynGap : null;
        const labels = legendLabels();
        const t = dynThreshold;
        const dir = t > 0 && dynGap < -t ? labels.low :
                    t > 0 && dynGap > t  ? labels.high :
                    labels.mid;
        const color = t > 0 && dynGap < -t ? "var(--red)"
                    : t > 0 && dynGap > t  ? "var(--green)"
                    : "var(--text-dim)";

        const yStr = (yVal == null) ? "-" : yMode.fmt(yVal);
        const expectedStr = (expectedY == null) ? "-" : yMode.fmt(expectedY);
        const gapNum = (yVal == null) ? "-" : (isComp ? formatGap(dynGap) : (dynGap >= 0 ? "+" : "") + yMode.fmt(dynGap).replace(/%$/, "") + (yMode.id === "passpct" ? " pts" : ""));
        const composite = d.composite != null ? d.composite.toFixed(1) : "-";
        const gapLabel = isComp ? "Reputation Gap" : yMode.label + " vs Expected";

        let html =
            '<div class="tt-header">' +
                avatarHTMLString(d.photo, d.name, "tt-avatar-img", "tt-avatar") +
                '<div class="tt-title-wrap">' +
                    '<strong class="tt-name">' + d.name + '</strong>' +
                    '<span class="tt-meta">' + d.club + ' &middot; ' + sub + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="tt-gap-card" style="--tt-gap-color:' + color + '">' +
                '<span class="tt-gap-label">' + gapLabel + '</span>' +
                '<span class="tt-gap-num">' + gapNum + '</span>' +
                '<span class="tt-gap-dir">' + dir + '</span>' +
            '</div>' +
            '<div class="tt-score-grid">' +
                '<div><span>OVR</span><strong>' + d.ea.ovr + '</strong></div>' +
                '<div><span>' + yMode.label + '</span><strong>' + yStr + '</strong></div>' +
                '<div><span>Expected</span><strong>' + expectedStr + '</strong></div>' +
                '<div><span>' + (isComp ? "Minutes" : "Composite") + '</span><strong>' + (isComp ? String(d.minutes || 0) : composite) + '</strong></div>' +
            '</div>' +
            '<div class="tt-footer">Click to open the gap card</div>';
        return html;
    }

    function update(instant) {
        const duration = instant ? 0 : 500;
        const filtered = filterData();
        renderLegend();
        renderRecommendation();
        if (!filtered.length) {
            dotGroup.selectAll(".dot").remove();
            labelGroup.selectAll(".dot-label").remove();
            trendLine.style("display", "none");
            xAxisG.call(d3.axisBottom(x).ticks(0));
            yAxisG.call(d3.axisLeft(y).ticks(0));
            yAxisLabel.text(yMode.axisLabel);
            dynThreshold = 0;
            return;
        }
        const pts = filtered.map(d => [d.ea.ovr, yMode.get(d)]);
        const reg = linReg(pts);

        if (reg) {
            let sumSq = 0, mean = 0;
            const resid = filtered.map(d => yMode.get(d) - (reg.slope * d.ea.ovr + reg.intercept));
            for (const r of resid) mean += r;
            mean /= resid.length;
            for (const r of resid) sumSq += (r - mean) ** 2;
            const std = Math.sqrt(sumSq / resid.length);
            dynThreshold = std * 0.75;
            filtered.forEach((d, i) => { d._dynGap = resid[i]; });
        } else {
            dynThreshold = 0;
            filtered.forEach(d => { d._dynGap = 0; });
        }

        dotGroup.selectAll(".dot").interrupt();
        labelGroup.selectAll(".dot-label").interrupt();

        const xExt = d3.extent(filtered, d => d.ea.ovr);
        const yExt = d3.extent(filtered, d => yMode.get(d));
        const mExt = d3.extent(filtered, d => d.minutes);
        const xPad = ((xExt[1] || 1) - (xExt[0] || 0)) * 0.06;
        const yPad = ((yExt[1] || 1) - (yExt[0] || 0)) * 0.06;

        x.domain([(xExt[0] || 60) - xPad, (xExt[1] || 95) + xPad]);
        y.domain([(yExt[0] || 0) - yPad, (yExt[1] || 100) + yPad]);
        rScale.domain(mExt[0] != null ? mExt : [300, 3000]);

        xAxisG.transition().duration(duration).call(d3.axisBottom(x).ticks(8));
        yAxisG.transition().duration(duration).call(d3.axisLeft(y).ticks(8));
        yAxisLabel.text(yMode.axisLabel);

        if (reg) {
            const [x0, x1] = x.domain();
            trendLine.transition().duration(duration)
                .attr("x1", x(x0)).attr("y1", y(reg.slope * x0 + reg.intercept))
                .attr("x2", x(x1)).attr("y2", y(reg.slope * x1 + reg.intercept))
                .style("display", null);
        } else {
            trendLine.style("display", "none");
        }

        const dots = dotGroup.selectAll(".dot").data(filtered, pid);
        dots.exit().remove();

        const enter = dots.enter().append("circle").attr("class", "dot")
            .attr("cx", d => x(d.ea.ovr)).attr("cy", d => y(yMode.get(d)))
            .attr("r", 0).style("opacity", 0.8).attr("stroke-width", 1.5)
            .style("cursor", "pointer");

        enter
            .on("mouseenter", function (ev, d) {
                tooltip.classed("hidden", false).html(tooltipHTML(d));
                d3.select(this).transition().duration(150).attr("r", rScale(d.minutes) + 3);
            })
            .on("mousemove", ev => {
                const node = tooltip.node();
                const w = node.offsetWidth || 268;
                const h = node.offsetHeight || 280;
                const margin = 14;
                let left = ev.clientX - w - margin;
                let top  = ev.clientY - h - margin;
                if (left < 8) left = ev.clientX + margin;
                if (top  < 8) top  = ev.clientY + margin;
                if (left + w > window.innerWidth  - 8) left = window.innerWidth  - w - 8;
                if (top  + h > window.innerHeight - 8) top  = window.innerHeight - h - 8;
                tooltip.style("left", left + "px").style("top", top + "px");
            })
            .on("mouseleave", function (ev, d) {
                tooltip.classed("hidden", true);
                d3.select(this).transition().duration(150).attr("r", rScale(d.minutes));
            })
            .on("click", function (ev, d) {
                tooltip.classed("hidden", true);
                openGapBreakdown(d);
            });

        enter.merge(dots).transition().duration(duration)
            .attr("cx", d => x(d.ea.ovr)).attr("cy", d => y(yMode.get(d)))
            .attr("r", d => rScale(d.minutes))
            .attr("fill", d => dynColor(d._dynGap || 0))
            .attr("stroke", d => dynStroke(d._dynGap || 0));

        const sorted = filtered.slice().sort((a, b) => (a._dynGap || 0) - (b._dynGap || 0));
        const outliers = [...sorted.slice(0, 3), ...sorted.slice(-3).reverse()];

        const labels = labelGroup.selectAll(".dot-label").data(outliers, pid);
        labels.exit().remove();
        labels.enter().append("text").attr("class", "dot-label").style("opacity", 0)
            .merge(labels).transition().duration(duration)
            .attr("x", d => x(d.ea.ovr) + rScale(d.minutes) + 4)
            .attr("y", d => y(yMode.get(d)) + 3)
            .text(d => lastName(d.name)).style("opacity", 1);
    }

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
    if (yAxisSelect) yAxisSelect.addEventListener("change", () => {
        const next = Y_AXES.find(a => a.id === yAxisSelect.value);
        if (next) { yMode = next; update(); }
    });

    function setActivePos(nextPos) {
        if (!nextPos || nextPos === "ALL" || nextPos === activePos) return;
        activePos = nextPos;
        if (posToggle) {
            posToggle.querySelectorAll(".pos-btn").forEach(b => {
                b.classList.toggle("active", b.dataset.pos === activePos);
            });
        }
        update();
    }

    document.addEventListener("highlightPlayer", ev => {
        const detail = ev.detail || {};
        const name = detail.name;
        setActivePos(detail.subPos);
        const dots = dotGroup.selectAll(".dot");
        dots.filter(d => d.name === name).raise();
        dots
            .transition().duration(150)
            .attr("r", d => {
                const base = rScale(d.minutes);
                return d.name === name ? Math.max(base * 2.35, 13) : Math.max(base * 0.72, 2.4);
            })
            .attr("stroke", d => d.name === name ? "rgba(244, 240, 230, 0.96)" : dynStroke(d._dynGap || 0))
            .attr("stroke-width", d => d.name === name ? 4 : 1)
            .style("opacity", d => d.name === name ? 1 : 0.32);
    });
    document.addEventListener("unhighlightPlayer", () => {
        dotGroup.selectAll(".dot")
            .transition().duration(150)
            .attr("r", d => rScale(d.minutes))
            .attr("stroke", d => dynStroke(d._dynGap || 0))
            .attr("stroke-width", 1.5)
            .style("opacity", 0.8);
    });
    document.addEventListener("act2WallFilter", ev => {
        setActivePos(ev.detail && ev.detail.subPos);
    });

    const wall = document.getElementById("wall-fame-shame");
    const container = plotArea.closest(".scatter-layout") || plotArea;
    const placeholder = document.createElement("div");
    placeholder.className = "act2-scatter-placeholder";
    let wallWantsMini = false;
    let releaseWantsHide = false;
    let releaseTimer = null;

    function setScatterPinned(nextPinned) {
        const pinned = container.classList.contains("scatter-pinned");
        if (nextPinned === pinned) return;

        if (nextPinned) {
            if (releaseTimer) {
                clearTimeout(releaseTimer);
                releaseTimer = null;
            }
            // clear leftover fade state from a previous release
            container.classList.remove("scatter-release-fade", "scatter-release-hidden");
            container.style.opacity = "";
            container.style.transform = "";
            const rect = container.getBoundingClientRect();
            placeholder.style.height = Math.max(0, rect.height) + "px";
            placeholder.style.width = rect.width + "px";
            if (!placeholder.parentNode && container.parentNode) {
                container.parentNode.insertBefore(placeholder, container);
            }
            container.classList.add("scatter-teleporting");
            container.classList.add("scatter-pinned");
            // mini mode always falls back to composite vs ovr
            const composite = Y_AXES.find(a => a.id === "composite");
            if (composite && yMode !== composite) {
                yMode = composite;
                if (yAxisSelect) yAxisSelect.value = "composite";
            }
            requestAnimationFrame(() => {
                resize(true);
                update(true);
                requestAnimationFrame(() => container.classList.remove("scatter-teleporting"));
            });
        } else {
            // cancel a pending fade so the scatter doesn't stay invisible
            if (releaseTimer) {
                clearTimeout(releaseTimer);
                releaseTimer = null;
            }
            container.classList.remove("scatter-release-fade", "scatter-release-hidden");
            container.style.opacity = "";
            container.style.transform = "";
            container.classList.add("scatter-teleporting");
            container.classList.remove("scatter-pinned");
            if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
            requestAnimationFrame(() => {
                resize(true);
                requestAnimationFrame(() => container.classList.remove("scatter-teleporting"));
            });
        }
    }

    function syncScatterMini() {
        const shouldPin = wallWantsMini && !releaseWantsHide;
        // let the release timer do the final unpin so we don't rip it mid-animation
        if (releaseTimer && !shouldPin && container.classList.contains("scatter-pinned")) return;
        setScatterPinned(shouldPin);
    }

    function setReleaseHidden(nextHidden) {
        releaseWantsHide = nextHidden;
        const act = document.getElementById("act2");
        if (act) act.classList.toggle("act2-hide-scatter", releaseWantsHide);

        if (releaseTimer) {
            clearTimeout(releaseTimer);
            releaseTimer = null;
        }

        if (releaseWantsHide && container.classList.contains("scatter-pinned")) {
            container.classList.add("scatter-release-fade");
            container.style.opacity = "0";
            container.style.transform = "";
            releaseTimer = window.setTimeout(() => {
                releaseTimer = null;
                if (!releaseWantsHide) return;
                if (!container.classList.contains("scatter-pinned")) {
                    container.classList.remove("scatter-release-fade");
                    container.style.opacity = "";
                    container.style.transform = "";
                    return;
                }
                setScatterPinned(false);
                container.classList.add("scatter-release-hidden");
            }, 260);
        } else {
            container.classList.remove("scatter-release-fade", "scatter-release-hidden");
            container.style.opacity = "";
            container.style.transform = "";
            syncScatterMini();
        }
    }

    if (wall && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                wallWantsMini = e.isIntersecting;
                syncScatterMini();
            });
        }, { threshold: 0.01, rootMargin: "-32% 0px -36% 0px" });
        io.observe(wall);
    }

    const releaseTargets = Array.from(document.querySelectorAll(".act2-scatter-release"));
    if (releaseTargets.length && "IntersectionObserver" in window) {
        const visibleTargets = new Set();
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) visibleTargets.add(e.target);
                else visibleTargets.delete(e.target);
            });
            setReleaseHidden(visibleTargets.size > 0);
        }, { threshold: 0.03, rootMargin: "-10% 0px -26% 0px" });
        releaseTargets.forEach(el => io.observe(el));
    }

    function resize(force) {
        const mini = container.classList.contains("scatter-pinned");
        Object.assign(margin, mini ? miniMargin : fullMargin);

        const outerHeight = mini ? plotArea.clientHeight : 520;
        const w = Math.max(mini ? 180 : 360, plotArea.clientWidth - margin.left - margin.right);
        const h = Math.max(mini ? 130 : 360, outerHeight - margin.top - margin.bottom);

        if (!force && Math.abs(w - width) < 10 && Math.abs(h - height) < 10) return;
        width = w;
        height = h;
        svg.attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .attr("viewBox", "0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom));
        g.attr("transform", `translate(${margin.left},${margin.top})`);
        x.range([0, width]);
        y.range([height, 0]);
        xAxisG.attr("transform", `translate(0,${height})`);
        xAxisLabel.attr("x", margin.left + width / 2);
        xAxisLabel.attr("y", margin.top + height + margin.bottom - (mini ? 3 : 6));
        yAxisLabel.attr("x", -(margin.top + height / 2));
        yAxisLabel.attr("y", mini ? 8 : 16);
        update(force);
    }
    if ("ResizeObserver" in window) {
        const ro = new ResizeObserver(resize);
        ro.observe(plotArea);
    }
    window.addEventListener("resize", resize);

    resize(true);
}
