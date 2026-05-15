# The Reputation Gap

Scrollytelling site about EA FC 25 player ratings vs real 2024-25 match
data. Built for COM-480 (Data Visualization, EPFL).

**Live demo:** https://com-480-data-visualization.github.io/Tito-Data-Viz/

**Process book:** [milestones/M3/process-book.pdf](milestones/M3/process-book.pdf)

**Screencast:** [milestones/M3/screencast.mp4](milestones/M3/screencast.mp4)

Scroll through the three acts on a desktop browser. The floating ball in
the top left opens the section nav.

| Student | SCIPER |
| ------- | ------ |
| Youssef Jeddi | 355976 |
| Omar Bouden | 341381 |
| Alexis Allemand | 355689 |

## Story

The site is in three acts.

1. **Two Worlds, Two Truths.** EA's top 10 next to a top 10 built from
   FBref per-90 stats, switchable by sub-position.
2. **The Reputation Gap.** A scatter, a wall of fame / wall of shame
   ledger, a league map that drills into a per-club stadium view, and a
   multi-player radar overlay. All four show where a player's real
   composite sits relative to what their EA OVR would predict.
3. **Rebuild the Ratings.** The reader picks a position, sets their own
   dimension weights with sliders or a short guided quiz, and watches the
   top 10 reshuffle live. A six-player taste test at the end checks
   whether their picks line up with their own weights.

## Stack

- HTML, CSS, vanilla JavaScript, no framework
- [D3.js v7](https://d3js.org/)
- [Scrollama 3](https://github.com/russellsamora/scrollama)
- [GSAP 3](https://greensock.com/gsap/) for the ball menu and Act 3 transitions
- [TopoJSON client](https://github.com/topojson/topojson-client) for the league map
- Python (`pandas`, `numpy`, `rapidfuzz`) for the data pipeline

## Running locally

The site is fully static, served from `docs/`. Any local HTTP server works:

```bash
cd docs
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

`docs/data/players.json` is committed, so the site runs as-is. To
regenerate it from the raw CSVs:

```bash
pip install -r requirements.txt
python docs/scripts/build_data.py
```

## Data

- **EA FC 25** in-game ratings, 17,737 player cards.
- **FBref** 2024-25 per-90 metrics across the top five European leagues
  (Premier League, La Liga, Bundesliga, Serie A, Ligue 1).
- **Transfermarkt** profile, market value history and injury data, used
  for the context shown inside player modals.

The final sample is 1,708 players with at least 600 league minutes in
2024-25 and a confirmed name match between EA and FBref. For each
sub-position, every relevant stat is percentile-ranked within that role,
combined as a weighted average, and rescaled to share the EA OVR mean
and spread. The Reputation Gap is the residual from a linear regression
of that composite on OVR, fit per sub-position.

## Project structure

```
docs/                       served as the site root
  index.html                entry point, scroll narrative
  css/                      base, landing, chrome and per-act stylesheets
  js/                       vanilla JS modules, loaded in order from index.html
  data/players.json         the 1,708 player sample
  scripts/build_data.py     merges EA + FBref + Transfermarkt into players.json
datasets/                   raw input CSVs (EA, FBref, Transfermarkt, clubs)
milestones/                 M1, M2, M3 deliverables
```

## Credits

EPFL, COM-480 Data Visualization, spring 2026.
