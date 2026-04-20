let DATA = [];

document.addEventListener("DOMContentLoaded", function () {
    fetch("data/players.json")
        .then(r => r.json())
        .then(d => { DATA = d; boot(); })
        .catch(() => boot());
});

function boot() {
    initInfoTooltips();
    initBall();
    initScrollama();
    initAct1(DATA);
    initGuessTheGap(DATA);
    initScatter(DATA);
}

// --- Ball + Sommaire ---
// Phases: 0=title, 1=entering, 2=sommaire, 3=closing, 4=docked

function initBall() {
    const ball = document.getElementById("the-ball");
    const panel = document.getElementById("sommaire");
    const landing = document.getElementById("landing");
    if (!ball || !panel || !landing) return;

    const C = {
        ballSize: 52, dockedSize: 38,
        dockedTop: 16, dockedLeft: 16,
        panelWidth: 340, panelDockedTop: 62,
        depthBase: 0.035, busyTimeout: 2000
    };

    let phase = 0, depth = 0, busy = false, busyTimer = null, dockedOpen = false, sommaireLocked = false;

    const spItems = panel.querySelectorAll(".sp-item");
    const spHint = panel.querySelector(".sp-hint");

    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);

    const el = {
        lab: landing.querySelector(".landing-label"),
        ttl: landing.querySelector(".landing-title"),
        sub: landing.querySelector(".landing-subtitle"),
        scr: landing.querySelector(".scroll-indicator")
    };

    gsap.set(ball, { top: "50%", right: -70, left: "auto", yPercent: -50, opacity: 0 });

    // --- Busy safety ---

    function setBusy(val) {
        busy = val;
        clearTimeout(busyTimer);
        if (val) {
            busyTimer = setTimeout(function () {
                busy = false;
                if (phase < 4) forceDockedState();
            }, C.busyTimeout);
        }
    }

    function forceDockedState() {
        gsap.killTweensOf([ball, panel, spItems, spHint]);
        panel.style.clipPath = "circle(0% at 0px 0px)";
        panel.classList.remove("open");
        gsap.set(spItems, { opacity: 0, y: 8 });
        gsap.set(spHint, { opacity: 0 });
        gsap.set(ball, {
            top: C.dockedTop, left: C.dockedLeft, right: "auto",
            width: C.dockedSize, height: C.dockedSize,
            scale: 1, opacity: 1, xPercent: 0, yPercent: 0
        });
        ball.classList.add("docked");
        resetDepth();
        document.body.style.overflow = "";
        landing.style.display = "none";
        phase = 4; busy = false; dockedOpen = false;
    }

    // --- Depth effect on landing text ---

    function setDepth(t) {
        const s = 1 - t * 0.35, o = 1 - t * 0.8, b = t * 4;
        const targets = [el.lab, el.ttl, el.sub].filter(Boolean);
        gsap.set(targets, { scale: s, opacity: o, filter: "blur(" + b + "px)" });
        if (el.scr) gsap.set(el.scr, { opacity: Math.max(0, 1 - t * 4) });
    }

    function resetDepth() {
        gsap.to([el.lab, el.ttl, el.sub, el.scr].filter(Boolean), {
            scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "power2.out"
        });
        depth = 0;
    }

    // --- Enter timeline ---

    const enterTL = gsap.timeline({ paused: true, onComplete: onBallArrived });
    enterTL
        .set(ball, { opacity: 1, right: -70, top: "50%", scale: 0.25, rotation: 0 })
        .to(ball, {
            right: "calc(50% - " + (C.ballSize / 2) + "px)",
            top: "45%", scale: 0.85, rotation: -400, duration: 0.4, ease: "power2.out"
        })
        .to(ball, { top: "50%", scale: 1.05, rotation: -620, duration: 0.2, ease: "power2.inOut" })
        .to(ball, { top: "48.5%", scale: 0.97, rotation: -680, duration: 0.1, ease: "power1.out" })
        .to(ball, { top: "50%", scale: 1, rotation: -720, duration: 0.15, ease: "power1.inOut" });

    // --- Reveal timeline ---

    let revealTL = null;

    function buildRevealTL(originX, originY) {
        if (revealTL) revealTL.kill();
        const origin = originX + "px " + originY + "px";
        revealTL = gsap.timeline({ paused: true });
        revealTL
            .fromTo(panel,
                { clipPath: "circle(0% at " + origin + ")" },
                { clipPath: "circle(150% at " + origin + ")", duration: 0.5, ease: "power2.inOut" })
            .to(ball, { scale: 0, opacity: 0, duration: 0.35, ease: "power2.in" }, 0)
            .fromTo(spItems, { opacity: 0, y: 8 },
                { opacity: 1, y: 0, stagger: 0.06, duration: 0.3, ease: "power2.out" }, 0.25)
            .fromTo(spHint, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.4);
    }

    // --- Phase callbacks ---

    function onBallArrived() {
        const ballRect = ball.getBoundingClientRect();
        const panelLeft = (window.innerWidth - C.panelWidth) / 2;
        const panelTop = Math.max(40, (window.innerHeight - 300) / 2);
        gsap.set(panel, { left: panelLeft, top: panelTop, right: "auto" });

        buildRevealTL(
            ballRect.left + ballRect.width / 2 - panelLeft,
            ballRect.top + ballRect.height / 2 - panelTop
        );
        panel.classList.add("open");
        revealTL.play(0);
        phase = 2;
        setBusy(false);
        sommaireLocked = true;
        setTimeout(function () { sommaireLocked = false; }, 2000);
    }

    function closeSommaire(scrollTarget) {
        if (!revealTL || revealTL.progress() === 0) { dockBall(scrollTarget); return; }
        revealTL.eventCallback("onReverseComplete", function () {
            revealTL.eventCallback("onReverseComplete", null);
            panel.classList.remove("open");
            gsap.set(spItems, { opacity: 0, y: 8 });
            gsap.set(spHint, { opacity: 0 });
            dockBall(scrollTarget);
        });
        revealTL.reverse();
    }

    function dockBall(scrollTarget) {
        ball.classList.add("docked");
        gsap.to(ball, {
            top: C.dockedTop, left: C.dockedLeft, right: "auto",
            scale: 1, opacity: 1, rotation: -720,
            width: C.dockedSize, height: C.dockedSize,
            xPercent: 0, yPercent: 0, duration: 0.5, ease: "back.out(1.4)",
            onComplete() {
                gsap.set(panel, { top: C.panelDockedTop, left: C.dockedLeft, right: "auto" });
                resetDepth();
                document.body.style.overflow = "";
                landing.style.display = "none";
                window.scrollTo(0, 0);
                phase = 4; setBusy(false);
                if (scrollTarget) setTimeout(() => scrollTarget.scrollIntoView({ behavior: "smooth" }), 100);
            }
        });
    }

    // --- Scroll handling ---

    function triggerBallEntry() {
        phase = 1; setBusy(true);
        ball.style.pointerEvents = "all";
        gsap.set(ball, { opacity: 1 });
        enterTL.play(0);
    }

    function onWheel(e) {
        if (busy || sommaireLocked) { e.preventDefault(); return; }
        if (phase === 0 && e.deltaY > 0) {
            e.preventDefault();
            const speed = Math.min(Math.abs(e.deltaY) / 100, 5);
            depth = Math.min(1, depth + C.depthBase * Math.max(1, speed));
            setDepth(depth);
            if (depth >= 1) triggerBallEntry();
        } else if (phase === 2 && e.deltaY > 0) {
            e.preventDefault();
            phase = 3; setBusy(true);
            closeSommaire(null);
        }
    }
    window.addEventListener("wheel", onWheel, { passive: false });

    // Touch
    let touchY = 0;
    window.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: false });
    window.addEventListener("touchmove", function (e) {
        if (busy || sommaireLocked) { e.preventDefault(); return; }
        const dy = touchY - e.touches[0].clientY;
        touchY = e.touches[0].clientY;
        if (phase === 0 && dy > 3) {
            e.preventDefault();
            const speed = Math.min(Math.abs(dy) / 20, 5);
            depth = Math.min(1, depth + C.depthBase * 2.5 * Math.max(1, speed));
            setDepth(depth);
            if (depth >= 1) triggerBallEntry();
        } else if (phase === 2 && dy > 3) {
            e.preventDefault(); phase = 3; setBusy(true); closeSommaire(null);
        }
    }, { passive: false });

    // --- Docked toggle ---

    let dockedTL = null;

    function buildDockedTL() {
        if (dockedTL) dockedTL.kill();
        const originX = C.dockedSize / 2;
        const originY = -(C.panelDockedTop - C.dockedTop - C.dockedSize / 2);
        const origin = originX + "px " + originY + "px";
        dockedTL = gsap.timeline({ paused: true });
        dockedTL
            .fromTo(panel,
                { clipPath: "circle(0% at " + origin + ")" },
                { clipPath: "circle(150% at " + origin + ")", duration: 0.45, ease: "power2.inOut" })
            .to(ball, { scale: 0, opacity: 0, duration: 0.25, ease: "power2.in" }, 0)
            .fromTo(spItems, { opacity: 0, y: 8 },
                { opacity: 1, y: 0, stagger: 0.05, duration: 0.25, ease: "power2.out" }, 0.2)
            .fromTo(spHint, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.35);
    }

    function openDocked() {
        if (dockedOpen) return;
        dockedOpen = true;
        buildDockedTL();
        panel.classList.add("open");
        dockedTL.play(0);
    }

    function closeDocked(cb) {
        if (!dockedOpen || !dockedTL) { if (cb) cb(); return; }
        dockedOpen = false;
        dockedTL.eventCallback("onReverseComplete", function () {
            dockedTL.eventCallback("onReverseComplete", null);
            panel.classList.remove("open");
            gsap.to(ball, { scale: 1, opacity: 1, duration: 0.2, ease: "power2.out" });
            if (cb) cb();
        });
        dockedTL.reverse();
    }

    ball.addEventListener("click", function (e) {
        if (phase !== 4 || busy) return;
        e.stopPropagation();
        dockedOpen ? closeDocked() : openDocked();
    });

    document.addEventListener("click", function (e) {
        if (phase !== 4 || !dockedOpen) return;
        if (ball.contains(e.target) || panel.contains(e.target)) return;
        closeDocked();
    });

    // --- Sommaire links ---

    panel.querySelectorAll(".sp-item").forEach(function (link) {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const target = document.querySelector(link.getAttribute("href"));
            if (phase === 2) {
                phase = 3; setBusy(true);
                closeSommaire(target);
            } else if (phase === 4 && dockedOpen) {
                closeDocked(() => { if (target) target.scrollIntoView({ behavior: "smooth" }); });
            }
        });
    });

    // --- Rolling on scroll (docked) ---

    const ballPattern = ball.querySelector(".ball-pattern");
    let rollAngle = 0, lastScrollY = window.scrollY, rollingTimer = null;

    window.addEventListener("scroll", function () {
        const y = window.scrollY;
        const dy = y - lastScrollY;
        lastScrollY = y;
        if (phase !== 4 || !ballPattern) return;
        rollAngle = (rollAngle + dy * 0.9) % 360;
        ballPattern.setAttribute("transform", "rotate(" + rollAngle.toFixed(2) + " 50 50)");
        ball.classList.add("rolling");
        clearTimeout(rollingTimer);
        rollingTimer = setTimeout(function () { ball.classList.remove("rolling"); }, 200);
    }, { passive: true });
}

// --- Scrollama ---

function initScrollama() {
    if (typeof scrollama === "undefined") return;
    scrollama()
        .setup({ step: ".act-section", offset: 0.4 })
        .onStepEnter(r => {
            const id = r.element.id;
            document.querySelectorAll("#sommaire .sp-item").forEach(a => {
                a.classList.toggle("current", a.getAttribute("data-act") === id);
            });
        });
}
