"""
build_data.py
Reads the two original datasets (fc25_players.csv + players_data-2024_2025.csv),
fuzzy-matches players across them, then writes website/data/players.json
with enriched composite performance scores and reputation gap pre-computed.

Gap = composite_real - regression_predicted.
  Negative gap = overrated  (EA rates higher than real performance justifies)
  Positive gap = underrated (player performs better than OVR suggests)
"""

import json
import pathlib
import re
import unicodedata

import numpy as np
import pandas as pd
from rapidfuzz import fuzz, process as rfprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
FBREF_PATH = ROOT / "datasets" / "players_data-2024_2025.csv"
FC25_PATH = ROOT / "datasets" / "fc25_players.csv"
OUT_PATH = ROOT / "website" / "data" / "players.json"

# Transfermarkt paths
TM_DIR = ROOT / "datasets" / "transfermarkt"
TM_PROFILES = TM_DIR / "player_profiles.csv"
TM_MARKET_HIST = TM_DIR / "player_market_value.csv"
TM_INJURIES = TM_DIR / "player_injuries.csv"


# Manual overrides for names that fuzzy matching cannot resolve
MANUAL_MERGE = {
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
    "Vinicius Júnior":   "Vini Jr.",
    "Adrián":            ("Adrián", "Real Betis"),
    "Sergi":             ("Sergio", "CD Leganés"),
}

MERGE_SCORE_CUTOFF = 75

# FC25 uses full country names ("France"), FBref uses FIFA codes ("FRA").
# This mapping normalizes FC25 nation names to codes.
FC25_NATION_TO_CODE = {
    "England": "ENG", "France": "FRA", "Spain": "ESP", "Germany": "GER",
    "Italy": "ITA", "Portugal": "POR", "Brazil": "BRA", "Argentina": "ARG",
    "Netherlands": "NED", "Holland": "NED",
    "Belgium": "BEL", "Croatia": "CRO", "Uruguay": "URU",
    "Colombia": "COL", "Mexico": "MEX", "United States": "USA", "Canada": "CAN",
    "Norway": "NOR", "Denmark": "DEN", "Sweden": "SWE", "Switzerland": "SUI",
    "Austria": "AUT", "Poland": "POL", "Czech Republic": "CZE", "Slovakia": "SVK",
    "Hungary": "HUN", "Romania": "ROU", "Serbia": "SRB", "Turkey": "TUR",
    "Greece": "GRE", "Scotland": "SCO", "Wales": "WAL",
    "Ireland": "IRL", "Republic of Ireland": "IRL", "Northern Ireland": "NIR",
    "Japan": "JPN", "South Korea": "KOR", "Korea Republic": "KOR",
    "Australia": "AUS", "New Zealand": "NZL", "Saudi Arabia": "KSA",
    "Morocco": "MAR", "Senegal": "SEN", "Nigeria": "NGA", "Ghana": "GHA",
    "Ivory Coast": "CIV", "Cote d'Ivoire": "CIV",
    "Cameroon": "CMR", "Algeria": "ALG", "Tunisia": "TUN",
    "Egypt": "EGY", "Gabon": "GAB", "Guinea": "GUI", "Mali": "MLI",
    "Burkina Faso": "BFA", "Cape Verde Islands": "CPV", "Congo DR": "COD",
    "Mozambique": "MOZ", "Guinea-Bissau": "GNB", "Gambia": "GAM",
    "Equatorial Guinea": "EQG", "Zimbabwe": "ZIM", "Zambia": "ZAM",
    "Jamaica": "JAM", "Trinidad & Tobago": "TRI", "Trinidad and Tobago": "TRI",
    "Costa Rica": "CRC",
    "Ecuador": "ECU", "Chile": "CHI", "Peru": "PER", "Paraguay": "PAR",
    "Venezuela": "VEN", "Bolivia": "BOL", "Honduras": "HON", "Panama": "PAN",
    "Guatemala": "GUA", "El Salvador": "SLV", "Cuba": "CUB",
    "Iceland": "ISL", "Finland": "FIN", "Albania": "ALB", "Kosovo": "XKX",
    "Montenegro": "MNE", "North Macedonia": "MKD", "Slovenia": "SVN",
    "Bosnia and Herzegovina": "BIH", "Ukraine": "UKR", "Russia": "RUS",
    "Belarus": "BLR", "Georgia": "GEO", "Armenia": "ARM", "Azerbaijan": "AZE",
    "Israel": "ISR", "Iran": "IRN", "Iraq": "IRQ", "Indonesia": "IDN",
    "China PR": "CHN", "Thailand": "THA", "Luxembourg": "LUX",
    "Lithuania": "LTU", "Latvia": "LVA", "Estonia": "EST", "Moldova": "MDA",
    "Cyprus": "CYP", "Malta": "MLT", "Faroe Islands": "FRO",
    "Congo": "CGO", "Sierra Leone": "SLE", "Angola": "ANG",
    "Togo": "TOG", "Libya": "LBY", "Philippines": "PHI",
    "Bulgaria": "BUL", "South Africa": "RSA", "Suriname": "SUR",
    "India": "IND", "Central African Republic": "CTA",
}


def _normalize_name(name):
    if pd.isna(name):
        return ""
    s = unicodedata.normalize("NFKD", str(name))
    s = s.encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower()).strip()


def _fbref_nation_code(nation_str):
    """Extract 3-letter code from FBref nation string like 'fr FRA'."""
    if pd.isna(nation_str):
        return ""
    m = re.search(r"\b([A-Z]{2,3})\b", str(nation_str))
    return m.group(1) if m else str(nation_str).strip()


def merge_fbref_fc25(fbref: pd.DataFrame, fc25: pd.DataFrame) -> pd.DataFrame:
    """
    Fuzzy-match FBref players to FC25 entries and return a merged dataframe
    with FC25 columns prefixed by 'ea_'.
    """
    # Normalize names for matching
    fc25["name_norm"] = fc25["Name"].apply(_normalize_name)
    fc25["squad_norm"] = fc25["Team"].apply(_normalize_name)
    fc25["nation_code"] = fc25["Nation"].map(FC25_NATION_TO_CODE).fillna(fc25["Nation"])

    fbref["name_norm"] = fbref["Player"].apply(_normalize_name)
    fbref["squad_norm"] = fbref["Squad"].apply(_normalize_name)
    fbref["nation_code"] = fbref["Nation"].apply(_fbref_nation_code)

    # Reverse lookup: normalized name -> first fc25 index
    name_to_idx = {}
    for i, n in enumerate(fc25["name_norm"]):
        name_to_idx.setdefault(n, i)

    ea_names = fc25["name_norm"].tolist()

    def find_match(row):
        """Return (fc25_index, name_score, club_score) or (None, 0, 0)."""
        player = row["Player"]
        name = row["name_norm"]
        nation = row["nation_code"]
        squad = row["squad_norm"]

        # Manual overrides
        if player in MANUAL_MERGE:
            val = MANUAL_MERGE[player]
            if isinstance(val, tuple):
                ea_name, ea_club = val
                match = fc25[(fc25["Name"] == ea_name) & (fc25["Team"] == ea_club)]
                if len(match):
                    return match.index[0], 101, 100
            else:
                target = _normalize_name(val)
                if target in name_to_idx:
                    return name_to_idx[target], 101, 100

        # Primary: token_sort_ratio on all FC25 names
        hit = rfprocess.extractOne(
            name, ea_names,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=MERGE_SCORE_CUTOFF,
        )

        if hit:
            _, score, idx = hit
            matched = fc25.iloc[idx]

            # Nation mismatch? Retry within same-nation subset
            if nation != matched["nation_code"]:
                subset = fc25[fc25["nation_code"] == nation]
                if len(subset):
                    cands = subset["name_norm"].tolist()
                    idxs = subset.index.tolist()
                    r2 = rfprocess.extractOne(
                        name, cands,
                        scorer=fuzz.token_sort_ratio,
                        score_cutoff=MERGE_SCORE_CUTOFF - 5,
                    )
                    if r2 and r2[1] >= score - 5:
                        _, score, pos = r2
                        idx = idxs[pos]

            matched = fc25.iloc[idx]
            club_score = fuzz.token_sort_ratio(squad, matched["squad_norm"])

            if score >= 95:
                return idx, score, club_score
            if nation != matched["nation_code"] and club_score < 60:
                pass  # fall through to partial_ratio
            elif score < 87 and club_score < 40:
                pass
            else:
                return idx, score, club_score

        # Fallback: partial_ratio within same nation
        subset = fc25[fc25["nation_code"] == nation]
        if not len(subset):
            return None, 0, 0

        cands = subset["name_norm"].tolist()
        idxs = subset.index.tolist()
        hit2 = rfprocess.extractOne(name, cands, scorer=fuzz.partial_ratio, score_cutoff=90)
        if hit2 is None:
            return None, 0, 0

        _, score2, pos = hit2
        idx2 = idxs[pos]
        ea_norm = fc25.iloc[idx2]["name_norm"]
        cs2 = fuzz.token_sort_ratio(squad, fc25.iloc[idx2]["squad_norm"])

        shared = set(name.split()) & set(ea_norm.split())
        if not any(len(w) >= 4 for w in shared):
            return None, 0, 0

        if score2 >= 95 and (cs2 >= 30 or ea_norm in name):
            return idx2, score2, cs2

        return None, 0, 0

    # Run matching
    print("Fuzzy matching FBref <-> FC25 ...")
    results = []
    for i, row in fbref.iterrows():
        ea_i, ns, cs = find_match(row)
        results.append({"fb_i": i, "ea_i": ea_i, "name_score": ns, "club_score": cs})

    good = pd.DataFrame(results)
    good = good[good["ea_i"].notna()].copy()
    good["ea_i"] = good["ea_i"].astype(int)

    # Deduplicate: when two FBref players match the same FC25 row, keep best
    good = good.sort_values("name_score", ascending=False)
    good["_player"] = fbref.loc[good["fb_i"], "Player"].values

    drop_idx = []
    for _, grp in good[good.duplicated("ea_i", keep=False)].groupby("ea_i"):
        if grp["_player"].nunique() > 1:
            best = grp["name_score"].idxmax()
            drop_idx += [i for i in grp.index if i != best]
    good = good.drop(drop_idx).drop(columns="_player")

    print(f"  matched {len(good)}/{len(fbref)} ({len(good)/len(fbref)*100:.1f}%)")

    # Build merged dataframe: FBref columns + ea_-prefixed FC25 columns
    fb_side = fbref.loc[good["fb_i"]].reset_index(drop=True)
    ea_side = fc25.iloc[good["ea_i"].values].reset_index(drop=True).add_prefix("ea_")
    sc_side = good[["name_score", "club_score"]].reset_index(drop=True)

    merged = pd.concat([fb_side, ea_side, sc_side], axis=1)
    return merged

