/* Commercial LOS project workspace.
   Plain JS, no build step. All content lives in data/*.json so people and agents can edit it directly. */
(function () {
  "use strict";

  const FILES = ["project", "timeline", "claims", "decisions", "risks", "team", "options", "actions"]; // meeting decks are added from MEETINGS below
  // loaded if present; the site still works without them
  const OPTIONAL = ["surveys", "survey-responses"];
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

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ } },
  };

  /* ---------- theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  applyTheme(store.get(THEME_KEY, null));
  function cycleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === null ? "light" : cur === "light" ? "dark" : null;
    applyTheme(next); store.set(THEME_KEY, next); renderShell(); if (window.LOSMotion) { window.LOSMotion.refreshTheme(); if (window.LOSMotion.nav) window.LOSMotion.nav(true); }
  }

  /* ---------- routing and navigation ---------- */
  // Meeting slide decks. Each deck is its own data file with the same shape as kickoff.json
  // (title, date, lengthMinutes, goals, slides). To add a meeting, add its file to site/data and a line here.
  const MEETINGS = [
    { id: "kickoff", file: "kickoff", label: "Kickoff walkthrough" },
  ];
  const meeting = (id) => MEETINGS.find((m) => m.id === id);
  const deckData = (m) => D[m.file];
  const PAGES = ["overview", "meetings", "plan", "think", "learn", "options", "decisions", "risks", "surveys", "team"];
  function route() {
    let h = decodeURIComponent((location.hash || "#overview").slice(1));
    if (h === "evidence") h = "think"; // old links
    const pr = h.match(/^([a-z0-9-]+)\/print$/);
    if (pr && meeting(pr[1]) && deckData(meeting(pr[1]))) return { view: "print", deck: pr[1], key: pr[1], page: h, slide: 0 };
    const m = h.match(/^([a-z0-9-]+?)(?:-(\d+))?$/);
    if (m && meeting(m[1]) && deckData(meeting(m[1]))) {
      const n = deckData(meeting(m[1])).slides.length;
      return { view: "deck", deck: m[1], key: m[1], page: m[1], slide: Math.min(n - 1, Math.max(0, parseInt(m[2] || "1", 10) - 1)) };
    }
    const sv = h.match(/^survey-(.+?)(\/results)?$/);
    if (sv && D.surveys && D.surveys.roles.some((r) => r.id === sv[1])) {
      return { view: "survey", role: sv[1], tab: sv[2] ? "results" : "questions", key: `survey-${sv[1]}`, page: h, slide: 0 };
    }
    const v = PAGES.includes(h) && (h !== "surveys" || D.surveys) ? h : "overview";
    return { view: v, key: v, page: v, slide: 0 };
  }
  function counts() {
    return {
      learn: D.claims.claims.filter((c) => c.learn).length,
      decisions: D.decisions.decisions.filter((d) => d.status !== "decided").length,
      risks: D.risks.risks.filter((r) => r.status === "open").length,
      team: D.actions.actions.filter((a) => a.status !== "done").length,
    };
  }
  const shortDate = (iso) => { const d = new Date(parse(iso)); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  // The nav tree: top-level links and groups of links. `key` matches route().key.
  function navModel() {
    const c = counts();
    const link = (key, label, n, href) => ({ key, label, n, href: href || `#${key}` });
    const tree = [
      link("overview", "Overview"),
      { group: "meetings", label: "Meetings", items: [link("meetings", "All meetings"), ...MEETINGS.filter((m) => deckData(m)).map((m) => link(m.id, `${m.label} (${shortDate(deckData(m).date)})`, null, `#${m.id}-1`))] },
      { group: "plan", label: "Plan", items: [link("plan", "Roadmap"), link("options", "Options"), link("decisions", "Decisions", c.decisions), link("risks", "Risks", c.risks)] },
      { group: "knowledge", label: "Knowledge", items: [link("think", "What we think"), link("learn", "What we need to learn", c.learn)] },
    ];
    if (D.surveys) {
      const S = D.surveys, items = [link("surveys", "Survey plan")];
      const roleLink = (r) => { const n = svResponses(r.id).length; return link(`survey-${r.id}`, r.label, n || null); };
      (S.groups || []).forEach((g) => {
        const rs = S.roles.filter((r) => r.group === g.id);
        if (rs.length) items.push({ heading: g.label }, ...rs.map(roleLink));
      });
      const loose = S.roles.filter((r) => !(S.groups || []).some((g) => g.id === r.group));
      if (loose.length) items.push({ heading: "Other" }, ...loose.map(roleLink));
      tree.push({ group: "surveys", label: "Surveys", items });
    }
    tree.push(link("team", "Team and actions", c.team));
    return tree;
  }
  const NAV_KEY = "los-nav-open-v1";
  const NAV_DEFAULT = { meetings: true, plan: true, knowledge: true, surveys: false };
  let navOpen = store.get(NAV_KEY, {});
  let lastNavKey = null;
  const isOpen = (g) => (navOpen[g] != null ? navOpen[g] : NAV_DEFAULT[g] !== false);
  const curAttr = (r, key) => (r.key === key ? ' aria-current="page"' : "");

  /* ---------- shell ---------- */
  function renderShell() {
    const r = route();
    const end = keyDate("globalwave-end");
    const theme = document.documentElement.getAttribute("data-theme") || "system";
    const tree = navModel();
    const curGroup = tree.find((t) => t.items && t.items.some((x) => x.key === r.key));
    // open the group holding the current page whenever the page changes
    if (curGroup && lastNavKey !== r.key && !isOpen(curGroup.group)) { navOpen[curGroup.group] = true; store.set(NAV_KEY, navOpen); }
    lastNavKey = r.key;
    const a = (x) => `<a href="${x.href}"${curAttr(r, x.key)}><span>${esc(x.label)}</span>${x.n != null ? `<span class="count">${x.n}</span>` : ""}</a>`;
    const navLinks = tree.map((t) => {
      if (!t.items) return a(t);
      const open = isOpen(t.group);
      const sum = t.items.reduce((s, x) => s + (x.n || 0), 0);
      return `<div class="nav-group${t === curGroup ? " has-cur" : ""}">
        <button type="button" class="nav-gh" data-group="${t.group}" aria-expanded="${open}" aria-controls="ng-${t.group}"><span class="chev" aria-hidden="true"></span><span class="gl">${esc(t.label)}</span>${sum ? `<span class="count">${sum}</span>` : ""}</button>
        <div class="nav-sub" id="ng-${t.group}"${open ? "" : " hidden"}>${t.items.map((x) => (x.heading ? `<span class="nav-h">${esc(x.heading)}</span>` : a(x))).join("")}</div>
      </div>`;
    }).join("");
    const oldNav = document.querySelector(".rail .nav"), navScroll = oldNav ? oldNav.scrollTop : 0;
    document.getElementById("rail").innerHTML = `
      <div class="brand"><span class="eyebrow">Project workspace</span><span class="brand-name">${esc(D.project.name)}</span></div>
      <div class="clock"><span class="eyebrow"><span class="beacon" aria-hidden="true"></span>GlobalWave contract ends</span><span class="big">${daysUntil(end)} days</span><span class="small">${fmtDate(end)}</span></div>
      <nav class="nav" aria-label="Sections"><span class="nav-ind" aria-hidden="true"></span>${navLinks}</nav>
      <div class="rail-foot">
        <span class="small muted">Data updated ${fmtDate(D.project.updated)}</span>
        ${OFFLINE && window.LOS_SAVED ? `<span class="small muted">Offline copy saved ${fmtDate(window.LOS_SAVED)}</span>` : ""}
        <button class="theme-toggle" type="button" id="themeBtn">Theme: ${esc(theme)}</button>
      </div>`;
    const nav = document.querySelector(".rail .nav"), navCur = nav && nav.querySelector('a[aria-current="page"]');
    if (nav) {
      nav.scrollTop = navScroll;
      if (navCur && nav.clientHeight && (navCur.offsetTop < nav.scrollTop || navCur.offsetTop + navCur.offsetHeight > nav.scrollTop + nav.clientHeight)) nav.scrollTop = navCur.offsetTop - nav.clientHeight / 2;
    }
    // phone: one scrolling row of sections, and a second row with the pages in the current section
    const top = tree.map((t) => {
      if (!t.items) return `<a href="${t.href}"${curAttr(r, t.key)}>${esc(t.label)}</a>`;
      return `<a href="${t.items[0].href}"${t === curGroup ? ' aria-current="true"' : ""}>${esc(t.label)}</a>`;
    }).join("");
    const sub = curGroup ? curGroup.items.filter((x) => !x.heading).map((x) => `<a href="${x.href}"${curAttr(r, x.key)}>${esc(x.label)}${x.n ? ` <span class="count">${x.n}</span>` : ""}</a>`).join("") : "";
    document.getElementById("topbar").innerHTML = `
      <span class="brand-name">${esc(D.project.name)}</span>
      <span class="eyebrow">${daysUntil(end)} days to contract end</span>
      <nav aria-label="Sections" class="tb-nav">${top}</nav>
      ${sub ? `<nav aria-label="${esc(curGroup.label)}" class="tb-sub">${sub}</nav>` : ""}`;
    const tbSub = document.querySelector(".tb-sub"), tbCur = tbSub && tbSub.querySelector('[aria-current="page"]');
    if (tbCur) tbSub.scrollLeft = tbCur.offsetLeft - (tbSub.clientWidth - tbCur.offsetWidth) / 2;
    const tbNav = document.querySelector(".tb-nav"), tbTop = tbNav && tbNav.querySelector("[aria-current]");
    if (tbTop) tbNav.scrollLeft = tbTop.offsetLeft - (tbNav.clientWidth - tbTop.offsetWidth) / 2;
    document.getElementById("themeBtn").onclick = cycleTheme;
    document.querySelectorAll(".nav-gh").forEach((b) => (b.onclick = () => {
      const g = b.dataset.group, open = b.getAttribute("aria-expanded") !== "true";
      navOpen[g] = open; store.set(NAV_KEY, navOpen);
      b.setAttribute("aria-expanded", String(open));
      document.getElementById(`ng-${g}`).hidden = !open;
      if (window.LOSMotion && window.LOSMotion.nav) window.LOSMotion.nav(true);
    }));
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
            <h1 class="hero-title">Commercial LOS replacement</h1>
            <p class="hero-sub">The plan, open questions and decisions, in one place.</p>
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

  /* ---------- Meetings ---------- */
  function viewMeetings() {
    const ms = MEETINGS.filter((m) => deckData(m)).sort((a, b) => deckData(b).date.localeCompare(deckData(a).date));
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Meetings</span><h1>Meeting walkthroughs</h1>
        <p>Slides for each project meeting. Open them on the shared screen and use Present for full screen. Talking points are in each meeting\'s facilitator guide.</p></div>
      <section class="panel"><div class="list">${ms.map((m) => {
        const k = deckData(m), dd = daysUntil(k.date);
        const sections = [...new Set(k.slides.map((x) => x.section))];
        const when = dd > 0 ? `In ${dd} day${dd === 1 ? "" : "s"}` : dd === 0 ? "Today" : "Held";
        return `<div class="row meet">
          <div class="row-head"><h3><a href="#${m.id}-1">${esc(m.label)}</a></h3>${pill(dd >= 0 ? "st-open" : "st-done", when)}</div>
          <p class="small">${esc(k.title)}</p>
          <div class="meta"><span class="mono">${fmtDate(k.date)}</span><span>${cnt(k.lengthMinutes)} min</span><span>${cnt(k.slides.length)} slides</span><span>${esc(sections.join(" · "))}</span></div>
          <div class="btn-row"><a class="btn small" href="#${m.id}-1">Open the slides <span aria-hidden="true">→</span></a>
            <a class="btn small" href="#${m.id}/print">Print or save as PDF</a>
            ${OFFLINE ? "" : `<button class="btn small" type="button" data-offline="${m.id}">Download offline copy</button>`}</div>
        </div>`;
      }).join("")}</div></section>
      <p class="small muted">Slides for later meetings will be listed here as they are prepared.</p>
    </div>`;
  }

  /* ---------- Surveys ---------- */
  // Questionnaires are written here, sent to staff through Microsoft Forms, and the exported answers
  // are imported into data/survey-responses.json. Nothing is collected on this site.
  const svResponses = (roleId) => (((D["survey-responses"] || {}).responses) || []).filter((r) => !roleId || r.role === roleId);
  const svRole = (id) => D.surveys.roles.find((r) => r.id === id);
  const svGroupLabel = (id) => ((D.surveys.groups || []).find((g) => g.id === id) || {}).label || "";
  function svQuestions(roleId) {
    const S = D.surveys, order = new Map(S.sections.map((x, i) => [x.id, i]));
    const at = (q) => (order.has(q.section) ? order.get(q.section) : 999);
    return S.questions.map((q, i) => ({ q, i })).filter((x) => !roleId || (x.q.roles || []).includes(roleId))
      .sort((a, b) => at(a.q) - at(b.q) || a.i - b.i).map((x) => x.q);
  }
  function svScale(q) {
    const sc = (D.surveys.scales || {})[q.scale || (q.type === "nps" ? "zero10" : "")];
    return sc || (q.type === "nps" ? { min: 0, max: 10, labels: ["Not at all likely", "Extremely likely"] } : { min: 1, max: 5, labels: [] });
  }
  const pointLabels = (sc) => (sc.labels && sc.labels.length === sc.max - sc.min + 1 ? sc.labels : null);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  function svTypeLabel(q) {
    const sc = svScale(q);
    switch (q.type) {
      case "rating": return `Rating ${sc.min}-${sc.max}`;
      case "nps": return "Likelihood 0-10";
      case "number": return q.unit ? `Number (${q.unit})` : "Number";
      case "single": return "Pick one";
      case "multi": return q.maxPick ? `Pick up to ${q.maxPick}` : "Pick any";
      case "rank": return "Rank in order";
      case "matrix": return `Rate each, ${sc.min}-${sc.max}`;
      case "text": return q.long ? "Open answer (longer)" : "Open answer";
      default: return q.type;
    }
  }
  function svMinutes(role, qs) {
    if (role && role.estimatedMinutes) return { m: role.estimatedMinutes, est: false };
    const sec = qs.reduce((s, q) => s + ({ text: q.long ? 90 : 40, matrix: 10 + 8 * (q.rows || []).length, rank: 35, multi: 25 }[q.type] || 15), 0);
    return { m: Math.max(1, Math.round(sec / 60)), est: true };
  }
  function scaleChips(sc) {
    const pl = pointLabels(sc);
    return `<div class="sv-chips">${range(sc.min, sc.max).map((p, i) => `<span class="sv-chip"><b>${p}</b>${pl ? `<span>${esc(pl[i])}</span>` : ""}</span>`).join("")}</div>
      ${!pl && sc.labels && sc.labels.length ? `<p class="small muted">${sc.labels.map(esc).join(" · ")}</p>` : ""}`;
  }
  // a reference card for one question: what is asked and what kind of answer it takes (not a form)
  function svCard(q) {
    const sc = svScale(q);
    let body = "";
    if (q.type === "rating" || q.type === "nps") body = scaleChips(sc);
    else if (q.type === "number") body = `<p class="small muted">Answer is a number${q.unit ? ` in ${esc(q.unit)}` : ""}${q.min != null && q.max != null ? `, from ${esc(q.min)} to ${esc(q.max)}` : q.min != null ? `, ${esc(q.min)} or more` : q.max != null ? `, up to ${esc(q.max)}` : ""}.</p>`;
    else if (q.type === "single" || q.type === "multi") body = `<ul class="sv-opts${(q.options || []).length > 6 ? " cols" : ""}">${(q.options || []).map((o) => `<li>${esc(o)}</li>`).join("")}</ul>`;
    else if (q.type === "rank") body = `<ol class="sv-opts sv-rank">${(q.options || []).map((o) => `<li>${esc(o)}</li>`).join("")}</ol><p class="small muted">Shown in no particular order; each person puts them in their own order.</p>`;
    else if (q.type === "matrix") {
      const pl = pointLabels(sc);
      body = `<ul class="sv-opts">${(q.rows || []).map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
        <p class="small muted">Each rated ${sc.min}-${sc.max}${pl ? `: ${pl.map((l, i) => `${sc.min + i} ${esc(l)}`).join(", ")}` : ""}.</p>`;
    } else if (q.type === "text") body = "";
    return `<article class="sv-q">
      <div class="sv-qhead"><span class="mono muted">${esc(q.id)}</span><span class="sv-type">${esc(svTypeLabel(q))}</span>${q.required ? `<span class="small muted">Required</span>` : `<span class="small muted">Optional</span>`}</div>
      <h3>${esc(q.text)}</h3>
      ${q.help ? `<p class="small muted">${esc(q.help)}</p>` : ""}
      ${body}
    </article>`;
  }
  // plain text for pasting into Microsoft Forms; keeps the Q numbers so answers can be matched on import
  function svText(roleId) {
    const S = D.surveys, role = svRole(roleId), qs = svQuestions(roleId);
    const L = [`${role.label}: LOS staff survey`, ""];
    const intro = role.intro || S.intro;
    if (intro) L.push(intro, "");
    L.push("Questions marked * are required.");
    let sec = null;
    qs.forEach((q) => {
      if (q.section !== sec) { sec = q.section; const t = (S.sections.find((x) => x.id === sec) || {}).title || sec; L.push("", `== ${t} ==`, ""); }
      const sc = svScale(q), pl = pointLabels(sc);
      L.push(`${q.id}. ${q.text}${q.required ? " *" : ""}`);
      if (q.help) L.push(`   (${q.help})`);
      const form = { rating: "Rating", nps: "Net Promoter Score", number: "Text, number only", single: "Choice", multi: "Choice, multiple answers", rank: "Ranking", matrix: "Likert", text: q.long ? "Text, long answer" : "Text" }[q.type] || q.type;
      L.push(`   [Forms type: ${form}${q.type === "multi" && q.maxPick ? `, up to ${q.maxPick}` : ""}${q.type === "number" && q.unit ? `, in ${q.unit}` : ""}${q.type === "number" && (q.min != null || q.max != null) ? `, ${q.min != null ? q.min : ""}-${q.max != null ? q.max : ""}` : ""}]`);
      if (q.type === "rating" || q.type === "nps") L.push(`   Scale ${sc.min}-${sc.max}${pl ? ": " + pl.map((l, i) => `${sc.min + i} ${l}`).join(" / ") : sc.labels && sc.labels.length ? ": " + sc.labels.join(" / ") : ""}`);
      if (q.options) q.options.forEach((o) => L.push(`   - ${o}`));
      if (q.type === "matrix") { L.push(`   Options: ${pl ? pl.join(" / ") : range(sc.min, sc.max).join(" / ")}`); (q.rows || []).forEach((o) => L.push(`   * ${o}`)); }
      L.push("");
    });
    if (S.closing) L.push("", S.closing);
    return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  /* survey summaries */
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const num1 = (v) => (Math.round(v * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
  const isAnswer = (v) => v != null && v !== "" && !(Array.isArray(v) && !v.length) && !(typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
  const svAnswers = (q, rs) => rs.map((r) => (r.answers || {})[q.id]).filter(isAnswer);
  // horizontal bars with the value written next to each one
  function svBars(rows, max) {
    return `<div class="sv-bars">${rows.map((r) => `<div class="sv-bar${r.cls ? " " + r.cls : ""}"><span class="l">${esc(r.label)}</span><span class="v">${r.text}</span><div class="t" aria-hidden="true"><span style="width:${max ? Math.max(0, Math.min(1, r.v / max)) * 100 : 0}%"></span></div></div>`).join("")}</div>`;
  }
  const stat = (v, l) => `<div class="sv-stat"><span class="v">${v}</span><span class="l">${l}</span></div>`;
  function npsSplit(nums) {
    const p = nums.filter((v) => v >= 9).length, d = nums.filter((v) => v <= 6).length, n = nums.length;
    return { p, d, pas: n - p - d, n, score: Math.round(((p - d) / n) * 100) };
  }
  function countOptions(q, vals) {
    const c = new Map((q.options || []).map((o) => [o, 0]));
    vals.forEach((v) => (Array.isArray(v) ? v : [v]).forEach((o) => c.set(o, (c.get(o) || 0) + 1)));
    return [...c.entries()];
  }
  function svSummary(q, rs) {
    const vals = svAnswers(q, rs), n = vals.length, sc = svScale(q);
    if (!n) return `<p class="small muted">No answers to this question yet.</p>`;
    const nums = vals.map(Number).filter(Number.isFinite);
    switch (q.type) {
      case "rating": {
        const pl = pointLabels(sc);
        return `<div class="sv-stats">${stat(cnt(avg(nums), { dec: 1 }), `average, out of ${sc.max}`)}</div>
          ${svBars(range(sc.min, sc.max).reverse().map((p) => { const k = nums.filter((v) => v === p).length; return { label: `${p}${pl ? " · " + pl[p - sc.min] : ""}`, v: k, text: `${k} · ${pctOf(k, n)}%` }; }), n)}`;
      }
      case "nps": {
        const s = npsSplit(nums), top = Math.max(1, ...range(0, 10).map((p) => nums.filter((v) => v === p).length));
        return `<div class="sv-stats">${stat(cnt(s.score, { pre: s.score > 0 ? "+" : "" }), "score (share at 9-10 minus share at 0-6)")}${stat(cnt(avg(nums), { dec: 1 }), "average, out of 10")}</div>
          <div class="sv-cols" role="img" aria-label="How many people chose each number from 0 to 10">${range(0, 10).map((p) => { const k = nums.filter((v) => v === p).length; return `<div class="sv-col ${p >= 9 ? "pro" : p >= 7 ? "pas" : "det"}"><span class="k">${k || ""}</span><span class="c"><i style="height:${(k / top) * 100}%"></i></span><span class="p">${p}</span></div>`; }).join("")}</div>
          <div class="legend"><span class="key"><span class="sw sv-det"></span>0-6: ${s.d} (${pctOf(s.d, n)}%)</span><span class="key"><span class="sw sv-pas"></span>7-8: ${s.pas} (${pctOf(s.pas, n)}%)</span><span class="key"><span class="sw sv-pro"></span>9-10: ${s.p} (${pctOf(s.p, n)}%)</span></div>`;
      }
      case "number": {
        const u = q.unit ? ` ${esc(q.unit)}` : "";
        return `<div class="sv-stats">${stat(cnt(median(nums), { dec: median(nums) % 1 ? 1 : 0 }), `middle answer${u}`)}${stat(cnt(avg(nums), { dec: 1 }), `average${u}`)}${stat(`${num1(Math.min(...nums))}–${num1(Math.max(...nums))}`, `lowest to highest${u}`)}</div>`;
      }
      case "single": case "multi": {
        const rows = countOptions(q, vals).sort((a, b) => b[1] - a[1]);
        return `${svBars(rows.map(([o, k]) => ({ label: o, v: k, text: `${k} · ${pctOf(k, n)}%` })), n)}${q.type === "multi" ? `<p class="small muted">People could pick more than one, so the shares add up to more than 100%.</p>` : ""}`;
      }
      case "rank": {
        const opts = q.options || [], k = opts.length;
        const rows = opts.map((o) => { const pos = vals.map((v) => v.indexOf(o)).filter((i) => i >= 0).map((i) => i + 1); return { o, a: pos.length ? avg(pos) : null, first: pos.filter((x) => x === 1).length }; })
          .filter((x) => x.a != null).sort((a, b) => a.a - b.a);
        return `${svBars(rows.map((x, i) => ({ label: `${i + 1}. ${x.o}`, v: k + 1 - x.a, text: `avg place ${num1(x.a)}${x.first ? ` · first for ${x.first}` : ""}` })), k)}<p class="small muted">Ordered by average place (1 is most important). Longer bar = ranked higher.</p>`;
      }
      case "matrix": {
        const pl = pointLabels(sc);
        const rows = (q.rows || []).map((row) => { const v = vals.map((a) => Number(a[row])).filter(Number.isFinite); return { row, m: v.length ? avg(v) : null, k: v.length }; });
        return `${svBars(rows.map((x) => ({ label: x.row, v: x.m == null ? 0 : x.m - sc.min, text: x.m == null ? "no answers" : `${num1(x.m)} avg · ${x.k}` })), sc.max - sc.min)}
          <p class="small muted">Average on a ${sc.min}-${sc.max} scale${pl ? ` (${sc.min} ${esc(pl[0])}, ${sc.max} ${esc(pl[pl.length - 1])})` : ""}; the number after the dot is how many people rated it.</p>`;
      }
      case "text": {
        const list = vals.map((v) => `<li>${esc(v)}</li>`);
        return `<ul class="sv-texts">${list.slice(0, 8).join("")}</ul>${list.length > 8 ? `<details class="sv-more"><summary>Show all ${list.length} answers</summary><ul class="sv-texts">${list.slice(8).join("")}</ul></details>` : ""}`;
      }
      default: return `<p class="small muted">${n} answers.</p>`;
    }
  }

  function viewSurveys() {
    const S = D.surveys, all = svResponses(), qs = S.questions, roles = S.roles;
    const byRole = new Map(roles.map((r) => [r.id, svQuestions(r.id)]));
    const core = qs.filter((q) => roles.every((r) => (q.roles || []).includes(r.id))).length;
    const single = qs.filter((q) => (q.roles || []).length === 1).length;
    const groups = [...(S.groups || []), ...(roles.some((r) => !(S.groups || []).some((g) => g.id === r.group)) ? [{ id: null, label: "Other" }] : [])];
    const rolesIn = (g) => roles.filter((r) => (g.id ? r.group === g.id : !(S.groups || []).some((x) => x.id === r.group)));
    const maxCell = Math.max(1, ...S.sections.flatMap((sec) => roles.map((r) => byRole.get(r.id).filter((q) => q.section === sec.id).length)));
    // shared rating and 0-10 questions, compared by role once answers are in
    const withAnswers = roles.filter((r) => svResponses(r.id).length);
    const shared = qs.filter((q) => (q.type === "rating" || q.type === "nps") && (q.roles || []).length > 1 && withAnswers.filter((r) => q.roles.includes(r.id)).length > 1);
    return `<div class="page">
      <div class="page-head"><span class="eyebrow">Surveys · Plan workstream</span><h1>Asking staff what they need from the new LOS</h1>
        <p>A short questionnaire for each group of people who use the commercial LOS today, so the requirements and the vendor demos reflect how the work is really done. The surveys go out through Microsoft Forms; this page is the plan and the question list, not the survey itself.</p></div>
      <div class="figures">
        <div class="figure"><span class="eyebrow">Status</span><span class="val">${esc(S.status ? S.status[0].toUpperCase() + S.status.slice(1) : "Draft")}</span><span class="lbl">Owner: ${esc(S.owner || "to be named")}</span></div>
        <div class="figure"><span class="eyebrow">Roles surveyed</span><span class="val">${cnt(roles.length)}</span><span class="lbl">in ${(S.groups || []).length} groups</span></div>
        <div class="figure"><span class="eyebrow">Questions</span><span class="val">${cnt(qs.length)}</span><span class="lbl">${core} asked of everyone</span></div>
        <div class="figure"><span class="eyebrow">Responses</span><span class="val">${cnt(all.length)}</span><span class="lbl">${all.length ? `from ${withAnswers.length} role${withAnswers.length === 1 ? "" : "s"}${D["survey-responses"].imported ? ` · imported ${fmtDate(D["survey-responses"].imported)}` : ""}` : "none yet"}</span></div>
      </div>
      <section class="panel">
        <h2>How it works</h2>
        <ol class="sv-steps small">
          <li><b>Write the questions here.</b> Each role gets a shared core plus questions about its own work. Question numbers (Q01, Q02…) never change.</li>
          <li><b>Build each survey in Microsoft Forms.</b> Open a role below and use <em>Copy as text</em> to paste its questions across.</li>
          <li><b>Send and collect</b> through Forms. Answers are anonymous: only the role is recorded.</li>
          <li><b>Bring the answers back.</b> The Forms export is imported into the project data, and the summaries appear on each role's Results tab and below.</li>
        </ol>
        <p class="small muted">Working files and instructions are in <span class="mono">docs/surveys</span> in the repo.</p>
      </section>
      <div class="grid-3">${groups.map((g) => `<section class="panel">
        <div><span class="eyebrow">Group</span><h2>${esc(g.label)}</h2></div>
        <div class="list">${rolesIn(g).map((r) => { const rq = byRole.get(r.id), mm = svMinutes(r, rq), k = svResponses(r.id).length; return `<div class="row">
          <a href="#survey-${esc(r.id)}"><b>${esc(r.label)}</b></a>
          <div class="meta"><span>${rq.length} questions</span><span>${mm.est ? "about " : ""}${mm.m} min</span><span>${k ? `${k} response${k === 1 ? "" : "s"}` : "no responses yet"}</span></div>
        </div>`; }).join("")}</div>
      </section>`).join("")}</div>
      <section class="panel">
        <div class="panel-head"><h2>Which questions each role gets</h2><span class="small muted">${core} shared by all · ${qs.length - core - single} by some · ${single} for one role only</span></div>
        <div class="table-wrap"><table class="sv-grid"><thead><tr><th>Section</th>${roles.map((r) => `<th scope="col"><a href="#survey-${esc(r.id)}">${esc(r.label)}</a></th>`).join("")}<th scope="col">All roles</th></tr></thead><tbody>
          ${S.sections.map((sec) => { const inSec = qs.filter((q) => q.section === sec.id); const all8 = inSec.filter((q) => roles.every((r) => (q.roles || []).includes(r.id))).length; return `<tr><th scope="row">${esc(sec.title)}</th>${roles.map((r) => { const k = byRole.get(r.id).filter((q) => q.section === sec.id).length; return `<td class="mono${k ? "" : " muted"}" style="--h:${(k / maxCell) * 100}%">${k || "–"}</td>`; }).join("")}<td class="mono">${all8 || "–"}</td></tr>`; }).join("")}
          <tr class="sv-total"><th scope="row">Total</th>${roles.map((r) => `<td class="mono">${byRole.get(r.id).length}</td>`).join("")}<td class="mono">${core}</td></tr>
        </tbody></table></div>
        <p class="small muted">Each number is how many questions in that section the role is asked. Darker cells mean more questions.</p>
      </section>
      ${shared.length ? `<section class="panel"><div class="panel-head"><h2>Shared questions, compared by role</h2><span class="small muted">Average answer for each role</span></div>
        <div class="grid-2">${shared.map((q) => { const sc = svScale(q); return `<div class="sv-cmp"><span class="mono muted small">${esc(q.id)} · ${esc(svTypeLabel(q))}</span><h3>${esc(q.text)}</h3>
          ${svBars(withAnswers.filter((r) => q.roles.includes(r.id)).map((r) => { const v = svAnswers(q, svResponses(r.id)).map(Number).filter(Number.isFinite); return v.length ? { label: r.label, v: avg(v) - sc.min, text: `${num1(avg(v))} · ${v.length}` } : null; }).filter(Boolean), sc.max - sc.min)}</div>`; }).join("")}</div>
        <p class="small muted">Averages on each question's own scale; the number after the dot is how many people answered.</p></section>` : ""}
    </div>`;
  }

  function viewSurvey(roleId, tab) {
    const S = D.surveys, role = svRole(roleId), qs = svQuestions(roleId), rs = svResponses(roleId), mm = svMinutes(role, qs);
    const secs = S.sections.filter((sec) => qs.some((q) => q.section === sec.id));
    const loose = qs.filter((q) => !S.sections.some((sec) => sec.id === q.section));
    const tabs = `<div class="tabs" role="navigation" aria-label="Survey views">
      <a href="#survey-${esc(roleId)}"${tab === "questions" ? ' aria-current="page"' : ""}>Questions <span class="count">${qs.length}</span></a>
      <a href="#survey-${esc(roleId)}/results"${tab === "results" ? ' aria-current="page"' : ""}>Results <span class="count">${rs.length}</span></a></div>`;
    const head = `<div class="page-head"><span class="eyebrow"><a href="#surveys">Surveys</a> · ${esc(svGroupLabel(role.group))}</span><h1>${esc(role.label)}</h1>
      <p>${esc(role.intro || S.intro || "The questions this role will be asked in Microsoft Forms.")}</p>
      <div class="meta"><span>${qs.length} questions</span><span>${mm.est ? "about " : ""}${mm.m} min to answer</span><span>${pill("st-open", S.status || "draft")}</span></div></div>`;
    if (tab === "results") {
      return `<div class="page">${head}${tabs}
        ${rs.length ? `<div class="figures"><div class="figure"><span class="eyebrow">Responses</span><span class="val">${cnt(rs.length)}</span><span class="lbl">${D["survey-responses"].imported ? `imported ${fmtDate(D["survey-responses"].imported)}` : "imported from Microsoft Forms"}</span></div></div>
        ${[...secs.map((sec) => ({ title: sec.title, qs: qs.filter((q) => q.section === sec.id) })), ...(loose.length ? [{ title: "Other", qs: loose }] : [])].map((g) => `<section class="panel"><h2>${esc(g.title)}</h2>
          <div class="sv-results">${g.qs.map((q) => { const k = svAnswers(q, rs).length; return `<article class="sv-res"><div class="sv-qhead"><span class="mono muted">${esc(q.id)}</span><span class="sv-type">${esc(svTypeLabel(q))}</span><span class="small muted">${k} of ${rs.length} answered</span></div><h3>${esc(q.text)}</h3>${svSummary(q, rs)}</article>`; }).join("")}</div></section>`).join("")}`
        : `<section class="panel sv-empty"><h2>No answers yet</h2><p class="small muted">Summaries show up here once the Microsoft Forms export for this role has been imported into the project data (<span class="mono">scripts/import_responses.py</span>).</p></section>`}
      </div>`;
    }
    return `<div class="page">${head}${tabs}
      <section class="panel sv-tools"><div class="row-head"><p class="small">To build this survey in Microsoft Forms, copy the questions as plain text and paste them across. Keep the Q numbers: they are how answers are matched when they come back.</p>
        <button class="btn small" type="button" id="svCopy">Copy as text</button></div><span class="toast" id="toast"></span></section>
      ${[...secs.map((sec) => ({ title: sec.title, qs: qs.filter((q) => q.section === sec.id) })), ...(loose.length ? [{ title: "Other", qs: loose }] : [])].map((g) => `<section class="panel"><div class="panel-head"><h2>${esc(g.title)}</h2><span class="small muted">${g.qs.length} question${g.qs.length === 1 ? "" : "s"}</span></div>
        <div class="sv-qs">${g.qs.map(svCard).join("")}</div></section>`).join("")}
      ${S.closing ? `<p class="small muted">${esc(S.closing)}</p>` : ""}
    </div>`;
  }
  function bindSurvey(roleId) {
    const b = document.getElementById("svCopy");
    if (b) b.onclick = () => copyText(svText(roleId));
  }

  /* ---------- Kickoff slide blocks ---------- */
  const BLOCKS = {
    lead: (b) => `<p class="lead">${esc(b.text)}</p>`,
    goals: () => `<ul class="s-goals">${deck().goals.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`,
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
      return `<p class="lead">${esc(d.question)}</p>
        ${d.options.length ? `<ul class="s-options" aria-label="${esc(d.title)}">${d.options.map((o) => `<li class="s-option">${esc(o)}</li>`).join("")}</ul>` : ""}
        ${b.compact ? "" : `<div class="s-rec"><b>Recommendation</b>${esc(d.recommendation)}</div>`}`;
    },
    paths: () => `<div class="s-cards">${D.options.paths.map((p) => `<div class="s-card"><div class="ct">${esc(p.name)}</div><div class="cb">${esc(p.summary)}</div>
        <ul class="s-list small">${p.for.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>`,
    timeline: () => gantt({ compact: true }),
    criticalPath: () => `<ul class="s-list">${D.timeline.criticalPathNotes.slice(0, 3).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`,
    criteria: () => `<div class="weights s-weights">${weightRows(D.options.criteria, false)}</div>`,
    team: () => `<div class="table-wrap"><table class="s-table"><thead><tr><th>Role</th><th>Name</th><th>Time</th></tr></thead><tbody>
        ${D.team.roles.map((r) => `<tr><td>${esc(r.role)}</td><td>${esc(r.name)}</td><td class="mono s-muted">${esc(r.time)}</td></tr>`).join("")}
      </tbody></table></div>`,
    risks: (b) => `<div class="s-cards">${D.risks.risks.slice(0, b.limit || 6).map((r) => `<div class="s-card"><div class="row-head"><span class="ct">${esc(r.title)}</span>${pill("lv-" + r.impact, r.impact)}</div><div class="cb">${esc(r.mitigation)}</div></div>`).join("")}</div>`,
    actions: () => `<div class="table-wrap"><table class="s-table"><thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead><tbody>
        ${D.actions.actions.filter((a) => a.status !== "done").sort((a, b) => a.due.localeCompare(b.due)).map((a) => `<tr><td>${esc(a.title)}</td><td class="s-muted">${esc(a.owner)}</td><td class="mono">${fmtDate(a.due)}</td></tr>`).join("")}
      </tbody></table></div>`,
  };
  function firstSentences(t, n) { return t.split(/(?<=\.)\s+(?=[A-Z(])/).slice(0, n).join(" "); }

  /* ---------- Meeting decks ---------- */
  let curMeeting = MEETINGS[0];
  const deck = () => deckData(curMeeting);
  function useMeeting(id) { if (curMeeting.id !== id) curMeeting = meeting(id); }
  const slideHash = (j) => `${curMeeting.id}-${j + 1}`;

  function viewDeck(idx) {
    const k = deck();
    const n = k.slides.length;
    const i = Math.min(idx, n - 1);
    const s = k.slides[i];
    const sections = [];
    k.slides.forEach((x, j) => { if (!sections.length || sections[sections.length - 1].name !== x.section) sections.push({ name: x.section, at: j }); });
    return `<div class="kick" id="kick">
      <div class="kick-bar">
        <div class="group"><span class="eyebrow"><a href="#meetings">Meetings</a> · ${esc(curMeeting.label)} · ${fmtDate(k.date)} · ${k.lengthMinutes} min</span></div>
        <div class="group">
          <button class="btn small" type="button" id="prevBtn" ${i === 0 ? "disabled" : ""}>Previous</button>
          <span class="mono small">${i + 1} / ${n}</span>
          <button class="btn small primary" type="button" id="nextBtn" ${i === n - 1 ? "disabled" : ""}>Next</button>
          <button class="btn small" type="button" id="presentBtn">Present</button>
          <a class="btn small" href="#${curMeeting.id}/print">PDF</a>
          ${OFFLINE ? "" : `<button class="btn small" type="button" data-offline="${curMeeting.id}">Download</button>`}
        </div>
      </div>
      <div class="progress" role="group" aria-label="Slides">${k.slides.map((x, j) => `<button type="button" data-go="${j}" class="${j < i ? "done" : j === i ? "cur" : ""}" aria-label="Slide ${j + 1}: ${esc(x.title)}" title="${esc(x.title)}"></button>`).join("")}</div>
      <div class="progress-labels small muted">${sections.map((sec) => `<span>${esc(sec.name)}</span>`).join("")}</div>
      <article class="slide" aria-live="polite">${slideBody(s, i, n)}</article>
      <button class="exit-audience" type="button" id="exitBtn">Exit presentation (Esc)</button>
    </div>`;
  }

  function slideBody(s, i, n) {
    return `<div class="kicker"><span>${esc(s.kicker)}</span><span>${esc(s.section)}</span></div>
        <h1>${esc(s.title)}</h1>
        <div class="blocks">${s.blocks.map((b) => (BLOCKS[b.type] ? BLOCKS[b.type](b) : "")).join("")}</div>
        <span class="s-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <div class="slide-foot"><span>${esc(D.project.name)}</span><span>${i + 1} / ${n} · ~${s.minutes} min</span></div>`;
  }

  // Every slide on one page, one slide per printed sheet. The browser's print dialog saves it as a PDF.
  function viewPrint() {
    const k = deck(), n = k.slides.length;
    return `<div class="print-deck">
      <div class="print-bar">
        <span class="eyebrow"><a href="#meetings">Meetings</a> · <a href="#${curMeeting.id}-1">${esc(curMeeting.label)}</a> · ${fmtDate(k.date)} · ${n} slides</span>
        <div class="btn-row">
          <button class="btn small primary" type="button" id="printBtn">Print or save as PDF</button>
          <a class="btn small" href="#${curMeeting.id}-1">Back to the slides</a>
        </div>
        <p class="small muted">In the print dialog choose <b>Save as PDF</b> as the printer. Turn on <b>Background graphics</b> if the slides print white.</p>
      </div>
      ${k.slides.map((s, i) => `<div class="print-page"><article class="slide">${slideBody(s, i, n)}</article></div>`).join("")}
    </div>`;
  }
  function bindPrint() {
    document.getElementById("printBtn").onclick = () => window.print();
    // shrink the content of any slide that runs past the bottom of its page
    // (measured by where the footer lands; the big slide number hangs off the edge on purpose)
    document.querySelectorAll(".print-deck .slide").forEach((sl) => {
      const b = sl.querySelector(".blocks"), foot = sl.querySelector(".slide-foot");
      const over = () => foot.getBoundingClientRect().bottom - (sl.getBoundingClientRect().bottom - parseFloat(getComputedStyle(sl).paddingBottom));
      if (over() <= 1) return;
      // largest value of `set(x)` that fits (smaller text wraps less, so height doesn't scale evenly)
      const fit = (set, min) => { let lo = min, hi = 1; for (let t = 0; t < 8; t++) { const x = (lo + hi) / 2; set(x); if (over() > 1) hi = x; else lo = x; } set(lo); };
      // diagrams stretch to the full width, so narrow them first and leave the text at full size
      const wraps = [...sl.querySelectorAll(".sys-wrap, .gantt-wrap")], full = wraps.map((w) => w.getBoundingClientRect().width);
      if (wraps.length) fit((x) => wraps.forEach((w, k) => (w.style.maxWidth = `${Math.round(full[k] * x)}px`)), 0.55);
      if (over() > 1) fit((x) => (b.style.zoom = x.toFixed(3)), 0.4);
    });
    fitPrintPages();
  }
  function fitPrintPages() {
    const d = document.querySelector(".print-deck");
    if (!d) return;
    const z = Math.min(1, d.clientWidth / 1280);
    d.querySelectorAll(".print-page").forEach((p) => (p.style.zoom = z < 1 ? z.toFixed(3) : ""));
  }
  window.addEventListener("resize", fitPrintPages);

  /* ---------- Offline copy ---------- */
  // A single HTML file with the styles, scripts and a snapshot of all data inside it, so it opens
  // straight from disk with no server. It is the whole workspace, opened at the chosen meeting's slides.
  const OFFLINE = window.LOS_DATA || null;
  function downloadOffline(id) {
    const m = meeting(id), k = deckData(m);
    const get = (f) => fetch(f, { cache: "no-cache" }).then((res) => { if (!res.ok) throw new Error(`${f}: ${res.status}`); return res.text(); });
    // keep "</script>" or "<!--" inside the inlined text from ending the script tag early
    const safe = (t) => t.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
    const fonts = document.querySelector('link[href*="fonts.googleapis.com/css"]');
    flash("Preparing the download…");
    Promise.all(["styles.css", "motion.js", "app.js"].map(get)).then(([css, motion, js]) => {
      const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(m.label)} · ${esc(k.date)} · ${esc(D.project.name)}</title>
${fonts ? `<link rel="stylesheet" href="${esc(fonts.href)}">` : ""}
<style>${css.replace(/<\/(style)/gi, "<\\/$1")}</style>
</head>
<body>
  <div class="shell">
    <aside class="rail" id="rail"></aside>
    <div style="min-width:0">
      <header class="topbar" id="topbar"></header>
      <main class="main" id="main"><p class="loading">Loading project data…</p></main>
    </div>
  </div>
  <script>window.LOS_DATA = ${safe(JSON.stringify(D))};
window.LOS_START = ${JSON.stringify(`${m.id}-1`)};
window.LOS_SAVED = ${JSON.stringify(new Date().toISOString().slice(0, 10))};</script>
  <script>${safe(motion)}</script>
  <script>${safe(js)}</script>
</body>
</html>
`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      a.download = `${m.id}-${k.date}-slides.html`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      flash("Downloaded. Open the file in any browser; it works without a connection.");
    }).catch((err) => flash(`Download failed: ${err.message}`));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-offline]");
    if (b) downloadOffline(b.dataset.offline);
  });

  function copyText(text) {
    const fallback = () => { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) { /* ignore */ } ta.remove(); flash(ok ? "Copied." : "Copy failed. Select the text and copy by hand."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => flash("Copied."), fallback); else fallback();
  }
  function flash(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("span"); t.id = "toast"; t.className = "toast float"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; clearTimeout(flash.timer); flash.timer = setTimeout(() => { t.textContent = ""; }, 4500);
  }

  function bindDeck(i) {
    const n = deck().slides.length;
    const go = (j) => { if (j >= 0 && j < n) location.hash = slideHash(j); };
    const q = (id) => document.getElementById(id);
    q("prevBtn").onclick = () => go(i - 1);
    q("nextBtn").onclick = () => go(i + 1);
    q("presentBtn").onclick = () => { document.body.classList.add("audience"); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* optional */ } };
    q("exitBtn").onclick = exitAudience;
    document.querySelectorAll(".progress [data-go]").forEach((b) => (b.onclick = () => go(+b.dataset.go)));
  }
  function exitAudience() { document.body.classList.remove("audience"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* optional */ } }

  document.addEventListener("keydown", (e) => {
    if (route().view !== "deck") return;
    const i = route().slide, n = deck().slides.length;
    if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); if (i < n - 1) location.hash = slideHash(i + 1); }
    else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); if (i > 0) location.hash = slideHash(i - 1); }
    else if (e.key === "Escape") exitAudience();
    else if (e.key === "f" || e.key === "F") document.body.classList.contains("audience") ? exitAudience() : document.getElementById("presentBtn").click();
  });
  let touch = null;
  document.addEventListener("touchstart", (e) => { if (route().view === "deck" && e.target.closest && e.target.closest(".slide")) touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y; touch = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = route().slide, n = deck().slides.length;
    if (dx < 0 && i < n - 1) location.hash = slideHash(i + 1); else if (dx > 0 && i > 0) location.hash = slideHash(i - 1);
  }, { passive: true });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) document.body.classList.remove("audience"); });

  /* ---------- render ---------- */
  let lastPage = null, lastSlide = -1;
  function render() {
    const r = route();
    if (r.view === "deck" || r.view === "print") useMeeting(r.deck);
    renderShell();
    const main = document.getElementById("main");
    const views = { overview: viewOverview, meetings: viewMeetings, plan: viewPlan, think: viewThink, learn: viewLearn, options: viewOptions, decisions: viewDecisions, risks: viewRisks, surveys: viewSurveys, team: viewTeam };
    if (r.view === "deck") { main.innerHTML = viewDeck(r.slide); bindDeck(r.slide); }
    else if (r.view === "print") { main.innerHTML = viewPrint(); bindPrint(); document.body.classList.remove("audience"); }
    else {
      main.innerHTML = r.view === "survey" ? viewSurvey(r.role, r.tab) : views[r.view]();
      if (r.view === "survey") bindSurvey(r.role);
      document.body.classList.remove("audience");
    }
    const changed = lastPage !== r.page;
    if (changed && !(r.view === "survey" && lastPage && lastPage.split("/")[0] === r.page.split("/")[0])) window.scrollTo(0, 0);
    const info = { view: r.view, slide: r.slide, viewChanged: changed, slideChanged: r.view === "deck" && r.slide !== lastSlide, dir: r.slide >= lastSlide ? 1 : -1 };
    lastPage = r.page; lastSlide = r.view === "deck" ? r.slide : -1;
    if (window.LOSMotion) { try { window.LOSMotion.afterRender(main, info); } catch (e) { console.warn("motion", e); } }
  }

  window.addEventListener("hashchange", render);
  if (OFFLINE && !location.hash && window.LOS_START) history.replaceState(null, "", `#${window.LOS_START}`);
  const load = (f, optional) => OFFLINE ? (OFFLINE[f] ? Promise.resolve(D[f] = OFFLINE[f]) : optional ? Promise.resolve() : Promise.reject(new Error(`${f}.json is missing from this copy`))) : fetch(`data/${f}.json`, { cache: "no-cache" })
    .then((res) => { if (!res.ok) throw new Error(`${f}.json: ${res.status}`); return res.json(); })
    .then((j) => (D[f] = j))
    .catch((err) => { if (!optional) throw err; console.warn(`optional data file skipped: ${err.message}`); });
  Promise.all([...FILES.map((f) => load(f)), ...MEETINGS.map((m) => load(m.file, m.id !== "kickoff")), ...OPTIONAL.map((f) => load(f, true))])
    .then(render)
    .catch((err) => {
      document.getElementById("main").innerHTML = `<div class="error-box"><h2>The project data didn't load</h2>
        <p>${esc(err.message)}</p>
        <p>If you opened <code>index.html</code> directly from disk, browsers block it from reading the data files. From the repo root run <code>./scripts/serve.sh</code> and open <code>http://localhost:8000</code>.</p>
        <p>If you edited a file in <code>site/data/</code>, check that it is still valid JSON.</p></div>`;
    });
})();
