"""
Script to generate the 5 figures for M1 + the merged dataset.
Reads fc25_players.csv and players_data-2024_2025.csv,
does preprocessing, fuzzy-matches players across datasets,
then plots everything.

Run from the repo root:
    python src/m1_eda.py
"""

import os
import re
import unicodedata
import warnings

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from rapidfuzz import fuzz, process as rfprocess
from adjustText import adjust_text

warnings.filterwarnings("ignore")

# Paths — relative to repo root
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "datasets")
FIG_DIR  = os.path.join(ROOT, "milestones", "figures")
os.makedirs(FIG_DIR, exist_ok=True)

# Load datasets

fc25  = pd.read_csv(os.path.join(DATA_DIR, "fc25_players.csv"))
fbref = pd.read_csv(os.path.join(DATA_DIR, "players_data-2024_2025.csv"))
print(f"Loaded  FC25 {fc25.shape}  /  FBref {fbref.shape}")

plt.rcParams.update({"figure.dpi": 130, "font.size": 11})
sns.set_theme(style="whitegrid", palette="muted")

BLUE    = "#1a6fbf"
ORANGE  = "#f97316"
GREEN   = "#16a34a"
RED     = "#dc2626"

TOP5 = [
    "Premier League", "LALIGA EA SPORTS", "Serie A Enilive",
    "Bundesliga", "Ligue 1 McDonald's",
]
COMPOSITES = ["OVR", "PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]

# FC25 preprocessing

def _parse_cm(s):
    if pd.isna(s): return np.nan
    m = re.search(r"(\d+)\s*cm", s)
    return float(m.group(1)) if m else np.nan

def _parse_kg(s):
    if pd.isna(s): return np.nan
    m = re.search(r"(\d+)\s*kg", s)
    return float(m.group(1)) if m else np.nan

fc25["height_cm"] = fc25["Height"].apply(_parse_cm)
fc25["weight_kg"] = fc25["Weight"].apply(_parse_kg)

fc25["play_style_list"] = (
    fc25["play style"]
    .fillna("")
    .apply(lambda s: [t.strip() for t in s.split(",") if t.strip()])
)

# only keep top-5 leagues for the FC25 side (to match FBref scope)
fc25_t5  = fc25[fc25["League"].isin(TOP5)].copy()
fc25_out = fc25_t5[fc25_t5["Position"] != "GK"].copy()   # outfield only


# FBref preprocessing

# we drop all of duplicated cols
dup_prefixes = (
    "Rk_stats_", "Nation_stats_", "Pos_stats_", "Comp_stats_",
    "Age_stats_", "Born_stats_", "90s_stats_", "Squad_stats_",
)

dup_extra = {
    "Gls_stats_shooting",  "PK_stats_shooting",   "PKatt_stats_shooting",
    "xG_stats_shooting",   "npxG_stats_shooting",
    "Ast_stats_passing",   "xAG_stats_passing",   "PrgP_stats_passing",
    "Att_stats_passing_types", "Cmp_stats_passing_types",
    "PrgC_stats_possession",   "PrgR_stats_possession",
    "MP_stats_playing_time",   "Min_stats_playing_time",
    "Starts_stats_playing_time", "90s_stats_playing_time",
    "CrdY_stats_misc", "CrdR_stats_misc",
    "Crs_stats_misc",  "Int_stats_misc",  "TklW_stats_misc",
    "MP_stats_keeper",  "Starts_stats_keeper",
    "Min_stats_keeper", "90s_stats_keeper",  "PKatt_stats_keeper",
    "GA_stats_keeper_adv", "PKA_stats_keeper_adv", "OG_stats_keeper_adv",
}

cols_to_drop = [
    c for c in fbref.columns
    if any(c.startswith(p) for p in dup_prefixes) or c in dup_extra
]
fbref = fbref.drop(columns=cols_to_drop) 

# players with <300 min have noisy per-90 numbers
fbref = fbref[fbref["Min"].fillna(0) >= 300].copy()

# nation: "eng ENG" -> "ENG"
fbref["nation_code"] = (
    fbref["Nation"]
    .fillna("")
    .str.extract(r"\b([A-Z]{2,3})\b", expand=False)
    .fillna(fbref["Nation"].fillna(""))
)

# normalize EA positions to 10 categories we care about
# CF->ST, LM/RM->CM, LWB/RWB->LB/RB
EA_POS_CLEAN = {
    "CF": "ST",  "LM": "CM",  "RM": "CM",  "LWB": "LB",  "RWB": "RB",
}

# league: "eng Premier League" -> "Premier League"
fbref["league_clean"] = fbref["Comp"].apply(
    lambda c: re.sub(r"^[a-z]{2}\s+", "", c).strip() if pd.notna(c) else ""
)

print(f"FBref after cleaning: {fbref.shape}")

# Name matching  (no shared ID between the two datasets)

# FC25 uses country names ("Holland", "Korea Republic") while 
# FBref uses FIFA codes ("NED", "KOR").  This map normalizes both sides.

NATION_TO_CODE = {
    "England": "ENG",  "France": "FRA",  "Spain": "ESP",  "Germany": "GER",
    "Italy": "ITA",    "Portugal": "POR", "Brazil": "BRA", "Argentina": "ARG",
    "Netherlands": "NED", "Holland": "NED",
    "Belgium": "BEL",  "Croatia": "CRO",  "Uruguay": "URU",
    "Colombia": "COL",  "Mexico": "MEX",  "United States": "USA", "Canada": "CAN",
    "Norway": "NOR",  "Denmark": "DEN",  "Sweden": "SWE",  "Switzerland": "SUI",
    "Austria": "AUT",  "Poland": "POL",  "Czech Republic": "CZE", "Slovakia": "SVK",
    "Hungary": "HUN",  "Romania": "ROU",  "Serbia": "SRB",  "Turkey": "TUR",
    "Greece": "GRE",  "Scotland": "SCO",  "Wales": "WAL",
    "Ireland": "IRL",  "Republic of Ireland": "IRL",
    "Northern Ireland": "NIR",
    "Japan": "JPN",  "South Korea": "KOR",  "Korea Republic": "KOR",
    "Australia": "AUS",  "New Zealand": "NZL",  "Saudi Arabia": "KSA",
    "Morocco": "MAR",  "Senegal": "SEN",  "Nigeria": "NGA",  "Ghana": "GHA",
    "Ivory Coast": "CIV", "Côte d'Ivoire": "CIV",
    "Cameroon": "CMR",  "Algeria": "ALG",  "Tunisia": "TUN",
    "Egypt": "EGY",  "Gabon": "GAB",  "Guinea": "GUI",  "Mali": "MLI",
    "Burkina Faso": "BFA",  "Cape Verde Islands": "CPV",  "Congo DR": "COD",
    "Mozambique": "MOZ",  "Guinea-Bissau": "GNB",  "Gambia": "GAM",
    "Equatorial Guinea": "EQG",  "Zimbabwe": "ZIM",  "Zambia": "ZAM",
    "Jamaica": "JAM",  "Trinidad & Tobago": "TRI",  "Trinidad and Tobago": "TRI",
    "Costa Rica": "CRC",
    "Ecuador": "ECU",  "Chile": "CHI",  "Peru": "PER",  "Paraguay": "PAR",
    "Venezuela": "VEN",  "Bolivia": "BOL",  "Honduras": "HON",  "Panama": "PAN",
    "Guatemala": "GUA",  "El Salvador": "SLV",  "Cuba": "CUB",
    "Iceland": "ISL",  "Finland": "FIN",  "Albania": "ALB",  "Kosovo": "XKX",
    "Montenegro": "MNE",  "North Macedonia": "MKD",  "Slovenia": "SVN",
    "Bosnia and Herzegovina": "BIH",  "Ukraine": "UKR",  "Russia": "RUS",
    "Belarus": "BLR",  "Georgia": "GEO",  "Armenia": "ARM",  "Azerbaijan": "AZE",
    "Israel": "ISR",  "Iran": "IRN",  "Iraq": "IRQ",  "Indonesia": "IDN",
    "China PR": "CHN",  "Thailand": "THA",  "Luxembourg": "LUX",
    "Lithuania": "LTU",  "Latvia": "LVA",  "Estonia": "EST",  "Moldova": "MDA",
    "Cyprus": "CYP",  "Malta": "MLT",  "Faroe Islands": "FRO",
    "Congo": "CGO",  "Sierra Leone": "SLE",  "Angola": "ANG",
    "Togo": "TOG",  "Libya": "LBY",  "Philippines": "PHI",
    "Bulgaria": "BUL",  "South Africa": "RSA",  "Suriname": "SUR",
    "India": "IND",  "Central African Republic": "CTA",
}

fc25["nation_code"] = fc25["Nation"].map(NATION_TO_CODE).fillna(fc25["Nation"])

# some players have totally different names between FBref and FC25
# (nicknames, shortened names, transliteration issues...)

# names that fuzzy matching can't resolve (completely different names,
# hyphens vs spaces, transliteration issues)
# value = EA name, or (EA name, EA club) when the name alone is ambiguous
MANUAL = {
    "Obite N'Dicka":     "Evan Ndicka",
    "Max Kilman":        "Maximilian Kilman",
    "Kim Min-jae":       "Kim Min Jae",
    "Lee Jae-sung":      "Lee Jae Sung",
    "Lee Kang-in":       "Lee Kang In",
    "Álex Grimaldo":     "Grimaldo",
    "Mohamed Ali Cho":   "Mohamed-Ali Cho",
    "Kirian Rodríguez":  "Kirian",
    "Abel":              "Abel Bretones",
    "Hwang Hee-chan":     "Hwang Hee Chan",
    "Pierre Højbjerg":   "Pierre-Emile Højbjerg",
    "Benito Ramírez":    ("Benito", "UD Las Palmas"),
    "Isaac Romero":      ("Isaac", "Sevilla FC"),
    "Éderson":           ("Éderson", "Bergamo Calcio"),
    "Isaac Palazón Camacho": "Isi Palazón",
}


def normalize(name):
    if pd.isna(name):
        return ""
    s = unicodedata.normalize("NFKD", str(name))
    s = s.encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower()).strip()