LEAGUE_SHORT = {
    "eng Premier League": "PL",
    "Premier League": "PL",
    "es La Liga": "La Liga",
    "La Liga": "La Liga",
    "LALIGA EA SPORTS": "La Liga",
    "it Serie A": "Serie A",
    "Serie A": "Serie A",
    "Serie A Enilive": "Serie A",
    "de Bundesliga": "Bundesliga",
    "Bundesliga": "Bundesliga",
    "fr Ligue 1": "Ligue 1",
    "Ligue 1": "Ligue 1",
}


EA_POS_TO_GROUP = {
    "ST": "FW", "CF": "FW", "LW": "FW", "RW": "FW", "LF": "FW", "RF": "FW",
    "CAM": "MF", "CM": "MF", "CDM": "MF", "LM": "FW", "RM": "FW",
    "CB": "DF", "LB": "DF", "RB": "DF", "LWB": "DF", "RWB": "DF",
    "GK": "GK",
}


SUBPOS_TO_GROUP_MAP = {
    "ST": "FW", "WG": "FW", "AM": "MF", "CM": "MF",
    "DM": "MF", "FB": "DF", "CB": "DF", "GK": "GK",
}


def map_pos_group(row) -> str:
    """Map to FW/MF/DF/GK. Priority: manual subPos override > _pos_override > EA > FBref."""
    name = row.get("ea_Name") if pd.notna(row.get("ea_Name")) else row.get("Player", "")
    for oname, osp in MANUAL_SUBPOS.items():
        if isinstance(name, str) and oname.lower() in name.lower():
            return SUBPOS_TO_GROUP_MAP.get(osp, "MF")
    override = row.get("_pos_override")
    if isinstance(override, str) and override.strip():
        return override.strip()
    ea_pos = str(row.get("ea_Position", "")).strip()
    if ea_pos in EA_POS_TO_GROUP:
        return EA_POS_TO_GROUP[ea_pos]
    primary = str(row.get("Pos", "MF")).split(",")[0].strip()
    return primary if primary in ("FW", "MF", "DF", "GK") else "MF"


SUBPOS_MAP = {
    "ST": "ST", "CF": "ST",
    "LW": "WG", "RW": "WG", "LM": "WG", "RM": "WG",
    "CAM": "AM",
    "CM": "CM",
    "CDM": "DM",
    "LB": "FB", "RB": "FB", "LWB": "FB", "RWB": "FB",
    "CB": "CB",
    "GK": "GK",
}

FBREF_POS_TO_SUBPOS = {
    "FW": "ST", "MF": "CM", "DF": "CB", "GK": "GK",
}

# Manual sub-position overrides for misclassified players
MANUAL_SUBPOS = {
    "Grimaldo": "FB",
    "Jeremie Frimpong": "FB",
    "Declan Rice": "CM",
}


def map_sub_pos(row) -> str:
    """Map to granular sub-position (ST/WG/AM/CM/DM/FB/CB/GK)."""
    name = row.get("ea_Name") if pd.notna(row.get("ea_Name")) else row.get("Player", "")
    for oname, osp in MANUAL_SUBPOS.items():
        if isinstance(name, str) and oname.lower() in name.lower():
            return osp
    override = row.get("_pos_override")
    if isinstance(override, str) and override.strip():
        return FBREF_POS_TO_SUBPOS.get(override.strip(), "CM")
    ea_pos = str(row.get("ea_Position", "")).strip()
    if ea_pos in SUBPOS_MAP:
        return SUBPOS_MAP[ea_pos]
    primary = str(row.get("Pos", "MF")).split(",")[0].strip()
    return FBREF_POS_TO_SUBPOS.get(primary, "CM")


SUBPOS_STATS = {
    "ST": [
        ("npxG_90", "scoring", False),
        ("SoT_90", "scoring", False),
        ("G/Sh", "scoring", False),
        ("Sh_90", "scoring", False),
        ("npxG/Sh", "scoring", False),
        ("SoT_pct", "scoring", False),
        ("xAG_90", "creation", False),
        ("GCA_90", "creation", False),
        ("SCA_90", "creation", False),
        ("KP_90", "creation", False),
        ("TO_90", "progression", False),
        ("Succ_pct", "progression", False),
        ("PrgC_90", "progression", False),
        ("AttPen_90", "progression", False),
        ("CPA_90", "progression", False),
        ("Mis_90", "progression", True),        # miscontrols (inv) - in progression
        ("AerialWon_pct", "defense", False),
        ("Offsides_90", "discipline", True),
    ],
    "WG": [
        ("npxG_90", "scoring", False),
        ("Sh_90", "scoring", False),
        ("SoT_90", "scoring", False),
        ("xAG_90", "creation", False),
        ("SCA_90", "creation", False),
        ("GCA_90", "creation", False),
        ("KP_90", "creation", False),
        ("CrsPA_90", "creation", False),
        ("xA_90", "creation", False),
        ("TB_90", "creation", False),
        ("PPA_90", "creation", False),
        ("TO_90", "progression", False),
        ("Succ_pct", "progression", False),
        ("PrgC_90", "progression", False),
        ("Fld_misc_90", "discipline", False),   # fouls drawn (provokes fouls)
        ("Mis_90", "discipline", True),
    ],
    "AM": [
        ("xAG_90", "creation", False),
        ("SCA_90", "creation", False),
        ("GCA_90", "creation", False),
        ("KP_90", "creation", False),
        ("TB_90", "creation", False),
        ("PPA_90", "creation", False),
        ("xA_90", "creation", False),
        ("PrgP_90", "progression", False),
        ("PrgC_90", "progression", False),
        ("TO_90", "progression", False),
        ("Final3rd_90", "progression", False),
        ("npxG_90", "scoring", False),
        ("SoT_90", "scoring", False),           # shot quality
        ("Cmp_pct", "progression", False),
        ("Fld_misc_90", "discipline", False),
        ("Mis_90", "discipline", True),
    ],
    "CM": [
        ("xAG_90", "creation", False),
        ("SCA_90", "creation", False),
        ("KP_90", "creation", False),
        ("TB_90", "creation", False),
        ("PrgP_90", "progression", False),
        ("PrgC_90", "progression", False),
        ("Final3rd_90", "progression", False),
        ("Cmp_pct", "progression", False),
        ("npxG_90", "scoring", False),
        ("TklInt_90", "defense", False),
        ("Int_90", "defense", False),
        ("Recov_90", "defense", False),
        ("Blocks_90", "defense", False),
        ("AerialWon_pct", "defense", False),
        ("DrblAtt_90", "defense", False),       # dribblers challenged/90
        ("Fls_90", "discipline", True),
        ("Mis_90", "discipline", True),
    ],
    "DM": [
        ("TklInt_90", "defense", False),
        ("Int_90", "defense", False),
        ("Tkl_90", "defense", False),
        ("Tkl_pct", "defense", False),
        ("Recov_90", "defense", False),
        ("Blocks_90", "defense", False),
        ("Clr_90", "defense", False),
        ("ShDef_90", "defense", False),
        ("AerialWon_pct", "defense", False),
        ("DrblAtt_90", "defense", False),       # dribblers challenged/90
        ("PassBlk_90", "defense", False),       # passes blocked (defensive)/90
        ("PrgP_90", "progression", False),
        ("PrgC_90", "progression", False),
        ("Cmp_pct", "progression", False),
        ("Final3rd_90", "progression", False),
        ("Fls_90", "discipline", True),
    ],
    "FB": [
        ("PrgC_90", "progression", False),
        ("PrgP_90", "progression", False),
        ("TO_90", "progression", False),
        ("Succ_pct", "progression", False),
        ("SCA_90", "creation", False),
        ("xAG_90", "creation", False),
        ("CrsPA_90", "creation", False),
        ("KP_90", "creation", False),
        ("TB_90", "creation", False),
        ("TklInt_90", "defense", False),
        ("Int_90", "defense", False),
        ("Recov_90", "defense", False),
        ("Blocks_90", "defense", False),
        ("AerialWon_pct", "defense", False),
        ("Cmp_pct", "progression", False),
        ("CPA_90", "progression", False),       # carries into pen area/90
        ("Fls_90", "discipline", True),
    ],
    "CB": [
        ("TklInt_90", "defense", False),
        ("AerialWon_pct", "defense", False),
        ("Clr_90", "defense", False),
        ("Blocks_90", "defense", False),
        ("ShDef_90", "defense", False),
        ("Recov_90", "defense", False),
        ("Int_90", "defense", False),
        ("Tkl_90", "defense", False),
        ("Tkl_pct", "defense", False),
        ("DrblAtt_90", "defense", False),       # dribblers challenged/90
        ("PassBlk_90", "defense", False),       # passes blocked (defensive)/90
        ("PrgP_90", "progression", False),
        ("PrgC_90", "progression", False),
        ("Cmp_pct", "progression", False),
        ("Err_90", "discipline", True),
        ("Fls_90", "discipline", True),
    ],
    "GK": [
        ("PSxG_pm90", "scoring", False),
        ("Save_pct", "scoring", False),
        ("CS_pct", "scoring", False),
        ("GA90_inv", "scoring", False),
        ("PSxG_SoT", "scoring", False),
        ("GKCmp_pct", "creation", False),
        ("Launch_pct", "creation", False),
        ("GKThr_90", "creation", False),        # throws/90 (short distribution)
        ("OPA_90", "defense", False),
        ("Stp_pct", "defense", False),
        ("AvgDist_col", "defense", False),
    ],
}

