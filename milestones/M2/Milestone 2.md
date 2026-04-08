# Milestone 2 - The Reputation Gap

## Project Goal

**The Reputation Gap** is a data visualization project that questions one of football's most widely trusted numbers: the EA FC 25 Overall Rating.

Every summer, EA Sports releases ratings for thousands of professional footballers. For millions of fans and gamers, these numbers define how good a player "is." But EA's ratings aren't purely built on last season's statistics, they factor in reputation, marketability, and the judgment of volunteer scouts worldwide. A legendary player coasting through their final seasons can still carry a rating that their recent performances no longer justify. Meanwhile, a quietly excellent midfielder at a mid-table club might put up elite numbers while staying conservatively rated, simply because fewer people are watching.

This project puts those two things side by side: EA's perceived value on one hand, and real 2024–25 match data from FBref on the other. Using ~1,700 matched players across the top 5 European leagues, we compute a position-specific composite performance score from advanced metrics (Expected Goals, progressive carries, defensive actions, etc.) and compare it directly to each player's EA OVR. The gap between the two is what we call the **Reputation Gap**, a directional signal that surfaces who's overrated, who's underrated, and how much reputation distorts the way we see modern footballers.

The story unfolds in three acts :

**Act 1** shows the two worlds side by side: who EA thinks the best players are, and who the data says they are.

**Act 2** zooms into the gap itself : a scatter plot where every dot is a player, and distance from the trend line is the story. 

**Act 3** (planned) lets users rebuild the ratings themselves by adjusting the weights of each performance dimension.

## Visualizations

### Act 1: The Comparison

TODO: describe the split-screen ranking (top 10 EA vs top 10 Real per sub-position) + player modal (EA stats with percentiles, radar charts, composite score).

*Sketch: TODO insert screenshot of split-screen + modal*

### Act 2: The Reputation Gap

TODO: describe Guess the Gap intro (2 fixed examples) + scatter plot (OVR vs composite, regression line, gap encoding, filters by sub-position and league, sidebar top 5 overrated/underrated).

*Sketch: TODO insert screenshot of scatter plot*

### Act 3: Rebuild the Ratings (planned for M3)

TODO: describe interactive sliders for dimension weights, live recalculation of composite, ranking changes.

*Sketch: TODO insert wireframe of sliders + live ranking*

## Tools and Relevant Lectures

| Visualization | Tools | Relevant Lectures |
|---|---|---|
| Split-screen cards + player modal | D3.js, vanilla JS | TODO |
| Radar charts (percentile profiles) | D3.js SVG | TODO |
| Scatter plot + regression line | D3.js | TODO |
| Scrollytelling + animations | Scrollama, GSAP | TODO |
| Data pipeline (matching, normalization) | Python (pandas, rapidfuzz) | TODO |
| Position filters + interactivity | Vanilla JS, CSS | TODO |

## Implementation Breakdown

### Extra Ideas (enhancements, can be dropped)

- TODO: detailed player panels (heatmaps, passing, discipline, GK profile)
- TODO: multi-axis scatter (SHO vs npxG, DEF vs Tkl+Int, etc.)
- TODO: market value overlay (Transfermarkt)
- TODO: Act 3 interactive rating builder
- TODO: narrative insights + polished scrollytelling

## Functional Prototype

The website is live at: TODO insert URL

Current state: TODO describe what is implemented and running.