fc25["name_norm"]  = fc25["Name"].apply(normalize)
fc25["squad_norm"] = fc25["Team"].apply(normalize)

# reverse lookup
name_to_idx = {}
for i, n in enumerate(fc25["name_norm"]):
    name_to_idx.setdefault(n, i)

ea_names = fc25["name_norm"].tolist()

fbref["name_norm"]  = fbref["Player"].apply(normalize)
fbref["squad_norm"] = fbref["Squad"].apply(normalize)

SCORE_CUTOFF = 75


def find_match(row):
    """Return (fc25_index, name_score, club_score) or (None, 0, 0)."""

    player = row["Player"]
    name   = row["name_norm"]
    nation = row["nation_code"]
    squad  = row["squad_norm"]

    # manual overrides
    if player in MANUAL:
        val = MANUAL[player]
        if isinstance(val, tuple):
            ea_name, ea_club = val
            match = fc25[(fc25["Name"] == ea_name) & (fc25["Team"] == ea_club)]
            if len(match):
                return match.index[0], 100, 100
        else:
            target = normalize(val)
            if target in name_to_idx:
                return name_to_idx[target], 100, 100

    # try token_sort_ratio on the full database
    hit = rfprocess.extractOne(
        name, ea_names,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=SCORE_CUTOFF,
    )

    if hit:
        _, score, idx = hit
        matched = fc25.iloc[idx]

        # nation mismatch? retry within same-nation subset
        if nation != matched["nation_code"]:
            subset = fc25[fc25["nation_code"] == nation]
            if len(subset):
                cands = subset["name_norm"].tolist()
                idxs  = subset.index.tolist()
                r2 = rfprocess.extractOne(
                    name, cands,
                    scorer=fuzz.token_sort_ratio,
                    score_cutoff=SCORE_CUTOFF - 5,
                )
                if r2 and r2[1] >= score - 5:
                    _, score, pos = r2
                    idx = idxs[pos]

        matched    = fc25.iloc[idx]
        club_score = fuzz.token_sort_ratio(squad, matched["squad_norm"])

        if score >= 95:
            return idx, score, club_score
        if nation != matched["nation_code"] and club_score < 60:
            pass  # fall through to partial_ratio
        elif score < 87 and club_score < 40:
            pass 
        else:
            return idx, score, club_score

    # fallback: partial_ratio within same nation
    subset = fc25[fc25["nation_code"] == nation]
    if not len(subset):
        return None, 0, 0

    cands = subset["name_norm"].tolist()
    idxs  = subset.index.tolist()
    hit2 = rfprocess.extractOne(name, cands, scorer=fuzz.partial_ratio, score_cutoff=90)
    if hit2 is None:
        return None, 0, 0

    _, score2, pos = hit2
    idx2    = idxs[pos]
    ea_norm = fc25.iloc[idx2]["name_norm"]
    cs2     = fuzz.token_sort_ratio(squad, fc25.iloc[idx2]["squad_norm"])

    shared = set(name.split()) & set(ea_norm.split())
    if not any(len(w) >= 4 for w in shared):
        return None, 0, 0

    if score2 >= 95 and (cs2 >= 30 or ea_norm in name):
        return idx2, score2, cs2

    return None, 0, 0