SUBPOS_WEIGHTS = {
    "ST": {
        "npxG_90": 0.1156, "SoT_90": 0.0918, "G/Sh": 0.0442, "Sh_90": 0.0884,
        "npxG/Sh": 0.0204, "SoT_pct": 0.0408, "xAG_90": 0.0578, "GCA_90": 0.0578,
        "SCA_90": 0.0578, "KP_90": 0.0544, "TO_90": 0.0544, "Succ_pct": 0.0204,
        "PrgC_90": 0.0646, "AttPen_90": 0.102, "CPA_90": 0.068, "Mis_90": 0.034,
        "AerialWon_pct": 0.0204, "Offsides_90": 0.0068,
    },
    "WG": {
        "npxG_90": 0.11, "Sh_90": 0.10, "SoT_90": 0.10,
        "xAG_90": 0.05, "SCA_90": 0.05, "GCA_90": 0.045, "KP_90": 0.04,
        "CrsPA_90": 0.03, "xA_90": 0.03, "TB_90": 0.03, "PPA_90": 0.03,
        "TO_90": 0.12, "Succ_pct": 0.04, "PrgC_90": 0.12,
        "Fld_misc_90": 0.04, "Mis_90": 0.03,
    },
    "AM": {
        "xAG_90": 0.0635, "SCA_90": 0.0761, "GCA_90": 0.0761, "KP_90": 0.0635,
        "TB_90": 0.0508, "PPA_90": 0.0635, "xA_90": 0.0635, "PrgP_90": 0.1015,
        "PrgC_90": 0.1015, "TO_90": 0.0761, "Final3rd_90": 0.0635, "npxG_90": 0.0761,
        "SoT_90": 0.0508, "Cmp_pct": 0.0228, "Fld_misc_90": 0.0254, "Mis_90": 0.0254,
    },
    "CM": {
        "xAG_90": 0.069, "SCA_90": 0.0862, "KP_90": 0.0862, "TB_90": 0.069,
        "PrgP_90": 0.0862, "PrgC_90": 0.069, "Final3rd_90": 0.069, "Cmp_pct": 0.0552,
        "npxG_90": 0.0655, "TklInt_90": 0.069, "Int_90": 0.0552, "Recov_90": 0.0552,
        "Blocks_90": 0.0414, "AerialWon_pct": 0.0276, "DrblAtt_90": 0.0276,
        "Fls_90": 0.0345, "Mis_90": 0.0345,
    },
    "DM": {
        "TklInt_90": 0.1, "Int_90": 0.0667, "Tkl_90": 0.08, "Tkl_pct": 0.0267,
        "Recov_90": 0.0467, "Blocks_90": 0.0467, "Clr_90": 0.0667, "ShDef_90": 0.04,
        "AerialWon_pct": 0.06, "DrblAtt_90": 0.06, "PassBlk_90": 0.0667,
        "PrgP_90": 0.1033, "PrgC_90": 0.1033, "Cmp_pct": 0.0333,
        "Final3rd_90": 0.0467, "Fls_90": 0.0533,
    },
    "FB": {
        "PrgC_90": 0.0865, "PrgP_90": 0.0865, "TO_90": 0.0432, "Succ_pct": 0.0144,
        "SCA_90": 0.0865, "xAG_90": 0.0865, "CrsPA_90": 0.0519, "KP_90": 0.0807,
        "TB_90": 0.0461, "TklInt_90": 0.0605, "Int_90": 0.0749, "Recov_90": 0.0807,
        "Blocks_90": 0.0749, "AerialWon_pct": 0.0231, "Cmp_pct": 0.0173,
        "CPA_90": 0.0576, "Fls_90": 0.0288,
    },
    "CB": {
        # defense (~50%): favor quality (tklpct, aerial%) over volume (clr, blocks)
        "TklInt_90": 0.04, "AerialWon_pct": 0.08, "Clr_90": 0.03,
        "Blocks_90": 0.03, "ShDef_90": 0.03, "Recov_90": 0.03,
        "Int_90": 0.03, "Tkl_90": 0.04, "Tkl_pct": 0.07, "DrblAtt_90": 0.04,
        "PassBlk_90": 0.03,
        # progression (~35%): ball-playing CB value
        "PrgP_90": 0.10, "PrgC_90": 0.10, "Cmp_pct": 0.08,
        # discipline (~15%)
        "Err_90": 0.05, "Fls_90": 0.07,
    },
    "GK": {
        "PSxG_pm90": 0.1544, "Save_pct": 0.1544, "CS_pct": 0.1158, "GA90_inv": 0.1274,
        "PSxG_SoT": 0.1158, "GKCmp_pct": 0.0386, "Launch_pct": 0.0386,
        "GKThr_90": 0.0232, "OPA_90": 0.0965, "Stp_pct": 0.0579, "AvgDist_col": 0.0772,
    },
}


# Mapping from internal column name to JSON stats key (for compositeMetrics)
COL_TO_KEY = {
    "xG_90": "xg90",
    "npxG_90": "npxg90",
    "xAG_90": "xag90",
    "SCA_90": "sca90",
    "GCA_90": "gca90",
    "Sh_90": "sh90",
    "SoT_90": "sot90",
    "PrgC_90": "prgc90",
    "PrgP_90": "prgp90",
    "KP_90": "kp90",
    "TklInt_90": "tklint90",
    "Blocks_90": "blocks90",
    "Clr_90": "clr90",
    "AerialWon_pct": "aerialwon",
    "Cmp_pct": "cmppct",
    "PSxG_pm": "psxgpm",
    "PSxG_pm90": "psxgpm90",
    "Save_pct": "savepct",
    "CS_pct": "cspct",
    "GKCmp_pct": "gkdist",
    "TO_90": "to90",
    "Succ_pct": "succpct",
    "Recov_90": "recov90",
    "TB_90": "tb90",
    "ShDef_90": "shblocks90",
    "Final3rd_90": "final3rd90",
    "OPA_90": "opa90",
    "Stp_pct": "stppct",
    "Launch_pct": "launchpct",
    "PPA_90": "ppa90",
    "CrsPA_90": "crspa90",
    "xA_90": "xa90",
    "Fls_90": "fls90",
    "Fld_misc_90": "fld90",
    "Int_90": "int90",
    "Tkl_90": "tkl90",
    "AttPen_90": "touchAttPen90",
    "Err_90": "err90",
    "GA90_inv": "ga90",
    "G/Sh": "gPerSh",
    "npxG/Sh": "npxgpsh",
    "Tkl_pct": "tklpct",
    "Tkl%": "tklpct",
    "PSxG_SoT": "psxgPerSoT",
    "PSxG/SoT": "psxgPerSoT",
    "AvgDist_col": "gkAvgDist",
    "AvgDist": "gkAvgDist",
    "SoT_pct": "sotpct",
    "Offsides_90": "offsides90",
    "DrblAtt_90": "drblAtt90",
    "PassBlk_90": "passBlk90",
    "GKThr_90": "gkThr90",
    "CPA_90": "cpa90",
}

