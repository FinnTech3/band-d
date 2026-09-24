"""Read the government's spreadsheets without a spreadsheet library.

MHCLG publishes council tax levels as OpenDocument (.ods) and the council tax
base as Excel (.xlsx). Both are zip archives of XML, so the standard library is
enough to read them, and keeping the package dependency-free means a fresh clone
runs with nothing installed.

Both readers return every sheet as a list of rows, each row a list of strings,
with empty cells as "". Numbers stay as the text the file stored them as; the
callers decide what is a number, because these files use ".." and "[x]" for
missing values and a reader that guessed would hide them.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
import zipfile

_ODS_TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
_ODS_TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"
_ODS_OFFICE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"

_XLSX = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_XLSX_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Formatting sometimes marks a whole row of thousands of empty cells as one
# repeated cell. Anything past this many columns is padding, not data.
_MAX_COLUMNS = 512


def read_ods(path: str) -> dict[str, list[list[str]]]:
    t, o = f"{{{_ODS_TABLE}}}", f"{{{_ODS_OFFICE}}}"
    root = ET.fromstring(zipfile.ZipFile(path).read("content.xml"))
    sheets: dict[str, list[list[str]]] = {}
    for table in root.iter(t + "table"):
        rows: list[list[str]] = []
        for row in table.iter(t + "table-row"):
            cells: list[str] = []
            for cell in row:
                if cell.tag not in (t + "table-cell", t + "covered-table-cell"):
                    continue
                repeat = int(cell.get(t + "number-columns-repeated", "1"))
                value = cell.get(o + "value")
                if value is None:
                    value = " ".join("".join(p.itertext()) for p in cell.iter(f"{{{_ODS_TEXT}}}p"))
                cells.extend([value] * min(repeat, _MAX_COLUMNS - len(cells)))
                if len(cells) >= _MAX_COLUMNS:
                    break
            while cells and cells[-1] == "":
                cells.pop()
            if cells:
                rows.append(cells)
        sheets[table.get(t + "name", "")] = rows
    return sheets


def _column(ref: str) -> int:
    n = 0
    for ch in ref:
        if not ch.isalpha():
            break
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(path: str) -> dict[str, list[list[str]]]:
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(_XLSX + "si"):
            shared.append("".join(t.text or "" for t in si.iter(_XLSX + "t")))
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    targets = {r.get("Id"): r.get("Target", "") for r in rels}

    sheets: dict[str, list[list[str]]] = {}
    for sheet in workbook.iter(_XLSX + "sheet"):
        target = targets[sheet.get(_XLSX_REL + "id")].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        rows: list[list[str]] = []
        for row in ET.fromstring(z.read(target)).iter(_XLSX + "row"):
            cells: dict[int, str] = {}
            for c in row.findall(_XLSX + "c"):
                v = c.find(_XLSX + "v")
                if v is not None:
                    text = v.text or ""
                    if c.get("t") == "s":
                        text = shared[int(text)]
                else:
                    inline = c.find(_XLSX + "is")
                    text = "".join(x.text or "" for x in inline.iter(_XLSX + "t")) if inline is not None else ""
                cells[_column(c.get("r", "A"))] = text
            if cells:
                width = max(cells) + 1
                rows.append([cells.get(i, "") for i in range(width)])
        sheets[sheet.get("name", "")] = rows
    return sheets
