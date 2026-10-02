#!/usr/bin/env python3
"""Check that every file in site/data is valid JSON and that cross-references resolve.

Optional: pass a survey responses JSON file to validate it against surveys.json too."""
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
def check_surveys(sv, resp):
    """Check surveys.json (question bank) and survey-responses.json (imported answers)."""
    import re
    types = {"rating", "nps", "number", "single", "multi", "rank", "matrix", "text"}
    scales, sections = sv.get("scales", {}), {x["id"] for x in sv.get("sections", [])}
    groups = {g["id"] for g in sv.get("groups", [])}
    roles = {r["id"] for r in sv.get("roles", [])}
    for k, sc in scales.items():
        if sc["min"] >= sc["max"]: errors.append(f"surveys scale {k}: min must be below max")
        elif sc["max"] - sc["min"] <= 4 and len(sc.get("labels", [])) != sc["max"] - sc["min"] + 1:
            errors.append(f"surveys scale {k}: needs one label per point")
    for r in sv.get("roles", []):
        if r.get("group") not in groups: errors.append(f"surveys role {r['id']}: unknown group {r.get('group')}")
    qs, seen = {}, set()
    for q in sv.get("questions", []):
        i, t = q.get("id", "?"), q.get("type")
        if not re.fullmatch(r"Q\d{2,3}", i): errors.append(f"surveys {i}: id must look like Q01")
        if i in seen: errors.append(f"surveys {i}: duplicate id")
        seen.add(i); qs[i] = q
        if q.get("section") not in sections: errors.append(f"surveys {i}: unknown section {q.get('section')}")
        if t not in types: errors.append(f"surveys {i}: unknown type {t}"); continue
        if not q.get("text"): errors.append(f"surveys {i}: missing text")
        if not isinstance(q.get("required"), bool): errors.append(f"surveys {i}: 'required' must be true or false")
        if not q.get("roles"): errors.append(f"surveys {i}: no roles")
        for r in q.get("roles", []):
            if r not in roles: errors.append(f"surveys {i}: unknown role {r}")
        if t in ("rating", "nps", "matrix"):
            if q.get("scale") not in scales: errors.append(f"surveys {i}: unknown scale {q.get('scale')}")
            elif t == "nps" and (scales[q["scale"]]["min"], scales[q["scale"]]["max"]) != (0, 10):
                errors.append(f"surveys {i}: nps needs a 0-10 scale")
        if t in ("single", "multi", "rank"):
            o = q.get("options") or []
            if len(o) < 2: errors.append(f"surveys {i}: needs at least two options")
            if len(set(o)) != len(o): errors.append(f"surveys {i}: duplicate options")
            if t == "rank" and len(o) > 10: errors.append(f"surveys {i}: Microsoft Forms ranking allows at most 10 options")
            if t == "multi" and "maxPick" in q and not 1 <= q["maxPick"] <= len(o): errors.append(f"surveys {i}: bad maxPick")
        if t == "matrix":
            rows = q.get("rows") or []
            if not rows: errors.append(f"surveys {i}: matrix needs rows")
            if len(set(rows)) != len(rows): errors.append(f"surveys {i}: duplicate rows")
        if t == "number":
            if not q.get("unit"): errors.append(f"surveys {i}: number needs a unit")
            if "min" in q and "max" in q and q["min"] > q["max"]: errors.append(f"surveys {i}: min above max")
    for r in roles:
        if not any(r in q.get("roles", []) for q in qs.values()): errors.append(f"surveys role {r}: has no questions")
    if resp is None: return
    rids = set()
    for x in resp.get("responses", []):
        i = x.get("id", "?")
        if i in rids: errors.append(f"survey-responses {i}: duplicate id")
        rids.add(i)
        if x.get("role") not in roles: errors.append(f"survey-responses {i}: unknown role {x.get('role')}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(x.get("submitted", ""))): errors.append(f"survey-responses {i}: submitted must be YYYY-MM-DD")
        for qid, v in x.get("answers", {}).items():
            q = qs.get(qid)
            if not q: errors.append(f"survey-responses {i}: unknown question {qid}"); continue
            if x.get("role") in roles and x["role"] not in q["roles"]: errors.append(f"survey-responses {i}: {qid} is not asked of {x.get('role')}")
            t, num = q["type"], lambda n: isinstance(n, (int, float)) and not isinstance(n, bool)
            sc = scales.get(q.get("scale"), {})
            ok = True
            if t in ("rating", "nps"): ok = num(v) and sc["min"] <= v <= sc["max"]
            elif t == "number": ok = num(v) and q.get("min", v) <= v <= q.get("max", v)
            elif t == "single": ok = isinstance(v, str)
            elif t == "text": ok = isinstance(v, str)
            elif t == "multi": ok = isinstance(v, list) and all(isinstance(s, str) for s in v)
            elif t == "rank": ok = isinstance(v, list) and set(v) <= set(q["options"]) and len(set(v)) == len(v)
            elif t == "matrix": ok = isinstance(v, dict) and all(k in q["rows"] and num(n) and sc["min"] <= n <= sc["max"] for k, n in v.items())
            if not ok: errors.append(f"survey-responses {i}: {qid} value does not fit a {t} question")

if not errors and "surveys" in d:
    check_surveys(d["surveys"], d.get("survey-responses"))
    if len(sys.argv) > 1:  # optional: validate another responses file, e.g. a sample
        check_surveys(d["surveys"], json.loads(pathlib.Path(sys.argv[1]).read_text()))

print("\n".join(errors) if errors else f"OK: {len(d)} data files valid")
sys.exit(1 if errors else 0)
