"""Fetch and normalize CEC db (db.cec.gov.tw) 2022 councilor results into data/council-2022.json."""
import json
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
RAW = DATA / "raw" / "council"
OUT = DATA / "council-2022.json"
BASE = "https://db.cec.gov.tw/static/elections/data"

# (subject, legislator type, theme id, district type label) from /static/elections/list/ELC_T1.json and ELC_T2.json
THEMES = [
    ("T1", "T1", "25e12c45f9f5641aab4193598d5aff6e", "區域"),
    ("T1", "T2", "44cf35b1708568b94bb3b4c38a3fc74c", "平地原住民"),
    ("T1", "T3", "699b1ece9739edf4ec4662cea25a0bb3", "山地原住民"),
    ("T2", "T1", "72976331a1ea6b85cfb1ed3380ae5f35", "區域"),
    ("T2", "T2", "c8f4dc82f282bed4ebcdf0f52552cf58", "平地原住民"),
    ("T2", "T3", "4ad215cf6c4ef28b25278bd1a13bc7bf", "山地原住民"),
]

def fetch(data_type, subject, legis, theme, level, prv, city):
    """Return the rows of one db.cec static JSON file (cached under data/raw/council), or None if it doesn't exist."""
    name = f"{data_type}_{subject}_{legis}_{level}_{prv}{city}.json"
    cache = RAW / name
    if not cache.exists():
        url = f"{BASE}/{data_type}/ELC/{subject}/{legis}/{theme}/{level}/{prv}_{city}_00_000_0000.json"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                cache.write_bytes(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                cache.write_text("null")
            else:
                raise
        time.sleep(0.2)
    return json.loads(cache.read_text())

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    mayor = json.loads((DATA / "mayor-2022.json").read_text())
    counties = {c["code"]: {"code": c["code"], "name": c["name"], "kind": "直轄市議員" if c["type"] == "municipality" else "縣市議員",
                            "districts": []} for c in mayor["counties"]}
    party_colors = {p["party_name"]: "#" + p["color_code"] for p in json.loads((DATA / "raw" / "party_colors.json").read_text())}

    for subject, legis, theme, label in THEMES:
        for code, county in counties.items():
            if (subject == "T1") != (county["kind"] == "直轄市議員"):
                continue
            prv, city = code[:2], code[2:]
            profiles = fetch("profiles", subject, legis, theme, "A", prv, city)
            if not profiles:
                continue  # this county has no district of this type
            tickets = next(iter(fetch("tickets", subject, legis, theme, "A", prv, city).values()))
            towns = fetch("areas", subject, legis, theme, "D", prv, city) or {}
            for p in next(iter(profiles.values())):
                no = p["area_code"]
                county["districts"].append({
                    "id": f"{code}-{legis}-{no}",
                    "type": label,
                    "no": no,
                    "name": p["area_name"],
                    "seats": p["elected_num"],
                    "electors": p["votable_population"],
                    "votesCast": p["vote_ticket"],
                    "valid": p["valid_ticket"],
                    "invalid": p["invalid_ticket"],
                    "turnout": p["vote_to_elect"],
                    # TOWNCODE in taiwan-atlas towns TopoJSON = county code + CEC dept_code
                    "towns": [{"code": code + t["dept_code"], "name": t["area_name"]}
                              for t in towns.get(f"{prv}_{city}_{no}_000_0000", [])],
                    "candidates": sorted(({
                        "no": t["cand_no"],
                        "name": t["cand_name"],
                        "party": t["party_name"],
                        "votes": t["ticket_num"],
                        "pct": t["ticket_percent"],
                        # "*" = elected, "!" = elected through the women's reserved seat (婦女保障名額)
                        "elected": t["is_victor"].strip() in ("*", "!"),
                        "womenQuota": t["is_victor"].strip() == "!",
                        "gender": {"1": "M", "2": "F"}.get(t["cand_sex"]),
                        "birthYear": int(t["cand_birthyear"]) if t["cand_birthyear"].strip() else None,
                        "incumbent": t["is_current"] == "Y",
                    } for t in tickets if t["area_code"] == no), key=lambda x: x["no"]),
                })

    for county in counties.values():
        seats_by_party = {}
        for d in county["districts"]:
            for c in d["candidates"]:
                if c["elected"]:
                    seats_by_party[c["party"]] = seats_by_party.get(c["party"], 0) + 1
        county["seats"] = sum(d["seats"] for d in county["districts"])
        county["seatsByParty"] = dict(sorted(seats_by_party.items(), key=lambda kv: -kv[1]))

    used = sorted({c["party"] for county in counties.values() for d in county["districts"] for c in d["candidates"]})
    out = {
        "election": "2022 直轄市議員及縣市議員選舉",
        "voteDate": "2022-11-26",
        "note": "district boundaries are the 2022 ones; some changed for 2026",
        "source": "中央選舉委員會選舉資料庫 https://db.cec.gov.tw/",
        "partyColors": {name: party_colors.get(name, "#CDCDCD") for name in used},
        "counties": sorted(counties.values(), key=lambda c: c["code"]),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"wrote {OUT}")

if __name__ == "__main__":
    main()
