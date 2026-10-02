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
    levels = set(d["claims"]["confidence"])
    decisions = {x["id"] for x in d["decisions"]["decisions"]}
    open_q = {c["id"] for c in d["claims"]["claims"] if c.get("learn")}
    for c in d["claims"]["claims"]:
        if c["confidence"] not in levels:
            errors.append(f"claims {c['id']}: unknown confidence {c['confidence']}")
        if c["confidence"] == "confirmed" and not c.get("sources"):
            errors.append(f"claims {c['id']}: confirmed but no sources")
        if c.get("learn") and not (c.get("how") and c.get("owner")):
            errors.append(f"claims {c['id']}: open question needs 'how' and 'owner'")
    for s in d["kickoff"]["slides"]:
        for b in s["blocks"]:
            for i in b.get("ids", []):
                if i not in claims: errors.append(f"kickoff {s['id']}: unknown claim {i}")
                elif b["type"] == "questions" and i not in open_q: errors.append(f"kickoff {s['id']}: {i} has no open question")
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
