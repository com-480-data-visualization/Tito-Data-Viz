# Milestone 1


## Datasets

To bridge the gap between EA's scores and real-world performance, we combined two complementary datasets: one capturing how EA perceives players, the other capturing how they actually performed on the pitch this season.

### 1. EA FC 25 Ratings (`fc25_players.csv`)

> **Source:** [EA Sports FC 25 Database, Ratings and Stats](https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats)

This dataset covers **17,737 players** across **56 columns**, including identity data (age, club, nation, position), 7 core composite ratings (`OVR`, `PAC`, `SHO`, `PAS`, `DRI`, `DEF`, `PHY`) on a 0–99 scale, 29 individual sub-attributes, and 5 goalkeeper-specific ratings.

The final score blends positional weighting, league modifiers, and a reputation bonus of up to +3, none of which reflect last season's output. That gap is what this project sets out to measure.

> *Preprocessing: parsed height/weight into numeric cm/kg, separated GK and outfield subsets, tokenized playstyle tags. Restricted to top-5 male leagues to match FBref scope.*

### 2. Real 2024–25 Stats (`players_data-2024_2025.csv`)

> **Source:** [Football Players Stats 2024–2025](https://www.kaggle.com/datasets/hubertsidorowicz/football-players-stats-2024-2025)

For those unfamiliar with football analytics, FBref is one of the most comprehensive and respected public sources of professional football data.

This dataset covers **2,854 players** from the top 5 European leagues. It merges 9 FBref statistical tables into 267 columns, reduced to **170 usable columns** after removing redundant identity fields.

Beyond goals and assists, FBref provides a much richer picture: expected goals (xG) and expected assisted goals (xAG) to measure attacking contribution independent of finishing luck, shot-creating actions to capture playmaking, progressive carries and passes to quantify ball progression, defensive duels and interceptions for defenders, and Post-Shot xG for goalkeepers, giving each position its own set of relevant performance metrics.

> *Preprocessing: we dropped 97 duplicate columns, filtered players under 300 min played (−24%, 686 rows), standardized nationality codes, mapped FBref positions to EA equivalents.*

---

## Problematic


Last year, EA Sports assigned every player a single overall rating in its game FC 25. This number is not simply a reflection of the previous season. It blends positional attribute weighting, a league-level modifier, and an international reputation bonus of up to +3 overall, all assessed by more than 6,000 volunteer scouts worldwide. It is subjective by design. This project compares those game ratings against actual 2024–25 advanced match data (FBref) to answer one central question: **which players actually earned their rating, and which ones didn't?**

**Main Axis & What We Want to Show:**
The core axis of this visualization is the "Reputation Gap", the distance between a player's perceived value (EA Overall Rating) and their actual on-pitch efficiency (metrics like expected Goals, progressive carries, and defensive actions). Through this lens, the visualization will expose two distinct groups:
* **The "Legacy" Stars:** Famous players whose high video game ratings significantly outpace their real-world 2024–25 output.
* **The "Hidden Gems":** Highly productive players who deliver elite stats but remain conservatively rated by EA's scouts because they are less famous or play for smaller clubs.

**Motivation:**
Video game ratings heavily influence how millions of football fans perceive real-life players. Our motivation is to pierce through this subjective hype using advanced data analytics, visually demonstrating how reputation biases and league popularity can distort the evaluation of modern athletes. 

**Target Audience:**
This visualization is designed for **football fans, FC 25 gamers, and sports data enthusiasts**. We want to provide an intuitive, engaging tool for gamers to discover underrated talent, and for data analysts to see advanced football metrics translated into a highly relatable, pop-culture context.

---

## Exploratory Data Analysis

### Rating distributions

Restricted to the top-5 male leagues (2,612 players), FC 25 OVR (Overall Rating) is right-skewed (mean 73.3, median 74, σ 6.4): only 2.3% of players exceed 85. Among the seven composites, `PAC` leads (mean 70.8) while `DEF` has the lowest mean (56.7) and widest spread (σ 17.9), positional variance that makes position-aware normalization essential.

![Composite rating distributions](https://github.com/user-attachments/assets/dc6e98f3-ec27-4bbe-a76e-2395ab73ce04)

*Figure 1: Distribution of the 7 composite ratings. `DEF` stands out for its high variance, driven by the contrast between defenders and forwards.*

![OVR by position and league](https://github.com/user-attachments/assets/67dfd1cd-0ea6-4a0f-a53c-045d055ab99d)

*Figure 2: OVR by position and league in the top-5 male leagues; IQR 70–77, mean 73.3, median 74, with only 2.3% exceeding 85.*

### Real-world stats

After the 300-minute filter, 2,168 players remain across the top 5 leagues (DEF 34%, MID 20%, CAM 19%, ATT 12%, GK 8%, CDM 7%) with league sizes between 387 and 474. Goals and assists are zero-inflated (median = 0), as expected in a defender-heavy sample. xG and actual goals correlate at r ≈ 0.93, validating data quality.

![Position and league breakdown](https://github.com/user-attachments/assets/a669a7e9-26e4-481c-b356-3e2851540bca)

*Figure 3: Player distribution by position and league (300-min filter). Defenders dominate in every league, informing our choice to normalize statistics by position group.*

### Dataset overlap

Fuzzy name matching yields **1,869 confirmed pairs, 86.2%** of the FBref sample. The 299 gaps stem from name format mismatches (reversed Korean names, nicknames like *Vini Jr.*), mid-season transfers, and genuine FC 25 absences; a second pass later will close most of them.

### Preliminary correlations and outliers

Cross-dataset analysis confirms clear "signal pairs" that validate our data:
* **Shooting/Goal-Scoring**: EA `SHO` correlates strongly with real-world **Expected Goals** (`xG`), validating that high-rated virtual finishers generally reach high-quality scoring chances.
* **Defensive Skill**: The EA `DEF` rating shows the strongest alignment with actual defensive output, specifically **Tackles + Interceptions** (`Tkl+Int`).

Conversely, some traits lack a direct statistical match. **Speed** (`PAC`), for instance, only shows a weak link to **Progressive Carries**, reinforcing the need for position-specific analysis rather than a universal metric.

#### The "Reputation Gap"

Mapping **Overall Rating** (`OVR`) against attacking productivity (`xG+xAG/90`) surfaces two key outliers:
* **"Legacy" Stars**: Established names whose high ratings outpace their current 2024–25 output.
* **"Hidden Gems"**: Productive mid-table players who remain conservatively rated despite high efficiency.

![Correlation heatmap](https://github.com/user-attachments/assets/a31761e6-73c1-4b2d-bac4-05dfd5df5e8c)

*Figure 4: Cross-dataset correlation heatmap. The `SHO`/`xG` and `DEF`/`Tkl+Int` pairs are the strongest signals.*

![OVR vs xG+xAG scatter](https://github.com/user-attachments/assets/a3f3854b-2139-4452-aa0b-bca07618ab67)

*Figure 5: OVR vs xG+xAG/90 scatter for attackers and midfielders, surfacing established stars and underrated mid-table players.*

---

## Related Work

**What others have done with this data:** The FC 25 Kaggle dataset has been used for attribute-level EDA and ingame rating prediction: [This notebook by devraai](https://www.kaggle.com/code/devraai/ea-sports-fc-25-player-data-analysis-and-predic) predicts OVR using ML and [the dataset author's own EDA](https://www.kaggle.com/code/nyagami/exploratory-data-analysis-of-the-fc-25-dataset) explores distributions both without real-world performance reference. No existing work crosses the two datasets. Community tools like [SoFIFA](https://sofifa.com) and [FUTWIZ](https://www.futwiz.com) let users browse ratings, while [FBref](https://fbref.com) and [Sofascore](https://www.sofascore.com) offer per-90 dashboards but each operates in isolation, with no shared frame between gaming perception and on-pitch reality.

**Why our approach is original:** Rather than comparing players to other players, we use the EA rating as a proxy for *public perceived value* and pit it against positional-normalised real-world efficiency metrics. This produces a directional "Reputation Gap" that surfaces overrated legacy stars and underrated hidden gems in a single framework: Something neither analytics dashboards nor gaming databases attempt. [Prior ML work on FIFA ratings](https://brentclaypool.com/2021/06/03/machine-learning-analysis-of-ea-sports-fifa/) explicitly identified "bias introduced by high performance in previous seasons" as an unresolved problem — our cross-dataset approach directly addresses it.

**Visual inspirations:** Our main scatter (OVR vs xG+xAG/90, trend line, labeled outliers) draws from three works: [Flourish's football scatter](https://flourish.studio/blog/world-cup-euros-football-data-visualization/) uses the same expected vs actual structure with annotations; the [NYC Data Science player value analysis](https://nycdatascience.com/blog/student-works/identifying-overvalued-and-undervalued-soccer-players-relative-to-in-season-performance/) classifies players by residual distance from a trend line; and [Soccerment's hidden gems](https://soccerment.com/looking-for-hidden-gems/) plots performance vs salary to surface undervalued players by position.
