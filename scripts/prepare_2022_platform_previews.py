"""Build candidate-specific previews from the cached 2022 CEC bulletins.

Requires PyMuPDF, Pillow, OpenCV and NumPy. Run after prepare_2022_platforms.py.
The PDFs stay in .cache; only verified WebP crops are published. A cached photo
match can be refreshed with --rematch when the source PDFs or portraits change.
"""

from collections import Counter, defaultdict
from hashlib import sha1
import json
from pathlib import Path
import sys
from urllib.parse import unquote, urlsplit

import cv2
import fitz
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
PDFS = ROOT / ".cache/cec-2022/bulletins/pdf"
MATCHES = ROOT / ".cache/cec-2022/bulletins/face-matches.json"
PUBLIC = ROOT / "apps/web/public"
MAYORS = ROOT / "data/mayor-2022.json"
COUNCILS = ROOT / "data/council-2022.json"
SIFT = cv2.SIFT_create(nfeatures=200)
BF = cv2.BFMatcher()
# A few official PDFs embed portraits as a single strip, so photo matching
# cannot identify the row. These verified row bounds use the 1200px page render.
MANUAL_ROWS = {
    ("mayor", "連江縣", 1): (1, 368, 588),
    ("mayor", "連江縣", 2): (1, 588, 807),
    ("mayor", "連江縣", 3): (1, 807, 1028),
    ("mayor", "金門縣", 1): (1, 357, 576),
    ("mayor", "金門縣", 6): (2, 149, 369),
    ("mayor", "嘉義市", 5): (1, 988, 1172),
    ("mayor", "高雄市", 4): (1, 1186, 1450),
}


def candidates(mayors, councils):
    for county in mayors["counties"]:
        for candidate in county["candidates"]:
            yield ("mayor", county["name"], "", candidate)
    for county in councils["counties"]:
        for district in county["districts"]:
            for candidate in district["candidates"]:
                yield ("council", county["name"], district["name"], candidate)


def pdf_path(url):
    path = unquote(urlsplit(url).path[1:])
    return PDFS / (sha1(path.encode()).hexdigest() + ".pdf")


def portrait_infos(page):
    for info in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info["bbox"]
        width, height = x1 - x0, y1 - y0
        if height <= 0:
            continue
        if (.035 < width / page.rect.width < .25
                and .03 < height / page.rect.height < .25
                and .45 < width / height < 1.3
                and x0 < page.rect.width * .7):
            yield info


def page_image(page):
    scale = 1200 / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3), scale


def descriptor(image):
    gray = cv2.cvtColor(cv2.resize(image, (240, 300)), cv2.COLOR_RGB2GRAY)
    return SIFT.detectAndCompute(gray, None)[1]


def score(a, b):
    if a is None or b is None:
        return 0
    try:
        return sum(first.distance < .75 * second.distance for first, second in BF.knnMatch(a, b, k=2))
    except cv2.error:
        return 0


def match_all(grouped):
    matches = {}
    for index, (url, entries) in enumerate(grouped.items(), 1):
        document = fitz.open(pdf_path(url))
        faces = []
        for page in document:
            infos = list(portrait_infos(page))
            if not infos:
                continue
            image, scale = page_image(page)
            for info in infos:
                x0, y0, x1, y1 = info["bbox"]
                crop = image[max(0, int(y0 * scale)):int(y1 * scale), max(0, int(x0 * scale)):int(x1 * scale)]
                if not crop.size:
                    continue
                desc = descriptor(crop)
                if desc is not None and len(desc) >= 4:
                    faces.append((page.number + 1, [round(v, 2) for v in info["bbox"]], desc))
        for kind, county, district, candidate in entries:
            profile = np.asarray(Image.open(PUBLIC / candidate["photo"].lstrip("/")).convert("RGB"))
            desc = descriptor(profile)
            ranked = sorted(((score(desc, face[2]), face) for face in faces), key=lambda item: -item[0])
            best = ranked[0] if ranked else (0, None)
            second = ranked[1][0] if len(ranked) > 1 else 0
            key = (kind, county, district, candidate["no"])
            matches[key] = {"score": best[0], "second": second,
                            "page": best[1][0] if best[1] else None,
                            "bbox": best[1][1] if best[1] else None}
        if index % 25 == 0:
            print(f"matched {index}/{len(grouped)} bulletins", flush=True)
    MATCHES.parent.mkdir(parents=True, exist_ok=True)
    MATCHES.write_text(json.dumps([list(key) + [value] for key, value in matches.items()], ensure_ascii=False))
    return matches


