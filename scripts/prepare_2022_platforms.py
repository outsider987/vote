"""Link every 2022 candidate to their page in the official CEC election bulletin.

Run after prepare_2022_profiles.py. Requires PyMuPDF. The source PDFs are cached under
.cache/cec-2022/bulletins and are not published with the site.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from hashlib import sha1
from html import unescape
import json
from pathlib import Path
import re
import time
import unicodedata
from urllib.parse import quote, unquote
from urllib.request import Request, urlopen

import fitz


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/cec-2022/bulletins"
BASE = "https://bulletin.cec.gov.tw/"
CATEGORIES = ("03直轄市長", "04縣市長", "05直轄市議員", "06縣市議員")
CHINESE = {s: i for i, s in enumerate("零一二三四五六七八九")}


def fetch(url: str) -> bytes:
    request = Request(quote(url, safe="/:?=&%"), headers={"User-Agent": "vote-2022-replay/1.0"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=90) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise AssertionError("unreachable")


def bulletin_paths() -> list[str]:
    listing = CACHE / "paths.txt"
    if listing.exists():
        return [p for p in listing.read_text().splitlines() if "罷免" not in p]
    seen, files = set(), set()

    def visit(path: str):
        if path in seen:
            return
        seen.add(path)
        page = fetch(BASE + "?dir=" + quote(path)).decode("utf-8-sig")
        for href in re.findall(r'<a[^>]+href="([^"]+)"', page):
            href = unescape(href)
            if href.startswith("?dir="):
                child = unquote(href[5:])
                if child.startswith(path + "/") and "02有聲公報" not in child:
                    visit(child)
            elif href.lower().endswith(".pdf") and "罷免" not in href:
                files.add(unquote(href))

    for category in CATEGORIES:
        visit(f"01選舉公報/{category}/111年")
    listing.parent.mkdir(parents=True, exist_ok=True)
    listing.write_text("\n".join(sorted(files)) + "\n")
    return sorted(files)


def cached_pdf(path: str) -> Path:
    target = CACHE / "pdf" / (sha1(path.encode()).hexdigest() + ".pdf")
    if not target.exists():
        data = fetch(BASE + path)
        assert data.startswith(b"%PDF-"), path
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(".tmp")
        temporary.write_bytes(data)
        temporary.replace(target)
    return target


def normal(value: str) -> str:
    value = re.sub(r"@([0-9A-Fa-f]+)@", lambda m: chr(int(m[1], 16)), value)
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", value)).replace("台", "臺")


def number(value: str) -> int:
    if value.isdigit():
        return int(value)
    if value == "十":
        return 10
    if "十" in value:
        left, right = value.split("十")
        return (CHINESE[left] if left else 1) * 10 + (CHINESE[right] if right else 0)
    return CHINESE[value]


def district_numbers(path: str) -> set[int]:
    filename = path.rsplit("/", 1)[-1]
    match = re.search(r"第([零一二三四五六七八九十\d、，,./及第~～—–\-]+?)(?:選舉區|選區)", filename)
    if not match:
        return set()
    segment = match[1]
    tokens = [number(n) for n in re.findall(r"\d+|[零一二三四五六七八九十]+", segment)]
    result = set(tokens)
    for start, end in re.findall(r"(\d+)\s*[-~～—–]\s*(\d+)", segment):
        result.update(range(int(start), int(end) + 1))
    return result


def main():
    mayor_path = ROOT / "data/mayor-2022.json"
    council_path = ROOT / "data/council-2022.json"
    mayors = json.loads(mayor_path.read_text())
    councils = json.loads(council_path.read_text())
    names = {normal(c["name"]): c["code"] for c in mayors["counties"]}
    paths = bulletin_paths()
    paths_by_county = {}
    for path in paths:
        category = path.split("/")[1]
        if category in CATEGORIES[:2]:
            filename = normal(path.rsplit("/", 1)[-1])
            found = [code for name, code in names.items() if filename.startswith(name)]
        else:
            folder = normal(re.sub(r"^\d+", "", path.split("/")[3]))
            found = [names[folder]] if folder in names else []
        if found:
            key = ("mayor" if category in CATEGORIES[:2] else "council", found[0])
            paths_by_county.setdefault(key, []).append(path)

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(cached_pdf, path) for path in paths]
        for index, future in enumerate(as_completed(futures), 1):
            future.result()
            if index % 40 == 0:
                print(f"bulletins checked {index}/{len(futures)}", flush=True)

    pages = {}
    for index, path in enumerate(paths, 1):
        document = fitz.open(cached_pdf(path))
        pages[path] = [normal(page.get_text()) for page in document]
        if index % 40 == 0:
            print(f"bulletins indexed {index}/{len(paths)}", flush=True)

    with_page = 0
    without_page = 0

    def assign(candidate, options, district=None):
        nonlocal with_page, without_page
        assert options, (candidate["name"], district)
        name = normal(candidate["name"])
        # Pingtung district 1 is printed in two volumes, split at ballot 20.
        if district == "10013-T1-01":
            suffix = "1.pdf" if candidate["no"] <= 20 else "2.pdf"
            options = [p for p in options if p.endswith("屏東縣第01選舉區" + suffix)]
        hits = [(path, i + 1) for path in options for i, text in enumerate(pages[path]) if name in text]
        if hits:
            path, page = hits[0]
        else:
            path, page = options[0], None
        if district == "10013-T1-01":
            page = (candidate["no"] - 1) // 10 + 1 if candidate["no"] <= 20 else 1
        assert page is None or 1 <= page <= len(pages[path]), (candidate["name"], path, page)
        candidate["platformUrl"] = BASE + quote(path, safe="/") + (f"#page={page}" if page else "")
        if page:
            with_page += 1
        else:
            without_page += 1

    for county in mayors["counties"]:
        documents = paths_by_county.get(("mayor", county["code"]), [])
        assert len(documents) == 1, (county["name"], documents)
        for candidate in county["candidates"]:
            assign(candidate, documents)

    for county in councils["counties"]:
        documents = paths_by_county.get(("council", county["code"]), [])
        for district in county["districts"]:
            number_ = int(district["no"])
            options = sorted(p for p in documents if number_ in district_numbers(p))
            if not options and county["code"] == "10017" and number_ == 8:
                # Keelung prints its indigenous district in every regional PDF.
                options = sorted(documents)[:1]
            assert options, (district["id"], documents)
            for candidate in district["candidates"]:
                assign(candidate, options, district["id"])

    assert with_page + without_page == 1771, (with_page, without_page)
    mayor_path.write_text(json.dumps(mayors, ensure_ascii=False, indent=1) + "\n")
    council_path.write_text(json.dumps(councils, ensure_ascii=False, indent=1) + "\n")
    print(f"linked 1771 candidates: {with_page} exact pages, {without_page} district bulletins")


if __name__ == "__main__":
    main()
