function initGuessTheGap(data) {
    const container = document.getElementById("guess-the-gap");
    if (!container) return;
    const act = document.getElementById("act2");
    if (act) act.classList.add("act2-locked");

    const EXAMPLES = [
        { name: "Antoine Griezmann", type: "overrated",
          context: "Despite an OVR of 88, Griezmann's real output this season ranks him well below what that rating predicts among Strikers." },
        { name: "Omar Marmoush", type: "underrated",
          context: "With only 79 OVR, Marmoush was the standout Striker of the season at Frankfurt, earning a mid-season transfer to Man City." }
    ];

    const players = EXAMPLES.map(ex => data.find(d => d.name === ex.name && d.gap != null)).filter(Boolean);
    if (players.length < 2) {
        container.style.display = "none";
        if (act) act.classList.remove("act2-locked");
        return;
    }

    let current = 0;

    function showCard(i) {
        const p = players[i];
        const ex = EXAMPLES[i];
        const isOver = p.gap < 0;
        const subLabel = SUBPOS_LABELS[p.subPos] || p.subPos;

        container.innerHTML =
            '<div class="act-bridge-head act2-gate-head">' +
                '<span class="bridge-kicker">Act 2</span>' +
                '<h2 class="bridge-quote">The Reputation Gap' +
                    '<span class="info-i act2-title-info" data-info="For each sub-position, we fit a regression line between OVR and the real composite. It answers: among players EA rates this high at this position, what composite do they usually deliver? Above the line = outperforms peers with the same OVR. Below = underperforms. The Reputation Gap is the vertical distance to that trend.">i</span>' +
                '</h2>' +
                '<p class="bridge-sub">EA Sports rewards reputation, scouting, and marketability. Match data keeps a colder memory. Choose one player through both lenses and see where the rating breaks apart.</p>' +
            '</div>' +
            '<div class="guess-card">' +
                '<div class="guess-topline">' +
                    '<span class="guess-kicker">Overrated / Underrated</span>' +
                    '<span class="guess-progress">' + (i + 1) + ' / ' + players.length + '</span>' +
                '</div>' +
                '<h3 class="guess-title">Choose the badge or choose the season?</h3>' +
                '<p class="guess-prompt">The rest of Act 2 stays closed until this choice is made.</p>' +
                '<div class="guess-fut-card">' +
                    '<div class="guess-avatar-wrap">' + avatarHTMLString(p.photo, p.name, "guess-avatar-img", "guess-avatar") + '</div>' +
                    '<div>' +
                        '<div class="guess-name">' + p.name + '</div>' +
                        '<div class="guess-club">' + p.club + ' &middot; ' + subLabel + '</div>' +
                    '</div>' +
                    '<div class="guess-ovr">' + p.ea.ovr + '</div>' +
                '</div>' +
                '<div class="guess-buttons">' +
                    '<button class="guess-btn guess-btn-over" data-choice="overrated">Overrated</button>' +
                    '<button class="guess-btn guess-btn-under" data-choice="underrated">Underrated</button>' +
                '</div>' +
                '<div class="guess-result" id="guess-result"></div>' +
            '</div>';
        if (typeof initInfoTooltips === "function") initInfoTooltips();

        container.querySelectorAll(".guess-btn").forEach(btn => {
            btn.addEventListener("click", function () {
                const choice = btn.dataset.choice;
                const correct = (isOver && choice === "overrated") || (!isOver && choice === "underrated");

                container.querySelectorAll(".guess-btn").forEach(b => b.disabled = true);
                btn.classList.add("chosen");

                const label = isOver ? "overrated" : "underrated";
                const gapColor = isOver ? "var(--red)" : "var(--green)";

                document.getElementById("guess-result").innerHTML =
                    '<div class="guess-reveal ' + label + '">' +
                        (correct ? "Correct! " : "Not quite! ") +
                        p.name + ' is <strong>' + label + '</strong> by EA.' +
                    '</div>' +
                    '<div class="guess-stats-row">' +
                        '<div class="guess-stat"><span class="guess-stat-label c-gold">EA OVR</span><span class="guess-stat-val">' + p.ea.ovr + '</span></div>' +
                        '<div class="guess-stat"><span class="guess-stat-label c-blue">Real Composite</span><span class="guess-stat-val">' + p.composite.toFixed(1) + '</span></div>' +
                        '<div class="guess-stat"><span class="guess-stat-label" style="color:' + gapColor + '">Gap</span><span class="guess-stat-val" style="color:' + gapColor + '">' + formatGap(p.gap) + '</span></div>' +
                    '</div>' +
                    '<div class="guess-context">' + ex.context + '</div>' +
                    '<button class="guess-continue-btn" type="button">' + (i + 1 < players.length ? "Continue" : "Unlock Act 2") + '</button>';

                document.getElementById("guess-result").classList.add("revealed");
                const nextBtn = container.querySelector(".guess-continue-btn");
                if (nextBtn) {
                    nextBtn.addEventListener("click", () => {
                        current++;
                        if (current < players.length) showCard(current);
                        else showDone();
                    });
                }
            });
        });
    }

    function showDone() {
        container.innerHTML =
            '<div class="act-bridge-head act2-gate-head">' +
                '<span class="bridge-kicker">Act 2</span>' +
                '<h2 class="bridge-quote">The Reputation Gap</h2>' +
                '<p class="bridge-sub">EA gives you the badge. Match data gives you the season. Now the full Reputation Gap opens.</p>' +
            '</div>' +
            '<div class="guess-card guess-done">' +
                '<span class="guess-kicker">Act 2 unlocked</span>' +
                '<h3 class="guess-title">Now the gap has a shape.</h3>' +
                '<p>The <strong>Reputation Gap</strong> measures this mismatch for every player.</p>' +
                '<p class="guess-done-sub">The gap is the distance between real composite score and what a regression model predicts from EA OVR, within each sub-position.</p>' +
                '<button class="guess-open-btn" type="button">Open the scatter</button>' +
            '</div>';
        if (act) {
            act.classList.remove("act2-locked");
            act.classList.add("act2-unlocked");
        }
        const btn = container.querySelector(".guess-open-btn");
        if (btn) {
            btn.addEventListener("click", function () {
                const target = document.querySelector(".act2-signal-head");
                if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    showCard(0);

    window.unlockAct2Gate = function () {
        if (!act || !act.classList.contains("act2-locked")) return;
        showDone();
    };
}
