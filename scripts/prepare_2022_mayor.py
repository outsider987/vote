"""Normalize CEC db (db.cec.gov.tw) 2022 mayor/magistrate results into data/mayor-2022.json."""
import json
from pathlib import Path

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT = RAW.parent / "mayor-2022.json"

def rows(name):
    return next(iter(json.loads((RAW / name).read_text()).values()))

party_colors = {p["party_name"]: "#" + p["color_code"] for p in json.loads((RAW / "party_colors.json").read_text())}

counties = {}
for kind, prefix in (("municipality", "c1"), ("county", "c2"), ("county", "chiayi")):
    for p in rows(f"{prefix}_profiles.json"):
        code = p["prv_code"] + p["city_code"]
        counties[code] = {
            "code": code,
            "name": p["area_name"],
            "type": kind if kind == "municipality" else ("city" if p["area_name"].endswith("市") else "county"),
            "electors": p["votable_population"],
            "votesCast": p["vote_ticket"],
            "valid": p["valid_ticket"],
            "invalid": p["invalid_ticket"],
            "turnout": p["vote_to_elect"],
            "candidates": [],
        }
    for t in rows(f"{prefix}_tickets.json"):
        counties[t["prv_code"] + t["city_code"]]["candidates"].append({
            "no": t["cand_no"],
            "name": t["cand_name"],
            "party": t["party_name"],
            "votes": t["ticket_num"],
            "pct": t["ticket_percent"],
            "elected": t["is_victor"].strip() in ("*", "Y", "◎"),
            "gender": {"1": "M", "2": "F"}.get(t["cand_sex"]),
            "birthYear": int(t["cand_birthyear"]) if t["cand_birthyear"].strip() else None,
            "incumbent": t["is_current"] == "Y",
        })

for c in counties.values():
    c["candidates"].sort(key=lambda x: x["no"])

used = sorted({x["party"] for c in counties.values() for x in c["candidates"]})
out = {
    "election": "2022 直轄市長及縣市長選舉",
    "voteDate": "2022-11-26",
    "note": "嘉義市因候選人過世延至 2022-12-18 重行選舉",
    "source": "中央選舉委員會選舉資料庫 https://db.cec.gov.tw/",
    "partyColors": {name: party_colors.get(name, "#CDCDCD") for name in used},
    "counties": sorted(counties.values(), key=lambda c: c["code"]),
}
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f"wrote {OUT} ({len(out['counties'])} counties)")
