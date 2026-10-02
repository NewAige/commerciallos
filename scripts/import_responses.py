#!/usr/bin/env python3
"""Optional: load one Microsoft Forms export into site/data/survey-responses.json.

    python3 scripts/import_responses.py --role credit-analyst export.xlsx   # needs openpyxl
    python3 scripts/import_responses.py --role cla export.csv [--dry-run]   # CSV saved from Excel

Columns are matched by the "[Q##]" prefix in their header. Likert questions come as one
column per statement ("[Q12] ....Statement"). Rows already imported (same role and Forms
response ID) are skipped. See docs/surveys/README.md.
"""
import argparse, csv, datetime, json, pathlib, re, sys

DATA = pathlib.Path(__file__).resolve().parent.parent / "site" / "data"
QID = re.compile(r"^\s*\[(Q\d{2,3})\]")


def read_rows(path):
    if path.suffix.lower() in (".xlsx", ".xlsm"):
        try:
            import openpyxl
        except ImportError:
            sys.exit("Reading .xlsx needs openpyxl (pip install openpyxl). Or save the sheet as CSV from Excel.")
        rows = list(openpyxl.load_workbook(path, read_only=True, data_only=True).active.iter_rows(values_only=True))
    else:
        with open(path, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.reader(f))
    head = [str(h or "").strip() for h in rows[0]]
    return [dict(zip(head, r)) for r in rows[1:] if any(c not in (None, "") for c in r)]


def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", str(s).lower()).strip()


def to_date(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    s = str(v or "").strip().split(" ")[0]
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y"):
        try:
            return datetime.datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return datetime.date.today().isoformat()


def score(v, sc):
    """A rating cell: a number, or a scale label such as 'Agree'."""
    s = str(v).strip()
    try:
        n = float(s)
        return int(n) if n.is_integer() else n
    except ValueError:
        labels = [norm(l) for l in sc["labels"]]
        if norm(s) in labels and len(labels) == sc["max"] - sc["min"] + 1:
            return sc["min"] + labels.index(norm(s))
        m = re.match(r"^\d+", s)  # e.g. "0 = Not at all likely"
        return int(m.group()) if m else None


def split(v):
    return [p.strip() for p in str(v).split(";") if p.strip()]


def convert(q, cells, scales, warn):
    """cells: list of (header, value) for this question. Returns the answer or None."""
    t = q["type"]
    if t == "matrix":
        out = {}
        for head, v in cells:
            row = next((r for r in sorted(q["rows"], key=len, reverse=True) if norm(head).endswith(norm(r))), None)
            n = score(v, scales[q["scale"]]) if row else None
            if row and n is not None:
                out[row] = n
            elif v not in (None, ""):
                warn(f"{q['id']}: could not match '{head}' = '{v}'")
        return out or None
    v = cells[0][1]
    if v is None or str(v).strip() == "":
        return None
    if t in ("rating", "nps"):
        return score(v, scales[q["scale"]])
    if t == "number":
        try:
            n = float(str(v).replace(",", "").strip())
            return int(n) if n.is_integer() else n
        except ValueError:
            warn(f"{q['id']}: '{v}' is not a number")
            return None
    if t in ("multi", "rank"):
        return split(v)
    return str(v).strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", type=pathlib.Path)
    ap.add_argument("--role", required=True)
    ap.add_argument("--dry-run", action="store_true", help="show what would be imported without writing")
    a = ap.parse_args()

    sv = json.loads((DATA / "surveys.json").read_text())
    if a.role not in {r["id"] for r in sv["roles"]}:
        sys.exit(f"Unknown role {a.role}. Use one of: {', '.join(r['id'] for r in sv['roles'])}")
    qs = {q["id"]: q for q in sv["questions"]}
    out_path = DATA / "survey-responses.json"
    store = json.loads(out_path.read_text())
    seen = {(r["role"], str(r.get("formsId"))) for r in store["responses"]}
    nums = [int(m.group(1)) for r in store["responses"] if (m := re.match(r"resp-(\d+)$", r["id"]))]
    nxt = max(nums, default=0) + 1

    warnings = []
    warn = lambda m: warnings.append(m) if m not in warnings else None
    added = skipped = 0
    for row in read_rows(a.file):
        cols = {}
        for head, v in row.items():
            m = QID.match(head)
            if m:
                cols.setdefault(m.group(1), []).append((head, v))
        fid = str(row.get("ID") or "").strip() or None
        if fid and (a.role, fid) in seen:
            skipped += 1
            continue
        answers = {}
        for qid, cells in cols.items():
            q = qs.get(qid)
            if not q or a.role not in q["roles"]:
                warn(f"{qid}: not in the {a.role} survey, ignored")
                continue
            val = convert(q, cells, sv["scales"], warn)
            if val not in (None, [], {}):
                answers[qid] = val
        rec = {"id": f"resp-{nxt:04d}", "role": a.role, "submitted": to_date(row.get("Completion time") or row.get("Start time"))}
        if fid:
            rec["formsId"] = fid
        rec["answers"] = answers
        store["responses"].append(rec)
        nxt += 1
        added += 1

    for w in warnings:
        print("warning:", w)
    print(f"{a.role}: {added} new responses, {skipped} already imported")
    if a.dry_run or not added:
        return
    store["imported"] = datetime.date.today().isoformat()
    out_path.write_text(json.dumps(store, indent=2, ensure_ascii=False) + "\n")
    print(f"updated {out_path.name}; now run python3 scripts/validate.py")


if __name__ == "__main__":
    main()
