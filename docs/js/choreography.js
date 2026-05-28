function initAct1StoryMotion() {
    const act = document.getElementById("act1");
    const dataset = document.querySelector(".dataset-intro");
    const bridge = document.querySelector(".act1-bridge-head");
    const shell = document.querySelector(".act1-compare-shell");
    if (!act) return;

    const watch = [dataset, bridge, shell].filter(Boolean);
    if ("IntersectionObserver" in window && watch.length) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-in-view");
                io.unobserve(entry.target);
            });
        }, { threshold: 0.24, rootMargin: "-8% 0px -18% 0px" });
        watch.forEach(function (el) { io.observe(el); });
    }

    let ticking = false;
    function update() {
        const r = act.getBoundingClientRect();
        const span = Math.max(1, r.height - window.innerHeight);
        const p = Math.min(1, Math.max(0, -r.top / span));
        act.style.setProperty("--act1-scroll", p.toFixed(3));
        ticking = false;
    }
    function requestUpdate() {
        if (!ticking) {
            window.requestAnimationFrame(update);
            ticking = true;
        }
    }
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
}
function initOpeningChoreography() {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intro = document.getElementById("intro");
    const act = document.getElementById("act1");
    const dataset = document.querySelector(".dataset-intro");
    const bridge = document.querySelector(".act1-bridge-head");
    const shell = document.querySelector(".act1-compare-shell");
    const landing = document.getElementById("landing");
    const watched = [intro, dataset, bridge, shell].filter(Boolean);

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function formatNumber(n, decimals, comma) {
        const value = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
        if (!comma) return value;
        const parts = value.split(".");
        parts[0] = Number(parts[0]).toLocaleString();
        return parts.join(".");
    }

    function prepareCount(el) {
        if (!el || el.dataset.countReady === "true") return;
        const text = el.textContent.trim();
        const match = text.match(/([\d,.]+)/);
        if (!match) return;
        const raw = match[1];
        const target = Number(raw.replace(/,/g, ""));
        if (!Number.isFinite(target)) return;
        el.dataset.countReady = "true";
        el.dataset.countPrefix = text.slice(0, match.index);
        el.dataset.countSuffix = text.slice((match.index || 0) + raw.length);
        el.dataset.countTarget = target;
        el.dataset.countDecimals = raw.includes(".") ? String(raw.split(".")[1].length) : "0";
        el.dataset.countComma = raw.includes(",") ? "true" : "false";
    }

    function animateCount(el) {
        prepareCount(el);
        if (!el || el.dataset.countDone === "true" || !el.dataset.countTarget) return;
        el.dataset.countDone = "true";
        const target = Number(el.dataset.countTarget);
        const decimals = Number(el.dataset.countDecimals || 0);
        const comma = el.dataset.countComma === "true";
        const prefix = el.dataset.countPrefix || "";
        const suffix = el.dataset.countSuffix || "";
        if (reduceMotion) {
            el.textContent = prefix + formatNumber(target, decimals, comma) + suffix;
            return;
        }
        const start = Math.max(0, target * 0.68);
        const startTime = performance.now();
        const duration = 760;
        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const value = start + (target - start) * easeOutCubic(t);
            el.textContent = prefix + formatNumber(value, decimals, comma) + suffix;
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function revealDatasetMotion() {
        if (!dataset || dataset.dataset.motionDone === "true") return;
        dataset.dataset.motionDone = "true";
        dataset.querySelectorAll(".di-sample-value, .fs-num, .avg-val").forEach(animateCount);
        dataset.querySelectorAll(".lr-fill").forEach((bar, i) => {
            const width = bar.dataset.width || "0";
            if (reduceMotion) {
                bar.style.width = width + "%";
                return;
            }
            bar.style.transitionDelay = (120 + i * 70) + "ms";
            requestAnimationFrame(() => { bar.style.width = width + "%"; });
        });
    }

    if (reduceMotion) {
        revealDatasetMotion();
    } else if ("IntersectionObserver" in window && dataset) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                revealDatasetMotion();
                io.unobserve(entry.target);
            });
        }, { threshold: 0.28, rootMargin: "-8% 0px -12% 0px" });
        io.observe(dataset);
    } else {
        revealDatasetMotion();
    }

    if ("IntersectionObserver" in window && watched.length) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle("is-motion-active", entry.isIntersecting);
            });
        }, { threshold: [0, 0.2, 0.55], rootMargin: "-18% 0px -18% 0px" });
        watched.forEach(function (el) { io.observe(el); });
    }

    let ticking = false;
    function setProgress(el, name) {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const span = Math.max(1, window.innerHeight + r.height);
        const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / span));
        el.style.setProperty(name, p.toFixed(3));
    }
    function update() {
        setProgress(intro, "--intro-progress");
        setProgress(act, "--act1-motion-progress");
        if (landing) {
            const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
            landing.style.setProperty("--landing-progress", p.toFixed(3));
        }
        ticking = false;
    }
    function requestUpdate() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
}

function initProgressRail() {
    if (document.querySelector(".progress-rail")) return;
    const rail = document.createElement("div");
    rail.className = "progress-rail";
    const fill = document.createElement("span");
    fill.className = "progress-rail-fill";
    rail.appendChild(fill);
    document.body.appendChild(rail);

    let ticking = false;
    function update() {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
        fill.style.height = (p * 100).toFixed(2) + "%";
        ticking = false;
    }
    window.addEventListener("scroll", function () {
        if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
}

function initActIndicator() {
    const acts = [
        { id: "act1", roman: "I", label: "The Split" },
        { id: "act2", roman: "II", label: "The Gap" },
        { id: "act3", roman: "III", label: "Rebuild" }
    ];
    const nodes = acts.map(a => document.getElementById(a.id)).filter(Boolean);
    if (!nodes.length) return;

    const dock = document.createElement("div");
    dock.className = "act-indicator";
    dock.innerHTML = '<span class="ai-dot"></span><span class="ai-roman"></span><span class="ai-sep">&middot;</span><span class="ai-label"></span>';
    document.body.appendChild(dock);

    const romanEl = dock.querySelector(".ai-roman");
    const labelEl = dock.querySelector(".ai-label");

    let currentId = null;
    function setAct(id) {
        if (id === currentId) return;
        currentId = id;
        if (!id) { dock.classList.remove("visible"); return; }
        const a = acts.find(x => x.id === id);
        if (!a) return;
        romanEl.textContent = "Act " + a.roman;
        labelEl.textContent = a.label;
        dock.classList.add("visible");
    }

    const ratios = new Map();
    const io = new IntersectionObserver(function (entries) {
        entries.forEach(e => ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
        let bestId = null, bestRatio = 0;
        for (const a of acts) {
            const r = ratios.get(a.id) || 0;
            if (r > bestRatio) { bestRatio = r; bestId = a.id; }
        }
        if (bestId) {
            setAct(bestId);
        } else {
            const straddling = nodes.find(n => {
                const r = n.getBoundingClientRect();
                return r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
            });
            setAct(straddling ? straddling.id : null);
        }
    }, { threshold: [0, 0.25, 0.5, 0.75], rootMargin: "-30% 0px -30% 0px" });

    nodes.forEach(n => io.observe(n));
}
