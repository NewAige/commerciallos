/* Commercial LOS project workspace.
   Plain JS, no build step. All content lives in data/*.json so people and agents can edit it directly. */
(function () {
  "use strict";

  const FILES = ["project", "timeline", "claims", "decisions", "risks", "team", "options", "actions", "kickoff"];
  const NOTES_KEY = "los-kickoff-notes-v1";
  const THEME_KEY = "los-theme";
  const D = {};
  const app = document.getElementById("app");

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const todayUTC = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
  const DAY = 86400000;
  const daysUntil = (iso) => Math.round((parse(iso) - todayUTC()) / DAY);
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / DAY);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => { const d = new Date(parse(iso)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };
  const fmtMonth = (iso) => { const d = new Date(parse(iso)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const money = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `$${Math.round(n / 1e3)}K`;
  const keyDate = (id) => D.project.keyDates.find((k) => k.id === id).date;
  const CONF = ["confirmed", "likely", "unsure"];
  const confLabel = (s) => ({ confirmed: "Confirmed", likely: "Likely", unsure: "Unsure" }[s] || s);
  // plain-text sources (a person, a file in the repo) are shown as text; only web addresses become links
  const sourceList = (x) => x.sources ? `<div class="sources">${x.sources.map((u) => /^https?:/.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>` : `<span>${esc(u)}</span>`).join("")}${x.checked ? `<span class="muted mono">checked ${esc(x.checked)}</span>` : ""}</div>` : "";
  // number that motion.js counts up from zero; the final value is in the markup so it reads correctly at rest
  const cnt = (v, o = {}) => { const dec = o.dec || 0; const txt = (o.pre || "") + Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (o.suf || ""); return `<span data-count="${v}" data-dec="${dec}" data-pre="${esc(o.pre || "")}" data-suf="${esc(o.suf || "")}">${esc(txt)}</span>`; };
  const pill = (cls, text) => `<span class="pill ${esc(cls)}">${esc(text)}</span>`;
  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } },
  };
  let notes = store.get(NOTES_KEY, { slides: {}, picks: {}, names: {} });

  /* ---------- theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  applyTheme(store.get(THEME_KEY, null));
  function cycleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === null ? "light" : cur === "light" ? "dark" : null;
    applyTheme(next); store.set(THEME_KEY, next); renderShell(); if (window.LOSMotion) window.LOSMotion.refreshTheme();
  }

  /* ---------- routing ---------- */
  const VIEWS = [
    { id: "overview", label: "Overview" },
    { id: "kickoff", label: "Kickoff walkthrough" },
    { id: "plan", label: "Roadmap" },
    { id: "think", label: "What we think" },
    { id: "learn", label: "What we need to learn" },
    { id: "options", label: "Options" },
    { id: "decisions", label: "Decisions" },
    { id: "risks", label: "Risks" },
    { id: "team", label: "Team and actions" },
  ];
  function route() {
    let h = (location.hash || "#overview").slice(1);
    if (h === "evidence") h = "think"; // old links
    const m = h.match(/^kickoff-(\d+)$/);
    if (m) return { view: "kickoff", slide: Math.max(0, parseInt(m[1], 10) - 1) };
    return { view: VIEWS.some((v) => v.id === h) ? h : "overview", slide: 0 };
  }
  function counts() {
    return {
      learn: D.claims.claims.filter((c) => c.learn).length,
      decisions: D.decisions.decisions.filter((d) => d.status !== "decided").length,
      risks: D.risks.risks.filter((r) => r.status === "open").length,
      team: D.actions.actions.filter((a) => a.status !== "done").length,
    };
  }

  /* ---------- shell ---------- */
  function renderShell() {
    const r = route();
    const c = counts();
    const end = keyDate("globalwave-end");
    const theme = document.documentElement.getAttribute("data-theme") || "system";
    const navLinks = VIEWS.map((v) => {
      const n = c[v.id];
      const href = v.id === "kickoff" ? "#kickoff-1" : `#${v.id}`;
      return `<a href="${href}" ${r.view === v.id ? 'aria-current="page"' : ""}><span>${esc(v.label)}</span>${n != null ? `<span class="count">${n}</span>` : ""}</a>`;
    }).join("");
    document.getElementById("rail").innerHTML = `
      <div class="brand"><span class="eyebrow">Project workspace</span><span class="brand-name">${esc(D.project.name)}</span></div>
      <div class="clock"><span class="eyebrow"><span class="beacon" aria-hidden="true"></span>GlobalWave contract ends</span><span class="big">${daysUntil(end)} days</span><span class="small">${fmtDate(end)}</span></div>
      <nav class="nav" aria-label="Sections"><span class="nav-ind" aria-hidden="true"></span>${navLinks}</nav>
      <div class="rail-foot">
        <span class="small muted">Data updated ${fmtDate(D.project.updated)}</span>
        <button class="theme-toggle" type="button" id="themeBtn">Theme: ${esc(theme)}</button>
      </div>`;
    document.getElementById("topbar").innerHTML = `
      <span class="brand-name">${esc(D.project.name)}</span>
      <span class="eyebrow">${daysUntil(end)} days to contract end</span>
      <nav aria-label="Sections">${VIEWS.map((v) => `<a href="${v.id === "kickoff" ? "#kickoff-1" : "#" + v.id}" ${r.view === v.id ? 'aria-current="page"' : ""}>${esc(v.label)}</a>`).join("")}</nav>`;
    document.getElementById("themeBtn").onclick = cycleTheme;
  }

  /* ---------- shared visual pieces ---------- */
  function gantt(opts = {}) {
    const t = D.timeline;
    const compact = !!opts.compact;
    // compact (slide) mode: narrower canvas, labels above bars, so text stays legible when scaled down
    const W = compact ? 760 : 980, left = compact ? 8 : 210, right = compact ? 12 : 24, top = 66;
    const rowH = compact ? 40 : 34;
    const rows = t.phases.length;
    const H = top + rows * rowH + 70;
    const t0 = parse(t.start), t1 = parse(t.end);
    const x = (iso) => left + ((parse(iso) - t0) / (t1 - t0)) * (W - left - right);
    let s = `<svg class="gantt${compact ? " compact" : ""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Project roadmap from ${fmtMonth(t.start)} to ${fmtMonth(t.end)}">`;
    s += `<rect class="g-buffer" x="${x(t.buffer.start)}" y="${top - 6}" width="${x(t.buffer.end) - x(t.buffer.start)}" height="${rows * rowH + 6}"/>`;
    const d0 = new Date(t0);
    for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth(); Date.UTC(y, m, 1) <= t1; m++) {
      if (m > 11) { m = 0; y++; }
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      if (parse(iso) < t0) continue;
      const xx = x(iso);
      if (m === 0) s += `<text class="g-year" x="${xx + 3}" y="14">${y}</text>`;
      if (m % 3 === 0) {
        s += `<line class="g-grid" x1="${xx}" x2="${xx}" y1="${top - 14}" y2="${top + rows * rowH}" ${m === 0 ? "" : 'stroke-opacity="0.55"'}/>`;
        s += `<text class="g-month" x="${xx + 3}" y="${top - 18}">${MONTHS[m]}</text>`;
      }
    }
    t.phases.forEach((p, i) => {
      const y = top + i * rowH;
      const x0 = x(p.start), x1 = x(p.end);
      if (compact) {
        const anchorEnd = x0 > W * 0.55;
        s += `<text class="g-bar-label" x="${anchorEnd ? x1 : x0}" y="${y + 12}" text-anchor="${anchorEnd ? "end" : "start"}">${esc(p.name)}</text>`;
        s += `<rect class="g-bar" x="${x0}" y="${y + 18}" width="${Math.max(4, x1 - x0)}" height="14" rx="3"/>`;
      } else {
        s += `<text class="g-bar-label" x="0" y="${y + 15}">${esc(p.name)}</text>`;
        s += `<text class="g-dates" x="0" y="${y + 28}">${fmtMonth(p.start)} – ${fmtMonth(p.end)}</text>`;
        s += `<rect class="g-bar" x="${x0}" y="${y + 6}" width="${Math.max(4, x1 - x0)}" height="16" rx="3"/>`;
      }
    });
    const by = top + rows * rowH;
    s += `<text class="g-buffer-label" x="${x(t.buffer.start) + 6}" y="${by + 16}">BUFFER ≈ ${Math.round(daysBetween(t.buffer.start, t.buffer.end) / 30.4)} MONTHS</text>`;
    let alt = 0;
    t.milestones.forEach((m) => {
      if (m.kind === "hard") return;
      if (compact && m.kind === "meeting") return;
      const xx = x(m.date);
      s += `<path class="${m.kind === "golive" ? "g-ms g-ms-golive" : "g-ms"}" d="M${xx} ${by + 26} l5 5 l-5 5 l-5 -5 z"/>`;
      s += `<text class="g-ms-label" x="${xx}" y="${by + 50 + (alt++ % 2) * 13}" text-anchor="middle">${esc(m.label)}</text>`;
    });
    const hx = x(keyDate("globalwave-end"));
    s += `<line class="g-hard" x1="${hx}" x2="${hx}" y1="${top - 34}" y2="${by + 6}"/>`;
    s += `<text class="g-hard-label" x="${hx - 5}" y="34" text-anchor="end">CONTRACT ENDS ${fmtDate(keyDate("globalwave-end")).toUpperCase()}</text>`;
    const td = todayUTC();
    if (td >= t0 && td <= t1) {
      const tx = left + ((td - t0) / (t1 - t0)) * (W - left - right);
      s += `<line class="g-today" x1="${tx}" x2="${tx}" y1="${top - 6}" y2="${by}"/>`;
      s += `<text class="g-today-label" x="${tx + 4}" y="${by - 4}">today</text>`;
    }
    return `<div class="gantt-wrap">${s}</svg></div>`;
  }

  function confCounts() {
    const all = D.claims.claims;
    return CONF.map((s) => ({ s, n: all.filter((c) => c.confidence === s).length })).filter((x) => x.n);
  }
  function confBar() {
    const cc = confCounts(); const total = D.claims.claims.length;
    return `<div class="statusbar" role="img" aria-label="How sure we are">${cc.map((x) => `<span class="bg-cf-${x.s}" style="width:${(x.n / total) * 100}%"></span>`).join("")}</div>
      <div class="legend">${cc.map((x) => `<span class="key"><span class="sw bg-cf-${x.s}"></span>${esc(confLabel(x.s))} <span class="mono">${x.n}</span></span>`).join("")}</div>`;
  }

  /* ---------- Overview ---------- */
  function viewOverview() {
    const p = D.project;
    const end = keyDate("globalwave-end"), go = keyDate("go-live"), kick = keyDate("kickoff"), sign = keyDate("contract-signed");
    const kd = daysUntil(kick);
    const openDecisions = D.decisions.decisions.filter((d) => d.status !== "decided");
    const topRisks = D.risks.risks.filter((r) => r.impact === "high").slice(0, 4);
    const nextActions = D.actions.actions.filter((a) => a.status !== "done").sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    const t0 = todayUTC(), tEnd = parse(end);
    const pos = (iso) => Math.max(0, Math.min(100, ((parse(iso) - t0) / (tEnd - t0)) * 100));
    const stops = [
      { iso: kick, label: "Kickoff", cls: "" },
      { iso: sign, label: "Contract signed", cls: "" },
      { iso: go, label: "Go-live", cls: "go" },
      { iso: end, label: "Contract ends", cls: "end" },
    ];
    return `<div class="page">
      <section class="hero-stage">
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="hero-kicker">${kd > 0 ? `Kickoff in ${kd} day${kd === 1 ? "" : "s"} · ${fmtDate(kick)}` : kd === 0 ? "Kickoff is today" : `Kicked off ${fmtDate(kick)}`}</span>
            <h1 class="hero-title">Replace the commercial LOS before GlobalWave ends</h1>
            <p class="hero-sub">The plan, what we think so far, what we still need to learn, and every decision the team makes along the way.</p>
            <div class="hero-actions">
              <a class="btn glow" href="#kickoff-1">Start the kickoff walkthrough <span aria-hidden="true">→</span></a>
              <a class="btn ghost" href="#learn">What we need to learn</a>
            </div>
          </div>
          <div class="hero-count">
            <span class="hero-kicker">Days until the contract ends</span>
            <div class="odo" data-odo="${daysUntil(end)}" aria-label="${daysUntil(end)} days">${daysUntil(end)}</div>
            <span class="hero-date">${new Date(tEnd).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}, ${fmtDate(end)}</span>
          </div>
        </div>
        <div class="journey" aria-label="Journey from today to contract end">
          <div class="j-line"><span class="j-fill" style="width:${pos(go)}%"></span><span class="j-buf" style="left:${pos(go)}%;width:${100 - pos(go)}%"></span><span class="j-comet" style="--to:${pos(go)}%"></span></div>
          <span class="j-stop j-today below" style="left:0"><i></i><b>Today</b></span>
          ${stops.map((x, i) => `<span class="j-stop ${x.cls} ${i % 2 ? "below" : ""}" style="left:${pos(x.iso)}%"><i></i><b>${esc(x.label)}</b><em>${fmtMonth(x.iso)}</em></span>`).join("")}
        </div>
      </section>
      <div class="figures">
        <div class="figure"><span class="eyebrow">Contract ends</span><span class="val hard">${cnt(daysUntil(end))}</span><span class="lbl">days · ${fmtDate(end)}</span></div>
        <div class="figure"><span class="eyebrow">Target go-live</span><span class="val">${cnt(daysUntil(go))}</span><span class="lbl">days · ${fmtDate(go)}</span></div>
        <div class="figure"><span class="eyebrow">Contract signed by</span><span class="val">${cnt(daysUntil(sign))}</span><span class="lbl">days · ${fmtDate(sign)}</span></div>
        <div class="figure"><span class="eyebrow">Buffer</span><span class="val">${cnt(daysBetween(go, end))}</span><span class="lbl">days between go-live and contract end</span></div>
      </div>
      <section class="panel">
        <div class="panel-head"><h2>Proposed roadmap</h2><a href="#plan" class="small">Phase details</a></div>
        ${gantt()}
      </section>
      <div class="grid-2">
        <section class="panel">
          <div class="panel-head"><h2>Decisions needed</h2><a href="#decisions" class="small">All decisions</a></div>
          <div class="list">${openDecisions.slice(0, 5).map((d) => `<div class="row"><div class="row-head"><span><span class="mono muted">${d.id}</span> ${esc(d.title)}</span>${pill("st-" + d.status, d.status)}</div><div class="meta"><span>Needed by <span class="mono">${fmtDate(d.needed)}</span></span></div></div>`).join("")}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>What we think</h2><a href="#think" class="small">Full list</a></div>
          <p class="small muted">${D.claims.claims.length} things that shape the choice of a new LOS, and how sure we are of each.</p>
          ${confBar()}
          <div class="list">${D.claims.claims.filter((c) => c.learn && c.confidence === "unsure").map((c) => `<div class="row"><span>${esc(c.learn)}</span><div class="meta"><span>${esc(c.owner)}</span></div></div>`).join("")}</div>
          <p class="small"><a href="#learn">All ${D.claims.claims.filter((c) => c.learn).length} open questions</a>, each with an owner.</p>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Next actions</h2><a href="#team" class="small">All actions</a></div>
          <div class="list">${nextActions.map((a) => `<div class="row"><span>${esc(a.title)}</span><div class="meta"><span>${esc(a.owner)}</span><span class="mono">Due ${fmtDate(a.due)}</span></div></div>`).join("")}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>High-impact risks</h2><a href="#risks" class="small">Risk log</a></div>
          <div class="list">${topRisks.map((r) => `<div class="row"><div class="row-head"><span>${esc(r.title)}</span>${pill("lv-" + r.likelihood, "Likelihood " + r.likelihood)}</div><span class="small muted">${esc(r.mitigation)}</span></div>`).join("")}</div>
        </section>
      </div>
      <section class="panel">
        <h2>Working assumptions</h2>
        <ul class="small" style="margin:0;padding-left:18px;display:grid;gap:6px">${p.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      </section>
    </div>`;
  }

  /* ---------- Roadmap ---------- */
  function viewPlan() {
    const t = D.timeline;
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Roadmap</span><h1>From kickoff to contract end</h1><p>${esc(t.note)}</p></div>
      <section class="panel">${gantt()}</section>
      <section class="panel"><h2>What sets the critical path</h2><ul class="small" style="margin:0;padding-left:18px;display:grid;gap:8px">${t.criticalPathNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>
      <div class="grid-3">${t.phases.map((p) => `<section class="panel">
        <div><span class="eyebrow">${fmtMonth(p.start)} – ${fmtMonth(p.end)}</span><h3>${esc(p.name)}</h3></div>
        <p class="small">${esc(p.goal)}</p>
        <ul class="small muted" style="margin:0;padding-left:18px;display:grid;gap:4px">${p.deliverables.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>
      </section>`).join("")}</div>
      <section class="panel"><h2>Milestones</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Milestone</th><th>Type</th></tr></thead><tbody>
        ${t.milestones.map((m) => `<tr><td class="mono">${fmtDate(m.date)}</td><td>${esc(m.label)}</td><td>${esc(m.kind === "hard" ? "Hard deadline" : m.kind === "golive" ? "Go-live" : m.kind === "gate" ? "Gate" : "Meeting")}</td></tr>`).join("")}
      </tbody></table></div></section>
    </div>`;
  }

  /* ---------- What we think ---------- */
  function viewThink() {
    const c = D.claims;
    const group = (cf) => c.claims.filter((x) => x.confidence === cf);
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">What we think</span><h1>Where we stand, and how sure we are</h1><p>${esc(c.note)}</p></div>
      <section class="panel">${confBar()}</section>
      ${CONF.map((cf) => group(cf).length ? `<section class="panel">
        <div><h2>${esc(confLabel(cf))}</h2><p class="small muted">${esc(c.confidence[cf])}</p></div>
        <div>${group(cf).map((x) => `<article class="belief">
          <div class="row-head"><span class="meta"><span class="mono">${x.id}</span><span>${esc(x.topic)}</span></span>${pill("cf-" + x.confidence, confLabel(x.confidence))}</div>
          <p class="think">${esc(x.think)}</p>
          ${x.learn ? `<p class="small muted"><b>Still to learn:</b> <a href="#learn">${esc(x.learn)}</a></p>` : ""}
          ${sourceList(x)}
        </article>`).join("")}</div>
      </section>` : "").join("")}
      <p class="small muted">${esc(c.provenance)}</p>
    </div>`;
  }

  /* ---------- What we need to learn ---------- */
  function viewLearn() {
    const open = D.claims.claims.filter((x) => x.learn);
    const topics = [...new Set(open.map((x) => x.topic))];
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">What we need to learn</span><h1>${open.length} questions to answer before we choose</h1>
        <p>Each question has an owner and a way to find out. When we have an answer, it moves into <a href="#think">What we think</a>.</p></div>
      ${topics.map((t) => `<section class="panel"><h2>${esc(t)}</h2><div>${open.filter((x) => x.topic === t).map((x) => `<article class="belief">
          <div class="row-head"><h3>${esc(x.learn)}</h3><span class="pill st-open">${esc(x.owner)}</span></div>
          <p class="small"><b>How we'll find out:</b> ${esc(x.how)}</p>
          <p class="small muted"><b>What we think now</b> ${pill("cf-" + x.confidence, confLabel(x.confidence))} ${esc(x.think)}</p>
        </article>`).join("")}</div></section>`).join("")}
    </div>`;
  }

  /* ---------- Options ---------- */
  function viewOptions() {
    const o = D.options;
    const paths = o.paths.map((p) => `<section class="panel"><h2>${esc(p.name)}</h2><p class="small">${esc(p.summary)}</p>
      <div class="grid-2" style="gap:12px"><div><span class="eyebrow">For</span><ul class="small" style="margin:4px 0 0;padding-left:18px">${p.for.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div><span class="eyebrow">Against</span><ul class="small" style="margin:4px 0 0;padding-left:18px">${p.against.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      <p class="small muted"><b>Still to learn:</b> ${esc(p.toLearn)}</p></section>`).join("");
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Options</span><h1>Paths, vendors and how we'll score them</h1><p>${esc(o.note)}</p></div>
      <div class="grid-2">${paths}</div>
      <section class="panel"><h2>Commercial LOS long list</h2><div class="table-wrap"><table><thead><tr><th>Vendor</th><th>Status</th><th>Where it came from</th><th>Notes</th></tr></thead><tbody>
        ${o.vendors.map((v) => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.status)}</td><td class="muted">${esc(v.source)}</td><td>${esc(v.notes)}</td></tr>`).join("")}
      </tbody></table></div>${o.vendorNote ? `<p class="small muted">${esc(o.vendorNote)}</p>` : ""}</section>
      <section class="panel"><h2>Small business lending (if in scope)</h2><div class="table-wrap"><table><thead><tr><th>Platform</th><th>Status</th><th>Notes</th></tr></thead><tbody>
        ${o.smallBusiness.map((v) => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.status)}</td><td>${esc(v.notes)}</td></tr>`).join("")}
      </tbody></table></div></section>
      <section class="panel"><div class="panel-head"><h2>Draft evaluation criteria</h2><span class="small muted">Weights to be agreed by ${fmtDate(D.decisions.decisions.find((d) => d.id === "D05").needed)}</span></div>
        <div class="weights">${weightRows(o.criteria, true)}</div></section>
    </div>`;
  }
  function weightRows(criteria, detail) {
    const max = Math.max(...criteria.map((c) => c.suggestedWeight));
    return criteria.map((c) => `<div class="weight"><span>${esc(c.name)}</span><span class="w">${cnt(c.suggestedWeight, { suf: "%" })}</span>
      <div class="bar"><span style="width:${(c.suggestedWeight / max) * 100}%"></span></div>${detail ? `<span class="small muted wd" style="grid-column:1/-1">${esc(c.detail)}</span>` : ""}</div>`).join("");
  }

  /* ---------- Decisions ---------- */
  function viewDecisions() {
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Decision log</span><h1>Decisions the project needs</h1><p>${esc(D.decisions.note)}</p></div>
      <section class="panel"><div class="list">${D.decisions.decisions.map((d) => `<div class="row" style="gap:8px">
        <div class="row-head"><h3><span class="mono muted">${d.id}</span> ${esc(d.title)}</h3>${pill("st-" + d.status, d.status)}</div>
        <p>${esc(d.question)}</p>
        ${d.options.length ? `<ul class="small" style="margin:0;padding-left:18px">${d.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
        <p class="small"><b>Recommendation:</b> ${esc(d.recommendation)}</p>
        <div class="meta"><span>Needed by <span class="mono">${fmtDate(d.needed)}</span></span>${d.outcome ? `<span><b>Outcome:</b> ${esc(d.outcome)} (${esc(d.decidedBy)}, ${esc(d.decidedOn)})</span>` : ""}</div>
      </div>`).join("")}</div></section></div>`;
  }

  /* ---------- Risks ---------- */
  function viewRisks() {
    const rank = { high: 3, medium: 2, low: 1 };
    const rs = [...D.risks.risks].sort((a, b) => rank[b.impact] * rank[b.likelihood] - rank[a.impact] * rank[a.likelihood]);
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Risk log</span><h1>What could stop us</h1><p>${esc(D.risks.note)}</p></div>
      <section class="panel"><div class="list">${rs.map((r) => `<div class="row" style="gap:6px">
        <div class="row-head"><h3><span class="mono muted">${r.id}</span> ${esc(r.title)}</h3><span style="display:flex;gap:6px;flex-wrap:wrap">${pill("lv-" + r.likelihood, "Likelihood " + r.likelihood)}${pill("lv-" + r.impact, "Impact " + r.impact)}</span></div>
        <p class="small">${esc(r.detail)}</p><p class="small"><b>Mitigation:</b> ${esc(r.mitigation)}</p><div class="meta"><span>Owner: ${esc(r.owner)}</span></div>
      </div>`).join("")}</div></section></div>`;
  }

  /* ---------- Team ---------- */
  function viewTeam() {
    const t = D.team;
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Team and actions</span><h1>Who does what, and what's next</h1><p>${esc(t.note)}</p></div>
      <section class="panel"><h2>Roles</h2><div class="table-wrap"><table><thead><tr><th>Role</th><th>Name</th><th>Time</th><th>Responsibility</th></tr></thead><tbody>
        ${t.roles.map((r) => `<tr><td><b>${esc(r.role)}</b></td><td class="${/TBD/.test(r.name) ? "muted" : ""}">${esc(r.name)}</td><td class="mono">${esc(r.time)}</td><td>${esc(r.responsibility)}</td></tr>`).join("")}
      </tbody></table></div></section>
      <div class="grid-2">
        <section class="panel"><h2>Next actions</h2><div class="list">${D.actions.actions.map((a) => `<div class="row"><div class="row-head"><span><span class="mono muted">${a.id}</span> ${esc(a.title)}</span>${pill("st-" + a.status, a.status)}</div><div class="meta"><span>${esc(a.owner)}</span><span class="mono">Due ${fmtDate(a.due)}</span></div></div>`).join("")}</div></section>
        <section class="panel"><h2>Meeting cadence</h2><div class="list">${t.cadence.map((c) => `<div class="row"><b>${esc(c.meeting)}</b><span class="small muted">${esc(c.frequency)}</span></div>`).join("")}</div></section>
      </div></div>`;
  }

  /* ---------- Kickoff slide blocks ---------- */
  const BLOCKS = {
    lead: (b) => `<p class="lead">${esc(b.text)}</p>`,
    goals: () => `<ul class="s-goals">${D.kickoff.goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`,
    countdown: () => {
      const kick = keyDate("kickoff"), go = keyDate("go-live"), end = keyDate("globalwave-end"), sign = keyDate("contract-signed");
      const total = daysBetween(kick, end);
      const pct = (iso) => (daysBetween(kick, iso) / total) * 100;
      const months = (a, b) => Math.round(daysBetween(a, b) / 30.44);
      return `<div class="s-figs" style="--n:4">
          <div class="s-fig"><span class="v brass">${cnt(months(kick, end), { suf: " mo" })}</span><span class="l">from kickoff to contract end (${total} days)</span></div>
          <div class="s-fig"><span class="v">${cnt(months(kick, sign), { suf: " mo" })}</span><span class="l">to choose and sign a vendor</span></div>
          <div class="s-fig"><span class="v">${cnt(months(sign, go), { suf: " mo" })}</span><span class="l">to implement, test and train</span></div>
          <div class="s-fig"><span class="v accent">${cnt(months(go, end), { suf: " mo" })}</span><span class="l">buffer after go-live</span></div>
        </div>
        <div class="track" aria-hidden="true">
          <span class="tick first" style="left:0">Kickoff · ${fmtMonth(kick)}</span>
          <span class="tick" style="left:${pct(sign)}%">Contract · ${fmtMonth(sign)}</span>
          <span class="tick last" style="left:100%">Ends · ${fmtMonth(end)}</span>
          <div class="rail-line"><span class="seg used" style="left:0;width:${pct(go)}%"></span><span class="seg buf" style="left:${pct(go)}%;width:${100 - pct(go)}%"></span></div>
          <span class="pin" style="left:${pct(sign)}%"></span><span class="pin" style="left:${pct(go)}%"></span>
          <span class="tick b" style="left:${pct(go)}%">Go-live · ${fmtMonth(go)}</span>
        </div>`;
    },
    profile: () => {
      const b = D.project.bank;
      return `<div class="s-figs" style="--n:4">
          <div class="s-fig"><span class="v">${cnt(b.totalAssets, { dec: 1, pre: "$", suf: "B" })}</span><span class="l">total assets, targeting <b>$${b.targetAssets.toFixed(1)}B</b></span></div>
          <div class="s-fig"><span class="v">${cnt(b.commercialPortfolio, { dec: 1, pre: "$", suf: "B" })}</span><span class="l">commercial loan portfolio</span></div>
          <div class="s-fig"><span class="v">${money(b.loanSizeMin)}–${money(b.loanSizeMax)}</span><span class="l">typical commercial deal size</span></div>
          <div class="s-fig"><span class="v brass">Part-time</span><span class="l">loan technology admin; no Salesforce staff</span></div>
        </div>
        <div class="split"><span class="s-muted small">Complex structures</span><div class="bars">
          <div class="bar-row"><span>Share of loans</span><div class="b"><span style="width:${b.complexShareOfUnits * 100}%"></span></div></div>
          <div class="bar-row"><span>Share of dollars</span><div class="b"><span style="width:${b.complexShareOfDollars * 100}%"></span></div></div>
        </div></div>`;
    },
    systems: () => {
      const box = (x, y, w, h, t3, t1, t2, cls = "") => `<g class="node ${cls}"><rect class="box ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text class="t3" x="${x + 16}" y="${y + 24}">${esc(t3)}</text><text class="t1" x="${x + 16}" y="${y + 52}">${esc(t1)}</text><text class="t2" x="${x + 16}" y="${y + 76}">${esc(t2)}</text></g>`;
      const edge = (x1, y1, x2, y2, label, lx, ly, cls = "", anchor = "middle", flow = "out") => `<path class="edge ${cls}" data-flow="${flow}" d="M${x1} ${y1} L${x2} ${y2}" marker-end="url(#ah)"/><text class="elabel" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(label)}</text>`;
      return `<div class="sys-wrap"><svg class="sys" viewBox="0 0 860 440" role="img" aria-label="Systems that connect to the commercial LOS">
        <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow" d="M0 0 L10 5 L0 10 z"/></marker></defs>
        ${box(290, 172, 280, 96, "TO BE SELECTED", "Commercial LOS", "Origination · underwriting · approval", "core")}
        ${box(0, 40, 260, 96, "RISK RATING", "Abrigo", "Ratings, spreads, analysis")}
        ${box(600, 40, 260, 96, "DOCUMENT PREP", "Finastra LaserPro", "Loan documents at closing")}
        ${box(0, 330, 260, 96, "CORE BANKING", "COCC", "Boarding, customer records")}
        ${box(600, 330, 260, 96, "CONTENT MANAGEMENT", "Identifi", "Credit files, imaging")}
        ${box(305, 0, 250, 96, "INCUMBENT · ENDS 3/1/2029", "GlobalWave", "Credit Track", "old")}
        ${edge(262, 120, 300, 170, "ratings", 276, 162, "", "end", "both")}
        ${edge(560, 170, 598, 120, "deal data", 584, 162, "", "start")}
        ${edge(300, 270, 262, 328, "boarding", 276, 290, "", "end")}
        ${edge(560, 270, 598, 328, "documents", 584, 290, "", "start")}
        ${edge(430, 98, 430, 168, "convert or archive", 440, 138, "old", "start")}
      </svg></div>`;
    },
    thinking: () => {
      const cc = confCounts(); const open = D.claims.claims.filter((x) => x.learn).length;
      return `<div class="s-figs" style="--n:${cc.length + 1}">${cc.map((x) => `<div class="s-fig"><span class="v">${cnt(x.n)}</span><span class="l">${pill("cf-" + x.s, confLabel(x.s))}</span></div>`).join("")}
        <div class="s-fig"><span class="v accent">${cnt(open)}</span><span class="l">Open questions</span></div></div>
        <p class="s-muted small">Full lists in <a href="#think">What we think</a> and <a href="#learn">What we need to learn</a>.</p>`;
    },
    questions: (b) => `<div class="s-cards">${b.ids.map((id) => {
      const c = D.claims.claims.find((x) => x.id === id); if (!c) return "";
      return `<div class="s-card"><div class="row-head"><span class="s-muted small">${esc(c.topic)} · ${esc(c.owner)}</span>${pill("cf-" + c.confidence, confLabel(c.confidence))}</div>
        <div class="ct">${esc(c.learn)}</div><div class="cb">We think: ${esc(firstSentences(c.think, 1))}</div></div>`;
    }).join("")}</div>`,
    decision: (b) => {
      const d = D.decisions.decisions.find((x) => x.id === b.id);
      const pick = notes.picks[d.id];
      return `${b.compact ? `<p class="lead">${esc(d.question)}</p>` : `<p class="lead">${esc(d.question)}</p>`}
        ${d.options.length ? `<div class="s-options" role="group" aria-label="${esc(d.title)}">${d.options.map((o, i) => `<button type="button" class="s-option" data-decision="${d.id}" data-opt="${i}" aria-pressed="${pick === i}"><span class="radio"></span><span>${esc(o)}</span></button>`).join("")}</div>` : ""}
        ${b.compact ? "" : `<div class="s-rec"><b>Recommendation</b>${esc(d.recommendation)}</div>`}`;
    },
    paths: () => `<div class="s-cards">${D.options.paths.map((p) => `<div class="s-card"><div class="ct">${esc(p.name)}</div><div class="cb">${esc(p.summary)}</div>
        <ul class="s-list small">${p.for.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`,
    timeline: () => gantt({ compact: true }),
    criticalPath: () => `<ul class="s-list">${D.timeline.criticalPathNotes.slice(0, 3).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`,
    criteria: () => `<div class="weights s-weights">${weightRows(D.options.criteria, false)}</div>`,
    team: () => `<div class="table-wrap"><table class="s-table"><thead><tr><th>Role</th><th>Name</th><th>Time</th></tr></thead><tbody>
        ${D.team.roles.map((r, i) => `<tr><td>${esc(r.role)}</td><td><input type="text" id="role-${i}" data-role="${esc(r.role)}" value="${esc(notes.names[r.role] || (/TBD|volunteers/.test(r.name) ? "" : r.name))}" placeholder="${esc(r.name)}" aria-label="Name for ${esc(r.role)}"></td><td class="mono s-muted">${esc(r.time)}</td></tr>`).join("")}
      </tbody></table></div>`,
    risks: (b) => `<div class="s-cards">${D.risks.risks.slice(0, b.limit || 6).map((r) => `<div class="s-card"><div class="row-head"><span class="ct">${esc(r.title)}</span>${pill("lv-" + r.impact, r.impact)}</div><div class="cb">${esc(r.mitigation)}</div></div>`).join("")}</div>`,
    actions: () => `<div class="table-wrap"><table class="s-table"><thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody>
        ${D.actions.actions.slice().sort((a, b) => a.due.localeCompare(b.due)).map((a) => `<tr><td>${esc(a.title)}</td><td class="s-muted">${esc(a.owner)}</td><td class="mono">${fmtDate(a.due)}</td></tr>`).join("")}
      </tbody></table></div>`,
  };
  function firstSentences(t, n) { return t.split(/(?<=\.)\s+(?=[A-Z(])/).slice(0, n).join(" "); }

  /* ---------- Kickoff view ---------- */
  let showNotes = window.matchMedia("(min-width: 700px)").matches;
  let timerStart = null, timerHandle = null;

  function plannedAt(i) { return D.kickoff.slides.slice(0, i).reduce((s, x) => s + x.minutes, 0); }

  function viewKickoff(idx) {
    const k = D.kickoff;
    const n = k.slides.length;
    const i = Math.min(idx, n - 1);
    const s = k.slides[i];
    const sections = [];
    k.slides.forEach((x, j) => { if (!sections.length || sections[sections.length - 1].name !== x.section) sections.push({ name: x.section, at: j }); });
    return `<div class="kick ${showNotes ? "" : "notes-off"}" id="kick">
      <div class="kick-bar">
        <div class="group"><span class="eyebrow">Kickoff walkthrough · ${fmtDate(k.date)} · ${k.lengthMinutes} min</span></div>
        <div class="group">
          <button class="btn small" type="button" id="prevBtn" ${i === 0 ? "disabled" : ""}>Previous</button>
          <span class="mono small">${i + 1} / ${n}</span>
          <button class="btn small primary" type="button" id="nextBtn" ${i === n - 1 ? "disabled" : ""}>Next</button>
          <button class="btn small" type="button" id="notesBtn" aria-pressed="${showNotes}">${showNotes ? "Hide" : "Show"} presenter notes</button>
          <button class="btn small" type="button" id="presentBtn">Present</button>
        </div>
      </div>
      <div class="progress" role="group" aria-label="Slides">${k.slides.map((x, j) => `<button type="button" data-go="${j}" class="${j < i ? "done" : j === i ? "cur" : ""}" aria-label="Slide ${j + 1}: ${esc(x.title)}" title="${esc(x.title)}"></button>`).join("")}</div>
      <div class="progress-labels small muted">${sections.map((sec) => `<span>${esc(sec.name)}</span>`).join("")}</div>
      <article class="slide" aria-live="polite">
        <div class="kicker"><span>${esc(s.kicker)}</span><span>${esc(s.section)}</span></div>
        <h1>${esc(s.title)}</h1>
        <div class="blocks">${s.blocks.map((b) => (BLOCKS[b.type] ? BLOCKS[b.type](b) : "")).join("")}</div>
        <span class="s-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <div class="slide-foot"><span>${esc(D.project.name)}</span><span>${i + 1} / ${n} · ~${s.minutes} min</span></div>
      </article>
      <aside class="presenter" aria-label="Presenter notes">
        <section class="panel">
          <div class="timer"><span class="eyebrow">Meeting clock</span><span class="t" id="timerT">${timerStart ? "" : "0:00"}</span><button class="btn small" type="button" id="timerBtn">${timerStart ? "Stop" : "Start"}</button></div>
          <span class="small muted">Plan: this slide starts at minute ${plannedAt(i)} and runs ~${s.minutes} min.</span>
        </section>
        <section class="panel"><span class="eyebrow">Talking points</span><p class="notes-text">${esc(s.notes)}</p></section>
        ${s.discuss.length ? `<section class="panel"><span class="eyebrow">Ask the room</span><ul class="prompts">${s.discuss.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></section>` : ""}
        ${s.capture ? `<section class="panel"><label class="eyebrow" for="cap-${s.id}">Capture: ${esc(s.capture)}</label><textarea id="cap-${s.id}" data-slide="${s.id}" placeholder="Type notes during the meeting. They stay in this browser until you copy them out.">${esc(notes.slides[s.id] || "")}</textarea></section>` : ""}
        <section class="panel">
          <span class="eyebrow">Meeting record</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" type="button" id="copyBtn">Copy notes as Markdown</button>${inFrame ? "" : `<button class="btn small" type="button" id="dlBtn">Download notes</button>`}<button class="btn small" type="button" id="clearBtn">Clear notes</button></div>
          <span class="toast" id="toast"></span>
          <span class="small muted">Paste the notes into <span class="mono">docs/kickoff/</span> in the repo so the team and agents can update the decision log.</span>
        </section>
      </aside>
      <button class="exit-audience" type="button" id="exitBtn">Exit presentation (Esc)</button>
    </div>`;
  }

  function notesMarkdown() {
    const k = D.kickoff;
    let md = `# Kickoff meeting notes, ${fmtDate(k.date)}\n\n_Exported ${new Date().toLocaleString()}_\n\n## Decisions\n\n`;
    D.decisions.decisions.forEach((d) => {
      if (notes.picks[d.id] != null) md += `- **${d.id} ${d.title}**: ${d.options[notes.picks[d.id]]}\n`;
    });
    if (!Object.keys(notes.picks).length) md += "- None recorded\n";
    md += `\n## Team\n\n`;
    D.team.roles.forEach((r) => { if (notes.names[r.role]) md += `- ${r.role}: ${notes.names[r.role]}\n`; });
    if (!Object.values(notes.names).some(Boolean)) md += "- No names recorded\n";
    md += `\n## Notes by topic\n\n`;
    k.slides.forEach((s) => { if (s.capture && (notes.slides[s.id] || "").trim()) md += `### ${s.title}\n_${s.capture}_\n\n${notes.slides[s.id].trim()}\n\n`; });
    return md;
  }
  function flash(msg) { const t = document.getElementById("toast"); if (t) { t.textContent = msg; setTimeout(() => { if (t) t.textContent = ""; }, 3500); } }
  let clearArmed = false;

  function tickTimer() {
    const el = document.getElementById("timerT"); if (!el || !timerStart) return;
    const sec = Math.floor((Date.now() - timerStart) / 1000);
    el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    const i = route().slide;
    el.classList.toggle("late", sec / 60 > plannedAt(i) + D.kickoff.slides[Math.min(i, D.kickoff.slides.length - 1)].minutes);
  }

  function bindKickoff(i) {
    const n = D.kickoff.slides.length;
    const go = (j) => { if (j >= 0 && j < n) location.hash = `kickoff-${j + 1}`; };
    const q = (id) => document.getElementById(id);
    q("prevBtn").onclick = () => go(i - 1);
    q("nextBtn").onclick = () => go(i + 1);
    q("notesBtn").onclick = () => { showNotes = !showNotes; render(); };
    q("presentBtn").onclick = () => { document.body.classList.add("audience"); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* optional */ } };
    q("exitBtn").onclick = exitAudience;
    document.querySelectorAll(".progress [data-go]").forEach((b) => (b.onclick = () => go(+b.dataset.go)));
    document.querySelectorAll("[data-decision]").forEach((b) => (b.onclick = () => {
      const id = b.dataset.decision, o = +b.dataset.opt;
      if (notes.picks[id] === o) delete notes.picks[id]; else notes.picks[id] = o;
      store.set(NOTES_KEY, notes); render();
    }));
    document.querySelectorAll("textarea[data-slide]").forEach((t) => (t.oninput = () => { notes.slides[t.dataset.slide] = t.value; store.set(NOTES_KEY, notes); }));
    document.querySelectorAll("input[data-role]").forEach((t) => (t.oninput = () => { notes.names[t.dataset.role] = t.value; store.set(NOTES_KEY, notes); }));
    q("timerBtn").onclick = () => {
      if (timerStart) { timerStart = null; clearInterval(timerHandle); } else { timerStart = Date.now(); timerHandle = setInterval(tickTimer, 1000); }
      render();
    };
    tickTimer();
    q("copyBtn").onclick = () => {
      const md = notesMarkdown();
      const fallback = () => { const ta = document.createElement("textarea"); ta.value = md; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); flash(ok ? "Copied." : "Copy failed. Select the notes text and copy by hand."); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(md).then(() => flash("Copied."), fallback); else fallback();
    };
    if (q("dlBtn")) q("dlBtn").onclick = () => {
      const blob = new Blob([notesMarkdown()], { type: "text/markdown" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `kickoff-notes-${D.kickoff.date}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    q("clearBtn").onclick = () => {
      if (!clearArmed) { clearArmed = true; q("clearBtn").textContent = "Click again to clear all notes"; setTimeout(() => { clearArmed = false; const b = q("clearBtn"); if (b) b.textContent = "Clear notes"; }, 4000); return; }
      clearArmed = false; notes = { slides: {}, picks: {}, names: {} }; store.set(NOTES_KEY, notes); render(); flash("Notes cleared.");
    };
  }
  function exitAudience() { document.body.classList.remove("audience"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* optional */ } }

  document.addEventListener("keydown", (e) => {
    if (route().view !== "kickoff") return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    const i = route().slide, n = D.kickoff.slides.length;
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); if (i < n - 1) location.hash = `kickoff-${i + 2}`; }
    else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); if (i > 0) location.hash = `kickoff-${i}`; }
    else if (e.key === "Escape") exitAudience();
    else if (e.key === "f" || e.key === "F") document.body.classList.contains("audience") ? exitAudience() : document.getElementById("presentBtn").click();
    else if (e.key === "n" || e.key === "N") { showNotes = !showNotes; render(); }
  });
  let touch = null;
  document.addEventListener("touchstart", (e) => { if (route().view === "kickoff" && e.target.closest && e.target.closest(".slide")) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y; touch = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = route().slide, n = D.kickoff.slides.length;
    if (dx < 0 && i < n - 1) location.hash = `kickoff-${i + 2}`; else if (dx > 0 && i > 0) location.hash = `kickoff-${i}`;
  }, { passive: true });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) document.body.classList.remove("audience"); });

  /* ---------- render ---------- */
  let lastView = null, lastSlide = -1;
  function render() {
    const r = route();
    renderShell();
    const main = document.getElementById("main");
    const views = { overview: viewOverview, plan: viewPlan, think: viewThink, learn: viewLearn, options: viewOptions, decisions: viewDecisions, risks: viewRisks, team: viewTeam };
    if (r.view === "kickoff") { main.innerHTML = viewKickoff(r.slide); bindKickoff(Math.min(r.slide, D.kickoff.slides.length - 1)); }
    else { main.innerHTML = views[r.view](); document.body.classList.remove("audience"); }
    if (lastView !== r.view) window.scrollTo(0, 0);
    const info = { view: r.view, slide: r.slide, viewChanged: lastView !== r.view, slideChanged: r.view === "kickoff" && r.slide !== lastSlide, dir: r.slide >= lastSlide ? 1 : -1 };
    lastView = r.view; lastSlide = r.view === "kickoff" ? r.slide : -1;
    if (window.LOSMotion) { try { window.LOSMotion.afterRender(main, info); } catch (e) { console.warn("motion", e); } }
  }

  window.addEventListener("hashchange", render);
  Promise.all(FILES.map((f) => fetch(`data/${f}.json`, { cache: "no-cache" }).then((res) => { if (!res.ok) throw new Error(`${f}.json: ${res.status}`); return res.json(); }).then((j) => (D[f] = j))))
    .then(render)
    .catch((err) => {
      document.getElementById("main").innerHTML = `<div class="error-box"><h2>The project data didn't load</h2>
        <p>${esc(err.message)}</p>
        <p>If you opened <code>index.html</code> directly from disk, browsers block it from reading the data files. From the repo root run <code>./scripts/serve.sh</code> and open <code>http://localhost:8000</code>.</p>
        <p>If you edited a file in <code>site/data/</code>, check that it is still valid JSON.</p></div>`;
    });
})();
