## Overview/Problematic

Last year, EA Sports assigned every player a single overall rating in its game FC 25. This number is not simply a reflection of the previous season; it blends positional attribute weighting, a league-level modifier, and an international reputation bonus of up to +3 overall, all assessed by more than 6,000 volunteer scouts worldwide. It is subjective by design.

This project compares those ratings against actual 2024–25 match data to answer one question: **which players earned their rating and which ones didn't?**

---

## Datasets

### 1. EA FC 25 Ratings (`fc25_players.csv`)

> **Source:** [EA Sports FC 25 Database, Ratings and Stats](https://www.kaggle.com/datasets/nyagami/ea-sports-fc-25-database-ratings-and-stats)

This dataset includes approximately 18,000 players and 56 attributes. Each profile includes identity data (age, club, nation, position) and 7 core composite ratings (`OVR`, `PAC`, `SHO`, `PAS`, `DRI`, `DEF`, `PHY`), along with 34 sub-attributes and goalkeeper-specific stats. All ratings are measured on a 0–99 scale.

Because ratings combine positional weighting, league modifiers, and a reputation bonus, they embed structural subjectivity, which is precisely what this project evaluates.

*Preprocessing: parsed height/weight strings, separated GK/outfield subsets, cleaned playstyle tags.*

### 2. Real 2024–25 Stats (`players_data-2024_2025.csv`)

> **Source:** [Football Players Stats 2024–2025](https://www.kaggle.com/datasets/hubertsidorowicz/football-players-stats-2024-2025)

This dataset presents approximately 2,800 players from top European leagues. It merges 9 FBref statistical tables, resulting in 199 usable columns after deduplication.

Beyond basic goals and assists, FBref provides granular metrics such as xG, progressive passes, shot-creating actions, defensive duels, and PSxG for goalkeepers. This level of detail enables a more comprehensive and position-specific evaluation of player performance.

*Preprocessing: dropped 68 duplicate identity columns, filtered players under 300 minutes, standardized nationality format, mapped FBref positions to EA equivalents.*

### Joining the Datasets

No shared ID exists between the two sources, so we will match players using fuzzy string matching based on **Name + Nation + Club**, with manual verification to resolve issues related to accents, abbreviations, and loan discrepancies.

The final overlap (up to 2,800 players) is primarily concentrated in the Top 5 European leagues, which form the core analytical sample.

---

## Exploratory Data Analysis

