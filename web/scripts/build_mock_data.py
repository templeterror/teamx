#!/usr/bin/env python3
"""Pull 2026-2027 Temple bulletin course cards and write CS BS mock data.

Schedules in the output are placeholders. This script is the record of where
the JSON came from; the app reads the JSON, not this file.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "data"
BULLETIN = "https://bulletin.temple.edu"
YEAR = "2026-2027"
UA = {"User-Agent": "Mozilla/5.0 (compatible; TeamX mock-data builder)"}

DEGREE_COURSES = [
    "CIS 1001", "CIS 1051", "CIS 1951", "CIS 1057", "CIS 1068", "CIS 1968",
    "CIS 1166", "CIS 1966", "CIS 2033", "CIS 2107", "CIS 2166", "CIS 2168",
    "CIS 3207", "CIS 3223", "CIS 3296", "CIS 4397", "CIS 4398",
    "CIS 3100", "CIS 3203", "CIS 3211", "CIS 3217", "CIS 3308", "CIS 3319",
    "CIS 3374", "CIS 3381", "CIS 3441", "CIS 3515", "CIS 3523", "CIS 3603",
    "CIS 3605", "CIS 3655", "CIS 3715", "CIS 3755", "CIS 4203", "CIS 4282",
    "CIS 4307", "CIS 4319", "CIS 4324", "CIS 4331", "CIS 4345", "CIS 4350",
    "CIS 4360", "CIS 4419", "CIS 4429", "CIS 4515", "CIS 4517", "CIS 4523",
    "CIS 4524", "CIS 4526", "CIS 4626", "CIS 4696",
    "MATH 1041", "MATH 1941", "MATH 1042", "MATH 1942", "MATH 2043",
    "MATH 2101", "MATH 2103",
    "BIOL 1011", "BIOL 1111", "BIOL 1911", "BIOL 1012", "BIOL 1112",
    "BIOL 1912", "BIOL 2112", "BIOL 2912",
    "CHEM 1021", "CHEM 1023", "CHEM 1022", "CHEM 1024",
    "CHEM 1031", "CHEM 1033", "CHEM 1032", "CHEM 1034",
    "CHEM 1951", "CHEM 1953", "CHEM 1952", "CHEM 1954",
    "EES 2001", "EES 2011", "EES 2021", "EES 2061", "EES 3051",
    "PHYS 1021", "PHYS 1061", "PHYS 1961", "PHYS 2021", "PHYS 2921",
    "PHYS 1022", "PHYS 1062", "PHYS 1962", "PHYS 2022", "PHYS 2922",
    "SCTC 1001", "SCTC 2001",
    "ENG 0802", "ENG 0812", "ENG 0902",
    "IH 0851", "IH 0951", "IH 0852", "IH 0952",
]

GENED_AREAS = {
    "gw": "https://bulletin.temple.edu/undergraduate/general-education/gw/",
    "gq": "https://bulletin.temple.edu/undergraduate/general-education/gq/",
    "gy": "https://bulletin.temple.edu/undergraduate/general-education/gy-gz/",
    "gz": "https://bulletin.temple.edu/undergraduate/general-education/gy-gz/",
    "ga": "https://bulletin.temple.edu/undergraduate/general-education/ga/",
    "gb": "https://bulletin.temple.edu/undergraduate/general-education/gb/",
    "gd": "https://bulletin.temple.edu/undergraduate/general-education/gd/",
    "gg": "https://bulletin.temple.edu/undergraduate/general-education/gg/",
    "gs": "https://bulletin.temple.edu/undergraduate/general-education/gs/",
    "gu": "https://bulletin.temple.edu/undergraduate/general-education/gu/",
}

# Intellectual Heritage page lists both GY and GZ. Split by course number.
IH_AREA = {"IH 0851": "gy", "IH 0951": "gy", "IH 0852": "gz", "IH 0952": "gz"}

CS_ELECTIVES = [
    "CIS 3100", "CIS 3203", "CIS 3211", "CIS 3217", "CIS 3308", "CIS 3319",
    "CIS 3374", "CIS 3381", "CIS 3441", "CIS 3515", "CIS 3523", "CIS 3603",
    "CIS 3605", "CIS 3655", "CIS 3715", "CIS 3755", "CIS 4203", "CIS 4282",
    "CIS 4307", "CIS 4319", "CIS 4324", "CIS 4331", "CIS 4345", "CIS 4350",
    "CIS 4360", "CIS 4419", "CIS 4429", "CIS 4515", "CIS 4517", "CIS 4523",
    "CIS 4524", "CIS 4526", "CIS 4626", "CIS 4696",
    "MATH 2043", "MATH 2101", "MATH 2103",
]

INSTRUCTORS = [
    "Avery Lang", "Jordan Ellis", "Riley Okonkwo", "Samir Shah", "Noah Brooks",
    "Maya Rahman", "Chris Dalton", "Elena Vasquez", "Parker Singh", "Quinn Adler",
    "Harper Diaz", "Rowan Blake", "Sasha Petrov", "Drew Okada", "Jamie Costa",
    "Alex Moreau", "Robin Hale", "Taylor Nguyen", "Casey Ibrahim", "Morgan Ellis",
    "Reese Kapoor", "Skyler Brooks", "Devon Cho", "Ari Mendel", "Cameron Ortiz",
    "Finley Grant", "Hayden Cole", "Jules Navarro", "Kendall Frost", "Logan Iyer",
]


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read().decode("utf-8", "replace")


def fetch_card(code: str) -> str:
    url = (
        BULLETIN
        + "/ribbit/index.cgi?page=getcourse.rjs&code="
        + urllib.parse.quote(code)
    )
    return fetch(url)


class ListItems(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.depth = 0
        self.capture = False
        self.buf: list[tuple[str, str]] = []
        self.items: list[dict] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li":
            self.depth += 1
            if self.depth == 1:
                self.capture = True
                self.buf = []
        if self.capture and tag == "a":
            match = re.search(r"showCourse\(this, '([^']+)'\)", attrs.get("onclick", ""))
            if match:
                self.buf.append(("code", match.group(1)))

    def handle_endtag(self, tag):
        if tag == "li" and self.depth:
            self.depth -= 1
            if self.depth == 0 and self.capture:
                codes = [value for kind, value in self.buf if kind == "code"]
                title = " ".join(value for kind, value in self.buf if kind == "text")
                title = re.sub(r"\s+", " ", title).strip()
                for code in codes:
                    title = title.replace(code.replace(" ", "\u00a0"), "")
                    title = title.replace(code, "")
                title = re.sub(r"\s+,", "", title)
                title = re.sub(r"\s+", " ", title).strip(" ,")
                if codes:
                    self.items.append({"codes": codes, "title": title})
                self.capture = False

    def handle_data(self, data):
        if self.capture and data.strip():
            self.buf.append(("text", data.strip()))


class CardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.mode = None
        self.title = []
        self.description = []
        self.parts: list[tuple[str, list[str]]] = []
        self._label = None
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "")
        if "courseblocktitle" in classes:
            self.mode = "title"
        elif "courseblockheaddiv" in classes or "courseblockdesc" in classes:
            if self.mode != "desc":
                self.mode = "desc"
        elif tag == "strong" and self.mode == "part":
            self._label = ""
            self.mode = "label"

    def handle_endtag(self, tag):
        if tag == "strong" and self.mode == "label":
            self.mode = "part-body"
            self._buf = []
        elif tag == "p" and self.mode == "part-body":
            label = (self._label or "").strip().rstrip(":")
            self.parts.append((label, self._buf))
            self.mode = "part"
            self._label = None
            self._buf = []

    def handle_data(self, data):
        if self.mode == "title":
            self.title.append(data)
        elif self.mode == "desc":
            self.description.append(data)
        elif self.mode == "label":
            self._label = (self._label or "") + data
        elif self.mode == "part-body":
            self._buf.append(data)
        elif data.strip() and self.mode is None and "Credit Hour" in data:
            self.title.append(data)


def parse_card(code: str, xml: str) -> dict:
    match = re.search(r"<!\[CDATA\[(.*?)\]\]>", xml, re.S)
    html = match.group(1) if match else xml
    parser = CardParser()
    # courseblockpart paragraphs: mark them before feed by a light rewrite
    html = html.replace('<p class="courseblockpart">', '<p class="courseblockpart" data-part="1">')
    parser.feed(html)
    # The parser above misses part detection. Re-parse parts with regex.
    title = clean("".join(parser.title))
    description = ""
    parts: dict[str, str] = {}
    head = re.search(r"courseblockheaddiv[^>]*>(.*?)</div>", html, re.S)
    if head:
        description = clean(re.sub(r"<[^>]+>", " ", head.group(1)))
    for label, body in re.findall(
        r"<p class=['\"]courseblockpart['\"]>\s*<strong>([^<]+)</strong>(.*?)</p>",
        html,
        re.S,
    ):
        parts[clean(label).rstrip(":")] = clean(re.sub(r"<[^>]+>", " ", body))
    if not title:
        title_match = re.search(r"courseblocktitle.*?<strong>(.*?)</strong>", html, re.S)
        title = clean(re.sub(r"<[^>]+>", " ", title_match.group(1))) if title_match else code
    return {
        "requestedCode": code,
        "titleLine": title,
        "description": description,
        "parts": parts,
        "rawHtml": html,
    }


def clean(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .").strip()


TOKEN = re.compile(
    r"""
    (?P<LPAREN>\()|
    (?P<RPAREN>\))|
    (?P<ANY>any\s+[A-Z]{2,5}\s+course\s+numbered\s+\d{4}\s+to\s+\d{4})|
    (?P<PLACEMENT>'Y'\s+in\s+[A-Z0-9]+)|
    (?P<GRADE>[A-Z][+-]?\s+or\s+higher)|
    (?P<CONCURRENT>may\s+be\s+taken\s+concurrently)|
    (?P<COURSE>[A-Z]{2,5}\s+\d{4})|
    (?P<AND>\band\b)|
    (?P<OR>\bor\b)|
    (?P<COMMA>,)|
    (?P<SKIP>[.;]|except\s+where\s+noted)
    """,
    re.X,
)


def tokenize(text: str) -> list[tuple[str, str]]:
    tokens = []
    for match in TOKEN.finditer(text):
        kind = match.lastgroup
        if kind == "SKIP":
            continue
        tokens.append((kind, match.group(0)))
    return tokens


def parse_prerequisites(raw: str | None) -> dict | None:
    if not raw:
        return None
    min_grade = None
    body = raw.strip().rstrip(".")
    prefix = re.match(
        r"Minimum grade of ([A-Z][+-]?)(?:\s*\(except where noted\))?\s+in\s+(.*)$",
        body,
    )
    if prefix:
        min_grade = prefix.group(1)
        body = prefix.group(2)
    tokens = tokenize(body)
    expression, consumed = parse_list(tokens, min_grade)
    leftover = tokens[consumed:]
    codes_in_tree = collect_codes(expression)
    codes_in_text = re.findall(r"[A-Z]{2,5}\s+\d{4}", body)
    return {
        "raw": raw,
        "minGrade": min_grade,
        "expression": expression,
        "complete": not leftover and codes_in_tree == codes_in_text,
        "unparsedTail": " ".join(value for _, value in leftover),
    }


def parse_list(tokens, default_grade, start=0):
    items = []
    ops = []
    index = start
    while index < len(tokens):
        kind, value = tokens[index]
        if kind == "RPAREN":
            break
        if kind in ("AND", "OR", "COMMA"):
            ops.append(kind)
            index += 1
            continue
        node, index = parse_atom(tokens, default_grade, index)
        if node is not None:
            items.append(node)
    if not items:
        return None, index
    if len(items) == 1:
        return items[0], index
    if "OR" in ops:
        return {"op": "any", "of": items}, index
    return {"op": "all", "of": items}, index


def parse_atom(tokens, default_grade, index):
    kind, value = tokens[index]
    if kind == "LPAREN":
        # Modifier group if it only holds grade/concurrent notes. Otherwise an expression.
        inner_end = find_close(tokens, index)
        inner = tokens[index + 1 : inner_end]
        if inner and all(token[0] in ("GRADE", "CONCURRENT", "AND", "COMMA") for token in inner):
            return None, inner_end + 1
        node, _ = parse_list(tokens, default_grade, index + 1)
        return node, inner_end + 1
    if kind == "COURSE":
        node = {"kind": "course", "code": re.sub(r"\s+", " ", value), "minGrade": default_grade, "concurrent": False}
        return apply_modifier(node, tokens, index + 1)
    if kind == "ANY":
        subject, start_n, end_n = re.search(
            r"any\s+([A-Z]{2,5})\s+course\s+numbered\s+(\d{4})\s+to\s+(\d{4})",
            value,
        ).groups()
        node = {
            "kind": "subjectRange",
            "subject": subject,
            "from": start_n,
            "to": end_n,
            "minGrade": default_grade,
            "concurrent": False,
        }
        return apply_modifier(node, tokens, index + 1)
    if kind == "PLACEMENT":
        code = re.search(r"in\s+([A-Z0-9]+)", value).group(1)
        return {"kind": "placement", "code": code}, index + 1
    return None, index + 1


def find_close(tokens, open_index) -> int:
    depth = 0
    for index in range(open_index, len(tokens)):
        if tokens[index][0] == "LPAREN":
            depth += 1
        elif tokens[index][0] == "RPAREN":
            depth -= 1
            if depth == 0:
                return index
    return len(tokens) - 1


def apply_modifier(node, tokens, index):
    if index < len(tokens) and tokens[index][0] == "LPAREN":
        end = find_close(tokens, index)
        inner = tokens[index + 1 : end]
        if inner and all(token[0] in ("GRADE", "CONCURRENT") for token in inner):
            for kind, value in inner:
                if kind == "GRADE":
                    node["minGrade"] = value.split()[0]
                if kind == "CONCURRENT":
                    node["concurrent"] = True
            index = end + 1
    while index < len(tokens) and tokens[index][0] in ("GRADE", "CONCURRENT"):
        kind, value = tokens[index]
        if kind == "GRADE":
            node["minGrade"] = value.split()[0]
        else:
            node["concurrent"] = True
        index += 1
    return node, index


def collect_codes(expression) -> list[str]:
    if not expression:
        return []
    if expression.get("kind") == "course":
        return [expression["code"]]
    codes = []
    for child in expression.get("of", []):
        codes.extend(collect_codes(child))
    return codes


def credits_from_title(title: str) -> dict:
    match = re.search(r"(\d+)\s+to\s+(\d+)\s+Credit Hour", title)
    if match:
        return {"min": int(match.group(1)), "max": int(match.group(2))}
    match = re.search(r"(\d+)\s+or\s+(\d+)\s+Credit Hour", title)
    if match:
        return {"options": [int(match.group(1)), int(match.group(2))]}
    match = re.search(r"(\d+)\s+Credit Hour", title)
    if match:
        return {"value": int(match.group(1))}
    return {}


def title_parts(title: str, fallback: str) -> tuple[str, str, str]:
    match = re.match(r"([A-Z]{2,5})\s+(\d{4})\.\s+(.*?)\.\s+\d", title)
    if not match:
        subject, number = fallback.split()
        return subject, number, title
    return match.group(1), match.group(2), match.group(3).strip()


def course_record(raw: dict, gen_ed: list[str]) -> dict:
    subject, number, name = title_parts(raw["titleLine"], raw["requestedCode"])
    code = f"{subject} {number}"
    description = raw["description"]
    offered = None
    offered_match = re.match(r"This course is typically offered in ([^.]+)\.", description)
    if offered_match:
        offered = offered_match.group(1)
        description = description[offered_match.end() :].strip()
    attributes = []
    attribute_text = raw["parts"].get("Course Attributes", "")
    if attribute_text:
        attributes = [part.strip() for part in attribute_text.split(",") if part.strip()]
    repeat_text = raw["parts"].get("Repeatability", "")
    prerequisites = parse_prerequisites(raw["parts"].get("Pre-requisites"))
    text_blob = description + " " + json.dumps(raw["parts"])
    return {
        "code": code,
        "subject": subject,
        "number": number,
        "title": name,
        "credits": credits_from_title(raw["titleLine"]),
        "description": description,
        "typicallyOffered": offered,
        "attributes": attributes,
        "repeatable": "may be repeated" in repeat_text.lower(),
        "repeatability": repeat_text or None,
        "prerequisites": prerequisites,
        "restrictions": {
            key: raw["parts"][key]
            for key in raw["parts"]
            if key not in {"Course Attributes", "Repeatability", "Pre-requisites"}
        },
        "requiresLaboratorySection": "0.0 credit Laboratory" in text_blob or "Two sections are required" in text_blob,
        "genEdAreas": gen_ed,
        "bulletinYear": YEAR,
        "source": f"{BULLETIN}/ribbit/index.cgi?page=getcourse.rjs&code={urllib.parse.quote(code)}",
    }


def load_gened_lists() -> dict[str, list[dict]]:
    lists = {}
    for area, url in {
        "gw": GENED_AREAS["gw"],
        "gq": GENED_AREAS["gq"],
        "gy-gz": GENED_AREAS["gy"],
        "ga": GENED_AREAS["ga"],
        "gb": GENED_AREAS["gb"],
        "gd": GENED_AREAS["gd"],
        "gg": GENED_AREAS["gg"],
        "gs": GENED_AREAS["gs"],
        "gu": GENED_AREAS["gu"],
    }.items():
        html = fetch(url)
        content = re.search(r'id="textcontainer"(.*)', html, re.S)
        parser = ListItems()
        parser.feed(content.group(1) if content else html)
        lists[area] = parser.items
    return lists


def day_pattern(code: str) -> str:
    return "MWF" if sum(ord(char) for char in code) % 2 == 0 else "TTh"


def section_for(course: dict, index: int) -> dict:
    credits = course["credits"]
    credit_value = credits.get("value")
    if credit_value is None:
        credit_value = credits.get("min", 3)
    pattern = day_pattern(course["code"])
    starts = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]
    start = starts[int(course["number"]) % len(starts)]
    if pattern == "MWF":
        duration = 50 if credit_value <= 3 else 65
    else:
        duration = 75 if credit_value <= 3 else 100
    hour, minute = map(int, start.split(":"))
    end_minutes = hour * 60 + minute + duration
    end = f"{end_minutes // 60:02d}:{end_minutes % 60:02d}"
    section = {
        "id": f"{course['subject']}{course['number']}-001",
        "course": course["code"],
        "section": "001",
        "days": ["Monday", "Wednesday", "Friday"] if pattern == "MWF" else ["Tuesday", "Thursday"],
        "start": start,
        "end": end,
        "instructor": INSTRUCTORS[index % len(INSTRUCTORS)],
        "campus": "Main",
        "source": "placeholder",
    }
    if course["requiresLaboratorySection"]:
        lab_pattern = "TTh" if pattern == "MWF" else "MWF"
        section["laboratory"] = {
            "section": "002",
            "days": ["Tuesday", "Thursday"] if lab_pattern == "TTh" else ["Monday", "Wednesday", "Friday"],
            "start": "18:00",
            "end": "20:00" if lab_pattern == "TTh" else "18:50",
            "instructor": INSTRUCTORS[(index + 7) % len(INSTRUCTORS)],
            "credits": 0,
            "source": "placeholder",
        }
    return section


def program_document(courses: dict[str, dict], gened_codes: dict[str, list[str]]) -> dict:
    def course_node(code: str, credits: int | None = None) -> dict:
        node = {"kind": "course", "code": code}
        if credits is not None:
            node["credits"] = credits
        return node

    def one_of(codes: list[str], credits: int) -> dict:
        return {"kind": "oneOf", "credits": credits, "courses": codes}

    return {
        "bulletinYear": YEAR,
        "bulletinUrl": f"{BULLETIN}/undergraduate/science-technology/computer-science-bs/",
        "program": {
            "code": "ST-CSCI-BS",
            "name": "Computer Science",
            "degree": "Bachelor of Science",
            "college": "College of Science and Technology",
            "campuses": ["Main", "Japan"],
        },
        "creditBudget": {
            "degreeCredits": 123,
            "majorCredits": {"min": 73, "max": 74},
            "computerScienceElectivesInsideMajor": {"min": 15, "max": 16},
            "generalEducationInAdditionToMajor": {
                "min": 25,
                "max": 26,
                "because": "GW 4, GY 3, GZ 3, GA 3 or 4, GB 3, GD 3, GG 3, and GU 3. GQ and both GS courses are waived by the major.",
            },
            "collegeSeminar": 1,
            "freeElectives": {
                "min": 22,
                "max": 24,
                "because": "123 minus the major (73 or 74), the GenEd courses that are not already inside the major (25 or 26), and the 1-credit CST seminar. The suggested academic plan's Elective rows add up to the same 22-24 credits.",
            },
        },
        "requirements": [
            {
                "id": "university",
                "title": "University requirements",
                "kind": "all",
                "children": [
                    {
                        "id": "university.credits",
                        "title": "Degree credits",
                        "kind": "creditMinimum",
                        "credits": 123,
                    },
                    {
                        "id": "university.writing-intensive",
                        "title": "Writing-intensive courses in the major",
                        "kind": "all",
                        "credits": 7,
                        "note": "Two writing-intensive courses, at least six credits, taken at Temple. Both are already required in the major.",
                        "children": [
                            course_node("CIS 3296", 4),
                            one_of(["CIS 4397", "CIS 4398"], 3),
                        ],
                    },
                    {
                        "id": "university.gened",
                        "title": "General Education",
                        "kind": "all",
                        "note": "A GenEd course counts in one area only. Grade of C- or higher. No more than two GenEd courses from a single department; foundation and transfer courses are excluded. Course numbers are 0800-0899, or 0900-0999 for Honors.",
                        "children": [
                            {
                                "id": "gened.gw",
                                "title": "Analytical Reading and Writing",
                                "attribute": "GW",
                                "kind": "oneOf",
                                "credits": 4,
                                "courses": gened_codes["gw"],
                            },
                            {
                                "id": "gened.gy",
                                "title": "Intellectual Heritage I",
                                "attribute": "GY",
                                "kind": "oneOf",
                                "credits": 3,
                                "courses": gened_codes["gy"],
                            },
                            {
                                "id": "gened.gz",
                                "title": "Intellectual Heritage II",
                                "attribute": "GZ",
                                "kind": "oneOf",
                                "credits": 3,
                                "courses": gened_codes["gz"],
                                "note": "IH I and IH II may be taken in either order, after Analytical Reading and Writing.",
                            },
                            {
                                "id": "gened.gq",
                                "title": "Quantitative Literacy",
                                "attribute": "GQ",
                                "kind": "waivedBy",
                                "credits": 4,
                                "waivedBy": ["MATH 1041", "MATH 1941", "MATH 1042", "MATH 1942", "MATH 2043"],
                                "otherwise": gened_codes["gq"],
                                "note": "CST majors waive one GQ course. Calculus I in this major is the waiver.",
                            },
                            {
                                "id": "gened.ga",
                                "title": "Arts",
                                "attribute": "GA",
                                "kind": "attribute",
                                "count": 1,
                                "credits": {"min": 3, "max": 4},
                                "courses": gened_codes["ga"],
                            },
                            {
                                "id": "gened.gb",
                                "title": "Human Behavior",
                                "attribute": "GB",
                                "kind": "attribute",
                                "count": 1,
                                "credits": 3,
                                "courses": gened_codes["gb"],
                            },
                            {
                                "id": "gened.gd",
                                "title": "Race and Diversity",
                                "attribute": "GD",
                                "kind": "attribute",
                                "count": 1,
                                "credits": 3,
                                "courses": gened_codes["gd"],
                            },
                            {
                                "id": "gened.gg",
                                "title": "World Society",
                                "attribute": "GG",
                                "kind": "attribute",
                                "count": 1,
                                "credits": 3,
                                "courses": gened_codes["gg"],
                            },
                            {
                                "id": "gened.gu",
                                "title": "U.S. Society",
                                "attribute": "GU",
                                "kind": "attribute",
                                "count": 1,
                                "credits": 3,
                                "courses": gened_codes["gu"],
                            },
                            {
                                "id": "gened.gs",
                                "title": "Science and Technology",
                                "attribute": "GS",
                                "kind": "waivedBy",
                                "credits": 6,
                                "count": 2,
                                "waivedByRequirement": "major.lab-science",
                                "otherwise": gened_codes["gs"],
                                "note": "CST majors waive both GS courses by completing one sequenced laboratory science.",
                            },
                        ],
                    },
                ],
            },
            {
                "id": "college",
                "title": "College of Science and Technology",
                "kind": "all",
                "children": [
                    {
                        "id": "college.credits",
                        "title": "Credits in CST, CLA, or Engineering",
                        "kind": "creditMinimum",
                        "credits": 90,
                    },
                    {
                        "id": "college.upper-level",
                        "title": "Upper-level credits in CST, CLA, or Engineering",
                        "kind": "creditMinimum",
                        "credits": 45,
                        "note": "Courses numbered 2000 and above.",
                    },
                    {
                        "id": "college.seminar",
                        "title": "First-year or transfer seminar",
                        "kind": "oneOf",
                        "credits": 1,
                        "courses": ["SCTC 1001", "SCTC 2001"],
                    },
                ],
            },
            {
                "id": "major",
                "title": "Computer Science BS major",
                "kind": "all",
                "credits": {"min": 73, "max": 74},
                "note": "At least 9 courses required for the major, and at least 7 CIS courses, must be completed at Temple. Major courses need a grade of C- or higher.",
                "children": [
                    course_node("CIS 1001", 1),
                    {
                        "id": "major.programming",
                        "title": "Introduction to programming",
                        "kind": "oneOf",
                        "credits": 4,
                        "courses": ["CIS 1051", "CIS 1951", "CIS 1057"],
                    },
                    one_of(["CIS 1068", "CIS 1968"], 4),
                    one_of(["CIS 1166", "CIS 1966"], 4),
                    course_node("CIS 2033", 3),
                    course_node("CIS 2107", 4),
                    course_node("CIS 2166", 4),
                    course_node("CIS 2168", 4),
                    course_node("CIS 3207", 4),
                    course_node("CIS 3223", 3),
                    course_node("CIS 3296", 4),
                    {
                        "id": "major.capstone",
                        "title": "Capstone",
                        "kind": "oneOf",
                        "credits": 3,
                        "courses": ["CIS 4398", "CIS 4397"],
                        "note": "CIS 4397 also requires a 3.0 overall GPA and a 3.3 major GPA, stated on its course card.",
                    },
                    {
                        "id": "major.electives",
                        "title": "Computer Science electives",
                        "kind": "creditsFrom",
                        "credits": {"min": 15, "max": 16},
                        "courses": CS_ELECTIVES,
                        "limits": [
                            "At most 8 credits from CIS 3381 and CIS 4282 combined.",
                            "At most 4 credits from CIS 3381.",
                            "At most one of MATH 2101, MATH 2103, and MATH 2043.",
                            "CIS 4397 or CIS 4398 counts here only when it is not the capstone.",
                            "Bulletin footnote on CIS 3381: prerequisite is CIS 4203 or CIS 4526. That line is not on the CIS 3381 course card.",
                        ],
                    },
                    {
                        "id": "major.calculus",
                        "title": "Calculus",
                        "kind": "all",
                        "credits": 8,
                        "children": [
                            one_of(["MATH 1041", "MATH 1941"], 4),
                            one_of(["MATH 1042", "MATH 1942"], 4),
                        ],
                    },
                    {
                        "id": "major.lab-science",
                        "title": "Laboratory science sequence",
                        "kind": "oneSequence",
                        "credits": 8,
                        "note": "Sequence A and sequence B come from the same department. Completing this sequence waives both GS GenEds.",
                        "options": [
                            {
                                "id": "biology",
                                "a": ["BIOL 1011", "BIOL 1111", "BIOL 1911"],
                                "b": ["BIOL 1012", "BIOL 1112", "BIOL 1912", "BIOL 2112", "BIOL 2912"],
                            },
                            {
                                "id": "chemistry",
                                "note": "Each chemistry choice is a 3-credit lecture plus a 1-credit lab. A and B may come from different chemistry tracks.",
                                "a": [
                                    ["CHEM 1021", "CHEM 1023"],
                                    ["CHEM 1031", "CHEM 1033"],
                                    ["CHEM 1951", "CHEM 1953"],
                                ],
                                "b": [
                                    ["CHEM 1022", "CHEM 1024"],
                                    ["CHEM 1032", "CHEM 1034"],
                                    ["CHEM 1952", "CHEM 1954"],
                                ],
                            },
                            {
                                "id": "earth-environmental",
                                "a": ["EES 2001"],
                                "b": ["EES 2011", "EES 2021", "EES 2061", "EES 3051"],
                                "note": "EES 2011 and EES 2061 require CHEM 1031. EES 2021 and EES 3051 do not.",
                            },
                            {
                                "id": "physics",
                                "note": "A and B may come from different physics tracks.",
                                "a": ["PHYS 1021", "PHYS 1061", "PHYS 1961", "PHYS 2021", "PHYS 2921"],
                                "b": ["PHYS 1022", "PHYS 1062", "PHYS 1962", "PHYS 2022", "PHYS 2922"],
                            },
                        ],
                    },
                ],
            },
            {
                "id": "free-electives",
                "title": "Free electives",
                "kind": "creditRange",
                "credits": {"min": 22, "max": 24},
                "note": "Any course not already used for General Education, the college seminar, or the major. This is separate from the 15-16 credit Computer Science elective block, which sits inside the 73-74 credit major.",
            },
        ],
        "coursesUsed": sorted(set(DEGREE_COURSES)),
    }


def academic_plan() -> dict:
    def row(kind, label, credits, **extra):
        item = {"kind": kind, "label": label, "credits": credits}
        item.update(extra)
        return item

    return {
        "bulletinYear": YEAR,
        "title": "Suggested academic plan for new students starting in 2026-2027",
        "program": "ST-CSCI-BS",
        "totalCredits": 123,
        "years": [
            {
                "year": 1,
                "terms": [
                    {
                        "term": "Fall",
                        "credits": 15,
                        "rows": [
                            row("course", "CIS 1001", 1, code= "CIS 1001"),
                            row("oneOf", "Introduction to programming", 4, courses= ["CIS 1051", "CIS 1951", "CIS 1057"]),
                            row("oneOf", "Calculus I", 4, courses= ["MATH 1041", "MATH 1941"]),
                            row("course", "CST First-Year Seminar", 1, code= "SCTC 1001"),
                            row("oneOf", "Analytical Reading and Writing", 4, courses= ["ENG 0802", "ENG 0812", "ENG 0902"], genEd= "GW"),
                            row("freeElective", "Free elective", 1),
                        ],
                    },
                    {
                        "term": "Spring",
                        "credits": 15,
                        "rows": [
                            row("oneOf", "Mathematical Concepts in Computing I", 4, courses= ["CIS 1166", "CIS 1966"]),
                            row("oneOf", "Program Design and Abstraction", 4, courses= ["CIS 1068", "CIS 1968"]),
                            row("oneOf", "Calculus II", 4, courses= ["MATH 1042", "MATH 1942"]),
                            row("oneOf", "Intellectual Heritage I", 3, courses= ["IH 0851", "IH 0951"], genEd= "GY"),
                        ],
                    },
                ],
            },
            {
                "year": 2,
                "terms": [
                    {
                        "term": "Fall",
                        "credits": 16,
                        "rows": [
                            row("course", "Data Structures", 4, code= "CIS 2168"),
                            row("oneOf", "Intellectual Heritage II", 3, courses= ["IH 0852", "IH 0952"], genEd= "GZ"),
                            row("genEd", "GenEd breadth", 3, areas= ["GA", "GB", "GD", "GG", "GU"]),
                            row("freeElective", "Free elective", 3),
                            row("freeElective", "Free elective", 3),
                        ],
                    },
                    {
                        "term": "Spring",
                        "credits": 16,
                        "rows": [
                            row("course", "Computational Probability and Statistics", 3, code= "CIS 2033"),
                            row("course", "Computer Systems and Low-Level Programming", 4, code= "CIS 2107"),
                            row("genEd", "GenEd breadth", 3, areas= ["GA", "GB", "GD", "GG", "GU"]),
                            row("genEd", "GenEd breadth", 3, areas= ["GA", "GB", "GD", "GG", "GU"]),
                            row("freeElective", "Free elective", 3),
                        ],
                    },
                ],
            },
            {
                "year": 3,
                "terms": [
                    {
                        "term": "Fall",
                        "credits": 16,
                        "rows": [
                            row("course", "Mathematical Concepts in Computing II", 4, code= "CIS 2166"),
                            row("course", "Introduction to Systems Programming and Operating Systems", 4, code= "CIS 3207"),
                            row("labScience", "Laboratory science A", 4, requirement= "major.lab-science", half= "a"),
                            row("genEd", "GenEd breadth", {"min": 3, "max": 4}, areas= ["GA", "GB", "GD", "GG", "GU"]),
                            row("freeElective", "Free elective", {"min": 0, "max": 1}, note= "1 credit when the GenEd breadth course is 3 credits, and 0 when it is 4."),
                        ],
                    },
                    {
                        "term": "Spring",
                        "credits": 15,
                        "rows": [
                            row("course", "Data Structures and Algorithms", 3, code= "CIS 3223"),
                            row("csElective", "Computer Science elective", 4, requirement= "major.electives"),
                            row("labScience", "Laboratory science B", 4, requirement= "major.lab-science", half= "b"),
                            row("genEd", "GenEd breadth", 3, areas= ["GA", "GB", "GD", "GG", "GU"]),
                            row("freeElective", "Free elective", 1),
                        ],
                    },
                ],
            },
            {
                "year": 4,
                "terms": [
                    {
                        "term": "Fall",
                        "credits": 15,
                        "rows": [
                            row("course", "Software Design", 4, code= "CIS 3296"),
                            row("csElective", "Computer Science elective", 4, requirement= "major.electives"),
                            row("csElective", "Computer Science elective", 4, requirement= "major.electives"),
                            row("freeElective", "Free elective", 3),
                        ],
                    },
                    {
                        "term": "Spring",
                        "credits": 15,
                        "rows": [
                            row("oneOf", "Capstone", 3, courses= ["CIS 4397", "CIS 4398"]),
                            row("csElective", "Computer Science elective", {"min": 3, "max": 4}, requirement= "major.electives"),
                            row("freeElective", "Free elective", 3),
                            row("freeElective", "Free elective", 3),
                            row("freeElective", "Free elective", {"min": 2, "max": 3}, note= "3 credits when the Computer Science elective is 3 credits, and 2 when it is 4."),
                        ],
                    },
                ],
            },
        ],
    }


def referenced_codes(expression) -> list[str]:
    return collect_codes(expression)


def main() -> None:
    print("loading gened lists")
    gened_lists = load_gened_lists()
    area_by_code: dict[str, list[str]] = {}
    groups: dict[str, list[str]] = {key: [] for key in ["gw", "gq", "gy", "gz", "ga", "gb", "gd", "gg", "gs", "gu"]}
    def is_gened_course(code: str) -> bool:
        # 08xx and 09xx are GenEd courses. Other numbers on those pages are
        # waivers for other colleges, which this degree does not use.
        number = code.split()[-1]
        return number.startswith(("08", "09"))

    for area, items in gened_lists.items():
        for item in items:
            codes = [code for code in item["codes"] if is_gened_course(code)]
            if not codes:
                continue
            if area == "gy-gz":
                assigned = [IH_AREA.get(code) for code in codes]
                target_areas = [value for value in assigned if value]
            else:
                target_areas = [area]
            for code in codes:
                for target in target_areas:
                    if code not in groups[target]:
                        groups[target].append(code)
                area_by_code.setdefault(code, [])
                for target in target_areas:
                    if target not in area_by_code[code]:
                        area_by_code[code].append(target)

    needed = set(DEGREE_COURSES)
    for codes in groups.values():
        needed.update(codes)

    cards: dict[str, dict] = {}

    def pull(code: str):
        try:
            xml = fetch_card(code)
            return code, parse_card(code, xml), None
        except Exception as error:  # noqa: BLE001
            return code, None, str(error)

    def pull_all(codes: set[str]) -> None:
        missing = [code for code in sorted(codes) if code not in cards]
        print(f"fetching {len(missing)} cards")
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = [pool.submit(pull, code) for code in missing]
            for future in as_completed(futures):
                code, card, error = future.result()
                if error:
                    print("FAILED", code, error)
                else:
                    cards[code] = card

    pull_all(needed)
    extra: set[str] = set()
    for card in cards.values():
        prereq = card["parts"].get("Pre-requisites", "")
        for code in re.findall(r"[A-Z]{2,5}\s+\d{4}", prereq):
            if code not in cards:
                extra.add(code)
    # One hop so prerequisite courses named by degree and GenEd cards exist.
    pull_all(extra)

    courses = {}
    failures = []
    for requested, card in cards.items():
        record = course_record(card, area_by_code.get(requested, []))
        prerequisites = record["prerequisites"]
        if prerequisites and not prerequisites["complete"]:
            failures.append((record["code"], prerequisites["raw"], prerequisites["unparsedTail"]))
        # Drop the parser debug flag's raw tail from the published record only after reporting.
        if prerequisites:
            record["prerequisites"] = {
                "raw": prerequisites["raw"],
                "minGrade": prerequisites["minGrade"],
                "expression": prerequisites["expression"],
            }
        courses[record["code"]] = record

    # Same-title cross-lists from a single GenEd row share one course identity.
    alias_of = {}
    for items in gened_lists.values():
        for item in items:
            if len(item["codes"]) > 1:
                primary = item["codes"][0]
                for alias in item["codes"][1:]:
                    alias_of[alias] = primary
    if "CIS 3381" in courses:
        courses["CIS 3381"]["bulletinNote"] = (
            "On the Computer Science BS elective list, footnote 3 says the prerequisite is "
            "CIS 4203 or CIS 4526. The course card itself does not list a prerequisite."
        )

    for alias, primary in alias_of.items():
        if alias in courses:
            courses[alias]["sameAs"] = primary
        if primary in courses:
            courses[primary].setdefault("alsoListedAs", [])
            if alias not in courses[primary]["alsoListedAs"]:
                courses[primary]["alsoListedAs"].append(alias)

    program = program_document(courses, groups)
    plan = academic_plan()
    sections = [section_for(course, index) for index, course in enumerate(sorted(courses.values(), key=lambda item: item["code"]))]

    ROOT.mkdir(parents=True, exist_ok=True)
    write_json(ROOT / "courses.json", {
        "bulletinYear": YEAR,
        "source": f"{BULLETIN}/ribbit/index.cgi?page=getcourse.rjs",
        "courses": courses,
    })
    write_json(ROOT / "program.json", program)
    write_json(ROOT / "academic-plan.json", plan)
    write_json(ROOT / "sections.json", {
        "source": "placeholder",
        "note": "Days, times, and instructors are made up. Each course meets Monday/Wednesday/Friday or Tuesday/Thursday. These are not Temple schedule data.",
        "sections": sections,
    })

    degree_failures = [item for item in failures if item[0] in set(DEGREE_COURSES)]
    print(f"courses {len(courses)}")
    print(f"prereq parse warnings {len(failures)}; degree-course warnings {len(degree_failures)}")
    for item in degree_failures:
        print(" DEGREE", item[0])
        print("  ", item[1][:240])
        print("  tail:", item[2][:160])
    missing_refs = []
    for code in DEGREE_COURSES:
        if code not in courses:
            missing_refs.append(code)
    print("missing degree courses", missing_refs)


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print("wrote", path)


if __name__ == "__main__":
    main()
