function initGuessTheGap(data) {
    const container = document.getElementById("guess-the-gap");
    if (!container) return;

    const EXAMPLES = [
        { name: "Antoine Griezmann", type: "overrated",
          context: "Despite an OVR of 88, Griezmann's real output this season ranks him well below what that rating predicts among Strikers." },
        { name: "Omar Marmoush", type: "underrated",
          context: "With only 79 OVR, Marmoush was the standout Striker of the season at Frankfurt, earning a mid-season transfer to Man City." }
    ];

    const players = EXAMPLES.map(ex => data.find(d => d.name === ex.name && d.gap != null)).filter(Boolean);
    if (players.length < 2) { container.style.display = "none"; return; }

    let current = 0;

    function showCard(i) {
        const p = players[i];
        const ex = EXAMPLES[i];
        const isOver = p.gap < 0;
        const subLabel = SUBPOS_LABELS[p.subPos] || p.subPos;

        container.innerHTML =
            '<div class="guess-card">' +
                '<p class="guess-prompt">Is this player overrated or underrated by EA FC 25?</p>' +
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
                    '<div class="guess-context">' + ex.context + '</div>';

                document.getElementById("guess-result").classList.add("revealed");

                setTimeout(() => {
                    current++;
                    if (current < players.length) showCard(current);
                    else showDone();
                }, 3500);
            });
        });
    }

    function showDone() {
        container.innerHTML =
            '<div class="guess-card guess-done">' +
                '<p>The <strong>Reputation Gap</strong> measures this mismatch for every player.</p>' +
                '<p class="guess-done-sub">The gap is the distance between real composite score and what a regression model predicts from EA OVR, within each sub-position. Explore the scatter below.</p>' +
            '</div>';
    }

    showCard(0);
}