print("Fuzzy matching + manual overrides …")
results = []
for i, row in fbref.iterrows():
    ea_i, ns, cs = find_match(row)
    results.append({"fb_i": i, "ea_i": ea_i, "name_score": ns, "club_score": cs})

good = pd.DataFrame(results)
good = good[good["ea_i"].notna()].copy()
good["ea_i"] = good["ea_i"].astype(int)

# deduplicate: when two different FBref players land on the same FC25 row,
# keep only the better match (mid-season transfers = same player twice → fine)
good = good.sort_values("name_score", ascending=False)
good["_player"] = fbref.loc[good["fb_i"], "Player"].values

drop_idx = []
for _, grp in good[good.duplicated("ea_i", keep=False)].groupby("ea_i"):
    if grp["_player"].nunique() > 1:
        best = grp["name_score"].idxmax()
        drop_idx += [i for i in grp.index if i != best]

good = good.drop(drop_idx).drop(columns="_player")
print(f"  matched {len(good)}/{len(fbref)} ({len(good)/len(fbref)*100:.1f}%)")


# build & save merged dataset

fb_side = fbref.loc[good["fb_i"]].reset_index(drop=True)
ea_side = fc25.iloc[good["ea_i"].values].reset_index(drop=True).add_prefix("ea_")
sc_side = good[["name_score", "club_score"]].reset_index(drop=True)