def horizontal_lines(image, two_columns, column):
    ink = (image.min(axis=2) < 240).astype("uint8") * 255
    lines = cv2.morphologyEx(ink, cv2.MORPH_OPEN, np.ones((1, int(image.shape[1] * .22)), np.uint8))
    contours, _ = cv2.findContours(lines, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    width = image.shape[1]
    minimum = width * (.38 if two_columns else .58)
    region = (0, width * .5) if two_columns and column == 0 else (width * .5, width) if two_columns else (0, width)
    return sorted({y for contour in contours
                   for x, y, w, h in [cv2.boundingRect(contour)]
                   if w > minimum and h < 10
                   and min(x + w, region[1]) - max(x, region[0]) > minimum * .8})


def row_lines(image):
    region = image[:, int(image.shape[1] * .05):int(image.shape[1] * .95)]
    coverage = (region.min(axis=2) < 245).mean(axis=1)
    hits = np.flatnonzero(coverage > .7)
    if not len(hits):
        return []
    return [int(run[0]) for run in np.split(hits, np.flatnonzero(np.diff(hits) > 1) + 1)
            if len(run) <= 8]


def row_crop_rect(page, face, all_faces, image, scale, lines):
    x0, y0, x1, y1 = face
    if (x1 - x0) / page.rect.width > .25:
        return None
    center = (y0 + y1) / 2 * scale
    below = [bbox[1] * scale for bbox in all_faces if bbox[1] * scale > center + 5]
    limit = min(below) if below else image.shape[0] * .97
    above = [y for y in lines if y < y0 * scale]
    after = [y for y in lines if center < y < limit]
    if not above or not after:
        return None
    top, bottom = max(above), min(after)
    if bottom < y1 * scale - 8 or bottom - top < (y1 - y0) * scale * .9:
        return None
    return fitz.Rect(page.rect.width * .45, top / scale,
                     page.rect.width * .98, bottom / scale)


def crop_rect(page, face, all_faces, image, scale, two_columns, lines_by_column):
    x0, y0, x1, y1 = face
    column = int(two_columns and x0 > page.rect.width * .42)
    center = (y0 + y1) / 2 * scale
    below = sorted(bbox[1] * scale for bbox in all_faces
                   if (int(two_columns and bbox[0] > page.rect.width * .42) == column
                       and bbox[1] * scale > center + 5))
    previous = [bbox for bbox in all_faces
                if int(two_columns and bbox[0] > page.rect.width * .42) == column
                and bbox[3] * scale < y0 * scale - 5]
    limit = below[0] if below else image.shape[0] * .97
    lines = lines_by_column[column]
    above = [y for y in lines if y < y0 * scale]
    after = [y for y in lines if y1 * scale + 2 < y < limit]
    if not after or (previous and not above):
        return None
    top = max(above) if above else 0
    bottom = min(after)
    left = image.shape[1] * (.5 if column else .01 if two_columns else .45)
    right = image.shape[1] * (.99 if column else .5 if two_columns else .98)
    return fitz.Rect(left / scale, top / scale, right / scale, bottom / scale)


def main():
    only_missing = "--only-missing" in sys.argv
    mayors = json.loads(MAYORS.read_text())
    councils = json.loads(COUNCILS.read_text())
    grouped = defaultdict(list)
    entries = list(candidates(mayors, councils))
    assert len(entries) == 1771
    for entry in entries:
        grouped[entry[3]["platformUrl"].split("#")[0]].append(entry)
    if MATCHES.exists() and "--rematch" not in sys.argv:
        matches = {(kind, county, district, no): value
                   for kind, county, district, no, value in json.loads(MATCHES.read_text())}
    else:
        matches = match_all(grouped)
    assert len(matches) == len(entries), (len(matches), len(entries))
    occupied = Counter((entry[3]["platformUrl"].split("#")[0], match["page"], tuple(match["bbox"]))
                       for entry in entries
                       for match in [matches[(entry[0], entry[1], entry[2], entry[3]["no"])]]
                       if match["bbox"])

    made = 0
    uncertain = []
    name_misses = []
    for index, (url, group) in enumerate(grouped.items(), 1):
        document = fitz.open(pdf_path(url))
        raw_faces = {page.number + 1: [info["bbox"] for info in portrait_infos(page)] for page in document}
        # A bulletin can contain several districts. The current district's
        # portraits may all be on the left even when the page has two columns.
        matched_right_pages = {
            match["page"] for kind, county, district, candidate in group
            for match in [matches[(kind, county, district, candidate["no"])]]
            if match["bbox"] and match["score"] >= 15 and match["score"] - match["second"] >= 8
            and .42 < match["bbox"][0] / document[match["page"] - 1].rect.width < .65
        }
        two_columns_by_page = {
            page_no: sum(.42 < bbox[0] / document[page_no - 1].rect.width < .65 for bbox in faces) >= 2
            or page_no in matched_right_pages
            for page_no, faces in raw_faces.items()
        }
        faces_by_page = {page_no: [bbox for bbox in faces if bbox[0] / document[page_no - 1].rect.width < .3
                                         or two_columns_by_page[page_no] and .42 < bbox[0] / document[page_no - 1].rect.width < .65]
                         for page_no, faces in raw_faces.items()}
        page_cache = {}
        row_cache = {}
        page_text = {}
        for kind, county, district, candidate in group:
            if only_missing and candidate.get("platformImage"):
                made += 1
                continue
            key = (kind, county, district, candidate["no"])
            match = matches[key]
            page_no, bbox = match["page"], match["bbox"]
            location = (url, page_no, tuple(bbox)) if bbox else None
            manual = MANUAL_ROWS.get((kind, county, candidate["no"]))
            if manual:
                page_no, top, bottom = manual
                page = document[page_no - 1]
                scale = 1200 / page.rect.width
                rect = fitz.Rect(page.rect.width * .45, top / scale,
                                 page.rect.width * .98, bottom / scale)
            elif not (page_no and bbox and match["score"] >= 15
                      and match["score"] - match["second"] >= 8 and occupied[location] == 1):
                candidate.pop("platformImage", None)
                uncertain.append((county, district, candidate["no"], candidate["name"], match["score"], match["second"]))
                continue
            else:
                page = document[page_no - 1]
                two_columns = two_columns_by_page[page_no]
                if page_no not in page_cache:
                    image, scale = page_image(page)
                    page_cache[page_no] = (image, scale, {column: horizontal_lines(image, two_columns, column)
                                                           for column in range(2 if two_columns else 1)})
                image, scale, lines_by_column = page_cache[page_no]
                rect = crop_rect(page, bbox, faces_by_page[page_no], image, scale, two_columns, lines_by_column)
                if rect is None and not two_columns:
                    if page_no not in row_cache:
                        row_cache[page_no] = row_lines(image)
                    rect = row_crop_rect(page, bbox, faces_by_page[page_no], image, scale, row_cache[page_no])
            if rect is None or rect.height < 20 or rect.width < 100:
                candidate.pop("platformImage", None)
                uncertain.append((county, district, candidate["no"], candidate["name"], match["score"], match["second"]))
                continue
            # Verify the selected row when the PDF contains searchable names.
            # One-column previews show the policy half, so inspect their whole row.
            if page_no not in page_text:
                page_text[page_no] = "".join(page.get_text().split())
            name = "".join(candidate["name"].split())
            check = rect if two_columns_by_page[page_no] else fitz.Rect(0, rect.y0, page.rect.width, rect.y1)
            if name in page_text[page_no] and name not in "".join(page.get_text(clip=check).split()):
                candidate.pop("platformImage", None)
                uncertain.append((county, district, candidate["no"], candidate["name"], match["score"], match["second"]))
                name_misses.append((county, district, candidate["no"], candidate["name"]))
                continue
            width = 1500 / rect.width
            pix = page.get_pixmap(matrix=fitz.Matrix(width, width), clip=rect, alpha=False)
            preview = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            image_url = candidate["photo"].replace("/portraits/", "/platforms/")
            target = PUBLIC / image_url.lstrip("/")
            target.parent.mkdir(parents=True, exist_ok=True)
            preview.save(target, "WEBP", quality=72, method=4)
            candidate["platformImage"] = image_url
            candidate["platformUrl"] = url + f"#page={page_no}"
            made += 1
        if index % 25 == 0:
            print(f"rendered {index}/{len(grouped)} bulletins; {made} candidates", flush=True)

    MAYORS.write_text(json.dumps(mayors, ensure_ascii=False, indent=1) + "\n")
    COUNCILS.write_text(json.dumps(councils, ensure_ascii=False, indent=1) + "\n")
    used = {PUBLIC / candidate["platformImage"].lstrip("/")
            for _, _, _, candidate in entries if candidate.get("platformImage")}
    assert made + len(uncertain) == len(entries) and len(used) == made
    assert all(path.is_file() for path in used)
    for path in (PUBLIC / "platforms/2022").rglob("*.webp"):
        if path not in used:
            path.unlink()
    print(f"published {made}/1771 candidate previews; {len(uncertain)} kept the original bulletin viewer")
    print(f"rejected {len(name_misses)} previews whose row did not contain the candidate name")
    for item in uncertain:
        print("review", *item)


if __name__ == "__main__":
    main()
