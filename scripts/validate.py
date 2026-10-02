#!/usr/bin/env python3
"""Check that every file in site/data is valid JSON and that cross-references resolve."""
import json, pathlib, sys

DATA = pathlib.Path(__file__).resolve().parent.parent / "site" / "data"
errors = []
d = {}
for f in sorted(DATA.glob("*.json")):
    try:
        d[f.stem] = json.loads(f.read_text())
    except json.JSONDecodeError as e:
        errors.append(f"{f.name}: {e}")
if not errors:
    claims = {c["id"] for c in d["claims"]["claims"]}
    statuses = set(d["claims"]["statuses"])
    decisions = {x["id"] for x in d["decisions"]["decisions"]}
    for c in d["claims"]["claims"]:
        if c["status"] not in statuses:
            errors.append(f"claims {c['id']}: unknown status {c['status']}")
    for s in d["kickoff"]["slides"]:
        for b in s["blocks"]:
            for i in b.get("ids", []):
                if i not in claims: errors.append(f"kickoff {s['id']}: unknown claim {i}")
            if b["type"] == "decision" and b["id"] not in decisions:
                errors.append(f"kickoff {s['id']}: unknown decision {b['id']}")
    ids = {k["id"] for k in d["project"]["keyDates"]}
    for need in ("kickoff", "contract-signed", "go-live", "globalwave-end"):
        if need not in ids: errors.append(f"project.keyDates missing {need}")
    total = sum(s["minutes"] for s in d["kickoff"]["slides"])
    if total != d["kickoff"]["lengthMinutes"]:
        print(f"note: kickoff slides add up to {total} min, meeting is {d['kickoff']['lengthMinutes']} min")
print("\n".join(errors) if errors else f"OK: {len(d)} data files valid")
sys.exit(1 if errors else 0)
