# Milestone 2: The Reputation Gap

**The Reputation Gap** questions one of football's fans most trusted numbers: the EA FC 25 Overall Rating. EA's ratings blend recent statistics with reputation, marketability and volunteer-scout opinion, so legendary players can coast on old glory while quietly excellent midfielders at mid-table clubs stay underrated.

We put EA's perceived value next to real 2024–25 match data from **FBref**, complemented by **Transfermarkt** for player profiles, market values and injury history. On about 1,700 matched players (600+ minutes, top 5 European leagues), we compute a position-specific **composite** from advanced metrics (xG, progressive carries, defensive actions, etc.) and compare it to each player's EA OVR. That distance is the **Reputation Gap**: a directional signal of who is overrated, who is underrated, and how much reputation distorts the way we see modern footballers.

The story unfolds in three acts: **Act 1** shows the two worlds side by side, **Act 2** plots every player and turns the disagreement into a measurable quantity and finally **Act 3** hands the ratings over to the user so they can rebuild them under their own assumptions.

### Act 1: The Comparison

Act 1 presents two ranked top-10 lists facing each other: EA OVR on the left, our real-performance composite on the right, filtered by sub-position (Strikers, Wingers, Central Midfielders, etc.) so the comparison is always fair. The composite is built by percentile-ranking each relevant FBref stat within the sub-position, averaging the dimension scores with position-specific weights, and rescaling the result to roughly match the EA OVR distribution. Animated lines connect players present in both columns, making disagreements impossible to miss. Clicking any card opens a **player modal** combining EA sub-ratings, real percentiles shown as a radar chart, and a Transfermarkt profile panel (market value, nationality, injuries), so users can see *why* a player ranks where they do: finishing, creation, or defensive output.

![Split-screen ranking: EA OVR vs real composite.](figures/act1-split.png)

![Player modal with EA sub-ratings and real percentiles.](figures/act1-modal.png)

### Act 2: The Reputation Gap

A short **Guess the Gap** warm-up shows a card with a player's photo, club, position and EA OVR, and asks the user to commit: *overrated or underrated?* The examples (Griezmann overrated, Marmoush underrated) are chosen to surprise and prime the reader to question their assumptions before seeing the full picture.

The core view is an **interactive scatter plot**: horizontal axis = EA OVR, vertical axis = real composite. A per-sub-position dashed regression line defines the *expected composite*, the output you would predict from a given OVR if EA were perfectly calibrated. Distance to that line is the Reputation Gap: green above (underrated), red below (overrated), grey near the line (fair). Dot size encodes minutes played, keeping full-season regulars visually prominent. Two filters control the view: a **sub-position toggle** (ST, WG, AM, CM, etc.), which also re-fits the regression, and a **league dropdown** (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, or all). A **sidebar** surfaces the top 5 overrated and top 5 underrated players for the current filter; hovering a row highlights its dot and vice versa, linking individual cases to the aggregate view.

![Guess the Gap warm-up before the scatter.](figures/act2-intro.png)

![Main scatter: DM position, Premier League filter, sidebar.](figures/act2-scatter.png)

### Act 3: Rebuild the Ratings

Act 3 addresses a limitation of Act 2: our composite is not objective either. We fixed the weights of each performance dimension, and a different analyst would have chosen differently. Act 3 therefore hands the weights over to the user in four steps:

1. **Position picker:** The user selects a sub-position by clicking a slot on an interactive line-up, like an EA FC team sheet.
2. **Opinion quiz:** Non-technical questions (*"One winger: the one who scores 20, or the one who sets up 20?"*) silently map to weight adjustments, so the user builds a personalized profile without having to read any metric definitions.
3. **Sliders, presets and ideal-profile view:** The quiz weights become editable sliders for manual refinement. Presets ("EA-like", "Balanced", "Ours", "Defensive", "Creative") allow comparison. A **ternary plot** places every real player and the user's current weights inside a triangle of the three dominant attributes of the role, making it visually obvious which players sit closest to the user's ideal.
4. **Live impact panel:** A paginated right-hand panel updates in real time and offers several complementary views: a re-ranked top list with biggest movers, a live scatter callback to Act 2 whose dots slide as sliders move, a split-screen bump chart callback to Act 1, and a divergent bar chart of gaps.

Act 3 closes the narrative: the Reputation Gap is real and measurable, but its exact shape depends on what the viewer values. A rating is as much about the person producing it as the player being rated.

![Act 3: line-up picker, sliders with presets, live-impact panel.](figures/act3.png)

### Tools and Relevant Lectures

| Block | Tools | Relevant Lectures |
|---|---|---|
| Global layout, scrollytelling, ball-button nav | HTML, CSS, SVG, Vanilla JS, Scrollama, GSAP | Web dev; JS; More JS; Interaction; Designing viz; Storytelling |
| Act 1, split rankings, modal, radar | D3.js, SVG, Vanilla JS | D3; Interactive D3; Marks & channels; Perception & colors; Tabular data; Interaction |
| Act 2, scatter, filters, over/underrated sidebar | D3.js, Vanilla JS | D3; Interactive D3; Tabular data; Interaction; Marks & channels; Perception & colors; Do's & don'ts; Storytelling |
| Act 3, line-up, quiz, sliders, ternary, impact panel | D3.js, SVG, Vanilla JS | Interaction; Interactive D3; Marks & channels; Perception & colors; Designing viz |
| Data pipeline: FBref + Transfermarkt merge, fuzzy name matching, per-position composite | Python (pandas, numpy, rapidfuzz) | Data |

### Extra Ideas (enhancements, can be dropped)

- **Random Guess the Gap replay** after Act 3, testing the user's intuition on unseen players once they have built their own weights.
- **Extra leagues** beyond the top 5 (Portugal, Netherlands, Saudi Pro League), pending an additional data source.
- **Age overlay on the scatter** to test the "legendary players coasting on reputation" hypothesis visually.
- **Context callouts** explaining why defenders from dominant clubs look weak in the composite (their team keeps the ball, so they face fewer actions per 90 than defenders at smaller clubs).
- **Share your profile** from Act 3 as a link or image.
- **FC 25 to FC 26 drift.** Did EA actually upgrade the players our composite flagged as underrated, and downgrade the overrated ones? A retrospective check on whether the Reputation Gap predicts EA's own corrections.
- **Transfermarkt market-value revaluation as ground truth.** Cross-check the Reputation Gap against each player's end-of-season market-value change on Transfermarkt: did the market revalue the players we flagged as underrated and devalue the overrated ones?

### Functional Prototype

Live at: [com-480-data-visualization.github.io/Tito-Data-Viz](https://com-480-data-visualization.github.io/Tito-Data-Viz/)

The prototype already delivers the landing page, the global ball-button navigation, and a first working pass of Acts 1 and 2: split-screen rankings with the player modal for Act 1, and the Guess the Gap intro followed by the interactive scatter (filters and over/underrated sidebar) for Act 2. The data pipeline is complete and the merged dataset is served as a static JSON file. M3 will polish these two acts and build Act 3 on top of them.