merged = pd.concat([fb_side, ea_side, sc_side], axis=1)
merged["pos_clean"] = merged["ea_Position"].map(EA_POS_CLEAN).fillna(merged["ea_Position"])
merged.to_csv(os.path.join(DATA_DIR, "merged_players.csv"), index=False)
print(f"  -> merged_players.csv  {merged.shape}")

# Figure 1 — composite rating distributions

fig, axes = plt.subplots(2, 4, figsize=(16, 7))
fig.suptitle("FC25 — Composite Attribute Distributions (top-5 leagues)",
             fontsize=14, fontweight="bold")

for ax, attr in zip(axes.flat, COMPOSITES):
    sns.histplot(fc25_t5[attr].dropna(), bins=30, kde=True, ax=ax,
                 color=BLUE, edgecolor="white", linewidth=0.4)
    ax.set_title(attr)
    ax.set_xlabel("Rating (0-99)")
    ax.set_ylabel("Count")

axes.flat[-1].set_visible(False)
plt.tight_layout()
plt.savefig(os.path.join(FIG_DIR, "fc25_composite_distributions.png"), bbox_inches="tight")
plt.close()
print("  [1/5] fc25_composite_distributions.png")


# Figure 2 — OVR by position + by league

pos_order = ["ST","CF","LW","RW","CAM","CM","CDM","LM","RM","LB","RB","CB","LWB","RWB"]
pos_keep  = [p for p in pos_order if p in fc25_out["Position"].values]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(17, 6))