# EA sub-attribute mapping: CSV column -> JSON key
EA_SUB_MAP = {
    "ea_Acceleration": "acceleration",
    "ea_Sprint Speed": "sprintSpeed",
    "ea_Positioning": "positioning",
    "ea_Finishing": "finishing",
    "ea_Shot Power": "shotPower",
    "ea_Long Shots": "longShots",
    "ea_Volleys": "volleys",
    "ea_Penalties": "penalties",
    "ea_Vision": "vision",
    "ea_Crossing": "crossing",
    "ea_Free Kick Accuracy": "fkAccuracy",
    "ea_Short Passing": "shortPassing",
    "ea_Long Passing": "longPassing",
    "ea_Curve": "curve",
    "ea_Dribbling": "dribbling",
    "ea_Agility": "agility",
    "ea_Balance": "balance",
    "ea_Reactions": "reactions",
    "ea_Ball Control": "ballControl",
    "ea_Composure": "composure",
    "ea_Interceptions": "interceptions",
    "ea_Heading Accuracy": "headingAccuracy",
    "ea_Def Awareness": "defAwareness",
    "ea_Standing Tackle": "standingTackle",
    "ea_Sliding Tackle": "slidingTackle",
    "ea_Jumping": "jumping",
    "ea_Stamina": "stamina",
    "ea_Strength": "strength",
    "ea_Aggression": "aggression",
    "ea_GK Diving": "gkDiving",
    "ea_GK Handling": "gkHandling",
    "ea_GK Kicking": "gkKicking",
    "ea_GK Positioning": "gkPositioning",
    "ea_GK Reflexes": "gkReflexes",
}


def clean_tm_name(name: str) -> str:
    """Strip trailing '(12345)' suffix from Transfermarkt player_name."""
    if not isinstance(name, str):
        return ""
    return re.sub(r"\s*\(\d+\)\s*$", "", name).strip()


def parse_height(h) -> int | None:
    """Parse height like '1.78' (meters) or '178' to integer cm."""
    if pd.isna(h):
        return None
    try:
        val = float(h)
        if val == 0.0:
            return None
        if val < 3.0:
            return int(round(val * 100))
        return int(round(val))
    except (ValueError, TypeError):
        return None


def parse_market_value(v) -> int | None:
    """Convert market value to integer, None if zero or missing."""
    if pd.isna(v):
        return None
    try:
        val = int(float(v))
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def strip_accents(s: str) -> str:
    """Remove diacritics/accents from a string for fuzzy comparison."""
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# Manual overrides: ea_Name (or Player) -> Transfermarkt player_id
# for players whose names are too short/different for fuzzy matching.
MANUAL_TM = {
    "Grimaldo": 193082,            # Alejandro Grimaldo, Leverkusen
    "Carvajal": 138927,            # Daniel Carvajal, Real Madrid
    "Bruno Fernandes": 240306,     # Manchester United
    "Marquinhos": 181767,          # PSG
    "Gabriel": 435338,             # Gabriel Magalhaes, Arsenal
    "Vitinha": 487469,             # PSG
    "Kim Min Jae": 503482,         # Min-jae Kim, Bayern
    "Parejo": 59561,               # Dani Parejo, Villarreal
    "Mateo Kovacic": 51471,        # Manchester City (accent-stripped)
    "Gaya": 221322,                # Jose Gaya, Valencia (accent-stripped)
    "Julian Alvarez": 576024,      # Atletico Madrid (accent-stripped)
    "Nuno Mendes": 616341,         # PSG
    "Koke": 74229,                 # Atletico Madrid
    "Morata": 128223,              # Alvaro Morata (TM has Como, was Milan in 24/25)
    "Palhinha": 257455,             # Joao Palhinha, Bayern (TM has Tottenham)
    "Sancet": 571020,               # Oihan Sancet, Athletic Bilbao
    "Oyarzabal": 351478,            # Mikel Oyarzabal, Real Sociedad
    "Zubimendi": 423440,            # Martin Zubimendi (TM has Arsenal)
    "Yeray": 255488,                # Yeray Alvarez, Athletic Bilbao
    "Balde": 636688,                # Alejandro Balde, FC Barcelona
    "Andre-Franck Zambo Anguissa": 354361,  # Frank Anguissa, Napoli
    "Zubeldia": 355628,             # Igor Zubeldia, Real Sociedad
    "Catena": 449796,               # Alejandro Catena, Osasuna
    "Kepa": 192279,                 # Kepa Arrizabalaga (TM has Arsenal)
    "Guruzeta": 340205,             # Gorka Guruzeta, Athletic Bilbao
    "Lee Kang In": 557149,          # Kang-in Lee, PSG
    "Azpilicueta": 57500,           # Cesar Azpilicueta (TM has Sevilla)
    "Valentin Castellanos": 522784,  # Taty Castellanos, Lazio
    "Emanuel Emegha": 559328,         # RC Strasbourg
    "Đorđe Petrović": 465555,         # AFC Bournemouth
    "Boubakar Kouyaté": 211637,       # Kiki Kouyate, Montpellier
    "Jonny Rowe": 672381,             # Jonathan Rowe, Marseille/Bologna
    "Abner Vinícius": 646402,         # Olympique Lyon
    "Jamie Bynoe-Gittens": 670882,    # Dortmund/Chelsea
    "Łukasz Skorupski": 80894,        # Bologna
    "Yann Aurel Bisseck": 441986,     # Inter Milan
    "Kouadio Manu Koné": 624690,      # AS Roma
    "Jon Mikel Aramburu": 661145,     # Real Sociedad
    "Jon Pacheco": 580560,            # Real Sociedad / Alaves (CB, not GK)
    "João Félix": 462250,             # Chelsea/Milan (TM has Al-Nassr now)
    "Vini Jr.": 371998,               # Vinicius Junior, Real Madrid
}


