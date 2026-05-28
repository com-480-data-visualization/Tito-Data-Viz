"""Download club logos from TheSportsDB.

Strategy: fetch one league at a time via `search_all_teams.php?l=<league>`
which returns all 18-20 teams plus their badge URL in a single call.
Match TheSportsDB team names against `team_clubs.csv` rows using
`club_canonical` and `club_aliases` (case insensitive). Downloads the
badge into `docs/assets/clubs/<slug>.png` (or whatever extension the
URL serves).

Idempotent: skips files already on disk unless `--force`.

Run from repo root:
    python docs/scripts/fetch_logos.py
    python docs/scripts/fetch_logos.py --force
"""

import argparse
import csv
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "datasets" / "team_clubs.csv"
OUT_DIR = ROOT / "docs" / "assets" / "clubs"
ATTRIBUTION_PATH = OUT_DIR / "attribution.json"

UA = "Tito-Data-Viz/0.1 (EPFL COM-480 student project; contact via repo)"
TSDB_API = "https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php"

LEAGUE_TO_TSDB = {
    "PL": ["English Premier League", "English League Championship"],
    "La Liga": ["Spanish La Liga", "Spanish La Liga 2"],
    "Bundesliga": ["German Bundesliga", "German 2. Bundesliga"],
    "Serie A": ["Italian Serie A", "Italian Serie B"],
    "Ligue 1": ["French Ligue 1", "French Ligue 2"],
}


def slugify(name):
    txt = unicodedata.normalize("NFKD", name)
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    txt = txt.lower().strip()
    txt = re.sub(r"[^a-z0-9]+", "_", txt)
    txt = txt.strip("_")
    return txt


def normalize(name):
    txt = unicodedata.normalize("NFKD", name)
    txt = "".join(c for c in txt if not unicodedata.combining(c))
    txt = txt.lower()
    txt = re.sub(r"[^a-z0-9 ]", " ", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt


def http_get(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    delay = 1.5
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read(), resp.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise


def fetch_league(league_name):
    url = TSDB_API + "?" + urllib.parse.urlencode({"l": league_name})
    raw, _ = http_get(url)
    payload = json.loads(raw.decode("utf-8"))
    return payload.get("teams") or []


def build_match_key(name):
    n = normalize(name)
    n = re.sub(r"\b(fc|cf|f c|c f|club|the|de|of)\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def candidate_keys(row):
    keys = set()
    keys.add(build_match_key(row["club_canonical"]))
    for a in (row.get("club_aliases") or "").split("|"):
        a = a.strip()
        if a:
            keys.add(build_match_key(a))
    return [k for k in keys if k]


def best_match(row, tsdb_teams):
    keys = candidate_keys(row)
    norm_tsdb = [(t, build_match_key(t.get("strTeam") or "")) for t in tsdb_teams]
    for k in keys:
        for team, tkey in norm_tsdb:
            if tkey == k:
                return team
    for k in keys:
        for team, tkey in norm_tsdb:
            if k and (k in tkey or tkey in k):
                return team
    return None


def ext_from_url(url):
    path = urllib.parse.urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in (".svg", ".png", ".jpg", ".jpeg", ".webp"):
        return suffix
    return ".png"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-download even if file exists")
    args = parser.parse_args()

    if not CSV_PATH.exists():
        print("ERROR: missing", CSV_PATH, file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    with CSV_PATH.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)

    by_league = {}
    for r in rows:
        by_league.setdefault(r["league"], []).append(r)

    league_pool = {}
    for csv_league, tsdb_names in LEAGUE_TO_TSDB.items():
        if csv_league not in by_league:
            continue
        merged = []
        for tsdb_name in tsdb_names:
            print(f"Fetching league {csv_league} ({tsdb_name})...")
            try:
                teams = fetch_league(tsdb_name)
                print(f"  got {len(teams)} teams from TSDB")
                merged.extend(teams)
            except Exception as e:
                print(f"  ERROR: {e}")
            time.sleep(1.0)
        league_pool[csv_league] = merged

    attribution = {}
    if ATTRIBUTION_PATH.exists():
        try:
            attribution = json.loads(ATTRIBUTION_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            attribution = {}

    ok = 0
    skipped = 0
    failed = []

    for r in rows:
        club = r["club_canonical"]
        slug = slugify(club)
        existing = list(OUT_DIR.glob(slug + ".*"))
        existing = [p for p in existing if p.suffix.lower() != ".json"]
        if existing and not args.force:
            skipped += 1
            ok += 1
            continue

        for p in existing:
            p.unlink()

        pool = league_pool.get(r["league"], [])
        team = best_match(r, pool)
        if not team:
            failed.append((club, "no TSDB match"))
            continue

        badge = team.get("strBadge")
        if not badge:
            failed.append((club, "TSDB team has no badge"))
            continue

        try:
            data, ctype = http_get(badge)
        except Exception as e:
            failed.append((club, f"download failed: {e}"))
            continue

        ext = ".svg" if "svg" in (ctype or "") else ext_from_url(badge)
        dest = OUT_DIR / (slug + ext)
        dest.write_bytes(data)
        attribution[slug] = {
            "club": club,
            "source": "TheSportsDB",
            "tsdb_team": team.get("strTeam"),
            "tsdb_id": team.get("idTeam"),
            "badge_url": badge,
            "license": "TheSportsDB Free API",
            "bytes": len(data),
        }
        print(f"  fetched {club} via '{team.get('strTeam')}' ({len(data)} B) -> {dest.name}")
        ok += 1
        time.sleep(0.4)

    ATTRIBUTION_PATH.write_text(
        json.dumps(attribution, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"\nDone. ok={ok}, skipped={skipped}, failed={len(failed)} of {len(rows)}")
    if failed:
        print("\nMissing logos (need fix in team_clubs.csv aliases):")
        for club, reason in failed:
            print(f"  - {club}: {reason}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
