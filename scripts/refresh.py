#!/usr/bin/env python3
"""Slim StatCan table 35-10-0184 to rates and incident counts. No API key is used.

The published CSV is about 325 MB. This keeps every BC police service for
twelve offence groups, and incidents plus the rate per 100,000. A failed run
does not replace web/data/sheet.json.
"""
import csv
import io
import json
import os
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
ZIP_URL = "https://www150.statcan.gc.ca/n1/tbl/csv/35100184-eng.zip"
VIOLATIONS = {
    "1": "All violations",
    "4": "Violent crime",
    "26": "Assault",
    "34": "Robbery",
    "64": "Property crime",
    "65": "Break and enter",
    "69": "Vehicle theft",
    "76": "Theft under $5,000",
    "81": "Mischief",
    "148": "Criminal Code traffic",
    "149": "Impaired driving",
    "231": "Drug violations",
}
FULL = {
    "1": "Total, all violations",
    "4": "Total violent Criminal Code violations",
    "26": "Total other assaults",
    "34": "Total robbery",
    "64": "Total property crime violations",
    "65": "Total breaking and entering",
    "69": "Total theft of motor vehicle",
    "76": "Total theft under $5,000 (non-motor vehicle)",
    "81": "Total mischief",
    "148": "Total Criminal Code traffic violations",
    "149": "Total impaired driving",
    "231": "Total Drug violations",
}


def main():
    local = os.environ.get("STATCAN_ZIP")
    if local:
        print(f"Reading {local}")
        blob = Path(local).read_bytes()
    else:
        print("Downloading StatCan table 35-10-0184")
        with urlopen(ZIP_URL, timeout=180) as response:
            blob = response.read()
    if len(blob) < 1_000_000:
        raise SystemExit("The StatCan download was too small; the previous extract was left in place")
    archive = zipfile.ZipFile(io.BytesIO(blob))
    services = {}
    cells = {}
    kept = 0
    with archive.open("35100184.csv") as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))
        for row in reader:
            coordinate = (row.get("COORDINATE") or "").split(".")
            if len(coordinate) != 3 or coordinate[1] not in VIOLATIONS or coordinate[2] not in ("1", "2"):
                continue
            value = (row.get("VALUE") or "").strip()
            if not value:
                continue
            try:
                number = float(value)
            except ValueError:
                continue
            year = int(row["REF_DATE"])
            geo_id, viol_id, stat = coordinate
            services.setdefault(geo_id, row["GEO"])
            bucket = cells.setdefault(geo_id, {}).setdefault(viol_id, {}).setdefault(str(year), [None, None])
            bucket[0 if stat == "1" else 1] = int(number) if stat == "1" and number.is_integer() else round(number, 2)
            kept += 1
    if kept < 5000 or "1" not in services:
        raise SystemExit(f"The extract kept {kept} cells; the previous file was left in place")
    years = sorted({int(year) for geos in cells.values() for viols in geos.values() for year in viols})
    sheet = {
        "source": "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3510018401",
        "table": "35-10-0184-01",
        "retrieved": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "released": "2026-07-22",
        "years": years,
        "services": [{"id": key, "name": services[key]} for key in sorted(services, key=lambda item: services[item].casefold())],
        "violations": [{"id": key, "name": VIOLATIONS[key], "full": FULL[key]} for key in VIOLATIONS],
        "cells": cells,
    }
    path = ROOT / "web" / "data" / "sheet.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(sheet, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    temporary.replace(path)
    (ROOT / "web" / "data" / "status.json").write_text(json.dumps({
        "retrieved": sheet["retrieved"],
        "released": sheet["released"],
        "services": len(sheet["services"]),
        "through": years[-1],
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(services)} services, {kept} cells, through {years[-1]}")


if __name__ == "__main__":
    main()