def merge_transfermarkt(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fuzzy-match players in df against Transfermarkt profiles and enrich
    with photo, nationality, height, foot, detailed position, contract,
    market value, and injury aggregates.
    """
    # Load profiles
    profiles = pd.read_csv(TM_PROFILES, low_memory=False)
    profiles["clean_name"] = profiles["player_name"].apply(clean_tm_name)

    # Build player_id -> profile row index lookup
    pid_to_idx = {}
    for i, row in profiles.iterrows():
        pid_to_idx[int(row["player_id"])] = i

    # Build lookup: clean_name -> list of rows (for disambiguation)
    from collections import defaultdict
    name_to_rows = defaultdict(list)
    for idx, row in profiles.iterrows():
        name_to_rows[row["clean_name"].lower()].append(idx)

    # Prepare list of unique TM names for fuzzy matching
    tm_names = profiles["clean_name"].tolist()
    tm_names_lower = [n.lower() for n in tm_names]
    # Also build accent-stripped versions for fallback matching
    tm_names_stripped = [strip_accents(n) for n in tm_names_lower]

    # Build name for matching: prefer ea_Name, fallback to Player
    df["_match_name"] = df["ea_Name"].where(df["ea_Name"].notna(), df["Player"])

    # Build manual override lookup using both ea_Name and accent-stripped ea_Name
    manual_lookup = {}
    for name, pid in MANUAL_TM.items():
        manual_lookup[name.lower()] = pid
        manual_lookup[strip_accents(name).lower()] = pid

    # Fuzzy match each player
    tm_cols = [
        "tm_player_id", "tm_photo", "tm_nationality", "tm_dob",
        "tm_height", "tm_foot", "tm_position_detail", "tm_contract_expires",
    ]
    for col in tm_cols:
        df[col] = None

    def _assign_tm_row(df, idx, tm_row):
        """Write TM fields from a profile row into df at idx."""
        df.at[idx, "tm_player_id"] = int(tm_row["player_id"])
        df.at[idx, "tm_photo"] = tm_row.get("player_image_url")
        df.at[idx, "tm_nationality"] = tm_row.get("citizenship")
        df.at[idx, "tm_dob"] = tm_row.get("date_of_birth")
        h = parse_height(tm_row.get("height"))
        df.at[idx, "tm_height"] = h
        foot = tm_row.get("foot")
        df.at[idx, "tm_foot"] = foot if isinstance(foot, str) and foot != "N/A" else None
        pos = tm_row.get("position")
        if isinstance(pos, str):
            parts = pos.split(" - ")
            df.at[idx, "tm_position_detail"] = parts[-1].strip() if len(parts) > 1 else pos.strip()
        df.at[idx, "tm_contract_expires"] = tm_row.get("contract_expires")

    matched = 0
    for idx, row in df.iterrows():
        player_name = row["_match_name"]
        if not isinstance(player_name, str) or not player_name.strip():
            continue

        player_lower = player_name.lower()
        player_stripped = strip_accents(player_lower)
        player_club = str(row.get("Squad", "")).lower()

        # 1) Check manual overrides (exact name or accent-stripped)
        manual_pid = manual_lookup.get(player_lower) or manual_lookup.get(player_stripped)
        if manual_pid and manual_pid in pid_to_idx:
            tm_row = profiles.iloc[pid_to_idx[manual_pid]]
            _assign_tm_row(df, idx, tm_row)
            matched += 1
            continue

        # 2) Fuzzy match on original names
        result = rfprocess.extractOne(
            player_lower,
            tm_names_lower,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=85,
        )

        # 3) Fallback: fuzzy match on accent-stripped names
        if result is None:
            result_stripped = rfprocess.extractOne(
                player_stripped,
                tm_names_stripped,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=85,
            )
            if result_stripped is not None:
                result = (tm_names_lower[result_stripped[2]], result_stripped[1], result_stripped[2])

        # 4) Fallback: try last name only (for single-word ea_Name that are surnames)
        if result is None and " " in row.get("Player", ""):
            last_name = row["Player"].split()[-1].lower()
            if len(last_name) >= 4:
                result_last = rfprocess.extractOne(
                    last_name,
                    tm_names_lower,
                    scorer=fuzz.token_sort_ratio,
                    score_cutoff=90,  # higher threshold for last-name-only
                )
                if result_last is not None:
                    result = result_last

        # 5) Fallback: for single-word names, check if name matches any
        #    word-part of TM clean names (e.g. "Sancet" in "Oihan Sancet")
        if result is None and " " not in player_lower.strip():
            query = player_stripped
            if len(query) >= 4:
                best_score = 0
                best_idx_part = None
                for ti, tname in enumerate(tm_names_lower):
                    for part in tname.split():
                        part_stripped = strip_accents(part)
                        sc = fuzz.ratio(query, part_stripped)
                        if sc > best_score:
                            best_score = sc
                            best_idx_part = ti
                if best_score >= 88 and best_idx_part is not None:
                    result = (tm_names_lower[best_idx_part], best_score, best_idx_part)

        if result is None:
            continue

        match_str, score, match_idx = result

        # Disambiguation: if multiple TM players share the same name,
        # try to pick one whose club matches
        tm_row = profiles.iloc[match_idx]
        candidates = name_to_rows.get(match_str, [match_idx])

        # Also check for multiple fuzzy matches above threshold (club tiebreaker)
        if len(candidates) > 1:
            best_idx = match_idx
            for c_idx in candidates:
                c_club = str(profiles.at[c_idx, "current_club_name"]).lower()
                if player_club and (player_club in c_club or c_club in player_club):
                    best_idx = c_idx
                    break
            tm_row = profiles.iloc[best_idx]

        _assign_tm_row(df, idx, tm_row)
        matched += 1

    print(f"Transfermarkt: matched {matched} / {len(df)} players")

    # Join market values -- start-of-season and latest
    # Load the full historical market value CSV once, grouped by player_id
    hist_mv = pd.read_csv(TM_MARKET_HIST, low_memory=False)
    hist_mv["date"] = pd.to_datetime(hist_mv["date_unix"], errors="coerce")
    hist_mv = hist_mv.dropna(subset=["date"])
    hist_mv = hist_mv.sort_values("date")

    # Cutoff for start-of-season value: last entry on or before Aug 31, 2024
    season_cutoff = pd.Timestamp("2024-08-31")

    grouped = hist_mv.groupby("player_id")

    # Pre-compute start-of-season and latest values per player_id
    mv_start_map = {}    # player_id -> (value, date_str)
    mv_latest_map = {}   # player_id -> (value, date_str)

    for pid, grp in grouped:
        # Latest value: last row (already sorted by date)
        last_row = grp.iloc[-1]
        mv_latest_map[int(pid)] = (last_row["value"], last_row["date_unix"])

        # Start-of-season value: the LATEST entry with date <= 2024-08-31
        before_season = grp[grp["date"] <= season_cutoff]
        if not before_season.empty:
            best = before_season.iloc[-1]  # already sorted by date
            mv_start_map[int(pid)] = (best["value"], best["date_unix"])
        # else: player's first TM valuation was after Aug 31 -> marketValue = null

    # Map onto the dataframe
    df["tm_market_value"] = None
    df["tm_market_value_date"] = None
    df["tm_market_value_latest"] = None
    df["tm_market_value_latest_date"] = None

    for idx, row in df.iterrows():
        pid = row["tm_player_id"]
        if pd.isna(pid):
            continue
        pid_int = int(pid)
        start_info = mv_start_map.get(pid_int)
        if start_info is not None:
            df.at[idx, "tm_market_value"] = parse_market_value(start_info[0])
            df.at[idx, "tm_market_value_date"] = start_info[1]
        latest_info = mv_latest_map.get(pid_int)
        if latest_info is not None:
            df.at[idx, "tm_market_value_latest"] = parse_market_value(latest_info[0])
            df.at[idx, "tm_market_value_latest_date"] = latest_info[1]

    # Join injuries
    injuries = pd.read_csv(TM_INJURIES)
    # Filter to 24/25 seasons
    injuries = injuries[injuries["season_name"].astype(str).str.contains("24|25", na=False)]
    # Aggregate per player
    inj_agg = injuries.groupby("player_id").agg(
        inj_count=("injury_reason", "count"),
        inj_days_missed=("days_missed", "sum"),
        inj_games_missed=("games_missed", "sum"),
        inj_latest=("injury_reason", "last"),
    ).reset_index()
    inj_map = {r["player_id"]: r for _, r in inj_agg.iterrows()}

    df["tm_inj_count"] = None
    df["tm_inj_days_missed"] = None
    df["tm_inj_games_missed"] = None
    df["tm_inj_latest"] = None

    for idx, row in df.iterrows():
        pid = row["tm_player_id"]
        if pd.isna(pid):
            continue
        inj = inj_map.get(int(pid))
        if inj is not None:
            df.at[idx, "tm_inj_count"] = int(inj["inj_count"])
            df.at[idx, "tm_inj_days_missed"] = int(inj["inj_days_missed"]) if pd.notna(inj["inj_days_missed"]) else 0
            df.at[idx, "tm_inj_games_missed"] = int(inj["inj_games_missed"]) if pd.notna(inj["inj_games_missed"]) else 0
            df.at[idx, "tm_inj_latest"] = inj["inj_latest"]

    df.drop(columns=["_match_name"], inplace=True)
    return df



def linregress(x: np.ndarray, y: np.ndarray):
    valid = np.isfinite(x) & np.isfinite(y)
    x, y = x[valid], y[valid]
    if len(x) < 2:
        return 0.0, np.nanmean(y) if len(y) > 0 else 0.0
    mx, my = x.mean(), y.mean()
    ss_xx = ((x - mx) ** 2).sum()
    if ss_xx == 0:
        return 0.0, my
    slope = ((x - mx) * (y - my)).sum() / ss_xx
    intercept = my - slope * mx
    return slope, intercept


def _val(row, col):
    v = row.get(col)
    return None if v is None or (isinstance(v, float) and np.isnan(v)) else v

def safe_int(row, col):
    v = _val(row, col)
    try: return int(v) if v is not None else None
    except (ValueError, TypeError): return None

def safe_float(row, col, decimals=2):
    v = _val(row, col)
    try: return round(float(v), decimals) if v is not None else None
    except (ValueError, TypeError): return None


def _fix_ea_columns(df: pd.DataFrame, row_mask, fc25_row: pd.Series) -> None:
    """Overwrite all ea_* columns in df for rows matching row_mask."""
    for col in fc25_row.index:
        merged_col = f"ea_{col}"
        if merged_col in df.columns:
            df.loc[row_mask, merged_col] = fc25_row[col]


def _postprocess_ea_matches(df: pd.DataFrame) -> pd.DataFrame:
    """Fix position mismatches, duplicate EA matches, and reclassify positions."""
    fc25 = pd.read_csv(FC25_PATH)

    # Fix position-mismatched EA entries (outfield matched to GK or vice versa)
    outfield_fbref = df["Pos"].str.contains("FW|MF|DF", case=False, na=False)
    gk_fbref = df["Pos"].str.strip().str.upper() == "GK"
    gk_ea = df["ea_Position"] == "GK"
    bad_mask = (outfield_fbref & gk_ea) | (gk_fbref & ~gk_ea & df["ea_Position"].notna())

    drop_indices = []
    for idx, row in df.loc[bad_mask].iterrows():
        is_gk = str(row["Pos"]).strip().upper() == "GK"
        target = fc25[fc25["Position"] == "GK"] if is_gk else fc25[fc25["Position"] != "GK"]
        ea_name = row["ea_Name"] if pd.notna(row.get("ea_Name")) else row["Player"]
        squad_lo = str(row.get("Squad", "")).lower()

        # Try ea_Name, then last name from Player
        search_names = [str(ea_name)]
        if " " in str(row.get("Player", "")):
            search_names.append(str(row["Player"]).split()[-1])

        # Try team match first across all search names, then fall back to any match
        fixed = False
        for attempt in ("team", "any"):
            for name in search_names:
                cands = target[target["Name"].str.lower() == name.lower()]
                if attempt == "team":
                    cands = cands[cands["Team"].str.lower().apply(lambda t: squad_lo in t or t in squad_lo)]
                if not cands.empty:
                    _fix_ea_columns(df, df.index == idx, cands.iloc[0])
                    print(f"POST-FIX: Re-matched {row['Player']} ({row['Squad']}) "
                          f"-> {cands.iloc[0]['Name']} (OVR {cands.iloc[0]['OVR']}, {cands.iloc[0]['Position']})")
                    fixed = True
                    break
            if fixed:
                break
        if not fixed:
            drop_indices.append(idx)
            print(f"POST-FIX: Dropping {row['Player']} ({row['Squad']}) -- position mismatch, no fix found")

    if drop_indices:
        df = df.drop(index=drop_indices).reset_index(drop=True)

    # Remove duplicate EA matches (same EA player matched to multiple FBref players)
    dup_mask = df.duplicated(subset=["ea_Name", "ea_OVR", "ea_Team"], keep=False) & df["ea_Name"].notna()
    drop_dup = []
    for (_, _), grp in df[dup_mask].groupby(["ea_Name", "ea_OVR"]):
        if len(grp) <= 1:
            continue
        best_idx = grp["Min"].idxmax()
        for idx in grp.index:
            if idx != best_idx:
                drop_dup.append(idx)
                print(f"POST-FIX: Dropping duplicate {grp.loc[idx, 'Player']} ({grp.loc[idx, 'Squad']}, "
                      f"Min={grp.loc[idx, 'Min']}) -- keeping {df.loc[best_idx, 'Player']} "
                      f"({df.loc[best_idx, 'Squad']}, Min={df.loc[best_idx, 'Min']})")
    if drop_dup:
        df = df.drop(index=drop_dup).reset_index(drop=True)

    # Reclassify CM/CAM players who play DF according to FBref
    fbref_pos = df["Pos"].astype(str).str.strip()
    ea_pos = df["ea_Position"].astype(str).str.strip()
    mf_as_df = fbref_pos.str.startswith("DF") & ea_pos.isin({"CM", "CAM"})
    if mf_as_df.any():
        for idx in df.index[mf_as_df]:
            print(f"POST-FIX: Reclassifying {df.loc[idx, 'Player']} to DF "
                  f"(EA={df.loc[idx, 'ea_Position']}, FBref={df.loc[idx, 'Pos']})")
        df.loc[mf_as_df, "_pos_override"] = "DF"

    return df


def compute_pca_composite(df: pd.DataFrame) -> pd.DataFrame:
    """Compute composite scores per sub-position: percentile rank each stat,
    weighted average using manual weights, rescaled to OVR-like distribution."""
    df["composite"] = np.nan
    for dim in ("scoring", "creation", "progression", "defense", "discipline"):
        df["sub_score_" + dim] = np.nan
        df["dim_weight_" + dim] = np.nan
    df["pca_weights_json"] = ""

    for sp, stat_defs in SUBPOS_STATS.items():
        mask = df["sub_pos"] == sp
        if mask.sum() < 5:
            continue

        col_names = [s[0] for s in stat_defs]
        dimensions = [s[1] for s in stat_defs]
        inverted = [s[2] for s in stat_defs]

        sub = df.loc[mask, col_names].copy()
        for i, inv in enumerate(inverted):
            if inv:
                sub.iloc[:, i] = -sub.iloc[:, i]
        for col in sub.columns:
            sub[col] = sub[col].fillna(sub[col].median() if pd.notna(sub[col].median()) else 0)

        # Percentile rank each stat (0-100)
        pct = sub.rank(pct=True) * 100

        # Normalize manual weights
        weights = SUBPOS_WEIGHTS.get(sp, {})
        loadings = np.array([weights.get(c, 1.0 / len(col_names)) for c in col_names])
        loadings = loadings / loadings.sum()

        weight_dict = {col_names[i]: round(float(loadings[i]), 4) for i in range(len(col_names))}
        df.loc[mask, "pca_weights_json"] = json.dumps(weight_dict)

        # Sub-scores by dimension (weighted percentile average)
        dim_set = sorted(set(dimensions))
        dim_scores = {}
        dim_weights = {}
        for dim in dim_set:
            idx = [i for i, d in enumerate(dimensions) if d == dim]
            dim_l = loadings[idx]
            dim_pct = pct.iloc[:, idx]
            if dim_l.sum() > 0:
                raw = (dim_pct.values * dim_l).sum(axis=1) / dim_l.sum()
            else:
                raw = dim_pct.values.mean(axis=1)
            dim_scores[dim] = pd.Series(raw, index=sub.index).round(1)
            dim_weights[dim] = round(float(dim_l.sum()), 4)

        total_dw = sum(dim_weights.values()) or 1
        for dim in dim_weights:
            dim_weights[dim] = round(dim_weights[dim] / total_dw, 4)

        for dim in ("scoring", "creation", "progression", "defense", "discipline"):
            if dim in dim_scores:
                df.loc[mask, "sub_score_" + dim] = dim_scores[dim]
                df.loc[mask, "dim_weight_" + dim] = dim_weights[dim]
            else:
                df.loc[mask, "sub_score_" + dim] = 50.0
                df.loc[mask, "dim_weight_" + dim] = 0.0

        # Weighted composite from dimension scores
        composite = pd.Series(0.0, index=sub.index)
        for dim in ("scoring", "creation", "progression", "defense", "discipline"):
            if dim in dim_scores and dim in dim_weights:
                composite += dim_scores[dim] * dim_weights[dim]

        # Rescale to match EA OVR distribution (mean=75.5, std=5.2)
        c_mu, c_sig = composite.mean(), composite.std()
        if c_sig > 0:
            composite = 75.5 + (composite - c_mu) / c_sig * 5.2
        df.loc[mask, "composite"] = composite.round(1)

    return df


def build():
    fbref = pd.read_csv(FBREF_PATH, low_memory=False)
    fc25 = pd.read_csv(FC25_PATH, low_memory=False)
    print(f"Loaded {len(fbref)} FBref players, {len(fc25)} FC25 players")

    # Restrict FBref to top-5 leagues
    top5 = {"eng Premier League", "es La Liga", "it Serie A", "de Bundesliga", "fr Ligue 1"}
    fbref = fbref[fbref["Comp"].isin(top5)].copy()
    print(f"After top-5 league filter: {len(fbref)} FBref players")

    df = merge_fbref_fc25(fbref, fc25)
    print(f"Merged dataframe: {len(df)} rows")

    df = _postprocess_ea_matches(df)

    before = len(df)
    df = df[df["Min"] >= 600].copy()
    print(f"After 600-min filter: {len(df)} rows (dropped {before - len(df)})")

    df["pos_group"] = df.apply(map_pos_group, axis=1)
    df["sub_pos"] = df.apply(map_sub_pos, axis=1)

    # Per-90 stats
    n90 = df["90s"].replace(0, np.nan)
    for col, src in [
        ("xG_90", "xG"), ("npxG_90", "npxG"), ("xAG_90", "xAG"),
        ("SCA_90", "SCA"), ("GCA_90", "GCA"), ("Sh_90", "Sh"), ("SoT_90", "SoT"),
        ("PrgP_90", "PrgP"), ("PrgC_90", "PrgC"), ("KP_90", "KP"),
        ("TklInt_90", "Tkl+Int"), ("Blocks_90", "Blocks"), ("Clr_90", "Clr"),
        ("TO_90", "TO"), ("Recov_90", "Recov"), ("TB_90", "TB"),
        ("ShDef_90", "Sh_stats_defense"), ("Final3rd_90", "1/3_stats_possession"),
        ("Tkl_90", "Tkl"), ("Int_90", "Int"), ("Fls_90", "Fls"),
        ("Fld_misc_90", "Fld_stats_misc"), ("Off_misc_90", "Off_stats_misc"),
        ("CPA_90", "CPA"), ("Mis_90", "Mis"), ("PPA_90", "PPA"),
        ("CrsPA_90", "CrsPA"), ("xA_90", "xA"), ("AttPen_90", "Att Pen"),
        ("Err_90", "Err"), ("Offsides_90", "Off_stats_misc"),
        ("DrblAtt_90", "Att_stats_defense"), ("PassBlk_90", "Pass"),
        ("GKThr_90", "Thr"),
    ]:
        df[col] = df[src] / n90

    # Rate stats (already percentages)
    df["AerialWon_pct"] = df["Won%"]
    df["Cmp_pct"] = df["Cmp%"]
    df["Succ_pct"] = df["Succ%"]
    df["SoT_pct"] = df["SoT%"]
    df["Tkl_pct"] = df["Tkl%"]

    # GK metrics
    df["PSxG_pm"] = df["PSxG+/-"]
    df["PSxG_pm90"] = df["/90"]
    df["Save_pct"] = df["Save%"]
    df["CS_pct"] = df["CS%"]
    df["GKCmp_pct"] = df["Cmp%_stats_keeper_adv"]
    df["OPA_90"] = df["#OPA/90"]
    df["Stp_pct"] = df["Stp%"]
    df["Launch_pct"] = df["Launch%"]
    df["GA90_inv"] = -df["GA90"].fillna(0)
    df["PSxG_SoT"] = df["PSxG/SoT"]
    df["AvgDist_col"] = df["AvgDist"]

    df = compute_pca_composite(df)

    # Reputation gap per sub-position (residual from OVR regression)
    df["gap"] = np.nan
    for sp in SUBPOS_STATS:
        mask = df["sub_pos"] == sp
        if mask.sum() < 5:
            continue
        ovr = df.loc[mask, "ea_OVR"].values.astype(float)
        comp = df.loc[mask, "composite"].values.astype(float)
        slope, intercept = linregress(ovr, comp)
        df.loc[mask, "gap"] = comp - (intercept + slope * ovr)

    df = merge_transfermarkt(df)
    df["league_short"] = df["Comp"].map(LEAGUE_SHORT).fillna(df["Comp"])
    df["nineties"] = df["90s"]

    # Build output records
    records = []
    for _, row in df.iterrows():
        pos = row["pos_group"]

        # Composite metrics and weights for this position (PCA-driven)
        sub_pos = row["sub_pos"]
        pca_w_str = row.get("pca_weights_json", "{}")
        try:
            pca_weights_raw = json.loads(pca_w_str) if isinstance(pca_w_str, str) and pca_w_str else {}
        except (json.JSONDecodeError, TypeError):
            pca_weights_raw = {}
        composite_metrics = []
        composite_weights = {}
        for col, w in pca_weights_raw.items():
            json_key = COL_TO_KEY.get(col, col)
            composite_metrics.append(json_key)
            composite_weights[json_key] = w

        sub_scores = {}
        dim_weights_out = {}
        for dim in ("scoring", "creation", "progression", "defense", "discipline"):
            sv = safe_float(row, "sub_score_" + dim, 1)
            dw = safe_float(row, "dim_weight_" + dim, 4)
            sub_scores[dim] = sv if sv is not None else 50.0
            dim_weights_out[dim] = dw if dw is not None else 0.0

        # Build EA sub-attributes object
        ea_obj = {
            "ovr": safe_int(row, "ea_OVR"),
            "pac": safe_int(row, "ea_PAC"),
            "sho": safe_int(row, "ea_SHO"),
            "pas": safe_int(row, "ea_PAS"),
            "dri": safe_int(row, "ea_DRI"),
            "def": safe_int(row, "ea_DEF"),
            "phy": safe_int(row, "ea_PHY"),
        }
        for csv_col, json_key in EA_SUB_MAP.items():
            ea_obj[json_key] = safe_int(row, csv_col)

        # Build real stats object
        real_obj = {
            "gls": safe_int(row, "Gls"),
            "ast": safe_int(row, "Ast"),
            "gpa": safe_int(row, "G+A"),
            "gpk": safe_int(row, "G-PK"),
            "xg90": safe_float(row, "xG_90", 2),
            "npxg90": safe_float(row, "npxG_90", 2),
            "xag90": safe_float(row, "xAG_90", 2),
            "sca90": safe_float(row, "SCA_90", 2),
            "gca90": safe_float(row, "GCA_90", 2),
            "sh90": safe_float(row, "Sh_90", 2),
            "sot90": safe_float(row, "SoT_90", 2),
            "sotpct": safe_float(row, "SoT%", 1),
            "npxgpsh": safe_float(row, "npxG/Sh", 2),
            "dist": safe_float(row, "Dist", 1),
            "fkGoals": safe_int(row, "FK"),
            "kp90": safe_float(row, "KP_90", 2),
            "ppa90": safe_float(row, "PPA_90", 2),
            "crspa90": safe_float(row, "CrsPA_90", 2),
            "tb90": safe_float(row, "TB_90", 2),
            "xa90": safe_float(row, "xA_90", 2),
            "prgc90": safe_float(row, "PrgC_90", 2),
            "prgp90": safe_float(row, "PrgP_90", 2),
            "cpa90": safe_float(row, "CPA_90", 2),
            "final3rd90": safe_float(row, "Final3rd_90", 2),
            "to90": safe_float(row, "TO_90", 2),
            "succpct": safe_float(row, "Succ_pct", 1),
            "mis90": safe_float(row, "Mis_90", 2),
            "tklint90": safe_float(row, "TklInt_90", 2),
            "tkl90": safe_float(row, "Tkl_90", 2),
            "tklpct": safe_float(row, "Tkl%", 1),
            "int90": safe_float(row, "Int_90", 2),
            "blocks90": safe_float(row, "Blocks_90", 2),
            "clr90": safe_float(row, "Clr_90", 2),
            "shblocks90": safe_float(row, "ShDef_90", 2),
            "recov90": safe_float(row, "Recov_90", 2),
            "aerialwon": safe_float(row, "AerialWon_pct", 1),
            "fls90": safe_float(row, "Fls_90", 2),
            "fld90": safe_float(row, "Fld_misc_90", 2),
            "offsides90": safe_float(row, "Off_misc_90", 2),
            "pkwon": safe_int(row, "PKwon"),
            "pkcon": safe_int(row, "PKcon"),
            "cmppct": safe_float(row, "Cmp_pct", 1),
            "gxg": safe_float(row, "G-xG", 2),
            "axag": safe_float(row, "A-xAG", 2),
            "npgxg": safe_float(row, "np:G-xG", 2),
            "minpct": safe_float(row, "Min%", 1),
            "psxgpm": safe_float(row, "PSxG_pm", 2),
            "psxgpm90": safe_float(row, "PSxG_pm90", 2),
            "savepct": safe_float(row, "Save_pct", 1),
            "cspct": safe_float(row, "CS_pct", 1),
            "gkdist": safe_float(row, "GKCmp_pct", 1),
            "opa90": safe_float(row, "OPA_90", 2),
            "stppct": safe_float(row, "Stp_pct", 1),
            "launchpct": safe_float(row, "Launch_pct", 1),
            "pka": safe_int(row, "PKA"),
            "pksv": safe_int(row, "PKsv"),
            "pkm": safe_int(row, "PKm"),

            "touches": safe_int(row, "Touches"),
            "touchDefPen": safe_int(row, "Def Pen"),
            "touchDef3rd": safe_int(row, "Def 3rd_stats_possession"),
            "touchMid3rd": safe_int(row, "Mid 3rd_stats_possession"),
            "touchAtt3rd": safe_int(row, "Att 3rd_stats_possession"),
            "touchAttPen": safe_int(row, "Att Pen"),
            "touchLive": safe_int(row, "Live_stats_possession"),
            "tklDef3rd": safe_int(row, "Def 3rd"),
            "tklMid3rd": safe_int(row, "Mid 3rd"),
            "tklAtt3rd": safe_int(row, "Att 3rd"),

            "mp": safe_int(row, "MP"),
            "starts": safe_int(row, "Starts"),
            "subs": safe_int(row, "Subs"),
            "compl": safe_int(row, "Compl"),
            "mnPerMp": safe_int(row, "Mn/MP"),
            "mnPerStart": safe_int(row, "Mn/Start"),
            "mnPerSub": safe_int(row, "Mn/Sub"),
            "unSub": safe_int(row, "unSub"),

            "passCmp": safe_int(row, "Cmp"),
            "passAtt": safe_int(row, "Att"),
            "passTotDist": safe_int(row, "TotDist"),
            "passPrgDist": safe_int(row, "PrgDist"),
            "passLive": safe_int(row, "Live"),
            "passDead": safe_int(row, "Dead"),
            "passFK": safe_int(row, "FK_stats_passing_types"),
            "passTB": safe_int(row, "TB"),
            "passSw": safe_int(row, "Sw"),
            "passCrs": safe_int(row, "Crs"),
            "passTI": safe_int(row, "TI"),
            "passCK": safe_int(row, "CK"),
            "passCKIn": safe_int(row, "In"),
            "passCKOut": safe_int(row, "Out"),
            "passCKStr": safe_int(row, "Str"),
            "passBlocked": safe_int(row, "Blocks"),
            "passOff": safe_int(row, "Off"),

            "carries": safe_int(row, "Carries"),
            "carriesTotDist": safe_int(row, "TotDist_stats_possession"),
            "carriesPrgDist": safe_int(row, "PrgDist_stats_possession"),
            "carriesPrgC": safe_int(row, "PrgC"),
            "carries1_3": safe_int(row, "1/3_stats_possession"),
            "carriesCPA": safe_int(row, "CPA"),
            "carriesDis": safe_int(row, "Dis"),
            "carriesRec": safe_int(row, "Rec"),
            "carriesMis": safe_int(row, "Mis"),
            "toAtt": safe_int(row, "Att_stats_possession"),
            "toSucc": safe_int(row, "Succ"),
            "tkld": safe_int(row, "Tkld"),
            "tkldPct": safe_float(row, "Tkld%", 1),
            "prgR": safe_int(row, "PrgR"),

            "crdY": safe_int(row, "CrdY"),
            "crdR": safe_int(row, "CrdR"),
            "crd2Y": safe_int(row, "2CrdY"),
            "fls": safe_int(row, "Fls"),
            "fld": safe_int(row, "Fld_stats_misc"),
            "og": safe_int(row, "OG"),
            "err": safe_int(row, "Err"),

            "onG": safe_float(row, "onG", 1),
            "onGA": safe_float(row, "onGA", 1),
            "plusMinus": safe_float(row, "+/-", 1),
            "plusMinus90": safe_float(row, "+/-90", 2),
            "onOff": safe_float(row, "On-Off", 2),
            "onxG": safe_float(row, "onxG", 1),
            "onxGA": safe_float(row, "onxGA", 1),
            "xgPlusMinus": safe_float(row, "xG+/-", 1),
            "xgPlusMinus90": safe_float(row, "xG+/-90", 2),
            "ppm": safe_float(row, "PPM", 2),

            "scaPassLive": safe_int(row, "PassLive"),
            "scaPassDead": safe_int(row, "PassDead"),
            "scaTO": safe_int(row, "TO"),
            "scaSh": safe_int(row, "Sh_stats_gca"),
            "scaFld": safe_int(row, "Fld"),
            "scaDef": safe_int(row, "Def"),
            "sca": safe_int(row, "SCA"),
            "gca": safe_int(row, "GCA"),

            "gPerSh": safe_float(row, "G/Sh", 2),
            "gPerSoT": safe_float(row, "G/SoT", 2),
            "tklW": safe_int(row, "TklW"),
            "challengesLost": safe_int(row, "Lost"),
            "passBlk": safe_int(row, "Pass"),
            "drblAtt": safe_int(row, "Att_stats_defense"),
            "aerialWon": safe_int(row, "Won"),
            "aerialLost": safe_int(row, "Lost_stats_misc"),

            "ga": safe_int(row, "GA"),
            "ga90": safe_float(row, "GA90", 2),
            "sota": safe_int(row, "SoTA"),
            "saves": safe_int(row, "Saves"),
            "gkW": safe_int(row, "W"),
            "gkD": safe_int(row, "D"),
            "gkL": safe_int(row, "L"),
            "cs": safe_int(row, "CS"),
            "psxg": safe_float(row, "PSxG", 1),
            "psxgPerSoT": safe_float(row, "PSxG/SoT", 2),
            "gkCmp": safe_int(row, "Cmp_stats_keeper_adv"),
            "gkAtt": safe_int(row, "Att_stats_keeper_adv"),
            "gkCmpPct": safe_float(row, "Cmp%_stats_keeper_adv", 1),
            "gkGoalKicks": safe_int(row, "Att (GK)"),
            "gkThr": safe_int(row, "Thr"),
            "gkAvgLen": safe_float(row, "AvgLen", 1),
            "gkOpp": safe_int(row, "Opp"),
            "gkStp": safe_int(row, "Stp"),
            "gkOPA": safe_int(row, "#OPA"),
            "gkAvgDist": safe_float(row, "AvgDist", 1),
            "gkFKConceded": safe_int(row, "FK_stats_keeper_adv"),
            "gkCKConceded": safe_int(row, "CK_stats_keeper_adv"),
            "gkOGConceded": safe_int(row, "OG"),
        }

        # Transfermarkt injury object
        injuries_obj = None
        if pd.notna(row.get("tm_inj_count")) and row["tm_inj_count"] is not None:
            injuries_obj = {
                "count": int(row["tm_inj_count"]),
                "daysMissed": int(row["tm_inj_days_missed"]) if pd.notna(row.get("tm_inj_days_missed")) else 0,
                "gamesMissed": int(row["tm_inj_games_missed"]) if pd.notna(row.get("tm_inj_games_missed")) else 0,
                "latest": row["tm_inj_latest"] if pd.notna(row.get("tm_inj_latest")) else None,
            }

        rec = {
            "name": row["ea_Name"] if pd.notna(row.get("ea_Name")) else row["Player"],
            "club": row["Squad"],
            "league": row["league_short"],
            "pos": pos,
            "subPos": sub_pos,
            "age": int(row["Age"]) if pd.notna(row.get("Age")) else None,
            "minutes": int(row["Min"]) if pd.notna(row.get("Min")) else None,
            "nineties": round(float(row["nineties"]), 1) if pd.notna(row.get("nineties")) else None,
            "composite": round(float(row["composite"]), 1) if pd.notna(row.get("composite")) else None,
            "gap": round(float(row["gap"]), 1) if pd.notna(row.get("gap")) else None,
            "compositeMetrics": composite_metrics,
            "compositeWeights": composite_weights,
            "subScores": sub_scores,
            "dimWeights": dim_weights_out,
            "ea": ea_obj,
            "real": real_obj,
            # Transfermarkt fields
            "photo": row["tm_photo"] if pd.notna(row.get("tm_photo")) else None,
            "nationality": row["tm_nationality"] if pd.notna(row.get("tm_nationality")) else None,
            "height": int(row["tm_height"]) if pd.notna(row.get("tm_height")) else None,
            "foot": row["tm_foot"] if pd.notna(row.get("tm_foot")) else None,
            "positionDetail": row["tm_position_detail"] if pd.notna(row.get("tm_position_detail")) else None,
            "contractExpires": row["tm_contract_expires"] if pd.notna(row.get("tm_contract_expires")) else None,
            "marketValue": int(row["tm_market_value"]) if pd.notna(row.get("tm_market_value")) else None,
            "marketValueDate": row["tm_market_value_date"] if pd.notna(row.get("tm_market_value_date")) else None,
            "marketValueLatest": int(row["tm_market_value_latest"]) if pd.notna(row.get("tm_market_value_latest")) else None,
            "marketValueLatestDate": row["tm_market_value_latest_date"] if pd.notna(row.get("tm_market_value_latest_date")) else None,
            "injuries": injuries_obj,
        }
        records.append(rec)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    import os
    size_kb = os.path.getsize(OUT_PATH) / 1024
    pos_counts = {}
    for r in records:
        pos_counts[r["pos"]] = pos_counts.get(r["pos"], 0) + 1
    gaps = [r["gap"] for r in records if r["gap"] is not None]
    tm_count = sum(1 for r in records if r["photo"] is not None)
    null_comp = sum(1 for r in records if r["composite"] is None)

    print(f"\nWrote {len(records)} players to {OUT_PATH} ({size_kb:.0f} KB)")
    print(f"  Positions: {pos_counts}")
    print(f"  Gap: mean={np.mean(gaps):.2f}, std={np.std(gaps):.2f}, range=[{min(gaps):.1f}, {max(gaps):.1f}]")
    print(f"  TM matched: {tm_count}/{len(records)}, null composites: {null_comp}")


if __name__ == "__main__":
    build()