sns.violinplot(
    data=fc25_out[fc25_out["Position"].isin(pos_keep)],
    x="Position", y="OVR", order=pos_keep,
    palette="Blues_d", inner="quartile", ax=ax1, linewidth=0.8, cut=0,
)
ax1.set_title("OVR by Position (top-5 leagues)", fontweight="bold")
ax1.set_ylabel("Overall Rating")
ax1.tick_params(axis="x", rotation=45)

sns.boxplot(
    data=fc25_t5, x="OVR", y="League", order=TOP5,
    palette="muted", ax=ax2, width=0.6,
)
ax2.set_title("OVR by League (top-5 leagues)", fontweight="bold")
ax2.set_xlabel("Overall Rating")
ax2.set_ylabel("")
median_ovr = fc25_t5["OVR"].median()
ax2.axvline(median_ovr, color=RED, ls="--", lw=1, label=f"Median ({median_ovr:.0f})")
ax2.legend(fontsize=9)

plt.tight_layout()
plt.savefig(os.path.join(FIG_DIR, "fc25_ovr_by_position_league.png"), bbox_inches="tight")
plt.close()
print("  [2/5] fc25_ovr_by_position_league.png")


# Figure 3 — FBref position & league breakdown

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
fig.suptitle("FBref 2024-25 — After Preprocessing (>=300 min)",
             fontsize=13, fontweight="bold")

# bar chart by FBref position (broad categories: GK/DF/MF/FW)
# extract primary position (before comma) for players with dual positions
fbref_pos = fbref["Pos"].str.split(",").str[0].fillna("Unknown")
grp_order   = ["FW","MF","DF","GK"]
grp_present = [g for g in grp_order if g in fbref_pos.values]
pos_counts  = fbref_pos.value_counts().reindex(grp_present)
bar_colors  = [RED, ORANGE, BLUE, "#0891b2"]

ax1.bar(pos_counts.index, pos_counts.values, color=bar_colors,
        edgecolor="white", linewidth=0.8)
ax1.set_title("Players by Position Group")
ax1.set_ylabel("Count")
for i, v in enumerate(pos_counts.values):
    ax1.text(i, v + 10, str(v), ha="center", fontsize=10)

# horizontal bar chart by league
league_counts = fbref["league_clean"].value_counts()
ax2.barh(league_counts.index, league_counts.values,
         color=BLUE, edgecolor="white", linewidth=0.8)
ax2.set_title("Players by League")
ax2.set_xlabel("Count")
ax2.invert_yaxis()
for i, v in enumerate(league_counts.values):
    ax2.text(v + 5, i, str(v), va="center", fontsize=10)

plt.tight_layout()
plt.savefig(os.path.join(FIG_DIR, "fbref_position_league_distribution.png"), bbox_inches="tight")
plt.close()
print("  [3/5] fbref_position_league_distribution.png")


# Figure 4 — correlation heatmap (EA vs FBref)

ea_cols  = ["ea_OVR","ea_SHO","ea_PAS","ea_DRI","ea_DEF","ea_PHY","ea_PAC"]
fb_cols  = ["xG+xAG",  "xG",   "xAG",   "Succ", "Tkl+Int","Won%",  "PrgC"]
ea_names_fig = ["OVR","SHO","PAS","DRI","DEF","PHY","PAC"]
fb_names_fig = ["xG+xAG/90","xG","xAG","Drib.Succ","Tkl+Int","AerWon%","PrgCarries"]

