"""Fetch CEC db (db.cec.gov.tw) 2022 mayor results per town (鄉鎮市區) into data/mayor-2022-towns.json."""
import json
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
RAW = DATA / "raw" / "towns"
OUT = DATA / "mayor-2022-towns.json"
BASE = "https://db.cec.gov.tw/static/elections/data"
# (subject, theme id) from /static/elections/list/ELC_C1.json and ELC_C2.json; 嘉義市 was re-held on 2022-12-18
THEMES = [("C1", "05cc7b904c7a30cc7c88d5b10898c98e"), ("C2", "63615098f5afa8ec53159c4a86fc01d3"),
          ("C2", "1275d73551f2c0caf202e803b1766057")]

def fetch(data_type, subject, theme, prv, city):
    cache = RAW / f"{data_type}_{subject}_{theme[:8]}_{prv}{city}.json"
    if not cache.exists():
        url = f"{BASE}/{data_type}/ELC/{subject}/00/{theme}/D/{prv}_{city}_00_000_0000.json"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                cache.write_bytes(r.read())
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
            cache.write_text("null")
        time.sleep(0.2)
    data = json.loads(cache.read_text())
    return next(iter(data.values())) if data else None

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    mayor = json.loads((DATA / "mayor-2022.json").read_text())
    out = {}
    for county in mayor["counties"]:
        code = county["code"]
        prv, city = code[:2], code[2:]
        for subject, theme in THEMES:
            if (subject == "C1") != (county["type"] == "municipality"):
                continue
            profiles = fetch("profiles", subject, theme, prv, city)
            tickets = fetch("tickets", subject, theme, prv, city)
            if not profiles or not tickets:
                continue
            towns = {}
            for p in profiles:
                towns[p["dept_code"]] = {
                    "code": code + p["dept_code"],   # = TOWNCODE in taiwan-atlas towns TopoJSON
                    "name": p["area_name"],
                    "electors": p["votable_population"],
                    "votesCast": p["vote_ticket"],
                    "valid": p["valid_ticket"],
                    "votes": {},
                }
            for t in tickets:
                towns[t["dept_code"]]["votes"][str(t["cand_no"])] = t["ticket_num"]
            out[code] = sorted(towns.values(), key=lambda x: x["code"])
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT} ({sum(len(v) for v in out.values())} towns in {len(out)} counties)")

if __name__ == "__main__":
    main()
