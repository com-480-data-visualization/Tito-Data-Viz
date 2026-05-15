function initDatasetIntro(data) {
    const finalEl = document.getElementById("di-final-count");
    const leaguesEl = document.getElementById("di-leagues");
    const avgEl = document.getElementById("di-averages");
    if (!finalEl || !leaguesEl || !avgEl || !data || !data.length) return;

    finalEl.textContent = data.length.toLocaleString();

    const leagueClass = { "PL": "l-pl", "La Liga": "l-laliga", "Serie A": "l-seriea", "Bundesliga": "l-bundes", "Ligue 1": "l-ligue1" };
    const leagueName  = { "PL": "Premier League" };
    const counts = {};
    data.forEach(p => { counts[p.league] = (counts[p.league] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const total = data.length;
    const maxN = sorted.length ? sorted[0][1] : 1;
    leaguesEl.innerHTML = sorted.map(([name, n]) => {
        const pct = (n / total) * 100;
        const widthPct = (n / maxN) * 100;
        const cls = leagueClass[name] || "l-default";
        const display = leagueName[name] || name;
        const tip = display + ": " + n + " players (" + pct.toFixed(1) + "%)";
        return '<div class="league-row" data-tip="' + tip + '">' +
               '<span class="lr-name">' + display + '</span>' +
               '<span class="lr-track">' +
                   '<span class="lr-fill ' + cls + '" data-width="' + widthPct.toFixed(2) + '" style="width:0%"></span>' +
               '</span>' +
               '<span class="lr-count">' + n + '</span>' +
               '<span class="lr-pct">' + pct.toFixed(1) + '%</span>' +
               '</div>';
    }).join("");

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const ages = data.filter(p => p.age != null).map(p => p.age);
    const mins = data.filter(p => p.minutes != null).map(p => p.minutes);
    const ovrs = data.filter(p => p.ea && p.ea.ovr != null).map(p => p.ea.ovr);

    const countLabel = data.length.toLocaleString();
    const tiles = [
        { val: avg(ages).toFixed(1), label: "Avg age", unit: "years old",
          tip: "Average age of the " + countLabel + " players in the final sample. Senior football skews towards 25-29; a low average signals a younger top-5 cohort." },
        { val: Math.round(avg(mins)).toLocaleString(), label: "Avg minutes", unit: "played in 24-25",
          tip: "Average league minutes played per player in 2024-25. A full 38-game starter sits around 3,420 minutes; the average is dragged down by rotation players and mid-season transfers." },
        { val: avg(ovrs).toFixed(1), label: "Avg EA OVR", unit: "out of 99",
          tip: "Average EA Overall Rating across the sample. The distribution is narrow (most players cluster in 70-82), which is why even small gaps in OVR translate into meaningful differences on the pitch." }
    ];
    avgEl.innerHTML = tiles.map(t =>
        '<div class="avg-tile" data-tip="' + t.tip.replace(/"/g, '&quot;') + '">' +
            '<div class="avg-val">' + t.val + '</div>' +
            '<div class="avg-label">' + t.label + '</div>' +
            '<div class="avg-unit">' + t.unit + '</div>' +
        '</div>'
    ).join("");

    const datasetSection = document.querySelector(".dataset-intro");
    if (datasetSection && typeof attachDataTip === "function") {
        attachDataTip(datasetSection);
    }
}
