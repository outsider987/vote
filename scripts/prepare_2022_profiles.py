"""Add CEC candidate portraits and birth details to the 2022 replay data.

Requires Pillow and PyMuPDF. The CEC's 2022 host currently omits its TLS
intermediate. To refresh, download the public certificate from
https://sslserver.twca.com.tw/cacert/secure_sha2_2023G3.crt, convert it with
`openssl x509 -inform DER -in secure_sha2_2023G3.crt -out twca.pem`, then run
`CEC_CA_FILE=twca.pem python scripts/prepare_2022_profiles.py`.
The downloaded source files are cached in .cache/cec-2022.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
import os
from pathlib import Path
import re
import ssl
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

import fitz
from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache/cec-2022"
PORTRAITS = ROOT / "apps/web/public/portraits/2022"
CEC = "https://2022.cec.gov.tw/data"
CHIAYI_PDF = "https://web.cec.gov.tw/api/file/d3c30632-925b-43c8-81f0-d8e1f0d3667c.pdf"
KINMEN_PDF = "https://bulletin.cec.gov.tw/01選舉公報/06縣市議員/111年/18金門縣/02議員第{}選區公報.pdf"

context = ssl.create_default_context()
if os.environ.get("CEC_CA_FILE"):
    context.load_verify_locations(cafile=os.environ["CEC_CA_FILE"])


def fetch(url: str, cache: Path) -> bytes:
    if cache.exists():
        return cache.read_bytes()
    cache.parent.mkdir(parents=True, exist_ok=True)
    request = Request(quote(url, safe="/:?=&"), headers={"User-Agent": "vote-2022-replay/1.0"})
    for attempt in range(3):
        try:
            with urlopen(request, context=context, timeout=40) as response:
                data = response.read()
            cache.write_bytes(data)
            return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise AssertionError("unreachable")


def cec_json(kind: str, county: str):
    return json.loads(fetch(f"{CEC}/json/cand/{kind}/{county}.json", CACHE / "json" / f"{kind}-{county}.json"))[kind]


def same_candidate(local, official):
    assert local["no"] == official["candNo"], (local, official)
    assert re.sub(r"\s", "", local["name"]) == re.sub(r"\s", "", official["name"]), (local, official)


def add_details(local, official):
    roc = official["birth"]
    assert re.fullmatch(r"\d{7}", roc), official
    year = int(roc[:3]) + 1911
    assert local["birthYear"] == year, (local, official)
    assert local["gender"] == {"男": "M", "女": "F"}[official["gender"]], (local, official)
    local["birth"] = f"{year:04d}-{roc[3:5]}-{roc[5:7]}"
    local["birthplace"] = official["home"]


def save_portrait(data: bytes, target: Path):
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(BytesIO(data)) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((120, 152), Image.Resampling.LANCZOS)
        temporary = target.with_suffix(".tmp")
        image.save(temporary, "WEBP", quality=76, method=4)
        temporary.replace(target)


def pdf_portraits(url: str, cache: Path, x_min: int, x_max: int) -> list[bytes]:
    document = fitz.open(stream=fetch(url, cache), filetype="pdf")
    portraits = []
    for page in list(document)[1:] if "kinmen" in cache.name else [document[0]]:
        images = []
        for xref, *_ in page.get_images(full=True):
            for rect in page.get_image_rects(xref):
                if x_min <= rect.x0 <= x_max and rect.width > 100 and rect.height > 140:
                    images.append((rect.y0, xref))
        for _, xref in sorted(set(images)):
            portraits.append(document.extract_image(xref)["image"])
    return portraits


def main():
    mayor_path = ROOT / "data/mayor-2022.json"
    council_path = ROOT / "data/council-2022.json"
    mayors = json.loads(mayor_path.read_text())
    councils = json.loads(council_path.read_text())
    council_by_code = {c["code"]: c for c in councils["counties"]}
    downloads = []
    total = 0

    for county in mayors["counties"]:
        code = county["code"]
        if code != "10020":  # 嘉義市長重行選舉不在 11 月的候選人 JSON 中
            official = cec_json("C1", code)
            assert len(county["candidates"]) == len(official), code
            for local, candidate in zip(county["candidates"], official):
                same_candidate(local, candidate)
                add_details(local, candidate)
                assert candidate["img"].startswith("/json/portrait/cand/C1/"), candidate
                target = PORTRAITS / "C1" / code / f'{local["no"]}.webp'
                local["photo"] = "/" + str(target.relative_to(ROOT / "apps/web/public"))
                downloads.append((f"https://2022.cec.gov.tw/data{candidate['img']}", target))
                total += 1

        local_districts = council_by_code[code]["districts"]
        official_districts = cec_json("T", code)
        assert len(local_districts) == len(official_districts), code
        for district, official in zip(local_districts, official_districts):
            assert district["no"] == official["areaCode"], (district["id"], official["areaCode"])
            assert len(district["candidates"]) == len(official["cands"]), district["id"]
            for local, candidate in zip(district["candidates"], official["cands"]):
                same_candidate(local, candidate)
                add_details(local, candidate)
                target = PORTRAITS / "T" / code / f'{district["id"].split("-")[1]}-{district["no"]}-{local["no"]}.webp'
                local["photo"] = "/" + str(target.relative_to(ROOT / "apps/web/public"))
                if candidate["img"]:
                    assert candidate["img"].startswith("/json/portrait/cand/T/"), candidate
                    downloads.append((f"https://2022.cec.gov.tw/data{candidate['img']}", target))
                else:
                    assert code == "09020", (code, candidate)
                total += 1

    # 2022 嘉義市長補選：five photographs are in the official election bulletin.
    chiayi = next(c for c in mayors["counties"] if c["code"] == "10020")
    portraits = pdf_portraits(CHIAYI_PDF, CACHE / "pdf/chiayi-mayor.pdf", 160, 170)
    assert len(portraits) == len(chiayi["candidates"]) == 5
    dates = ["1959-01-20", "1965-07-06", "1949-10-05", "1968-03-20", "1978-02-25"]
    for local, data, birth in zip(chiayi["candidates"], portraits, dates):
        assert local["birthYear"] == int(birth[:4])
        local["birth"] = birth
        local["birthplace"] = "桃園市" if local["no"] == 4 else "嘉義市"
        target = PORTRAITS / "C1/10020" / f'{local["no"]}.webp'
        local["photo"] = "/" + str(target.relative_to(ROOT / "apps/web/public"))
        save_portrait(data, target)
        total += 1

    # The Kinmen candidate JSON omits every council portrait. Its three
    # district bulletins print them in ballot order across consecutive pages.
    kinmen = council_by_code["09020"]
    for number, chinese in enumerate("一二三", 1):
        district = kinmen["districts"][number - 1]
        portraits = pdf_portraits(KINMEN_PDF.format(chinese), CACHE / f"pdf/kinmen-{number}.pdf", 180, 190)
        assert len(portraits) == len(district["candidates"]), (number, len(portraits), len(district["candidates"]))
        for local, data in zip(district["candidates"], portraits):
            target = ROOT / "apps/web/public" / local["photo"].lstrip("/")
            save_portrait(data, target)

    def download(job):
        url, target = job
        if target.exists():
            return
        source = CACHE / "jpg" / url.removeprefix("https://2022.cec.gov.tw/data/")
        save_portrait(fetch(url, source), target)

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(download, job) for job in downloads]
        for index, future in enumerate(as_completed(futures), 1):
            future.result()
            if index % 200 == 0:
                print(f"portraits checked {index}/{len(futures)}", flush=True)

    assert total == 1771, total
    assert all((ROOT / "apps/web/public" / candidate["photo"].lstrip("/")).exists()
               for county in mayors["counties"] for candidate in county["candidates"])
    assert all((ROOT / "apps/web/public" / candidate["photo"].lstrip("/")).exists()
               for county in councils["counties"] for district in county["districts"] for candidate in district["candidates"])
    mayor_path.write_text(json.dumps(mayors, ensure_ascii=False, indent=1) + "\n")
    council_path.write_text(json.dumps(councils, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {total} matched candidate portraits and profiles")


if __name__ == "__main__":
    main()
