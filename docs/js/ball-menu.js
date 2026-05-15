// phase: 0 title, 1 entering, 2 sommaire, 3 closing, 4 docked
function initBall() {
    const ball = document.getElementById("the-ball");
    const panel = document.getElementById("sommaire");
    const landing = document.getElementById("landing");
    const intro = document.getElementById("intro");
    if (!ball || !panel || !landing) return;

    const C = {
        ballSize: 52, dockedSize: 38,
        dockedTop: 16, dockedLeft: 16,
        panelWidth: 340, panelDockedTop: 62,
        depthBase: 0.035, busyTimeout: 3600
    };

    let phase = 0, depth = 0, busy = false, busyTimer = null, dockedOpen = false, sommaireLocked = false;
    let hintHidden = false, hintArmedUntil = 0;

    const spItems = panel.querySelectorAll(".sp-item");
    const spHint = panel.querySelector(".sp-hint");

    if (window.location.hash) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    landing.style.display = "";
    panel.classList.remove("open");
    panel.style.clipPath = "circle(0% at 0px 0px)";
    ball.classList.remove("docked", "rolling");
    document.body.classList.remove("prologue-opening");
    if (intro) gsap.set(intro, { clearProps: "display,clipPath" });
    document.body.classList.add("landing-active");
    document.body.style.overflow = "hidden";
    jumpToTop();
    requestAnimationFrame(jumpToTop);

    function jumpToTop() {
        const root = document.documentElement;
        const oldRootBehavior = root.style.scrollBehavior;
        const oldBodyBehavior = document.body.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        document.body.style.scrollBehavior = "auto";
        root.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        root.style.scrollBehavior = oldRootBehavior;
        document.body.style.scrollBehavior = oldBodyBehavior;
    }

    const el = {
        lab: landing.querySelector(".landing-label"),
        ttl: landing.querySelector(".landing-title"),
        sub: landing.querySelector(".landing-subtitle"),
        scr: landing.querySelector(".scroll-indicator")
    };
    const landingArtifacts = [el.lab, el.ttl, el.sub, el.scr, landing.querySelector(".pitch-marks")].filter(Boolean);
    const dockHint = document.createElement("div");
    dockHint.className = "ball-dock-hint";
    dockHint.innerHTML = '<span class="bdh-arrow" aria-hidden="true"></span><span>Click the ball for the summary</span>';
    dockHint.setAttribute("aria-hidden", "true");
    document.body.appendChild(dockHint);

    gsap.set(landing, { opacity: 1 });
    gsap.set(landingArtifacts, { opacity: 1, clearProps: "filter" });
    gsap.set(dockHint, { opacity: 0, x: -8, pointerEvents: "none" });

    gsap.set(ball, {
        top: "52%",
        left: "calc(100% + 74px)",
        right: "auto",
        xPercent: -50,
        yPercent: -50,
        opacity: 0,
        transformOrigin: "50% 50%"
    });

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
            scale: 1, opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0
        });
        ball.classList.add("docked");
        resetDepth();
        document.body.style.overflow = "";
        document.body.classList.remove("landing-active");
        document.body.classList.remove("prologue-opening");
        landing.style.display = "none";
        phase = 4; busy = false; dockedOpen = false;
        showDockHint();
    }

    function setDepth(t) {
        const s = 1 - t * 0.22, o = 1 - t * 0.82;
        const targets = [el.lab, el.ttl, el.sub].filter(Boolean);
        gsap.set(targets, { scale: s, opacity: o });
        if (el.scr) gsap.set(el.scr, { opacity: Math.max(0, 1 - t * 4) });
    }

    function resetDepth() {
        gsap.to([el.lab, el.ttl, el.sub, el.scr].filter(Boolean), {
            scale: 1, opacity: 1, duration: 0.45, ease: "power2.out"
        });
        depth = 0;
    }

    function placeDockHint() {
        const gap = 12;
        dockHint.style.left = (C.dockedLeft + C.dockedSize + gap) + "px";
        dockHint.style.top = (C.dockedTop + C.dockedSize / 2) + "px";
    }

    function showDockHint() {
        if (hintHidden) return;
        hintArmedUntil = performance.now() + 900;
        placeDockHint();
        dockHint.classList.add("visible");
        gsap.to(dockHint, { opacity: 1, x: 0, duration: 0.28, ease: "power2.out", pointerEvents: "none" });
    }

    function hideDockHint(force) {
        if (hintHidden) return;
        if (!force && performance.now() < hintArmedUntil) return;
        hintHidden = true;
        dockHint.classList.remove("visible");
        gsap.to(dockHint, { opacity: 0, x: -6, duration: 0.18, ease: "power2.out", pointerEvents: "none" });
    }

    window.addEventListener("resize", function () {
        if (!hintHidden && dockHint.classList.contains("visible")) placeDockHint();
    });

    const enterTL = gsap.timeline({ paused: true, onComplete: onBallArrived });
    enterTL
        .set(ball, {
            opacity: 1,
            left: "calc(100% + 74px)",
            right: "auto",
            top: "52%",
            xPercent: -50,
            yPercent: -50,
            scale: 0.22,
            rotation: 0,
            transformOrigin: "50% 50%"
        })
        .to(ball, {
            left: "50%",
            top: "45.5%",
            scale: 0.78,
            rotation: -360,
            duration: 0.52,
            ease: "power3.out"
        })
        .to(ball, { top: "50.5%", scale: 1.04, rotation: -610, duration: 0.24, ease: "sine.inOut" })
        .to(ball, { top: "49.2%", scale: 0.98, rotation: -680, duration: 0.12, ease: "sine.out" })
        .to(ball, { top: "50%", scale: 1, rotation: -720, duration: 0.18, ease: "sine.inOut" });

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

    function onBallArrived() {
        phase = 3;
        setTimeout(openPrologueFromBall, 160);
    }

    function openPrologueFromBall() {
        if (!intro) {
            dockBall(null);
            return;
        }
        document.body.classList.add("prologue-opening");
        const inner = intro.querySelector(".intro-inner");
        gsap.killTweensOf(landingArtifacts);
        gsap.to(landingArtifacts, {
            opacity: 0,
            duration: 0.16,
            ease: "power2.out"
        });
        gsap.set(intro, {
            display: "flex",
            clipPath: "circle(0% at 50% 50%)"
        });
        if (inner) gsap.set(inner, { opacity: 0, y: 18, scale: 0.985 });
        gsap.timeline({
            onComplete() {
                dockBall(null, function () {
                    gsap.set(intro, { clearProps: "display,clipPath" });
                    if (inner) gsap.set(inner, { clearProps: "opacity,transform" });
                    document.body.classList.remove("prologue-opening");
                });
            }
        })
            .to(intro, { clipPath: "circle(145% at 50% 50%)", duration: 0.58, ease: "power2.inOut" }, 0)
            .to(ball, { scale: 0.72, rotation: -820, duration: 0.42, ease: "power2.inOut" }, 0)
            .to(inner, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power2.out" }, 0.18);
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

    function dockBall(scrollTarget, afterDock) {
        const rect = ball.getBoundingClientRect();
        const visualSize = Math.max(1, rect.width);
        const dockScale = C.dockedSize / visualSize;
        clearTimeout(busyTimer);
        busyTimer = null;
        busy = true;
        ball.classList.remove("docked");
        gsap.set(ball, {
            top: rect.top,
            left: rect.left,
            right: "auto",
            width: visualSize,
            height: visualSize,
            x: 0,
            y: 0,
            xPercent: 0,
            yPercent: 0,
            scale: 1,
            opacity: 1
        });
        gsap.to(ball, {
            x: C.dockedLeft - rect.left,
            y: C.dockedTop - rect.top,
            scale: dockScale, opacity: 1, rotation: -720,
            duration: 0.58, ease: "power3.inOut",
            onComplete() {
                gsap.set(ball, {
                    top: C.dockedTop, left: C.dockedLeft, right: "auto",
                    width: C.dockedSize, height: C.dockedSize,
                    scale: 1, x: 0, y: 0, xPercent: 0, yPercent: 0
                });
                gsap.set(panel, { top: C.panelDockedTop, left: C.dockedLeft, right: "auto" });
                if (!document.body.classList.contains("prologue-opening")) resetDepth();
                jumpToTop();
                if (afterDock) afterDock();
                document.body.classList.remove("landing-active");
                landing.style.display = "none";
                phase = 4; setBusy(false);
                document.body.style.overflow = "";
                ball.classList.add("docked");
                showDockHint();
                if (scrollTarget) setTimeout(() => scrollTarget.scrollIntoView({ behavior: "smooth" }), 100);
            }
        });
    }

    function triggerBallEntry() {
        phase = 1; setBusy(true);
        ball.style.pointerEvents = "all";
        gsap.set(ball, { opacity: 1 });
        enterTL.play(0);
    }

    function onWheel(e) {
        if (phase === 4) hideDockHint(false);
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

    let touchY = 0;
    window.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: false });
    window.addEventListener("touchmove", function (e) {
        if (phase === 4) hideDockHint(false);
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
        hideDockHint(true);
        dockedOpen ? closeDocked() : openDocked();
    });

    document.addEventListener("click", function (e) {
        if (phase !== 4 || !dockedOpen) return;
        if (ball.contains(e.target) || panel.contains(e.target)) return;
        closeDocked();
    });

    panel.querySelectorAll(".sp-item").forEach(function (link) {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            const target = document.querySelector(link.getAttribute("href"));
            const act = link.getAttribute("data-act");
            if ((act === "act2" || act === "act3") && typeof window.unlockAct2Gate === "function") {
                window.unlockAct2Gate();
            }
            if (phase === 2) {
                phase = 3; setBusy(true);
                closeSommaire(target);
            } else if (phase === 4 && dockedOpen) {
                closeDocked(() => { if (target) target.scrollIntoView({ behavior: "smooth" }); });
            }
        });
    });

    const ballPattern = ball.querySelector(".ball-pattern");
    let rollAngle = 0, lastScrollY = window.scrollY, rollingTimer = null;

    window.addEventListener("scroll", function () {
        if (phase === 4 && window.scrollY > 2) hideDockHint(false);
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