corr_block = pd.concat([
    merged[ea_cols].rename(columns=dict(zip(ea_cols, ea_names_fig))),
    merged[fb_cols].rename(columns=dict(zip(fb_cols, fb_names_fig))),
], axis=1)
hm = corr_block.corr(numeric_only=True).loc[ea_names_fig, fb_names_fig]

fig, ax = plt.subplots(figsize=(10, 5))
sns.heatmap(hm, annot=True, fmt=".2f", cmap="RdYlGn",
            vmin=-1, vmax=1, center=0,
            linewidths=0.5, linecolor="white",
            ax=ax, annot_kws={"fontsize": 10})
ax.set_title("EA Composite Ratings vs FBref Stats — Correlation",
             fontsize=13, fontweight="bold")
ax.set_xlabel("FBref Stats")
ax.set_ylabel("EA Rating")

plt.tight_layout()
plt.savefig(os.path.join(FIG_DIR, "correlation_heatmap.png"), bbox_inches="tight")
plt.close()
print("  [4/5] correlation_heatmap.png")


# Figure 5 — OVR vs xG+xAG scatter

cols_scatter = ["Player","ea_Name","ea_OVR","xG+xAG","ea_Position","pos_clean"]
scat = merged[cols_scatter].dropna(subset=["ea_OVR","xG+xAG"]).copy()

# xG+xAG is meaningless for defenders/GK, keep attackers + midfielders
scat = scat[scat["pos_clean"].isin(["ST","LW","RW","CAM","CM"])].copy()

# linear trend + residual = "reputation gap"
slope, intercept = np.polyfit(scat["xG+xAG"], scat["ea_OVR"], 1)
scat["predicted"] = slope * scat["xG+xAG"] + intercept
scat["gap"] = scat["ea_OVR"] - scat["predicted"]

top_over  = scat.nlargest(5, "gap")
top_under = scat.nsmallest(5, "gap")

palette = {"ST": RED, "LW": ORANGE, "RW": ORANGE, "CAM": GREEN, "CM": BLUE}
labels  = {"ST": "ST - Strikers",
           "LW": "LW - Left Wingers",  "RW": "RW - Right Wingers",
           "CAM": "CAM - Attacking MF", "CM": "CM - Central MF"}

fig, ax = plt.subplots(figsize=(14, 9))

# median crosshairs
ax.axhline(scat["ea_OVR"].median(),  color="gray", ls=":", lw=0.8, zorder=1)
ax.axvline(scat["xG+xAG"].median(), color="gray", ls=":", lw=0.8, zorder=1)

# one color per position
for pos, group in scat.groupby("pos_clean"):
    ax.scatter(group["xG+xAG"], group["ea_OVR"],
               c=palette.get(pos, "gray"), alpha=0.55, s=40, linewidths=0,
               label=labels.get(pos, pos), zorder=2)

# trend line
x_range = np.linspace(scat["xG+xAG"].min(), scat["xG+xAG"].max(), 200)
ax.plot(x_range, slope * x_range + intercept,
        "k--", lw=1.5, label="Trend", zorder=3)

ax.legend(fontsize=9, loc="lower left", framealpha=0.95, edgecolor="lightgray")

# annotate the 5 most over- and under-rated
bbox_over  = dict(boxstyle="round,pad=0.15", facecolor="white", edgecolor=RED, alpha=0.9, linewidth=0.5)
bbox_under = dict(boxstyle="round,pad=0.15", facecolor="white", edgecolor=GREEN, alpha=0.9, linewidth=0.5)

