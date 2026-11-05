#!/usr/bin/env python3
"""Pull 2026-2027 Temple bulletin course cards and write the planner's mock data.

Two programs share one course catalog (courses.json) and one set of placeholder
sections (sections.json):

- Computer Science BS (ST-CSCI-BS): program.json and academic-plan.json
- Management Information Systems BBA (BU-MIS-BBA): mis-program.json and
  mis-academic-plan.json

Each program's requirement tree and suggested plan are hand-encoded from its
bulletin page, with a source URL where a rule comes from another page.
Schedules in the output are placeholders. This script is the record of where
the JSON came from; the app reads the JSON, not this file.
"""

from __future__ import annotations

import html as html_entities
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

# Pages the hand-written requirement facts below are checked against.
CS_BS_URL = f"{BULLETIN}/undergraduate/science-technology/computer-science-bs/"
CST_COLLEGE_URL = f"{BULLETIN}/undergraduate/science-technology/"
CST_COLLEGE_REQUIREMENTS_URL = CST_COLLEGE_URL + "#collegerequirementstextcontainer"
GENED_URL = f"{BULLETIN}/undergraduate/general-education/"

# Hand-written from the student's DARS audit, not generated. Its course codes are
# pulled into the catalog so every course in the record has a card.
STUDENT_RECORD = ROOT / "student-record.json"

# Prerequisite courses are fetched hop by hop until every code named in a card's
# prerequisites has a card (or is not in this year's bulletin). The cap only
# guards against a runaway chain.
PREREQ_HOPS = 8

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
    # CST College Requirements tab: these also meet the one-credit seminar.
    "UNVS 1001", "HNRS 1901", "UNVS 2002",
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
    for paragraph in re.findall(r"<p class=['\"]courseblockpart['\"]>(.*?)</p>", html, re.S):
        # One paragraph can hold several labels (Class Restrictions<br/>College Restrictions).
        for label, body in re.findall(r"<strong>([^<]+)</strong>(.*?)(?=<strong>|$)", paragraph, re.S):
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


def card_exists(xml: str) -> bool:
    """The endpoint answers an empty <courseinfo/> for a code with no card this year."""
    return "courseblocktitle" in xml


def clean(text: str) -> str:
    text = html_entities.unescape(text)
    text = text.replace("\u00a0", " ").replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .").strip()


