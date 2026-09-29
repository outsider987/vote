"""Extract the CEC's 2026 registration roster (not the approved candidate list).

Download the four PDFs from the CEC registration page before running. Their
file IDs are fixed below so a later refresh requires an explicit source review.
"""

import json
import re
from pathlib import Path
from urllib.request import Request, urlopen

import fitz


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/cec-2026/registered"
OUTPUT = ROOT / "data/registered-2026.json"
SOURCES = {
    "metro-mayor": "https://web.cec.gov.tw/api/file/bb9a8d7a-9b8a-41ec-8e23-33efd009385a.pdf",
    "metro-council": "https://web.cec.gov.tw/api/file/ccd7e51a-5fd0-4ea0-a81b-a120cd550c9c.pdf",
    "county-mayor": "https://web.cec.gov.tw/api/file/370f3bbf-6408-4fdc-b8d8-9b9214913f74.pdf",
    "county-council": "https://web.cec.gov.tw/api/file/729644ff-cb01-42bb-a052-c9b3c55a1289.pdf",
}
DATE = re.compile(r"115/(\d{2})/(\d{2})")


def extract(source, path):
    document = fitz.open(path)
    rows = []
    for page in document:
        words = page.get_text("words", sort=True)
        header = {word[4]: word for word in words if word[4] in ("姓名", "推薦之政黨", "備註")}
        name_right = (header["姓名"][0] + header["推薦之政黨"][0]) / 2
        party_right = header["備註"][0] - 6
        dates = [word for word in words if DATE.fullmatch(word[4])]
        for index, date in enumerate(dates):
            y = date[1]
            top = (dates[index - 1][1] + y) / 2 if index else 95
            bottom = (dates[index + 1][1] + y) / 2 if index + 1 < len(dates) else page.rect.height - 20
            same_line = [word for word in words if abs(word[1] - y) < 2]
            district = "".join(word[4] for word in same_line if word[0] < date[0] - 8)
            name = "".join(word[4] for word in words
                           if top <= word[1] < bottom and date[2] + 4 < word[0] < name_right)
            party = "".join(word[4] for word in words
                            if top <= word[1] < bottom and name_right < word[0] < party_right)
            assert district and name and party, (source, page.number + 1, district, name, party)
            county = re.match(r"^(.+?[縣市])", district)
            assert county, (source, district)
            month, day = DATE.fullmatch(date[4]).groups()
            rows.append({"county": county[1], "district": district if "council" in source else "",
                         "name": name, "party": party, "registeredAt": f"2026-{month}-{day}"})
    assert len(rows) == sum(len(DATE.findall(page.get_text())) for page in document)
    assert len({(row["district"] or row["county"], row["name"]) for row in rows}) == len(rows)
    return rows


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    groups = {}
    for source, url in SOURCES.items():
        path = CACHE / f"{source}.pdf"
        if not path.exists():
            with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as response:
                path.write_bytes(response.read())
        groups[source] = extract(source, path)
        print(source, len(groups[source]))
    result = {"asOf": "2026-09-07", "status": "registered-pending-review", "sources": SOURCES,
              "mayor": groups["metro-mayor"] + groups["county-mayor"],
              "council": groups["metro-council"] + groups["county-council"]}
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    print("total", len(result["mayor"]), len(result["council"]))


if __name__ == "__main__":
    main()
