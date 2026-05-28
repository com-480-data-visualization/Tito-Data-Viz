let DATA = [];

if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}

document.addEventListener("DOMContentLoaded", function () {
    window.scrollTo(0, 0);
    fetch("data/players.json")
        .then(r => r.json())
        .then(d => { DATA = d; boot(); })
        .catch(() => boot());
});

function boot() {
    initInfoTooltips();
    initBall();
    initProgressRail();
    initActIndicator();
    initScrollama();
    initDatasetIntro(DATA);
    initAct1StoryMotion();
    initOpeningChoreography();
    if (typeof window.initDatasetDossiers === "function") window.initDatasetDossiers(DATA);
    initAct1(DATA);
    initGuessTheGap(DATA);
    initScatter(DATA);
    initWallOfFameShame(DATA);
    initOverlay(DATA);
    initLeagueMap(DATA);
    initAct3(DATA);
    initConclusion(DATA);

    // links straight to act2/act3 skip the guess gate
    document.addEventListener("click", function (e) {
        const link = e.target.closest("[data-act]");
        if (!link) return;
        const act = link.getAttribute("data-act");
        if ((act === "act2" || act === "act3") && typeof window.unlockAct2Gate === "function") {
            window.unlockAct2Gate();
        }
    });
}

function initScrollama() {
    if (typeof scrollama === "undefined") return;
    scrollama()
        .setup({ step: ".act-section, .conclusion-section", offset: 0.4 })
        .onStepEnter(r => {
            const id = r.element.id;
            document.querySelectorAll("#sommaire .sp-item").forEach(a => {
                a.classList.toggle("current", a.getAttribute("data-act") === id);
            });
        });
}