TOKEN = re.compile(
    r"""
    (?P<LPAREN>\()|
    (?P<RPAREN>\))|
    (?P<ANY>any\s+[A-Z]{2,5}\s+course\s+numbered\s+\d{4}\s+to\s+\d{4})|
    (?P<PLACEMENT>'Y'\s+in\s+[A-Z0-9]+)|
    (?P<GRADE>(?:CR|[A-Z][+-]?)\s+or\s+higher)|
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
        r"Minimum grade of (CR|[A-Z][+-]?)(?:\s*\(except where noted\))?\s+in\s+(.*)$",
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
        "bulletinUrl": CS_BS_URL,
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
                        "source": GENED_URL,
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
                                "note": "IH I and IH II may be taken in either order. Students normally complete them soon after Analytical Reading and Writing.",
                                "source": GENED_URL,
                            },
                            {
                                "id": "gened.gq",
                                "title": "Quantitative Literacy",
                                "attribute": "GQ",
                                "kind": "waivedBy",
                                "credits": 4,
                                "waivedBy": ["MATH 1041", "MATH 1941", "MATH 1042", "MATH 1942", "MATH 2043"],
                                "otherwise": gened_codes["gq"],
                                "note": "Students who complete CST majors receive a waiver for one GQ course (Computer Science BS page). The GenEd page also lists MATH 1041, 1042, 1941, 1942 and 2043 among the courses that waive GQ; Calculus I and II are required in this major.",
                                "source": GENED_URL,
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
                                "waivedByRequirement": "major",
                                "otherwise": gened_codes["gs"],
                                "note": "Students who complete CST majors receive a waiver for both GS courses (Computer Science BS page).",
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
                        "courses": ["SCTC 1001", "SCTC 2001", "UNVS 1001", "HNRS 1901", "UNVS 2002"],
                        "note": "SCTC 1001 for entering first-year students, SCTC 2001 for transfer students. The college also accepts UNVS 1001 or HNRS 1901 in the first year, and UNVS 2002 after it. At most three attempts in total.",
                        "source": CST_COLLEGE_REQUIREMENTS_URL,
                    },
                ],
            },
            {
                "id": "major",
                "title": "Computer Science BS major",
                "kind": "all",
                "credits": {"min": 73, "max": 74},
                "note": "At least 9 courses required for the major, and at least 7 CIS courses, must be completed at Temple. The minimum grade in a course taken for the major is C- unless otherwise specified (College of Science and Technology, Bachelor of Science requirements).",
                "minGrade": "C-",
                "minGradeSource": CST_COLLEGE_REQUIREMENTS_URL,
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
                            "Bulletin footnote 3, marked on CIS 3381 and CIS 4203 in this list: prerequisite is CIS 4203 or CIS 4526. The CIS 3381 card lists no prerequisite; the CIS 4203 card lists CIS 3203 or CIS 4526.",
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
                        "note": "One sequence: Lab Science A and Lab Science B must be taken from the same department.",
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


# ---------------------------------------------------------------------------
# Management Information Systems BBA (Fox School of Business and Management)
#
# Encoded from the bulletin pages below, quoted in the research spec of
# 2026-11-04. Rules the bulletin leaves open are listed in "needsReview"
# rather than decided here.
# ---------------------------------------------------------------------------

MIS_BBA_URL = f"{BULLETIN}/undergraduate/fox-business-management/management-information-systems-bba/"
MIS_OV = MIS_BBA_URL + "#textcontainer"
MIS_REQ = MIS_BBA_URL + "#requirementstextcontainer"
MIS_PLAN = MIS_BBA_URL + "#academicplantextcontainer"
FOX_URL = f"{BULLETIN}/undergraduate/fox-business-management/"
FOX_REQ = FOX_URL + "#requirementstextcontainer"
FOX_POL = FOX_URL + "#policiestextcontainer"
GEN_FW = GENED_URL + "#ProgramFramework"
GEN_POL = GENED_URL + "#Policies_and_Requirements"
GEN_WV = GENED_URL + "#Waivers"
ABOUT_COURSES = f"{BULLETIN}/about-courses/"

MIS_LOWER_FOUNDATION = [
    ("ECON 1101", 3), ("ECON 1102", 3), ("HRM 1101", 3), ("BA 1103", 3),
    ("MIS 1101", 3), ("STAT 1001", 3), ("STAT 1102", 4), ("STAT 2103", 4),
    ("ACCT 2103", 4), ("BA 2501", 3), ("MKTG 2101", 3), ("BA 2101", 1),
    ("BA 2196", 3), ("RMI 2101", 3),
]
MIS_UPPER_FOUNDATION = [("FIN 3101", 3), ("MSOM 3101", 3), ("BA 4102", 3)]
MIS_MAJOR_CORE = ["MIS 2402", "MIS 2502", "MIS 3406", "MIS 3506", "MIS 3502"]
MIS_PROFESSIONAL_DEVELOPMENT = ["MIS 1001", "MIS 2001", "MIS 3001", "MIS 4001"]
MIS_GW = ["ENG 0802", "ENG 0812", "ENG 0902"]
MIS_GY = ["IH 0851", "IH 0951"]
MIS_GZ = ["IH 0852", "IH 0952"]
# GenEd waiver list for GQ (GEN-WV). STAT 2101, STAT 2901 and MATH 1038 have no
# 2026-2027 card; they stay in the rule because the bulletin names them.
MIS_GQ_WAIVERS = [
    "STAT 2103", "STAT 2903", "STAT 2101", "STAT 2901", "MATH 1031", "MATH 1038",
    "MATH 1041", "MATH 1042", "MATH 1941", "MATH 1942", "MATH 2043",
]
# Fox upper-division footnote 3: "2000-3999 electives can be selected from: ..."
FOX_BUSINESS_ELECTIVE_SUBJECTS = [
    "ACCT", "AS", "BA", "ECON", "FIN", "HCM", "HRM", "IB", "LGLS", "MIS", "MKTG",
    "RE", "RMI", "STAT", "SCM", "SGM",
]
# Transfer-only substitutions (Fox lower-division footnotes 3, 6 and 7).
MIS_TRANSFER_SUBSTITUTES = {
    "BA 1103": ([["LGLS 1101"]], "Transfer credit for LGLS 1101 will satisfy BA 1103."),
    "STAT 2103": (
        [["STAT 2101", "STAT 2102"]],
        "Transfer credits for STAT 2101 and STAT 2102 will satisfy STAT 2103. Students with transfer credit for STAT 2101 only should meet with an advisor to discuss options.",
    ),
    "ACCT 2103": (
        [["ACCT 2101", "ACCT 2102"]],
        "Transfer credits for ACCT 2101 and ACCT 2102 will satisfy ACCT 2103. Students with transfer credit for ACCT 2101 only should meet with an advisor to discuss options.",
    ),
}

# Every course the MIS requirement tree or plan names (cards that exist are fetched).
MIS_COURSES = sorted({
    *(code for code, _ in MIS_LOWER_FOUNDATION),
    *(code for code, _ in MIS_UPPER_FOUNDATION),
    *MIS_MAJOR_CORE, "MIS 4596", *MIS_PROFESSIONAL_DEVELOPMENT,
    *MIS_GW, *MIS_GY, *MIS_GZ, *MIS_GQ_WAIVERS,
    *(code for subs, _ in MIS_TRANSFER_SUBSTITUTES.values() for group in subs for code in group),
    "MIS 3535", "MIS 3504",
})
# Cards the spec confirms that the tree does not name: honors alternates accepted
# in prerequisites, entry math, the other MIS 2000-3999 courses, and courses named
# in Fox prerequisites.
MIS_RELATED_COURSES = [
    "MIS 1901", "ECON 1901", "ECON 1902", "BA 1903", "HRM 1901", "BA 2996",
    "RMI 2901", "FIN 3901", "MSOM 3901", "STAT 1902", "STAT 2903",
    "MATH 0701", "MATH 0702", "MATH 1021", "MATH 1022", "MATH 1031", "MATH 1041",
    "MATH 1941", "MATH 3031",
    "MIS 3505", "MIS 3507", "MIS 3534", "MIS 3536", "MIS 3538", "MIS 3580",
    "MIS 3581", "MIS 3582", "MIS 3682",
    "AS 1501", "AS 2503", "AS 2505", "ISE 2101", "SCTC 1021", "STAT 2104",
]


def mis_program_document() -> dict:
    def course(code: str, credits: int, **extra) -> dict:
        node = {"kind": "course", "code": code, "credits": credits}
        node.update(extra)
        return node

    def lower_foundation_node(code: str, credits: int) -> dict:
        if code not in MIS_TRANSFER_SUBSTITUTES:
            return course(code, credits)
        substitutes, note = MIS_TRANSFER_SUBSTITUTES[code]
        return course(
            code,
            credits,
            id=f"fox.lower-foundation.{code.lower().replace(' ', '-')}",
            transferSubstitutes=substitutes,
            note=note,
            source=FOX_REQ,
        )

    def area(id_: str, title: str, attribute: str, credits, count: int = 1) -> dict:
        node = {"id": id_, "title": title, "attribute": attribute, "kind": "attribute", "count": count, "credits": credits, "source": GEN_FW}
        return node

    return {
        "bulletinYear": YEAR,
        "bulletinUrl": MIS_BBA_URL,
        "program": {
            "code": "BU-MIS-BBA",
            "name": "Management Information Systems",
            "degree": "Bachelor of Business Administration",
            "college": "Fox School of Business and Management",
            "department": "Department of Management Information Systems",
            "campuses": ["Main"],
            "source": MIS_OV,
        },
        "creditBudget": {
            "degreeCredits": 124,
            "generalEducation": 31,
            "lowerDivisionFoundation": 43,
            "upperDivisionFoundation": 18,
            "majorCredits": 18,
            "freeElectives": 14,
            "source": FOX_REQ,
            "note": "Fox \"Summary of Graduation Requirements\" for the BBA. Twenty business courses (61 s.h.) make up the lower- and upper-division foundation. GQ is waived by STAT 2103; how the 31 GenEd credits are reached is not stated (see needsReview gened-credit-arithmetic).",
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
                        "credits": 124,
                        "minGpa": {"overall": 2.0, "major": 2.0},
                        "note": "A minimum of 124 semester hours of credit with a minimum cumulative GPA of 2.0 overall and in the major.",
                        "source": FOX_REQ,
                    },
                    {
                        "id": "university.residency",
                        "title": "Academic residency",
                        "kind": "creditMinimum",
                        "credits": 30,
                        "note": "A minimum of 30 credits must be completed at Temple University. In addition, a minimum of 50% of the business courses and the majority of the requirements of a major must be completed in the Fox School of Business and Management.",
                        "source": FOX_REQ,
                    },
                    {
                        "id": "university.writing-intensive",
                        "title": "Writing-intensive courses",
                        "kind": "all",
                        "credits": 6,
                        "minGrade": "C-",
                        "note": "All Fox students must complete a minimum of two writing-intensive courses at Temple: BA 2196 and a writing-intensive course in the major, each with a C- or better. Both are already required elsewhere in this program.",
                        "source": FOX_REQ,
                        "children": [course("BA 2196", 3), course("MIS 4596", 3)],
                    },
                    {
                        "id": "university.gened",
                        "title": "General Education",
                        "kind": "all",
                        "note": "A GenEd course counts in one area only. Grade of C- or higher. No more than two GenEd courses from a single department; foundation and transfer courses are excluded. Course numbers are 0800-0899, or 0900-0999 for Honors. GenEd courses may not be taken credit/no credit.",
                        "source": GEN_POL,
                        "children": [
                            {"id": "gened.gw", "title": "Analytical Reading and Writing", "attribute": "GW", "kind": "oneOf", "credits": 4, "courses": MIS_GW, "source": GEN_FW},
                            {"id": "gened.gy", "title": "Intellectual Heritage I", "attribute": "GY", "kind": "oneOf", "credits": 3, "courses": MIS_GY, "source": GEN_FW},
                            {"id": "gened.gz", "title": "Intellectual Heritage II", "attribute": "GZ", "kind": "oneOf", "credits": 3, "courses": MIS_GZ, "source": GEN_FW},
                            {
                                "id": "gened.gq",
                                "title": "Quantitative Literacy",
                                "attribute": "GQ",
                                "kind": "waivedBy",
                                "credits": 4,
                                "waivedBy": MIS_GQ_WAIVERS,
                                "minGrade": "C-",
                                "note": "STAT 2103, required in the lower-division foundation, waives the GenEd Quantitative Literacy requirement (Fox footnote 5). The rest are the other GQ waiver courses on the GenEd page; waiver courses need a C- or better.",
                                "source": GEN_WV,
                            },
                            area("gened.ga", "Arts", "GA", {"min": 3, "max": 4}),
                            area("gened.gb", "Human Behavior", "GB", 3),
                            area("gened.gd", "Race and Diversity", "GD", 3),
                            area("gened.gg", "World Society", "GG", 3),
                            {**area("gened.gs", "Science and Technology", "GS", 6, count=2), "note": "Not waived for this program."},
                            area("gened.gu", "U.S. Society", "GU", 3),
                        ],
                    },
                ],
            },
            {
                "id": "fox",
                "title": "Fox School of Business and Management",
                "kind": "all",
                "source": FOX_REQ,
                "children": [
                    {
                        "id": "fox.lower-foundation",
                        "title": "Lower-division foundation",
                        "kind": "all",
                        "credits": 43,
                        "minGrade": "C-",
                        "note": "A grade of C- or better must be obtained in all FSBM lower-division requirements. 1000-level courses are typically taken in freshman year; 2000-level courses in sophomore year.",
                        "source": FOX_REQ,
                        "children": [lower_foundation_node(code, credits) for code, credits in MIS_LOWER_FOUNDATION],
                    },
                    {
                        "id": "fox.upper-foundation",
                        "title": "Upper-division foundation",
                        "kind": "all",
                        "credits": 18,
                        "minGrade": "C-",
                        "note": "A grade of C- or better must be obtained in all FSBM upper-division requirements. 3000-level courses are typically taken in the junior or senior year; 4000-level courses in the senior year.",
                        "source": FOX_REQ,
                        "children": [
                            *(course(code, credits) for code, credits in MIS_UPPER_FOUNDATION),
                            {
                                "id": "fox.upper-foundation.business-electives",
                                "title": "Business electives",
                                "kind": "creditsFrom",
                                "credits": 9,
                                "count": 3,
                                "minGrade": "C-",
                                # Same shape as a prerequisite subjectRange leaf.
                                "pool": [
                                    {"kind": "subjectRange", "subject": subject, "from": "2000", "to": "3999"}
                                    for subject in FOX_BUSINESS_ELECTIVE_SUBJECTS
                                ],
                                "recommended": ["MIS 3535"],
                                "limits": [
                                    "Three courses numbered 2000-3999 from ACCT, AS, BA, ECON, FIN, HCM, HRM, IB, LGLS, MIS, MKTG, RE, RMI, STAT, SCM or SGM.",
                                    "MIS 3535 is highly recommended as a business elective (Suggested Academic Plan footnote).",
                                    "MIS 3504's card excludes Management Information Systems majors.",
                                ],
                                "note": "Please see your advisor for elective suggestions that match your career objectives.",
                                "source": FOX_REQ,
                            },
                        ],
                    },
                    {
                        "id": "fox.forward",
                        "title": "Fox Forward professional development",
                        "kind": "pointsMinimum",
                        "credits": 0,
                        "pointsPerAcademicYear": 250,
                        "minPointsPerCompetency": 20,
                        "competencies": [
                            "Critical Thinking",
                            "Communication & Teamwork",
                            "Equity & Inclusion",
                            "Civic Engagement & Leadership",
                            "Career & Self-Development",
                        ],
                        "note": "All undergraduate students are expected to earn 250 Forward points by the end of each academic year, with at least 20 points in each competency. Not a course; no credit.",
                        "source": FOX_REQ,
                    },
                ],
            },
            {
                "id": "major",
                "title": "Management Information Systems BBA major",
                "kind": "all",
                "credits": 18,
                "minGrade": "C",
                "minGpa": 2.0,
                "note": "A grade of C or better is required for all of the major courses except MIS 4596, which requires a C-. MIS students must attain a 2.0 GPA in the major and a 2.0 cumulative GPA to graduate. Fox requires a minimum of six business courses in the major.",
                "source": MIS_REQ,
                "children": [
                    {
                        "id": "major.core",
                        "title": "Major courses",
                        "kind": "all",
                        "credits": 15,
                        "minGrade": "C",
                        "children": [course(code, 3) for code in MIS_MAJOR_CORE],
                    },
                    course(
                        "MIS 4596",
                        3,
                        id="major.capstone",
                        title="Capstone",
                        minGrade="C-",
                        term="final",
                        note="This major capstone is taken in the final semester, and all prerequisites must be met.",
                        source=MIS_REQ,
                    ),
                    {
                        "id": "major.professional-development",
                        "title": "Professional development in MIS",
                        "kind": "all",
                        "credits": 0,
                        "minGrade": "CR",
                        "grading": "credit/no-credit",
                        "note": "Four zero-credit, credit/no-credit courses taken in order (each card's prerequisite is a CR in the one before). Graded on PRO Points. A student flagged X001 is not required to complete them.",
                        "source": MIS_REQ,
                        "children": [course(code, 0) for code in MIS_PROFESSIONAL_DEVELOPMENT],
                    },
                ],
            },
            {
                "id": "free-electives",
                "title": "Free electives",
                "kind": "creditRange",
                "credits": {"min": 14, "max": 14},
                "note": "Credits needed to reach 124 after GenEd, the Fox foundation and the major. May be business or non-business courses.",
                "source": FOX_REQ,
            },
        ],
        "needsReview": [
            {
                "id": "dual-major-overlap",
                "summary": "The Fox page gives two different limits for double-counting courses toward a dual major.",
                "quotes": [
                    "BBA students who choose to pursue a dual major can double-count a maximum of two courses toward both majors.",
                    "Students who choose to pursue a dual major in business can double-count a maximum of one course toward both majors.",
                ],
                "url": FOX_REQ,
            },
            {
                "id": "catalog-year",
                "summary": "Which bulletin applies: the page keys on matriculation year, but major and college requirements key on the time of declaration.",
                "quotes": [
                    "These requirements are for students who matriculated in academic year 2026-2027.",
                    "Students must follow the Major Requirements and College Requirements current at the time of declaration.",
                    "Students must follow the program requirements in effect at the time the major is declared or changed.",
                ],
                "url": MIS_REQ,
                "alsoSee": [FOX_REQ],
            },
            {
                "id": "mis-3535-prerequisite",
                "summary": "MIS 3535 is the recommended business elective, but its card prerequisite does not accept MIS 1101 (this program's intro course), and MIS 2101 and MIS 2901 have no 2026-2027 cards.",
                "quotes": [
                    "MIS 3535 is highly recommended as a business elective.",
                    "Minimum grade of C in (MIS 2101, MIS 2901, 'Y' in CRMI01, or 'Y' in CRMI04)",
                ],
                "url": MIS_PLAN,
                "alsoSee": [f"{BULLETIN}/courses/mis/"],
            },
            {
                "id": "professional-development-grade",
                "summary": "The major's grade note asks for a C in every listed course, but MIS 1001, 2001, 3001 and 4001 are zero-credit credit/no-credit courses. Encoded as CR.",
                "quotes": [
                    "A grade of C or better is required for all of the courses listed below except MIS 4596, which requires a C-.",
                    "This zero-credit, credit/no-credit, self-directed course",
                ],
                "url": MIS_REQ,
            },
            {
                "id": "business-elective-pool",
                "summary": "Not stated: whether 4000-level courses in the listed subjects count; whether a course already used for another requirement (BA 2501, MKTG 2101, RMI 2101, MIS major courses) can also be a business elective; why MSOM is absent from the subject list.",
                "quotes": [
                    "2000-3999 electives can be selected from: ACCT, AS, BA, ECON, FIN, HCM, HRM, IB, LGLS, MIS, MKTG, RE, RMI, STAT, SCM, SGM.",
                ],
                "url": FOX_REQ,
            },
            {
                "id": "fox-forward-competency-minimum",
                "summary": "Whether the 20-point minimum per competency applies per academic year or cumulatively, and whether transfer students owe points for years not spent at Fox.",
                "quotes": [
                    "The Fox School of Business and Management will expect all undergraduate students to earn 250 Forward points by the end of each of their academic years.",
                    "Students will need to earn at least 20 points in each competency",
                ],
                "url": FOX_REQ,
            },
            {
                "id": "gened-credit-arithmetic",
                "summary": "GenEd 31 and electives 14 add up only with a 3-credit Arts course, but GA is 3 or 4 credits. The bulletin does not say whether electives drop to 13 when GA is 4.",
                "quotes": [
                    "University General Education | 31",
                    "GA / Arts / 1 course, 3 or 4 credit hours",
                ],
                "url": FOX_REQ,
                "alsoSee": [GEN_FW],
            },
            {
                "id": "residency-share",
                "summary": "Whether 50% of the business courses is counted in courses or credits, and how many MIS courses make the majority of the major.",
                "quotes": [
                    "a minimum of 50% of the business courses and the majority of the requirements of a major must be completed in the Fox School of Business and Management.",
                ],
                "url": FOX_REQ,
            },
            {
                "id": "honors-alternates",
                "summary": "The BBA tables list only regular codes. The Fox BS core table and course prerequisites accept honors versions (ECON 1901/1902, BA 1903, HRM 1901, MIS 1901, STAT 1902, STAT 2903, BA 2996, RMI 2901, FIN 3901, MSOM 3901); whether they meet the BBA requirement is not stated. They are left out of the requirement nodes.",
                "quotes": [],
                "url": FOX_REQ,
            },
            {
                "id": "transfer-substitutions",
                "summary": "STAT 2101 + STAT 2102 satisfy STAT 2103 by transfer, but neither has a 2026-2027 card, so their credits are unknown. The 'STAT 2101 only' and 'ACCT 2101 only' cases go to an advisor.",
                "quotes": [
                    "Transfer credits for STAT 2101 and STAT 2102 will satisfy STAT 2103. Students with transfer credit for STAT 2101 only should meet with an advisor to discuss options.",
                ],
                "url": FOX_REQ,
            },
            {
                "id": "eng-0902-title",
                "summary": "The GW area page and the course card disagree on ENG 0902's title.",
                "quotes": ["Honors Writing About Literature ENG 0902", "Honors Analytical Reading and Writing"],
                "url": f"{GENED_URL}gw/",
            },
            {
                "id": "writing-intensive-wording",
                "summary": "The Fox page says two WI courses 'at Temple'; the BA 2196 card says two WI courses 'in their major'. Both resolve to BA 2196 and MIS 4596 here.",
                "quotes": [
                    "All Fox students must complete a minimum of two writing-intensive courses at Temple–BA 2196 and a writing-intensive course in the major.",
                    "This course counts toward the university requirement that students complete two writing-intensive courses in their major",
                ],
                "url": FOX_REQ,
            },
            {
                "id": "gened-45-plus",
                "summary": "Students with 45 or more transfer credits follow the 45+ GenEd curriculum, which is not encoded here.",
                "quotes": [
                    "Students with 45 or more transferable credits satisfy the 45+ GenEd Curriculum.",
                ],
                "url": GEN_POL,
            },
        ],
        "coursesUsed": MIS_COURSES,
    }


def mis_academic_plan() -> dict:
    def row(kind, label, credits, **extra):
        item = {"kind": kind, "label": label, "credits": credits}
        item.update(extra)
        return item

    def course(code, label, credits, **extra):
        return row("course", label, credits, code=code, **extra)

    breadth_areas = ["GA", "GB", "GD", "GG", "GS", "GU"]

    def breadth():
        return row("genEd", "GenEd breadth", 3, areas=breadth_areas)

    business_elective_note = (
        "2000-3999 electives can be selected from: ACCT, AS, BA, ECON, FIN, HCM, HRM, IB, LGLS, MIS, MKTG, RE, RMI, STAT, SCM, SGM. "
        "Please see your advisor for elective suggestions that match your career objectives. MIS 3535 is highly recommended as a business elective."
    )

    def business_elective():
        return row(
            "businessElective",
            "Business elective",
            3,
            requirement="fox.upper-foundation.business-electives",
            note=business_elective_note,
        )

    def free(credits=3):
        return row("freeElective", "Free elective", credits)

    def term(name, credits, rows):
        return {"term": name, "credits": credits, "rows": rows}

    return {
        "bulletinYear": YEAR,
        "title": "Suggested academic plan for new students starting in 2026-2027",
        "program": "BU-MIS-BBA",
        "totalCredits": 124,
        "note": "Please note that this plan is suggested only, ensuring prerequisites are met.",
        "source": MIS_PLAN,
        "years": [
            {
                "year": 1,
                "terms": [
                    term("Fall", 16, [
                        course("STAT 1001", "Quantitative Methods for Business I", 3),
                        course("ECON 1101", "Macroeconomic Principles", 3),
                        course("HRM 1101", "Leadership and Organizational Management", 3),
                        row("oneOf", "Analytical Reading and Writing", 4, courses=MIS_GW, genEd="GW"),
                        breadth(),
                    ]),
                    term("Spring", 16, [
                        course("STAT 1102", "Quantitative Methods for Business II", 4),
                        course("ECON 1102", "Microeconomic Principles", 3),
                        course("BA 1103", "Legal and Ethical Reasoning in Business", 3),
                        course("MIS 1101", "Digital Systems", 3),
                        row("oneOf", "Intellectual Heritage I", 3, courses=MIS_GY, genEd="GY"),
                    ]),
                ],
            },
            {
                "year": 2,
                "terms": [
                    term("Fall", 17, [
                        course("ACCT 2103", "Financial and Managerial Accounting for Decision Making", 4),
                        course("STAT 2103", "Statistical Business Analytics", 4, note="Waives the GenEd Quantitative Literacy requirement."),
                        course("MIS 1001", "Professional Development in MIS 1", 0),
                        course("MIS 2402", "Web Application Development", 3),
                        course("MIS 2502", "Data and Analytics", 3),
                        row("oneOf", "Intellectual Heritage II", 3, courses=MIS_GZ, genEd="GZ"),
                    ]),
                    term("Spring", 16, [
                        course("MKTG 2101", "Marketing Management", 3),
                        course("BA 2101", "Professional Development Strategies", 1),
                        course("BA 2196", "Business Communications", 3),
                        course("BA 2501", "Turning Numbers into Knowledge: Visualizing Data", 3),
                        course("MIS 2001", "Professional Development in MIS 2", 0),
                        course("MIS 3406", "Cloud Architecture", 3),
                        course("MIS 3506", "User Experience Design", 3),
                    ]),
                ],
            },
            {
                "year": 3,
                "terms": [
                    term("Fall", 15, [
                        course("RMI 2101", "Introduction to Risk Management", 3),
                        course("FIN 3101", "Financial Management", 3),
                        course("MSOM 3101", "Operations Management", 3),
                        business_elective(),
                        breadth(),
                    ]),
                    term("Spring", 15, [
                        course("MIS 3001", "Professional Development in MIS 3", 0),
                        course("MIS 3502", "Web Service Programming", 3),
                        business_elective(),
                        breadth(),
                        breadth(),
                        free(),
                    ]),
                ],
            },
            {
                "year": 4,
                "terms": [
                    term("Fall", 15, [
                        course("BA 4102", "Strategic Management", 3),
                        business_elective(),
                        breadth(),
                        breadth(),
                        breadth(),
                    ]),
                    term("Spring", 14, [
                        course("MIS 4001", "Professional Development in MIS 4", 0),
                        course("MIS 4596", "Managing Enterprise Cybersecurity", 3),
                        free(),
                        free(),
                        free(),
                        free(2),
                    ]),
                ],
            },
        ],
    }


# One entry per program. "courses" are named by the requirement tree or plan;
# "related" are extra cards worth having in the shared catalog.
PROGRAMS = [
    {
        "code": "ST-CSCI-BS",
        "courses": DEGREE_COURSES,
        "related": [],
        "document": program_document,
        "plan": academic_plan,
        "programFile": "program.json",
        "planFile": "academic-plan.json",
    },
    {
        "code": "BU-MIS-BBA",
        "courses": MIS_COURSES,
        "related": MIS_RELATED_COURSES,
        "document": lambda courses, gened_codes: mis_program_document(),
        "plan": mis_academic_plan,
        "programFile": "mis-program.json",
        "planFile": "mis-academic-plan.json",
    },
]


def referenced_codes(expression) -> list[str]:
    return collect_codes(expression)


def is_gened_course(code: str) -> bool:
    # 08xx and 09xx are GenEd courses. Other numbers on those pages are
    # waivers for other colleges, which this degree does not use.
    number = code.split()[-1]
    return number.startswith(("08", "09"))


def is_cross_list(codes: list[str]) -> bool:
    """One GenEd row with several codes is a cross-list only when every code is a
    GenEd course with the same number (ANTH 0915 / EDUC 0915). Waiver rows also
    hold several codes (BIOL 1011 — BIOL 1012), but those are sequences."""
    return len({code.split()[-1] for code in codes}) == 1 and all(map(is_gened_course, codes))


def record_course_codes(path: Path) -> set[str]:
    """Every course code in the hand-written student record, if there is one."""
    if not path.exists():
        return set()
    record = json.loads(path.read_text())
    return {course["code"] for term in record.get("terms", []) for course in term.get("courses", [])}


def prerequisite_codes(card: dict) -> set[str]:
    text = card["parts"].get("Pre-requisites", "")
    return {re.sub(r"\s+", " ", code) for code in re.findall(r"[A-Z]{2,5}\s+\d{4}", text)}


def main() -> None:
    print("loading gened lists")
    gened_lists = load_gened_lists()
    area_by_code: dict[str, list[str]] = {}
    groups: dict[str, list[str]] = {key: [] for key in ["gw", "gq", "gy", "gz", "ga", "gb", "gd", "gg", "gs", "gu"]}

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

    needed = (
        {code for spec in PROGRAMS for code in spec["courses"] + spec["related"]}
        | record_course_codes(STUDENT_RECORD)
    )
    for codes in groups.values():
        needed.update(codes)

    cards: dict[str, dict] = {}
    # Codes the bulletin has no 2026-2027 card for. They stay out of the catalog.
    not_in_bulletin: set[str] = set()

    def pull(code: str):
        try:
            xml = fetch_card(code)
            if not card_exists(xml):
                return code, None, None
            return code, parse_card(code, xml), None
        except Exception as error:  # noqa: BLE001
            return code, None, str(error)

    def pull_all(codes: set[str]) -> None:
        missing = [code for code in sorted(codes) if code not in cards and code not in not_in_bulletin]
        print(f"fetching {len(missing)} cards")
        with ThreadPoolExecutor(max_workers=12) as pool:
            futures = [pool.submit(pull, code) for code in missing]
            for future in as_completed(futures):
                code, card, error = future.result()
                if error:
                    print("FAILED", code, error)
                elif card is None:
                    not_in_bulletin.add(code)
                else:
                    cards[code] = card

    pull_all(needed)
    # Prerequisite courses, hop by hop, so no prerequisite names a course without a card.
    for _ in range(PREREQ_HOPS):
        extra = {
            code
            for card in cards.values()
            for code in prerequisite_codes(card)
            if code not in cards and code not in not_in_bulletin
        }
        if not extra:
            break
        pull_all(extra)
    else:
        print("WARNING prerequisite hops capped; some prerequisite codes have no card")

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
            if len(item["codes"]) > 1 and is_cross_list(item["codes"]):
                primary = item["codes"][0]
                for alias in item["codes"][1:]:
                    alias_of[alias] = primary
    # Computer Science BS elective list, footnote 3, is marked on both of these.
    for code in ("CIS 3381", "CIS 4203"):
        if code in courses:
            courses[code]["bulletinNote"] = (
                "On the Computer Science BS elective list, footnote 3, marked on this course, says "
                "the prerequisite is CIS 4203 or CIS 4526. This card's own prerequisite line says otherwise."
            )

    for alias, primary in alias_of.items():
        if alias in courses:
            courses[alias]["sameAs"] = primary
        if primary in courses:
            courses[primary].setdefault("alsoListedAs", [])
            if alias not in courses[primary]["alsoListedAs"]:
                courses[primary]["alsoListedAs"].append(alias)

    outputs = {}
    for spec in PROGRAMS:
        document = spec["document"](courses, groups)
        # coursesUsed lists the program's courses that have a card this year.
        document["coursesUsed"] = sorted(code for code in set(spec["courses"]) if code in courses)
        outputs[spec["programFile"]] = document
        outputs[spec["planFile"]] = spec["plan"]()
    # Placeholder sections already written keep their made-up meeting and instructor,
    # so adding a course to the catalog does not reshuffle the others.
    sections_path = ROOT / "sections.json"
    kept_sections = {}
    if sections_path.exists():
        kept_sections = {item["course"]: item for item in json.loads(sections_path.read_text())["sections"]}
    sections = [
        kept_sections.get(course["code"]) or section_for(course, index)
        for index, course in enumerate(sorted(courses.values(), key=lambda item: item["code"]))
    ]

    ROOT.mkdir(parents=True, exist_ok=True)
    write_json(ROOT / "courses.json", {
        "bulletinYear": YEAR,
        "source": f"{BULLETIN}/ribbit/index.cgi?page=getcourse.rjs",
        # Sorted by code: cards arrive in fetch order, which changes run to run.
        "courses": dict(sorted(courses.items())),
    })
    for name, payload in outputs.items():
        write_json(ROOT / name, payload)
    write_json(ROOT / "sections.json", {
        "source": "placeholder",
        "note": "Days, times, and instructors are made up. Each course meets Monday/Wednesday/Friday or Tuesday/Thursday. These are not Temple schedule data.",
        "sections": sections,
    })

    program_courses = {code for spec in PROGRAMS for code in spec["courses"]}
    degree_failures = [item for item in failures if item[0] in program_courses]
    print(f"courses {len(courses)}")
    print(f"prereq parse warnings {len(failures)}; degree-course warnings {len(degree_failures)}")
    for item in degree_failures:
        print(" DEGREE", item[0])
        print("  ", item[1][:240])
        print("  tail:", item[2][:160])
    for spec in PROGRAMS:
        missing_refs = sorted(code for code in set(spec["courses"]) if code not in courses)
        print(f"{spec['code']} courses without a card", missing_refs)
    print("not in the 2026-2027 bulletin (left out):", sorted(not_in_bulletin))


def write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print("wrote", path)


if __name__ == "__main__":
    main()
