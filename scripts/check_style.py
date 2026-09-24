#!/usr/bin/env python3
"""Scan a repo, a directory, or a file against the portfolio's house style.

Checks for the things that repeatedly need catching before a push:

  - em dashes and en dashes, including the HTML entities
  - stock phrases that read as filler
  - US spellings in prose

The exceptions matter as much as the rules. `prefers-color-scheme` is CSS, not a
spelling mistake. An npm script called `analyze` is an identifier. Flagging
those trains people to ignore the tool, so they are excluded deliberately
rather than by accident.

Usage:
    python3 check_house_style.py <path> [--quiet] [--no-spelling]

Exit code is 1 when anything is found, so it works in CI or a pre-commit hook.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

TEXT_EXTENSIONS = {
    ".md", ".txt", ".rst",
    ".py", ".rs", ".ts", ".tsx", ".js", ".mjs", ".jsx",
    ".html", ".css", ".scss", ".svg",
    ".yml", ".yaml", ".toml", ".json",
    ".sh", ".r", ".R",
}

SKIP_DIRS = {
    ".git", "node_modules", "target", "build", "dist", "out",
    "__pycache__", ".venv", "venv", "env", ".next", ".vite",
    "coverage", ".turbo", "vendor", ".mypy_cache", ".pytest_cache",
}

# Stock phrases that read as filler. Kept short on purpose: a long list
# produces false positives and gets switched off.
BANNED_PHRASES = [
    r"excited to (share|announce)",
    r"thrilled to",
    r"in today's (world|landscape)",
    r"ever wondered",
    r"let that sink in",
    r"here's the kicker",
    r"the best part\?",
    r"game[- ]chang(er|ing)",
    r"deep dive",
    r"in a nutshell",
    r"delve into",
    r"testament to",
    r"it's worth noting that",
    r"thoughts\?\s*$",
    r"drop a comment",
]

# US spellings worth catching in prose. Deliberately excludes anything that is
# commonly an identifier: `color` appears in CSS, `analyze` in npm scripts,
# `center` in HTML attributes, and flagging those is noise.
US_SPELLINGS = {
    "modeled": "modelled",
    "modeling": "modelling",
    "labeled": "labelled",
    "labeling": "labelling",
    "traveled": "travelled",
    "fulfill": "fulfil",
    "favorite": "favourite",
    "neighborhood": "neighbourhood",
    "recognizes": "recognises",
    "summarize": "summarise",
    "summarized": "summarised",
    "prioritize": "prioritise",
    "prioritized": "prioritised",
    "generalize": "generalise",
    "normalize": "normalise",
    "normalized": "normalised",
}

# Some files exist precisely to quote the things this tool looks for: a style
# guide showing what not to write, a changelog recording a phrase that was
# removed. Without an escape hatch the only options are a permanently failing
# check or deleting the examples, and both are worse than a marker.
#
#   file level: put `house-style: examples` anywhere in the file
#   line level: end the line with `house-style-ok`
FILE_OPT_OUT = re.compile(r"house-style:\s*examples", re.I)
LINE_OPT_OUT = re.compile(r"house-style-ok", re.I)


def is_text_file(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in TEXT_EXTENSIONS


def iter_files(root: str):
    if os.path.isfile(root):
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and not d.endswith(".egg-info")
        ]
        for name in filenames:
            path = os.path.join(dirpath, name)
            if is_text_file(path):
                yield path


def line_of(text: str, index: int) -> tuple[int, str]:
    line_no = text.count("\n", 0, index) + 1
    start = text.rfind("\n", 0, index) + 1
    end = text.find("\n", index)
    return line_no, text[start : end if end != -1 else None].strip()


class Finding:
    def __init__(self, path, line_no, kind, detail, snippet):
        self.path = path
        self.line_no = line_no
        self.kind = kind
        self.detail = detail
        self.snippet = snippet

    def __str__(self):
        return (
            f"{self.path}:{self.line_no}  [{self.kind}] {self.detail}\n"
            f"    {self.snippet[:160]}"
        )


def scan_text(path: str, text: str, check_spelling: bool) -> list[Finding]:
    if FILE_OPT_OUT.search(text):
        return []

    findings: list[Finding] = []
    lowered = text.lower()

    for char, name in (("—", "em dash"), ("–", "en dash")):
        for m in re.finditer(re.escape(char), text):
            line_no, snippet = line_of(text, m.start())
            findings.append(Finding(path, line_no, "dash", name, snippet))

    for entity, name in (("&mdash;", "em dash entity"), ("&ndash;", "en dash entity")):
        for m in re.finditer(entity, text, re.I):
            line_no, snippet = line_of(text, m.start())
            findings.append(Finding(path, line_no, "dash", name, snippet))

    for pattern in BANNED_PHRASES:
        for m in re.finditer(pattern, lowered, re.M):
            line_no, snippet = line_of(text, m.start())
            findings.append(
                Finding(path, line_no, "phrasing", m.group().strip(), snippet)
            )

    if check_spelling and os.path.splitext(path)[1].lower() in {".md", ".txt", ".rst"}:
        for us, uk in US_SPELLINGS.items():
            for m in re.finditer(rf"\b{us}\b", lowered):
                line_no, snippet = line_of(text, m.start())
                findings.append(
                    Finding(path, line_no, "spelling", f"{us} -> {uk}", snippet)
                )

    return [f for f in findings if not LINE_OPT_OUT.search(f.snippet)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", help="file or directory to scan")
    parser.add_argument("--quiet", action="store_true", help="summary only")
    parser.add_argument(
        "--no-spelling", action="store_true", help="skip the spelling check"
    )
    args = parser.parse_args()

    if not os.path.exists(args.path):
        print(f"no such path: {args.path}", file=sys.stderr)
        return 2

    all_findings: list[Finding] = []
    scanned = 0
    for path in iter_files(args.path):
        try:
            with open(path, encoding="utf-8", errors="ignore") as handle:
                text = handle.read(5_000_000)
        except OSError:
            continue
        scanned += 1
        all_findings.extend(scan_text(path, text, not args.no_spelling))

    if not args.quiet:
        for finding in all_findings:
            print(finding)
        if all_findings:
            print()

    by_kind: dict[str, int] = {}
    for finding in all_findings:
        by_kind[finding.kind] = by_kind.get(finding.kind, 0) + 1

    print(f"scanned {scanned} files")
    if not all_findings:
        print("house style: clean")
        return 0

    for kind, count in sorted(by_kind.items()):
        print(f"  {kind}: {count}")
    print(f"total: {len(all_findings)}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