texts = []
for _, r in top_over.iterrows():
    ax.scatter(r["xG+xAG"], r["ea_OVR"], c=RED, s=70, zorder=4,
               linewidths=0.5, edgecolors="white")
    texts.append(ax.text(r["xG+xAG"], r["ea_OVR"], r["ea_Name"],
                         fontsize=8.5, color=RED, fontweight="bold",
                         bbox=bbox_over, zorder=5))

for _, r in top_under.iterrows():
    ax.scatter(r["xG+xAG"], r["ea_OVR"], c=GREEN, s=70, zorder=4,
               linewidths=0.5, edgecolors="white")
    texts.append(ax.text(r["xG+xAG"], r["ea_OVR"], r["ea_Name"],
                         fontsize=8.5, color=GREEN, fontweight="bold",
                         bbox=bbox_under, zorder=5))

adjust_text(texts, ax=ax,
            arrowprops=dict(arrowstyle="-", color="gray", lw=0.6),
            expand=(2.5, 2.5), force_text=(1.5, 1.5),
            force_points=(0.8, 0.8),
            ensure_inside_axes=True)

# quadrant annotations
bx = dict(boxstyle="round,pad=0.3", facecolor="white", edgecolor="none", alpha=0.85)
ax.text(0.98, 0.98, "Low xG+xAG/90, High OVR\n-> OVERRATED?",
        transform=ax.transAxes, va="top", ha="right",
        fontsize=9, color=RED, fontweight="bold", bbox=bx)
ax.text(0.98, 0.02, "High xG+xAG/90, Low OVR\n-> UNDERRATED?",
        transform=ax.transAxes, va="bottom", ha="right",
        fontsize=9, color=GREEN, fontweight="bold", bbox=bx)

ax.set_title("EA FC 25 OVR vs Real-World (xG + xAG) / 90 min  —  ATT + CAM + MID",
             fontsize=13, fontweight="bold")
ax.set_xlabel("FBref (xG + xAG) / 90 min")
ax.set_ylabel("EA FC 25 Overall Rating")

plt.tight_layout()
plt.savefig(os.path.join(FIG_DIR, "ovr_vs_xg_scatter.png"), bbox_inches="tight")
plt.close()
print("  [5/5] ovr_vs_xg_scatter.png")

# Print key statistics for Milestone 1 text

print("\n===== KEY STATS FOR MILESTONE 1 =====")
print(f"FC25 top-5 players: {len(fc25_t5)}")
ovr = fc25_t5["OVR"]
print(f"OVR: mean={ovr.mean():.1f}, median={ovr.median():.0f}, std={ovr.std():.1f}")
print(f"OVR > 85: {(ovr > 85).sum()} ({(ovr > 85).mean()*100:.1f}%)")
for c in COMPOSITES:
    s = fc25_t5[c].dropna()
    print(f"  {c}: mean={s.mean():.1f}, std={s.std():.1f}")

print(f"\nFBref after 300-min filter: {len(fbref)}")
fbref_pos = fbref["Pos"].str.split(",").str[0].fillna("Unknown")
for p in ["DF","MF","FW","GK"]:
    cnt = (fbref_pos == p).sum()
    print(f"  {p}: {cnt} ({cnt/len(fbref)*100:.0f}%)")

league_counts = fbref["league_clean"].value_counts()
print("League sizes:", dict(league_counts))

# xG vs Gls correlation
xg_gls = merged[["xG","Gls"]].dropna()
print(f"\nxG vs Gls correlation: r={xg_gls['xG'].corr(xg_gls['Gls']):.2f}")

# matching stats
print(f"\nMatched: {len(good)}/{len(fbref)} ({len(good)/len(fbref)*100:.1f}%)")
unmatched = len(fbref) - len(good)
print(f"Unmatched: {unmatched}")

# heatmap key correlations
print(f"\nKey correlations (from heatmap):")
for ea, fb in [("SHO","xG"), ("DEF","Tkl+Int"), ("PAC","PrgCarries")]:
    print(f"  {ea} vs {fb}: r={hm.loc[ea, fb]:.2f}")

print("\nDone.")
