/* Motion layer for the project workspace.
   Uses only browser APIs (Web Animations, canvas, SMIL) so it works without a CDN.
   Every animation runs from a hidden state to the element's natural state, so content
   is always readable at rest, and everything is skipped when the viewer prefers reduced motion. */
(function () {
  "use strict";

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)");
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  const BACK = "cubic-bezier(.34,1.56,.64,1)";
  const reduced = () => RM.matches;
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function play(el, frames, opts) {
    if (!el || reduced() || !el.animate) return null;
    return el.animate(frames, Object.assign({ duration: 700, easing: EASE, fill: "backwards" }, opts || {}));
  }
  function stagger(els, frames, opts, step) {
    els.forEach((el, i) => play(el, frames, Object.assign({}, opts, { delay: ((opts && opts.delay) || 0) + i * (step || 60) })));
  }
  const RISE = [{ transform: "translateY(26px)", opacity: 0 }, { transform: "none", opacity: 1 }];
  const FADE = [{ opacity: 0 }, { opacity: 1 }];
  const GROW_X = [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];
  const POP = [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }];

  /* ---------- text effects ---------- */
  function countUp(el, delay, dur) {
    const to = parseFloat(el.dataset.count);
    const dec = +(el.dataset.dec || 0), pre = el.dataset.pre || "", suf = el.dataset.suf || "";
    const fmt = (v) => pre + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    if (reduced() || isNaN(to)) return;
    dur = dur || 1400;
    const t0 = performance.now() + (delay || 0);
    el.textContent = fmt(0);
    const step = (now) => {
      if (!el.isConnected) return;
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(p === 1 ? to : to * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789$%#/+";
  function scramble(el, delay, dur) {
    if (reduced() || !el) return;
    const final = el.textContent;
    dur = dur || 650;
    const t0 = performance.now() + (delay || 0);
    const step = (now) => {
      if (!el.isConnected) return;
      const p = (now - t0) / dur;
      if (p >= 1) { el.textContent = final; return; }
      const n = Math.max(0, Math.floor(final.length * p));
      let s = final.slice(0, n);
      for (let i = n; i < final.length; i++) s += /\s/.test(final[i]) ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = s;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function splitWords(h) {
    if (!h) return [];
    if (!h.dataset.split) {
      const words = h.textContent.trim().split(/\s+/);
      h.setAttribute("aria-label", h.textContent.trim());
      h.innerHTML = words.map((w) => `<span class="w" aria-hidden="true"><span class="wi">${esc(w)}</span></span>`).join(" ");
      h.dataset.split = "1";
    }
    return $$(".wi", h);
  }
  function revealTitle(h, delay) {
    stagger(splitWords(h), [{ transform: "translateY(110%) rotate(5deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 850, delay: delay || 0 }, 45);
  }

  /* Odometer: each digit is a strip of 0-9 twice, rolled to its final place. */
  function odometer(el, delay) {
    const value = el.dataset.odo;
    if (!value || el.dataset.built) return;
    el.dataset.built = "1";
    el.innerHTML = value.split("").map((ch) => {
      if (!/\d/.test(ch)) return `<span class="odo-sep" aria-hidden="true">${esc(ch)}</span>`;
      const d = +ch;
      const strip = Array.from({ length: 20 }, (_, k) => `<span>${k % 10}</span>`).join("");
      return `<span class="odo-col" aria-hidden="true"><span class="odo-strip" style="transform:translateY(-${((10 + d) / 20) * 100}%)">${strip}</span></span>`;
    }).join("");
    $$(".odo-strip", el).forEach((s, i) => play(s, [{ transform: "translateY(0%)" }, { transform: s.style.transform }], { duration: 1800 + i * 260, delay: (delay || 0) + i * 90, easing: "cubic-bezier(.16,1,.3,1)" }));
  }

  /* ---------- ambient flow field ---------- */
  const FX = (function () {
    const c = document.createElement("canvas");
    c.className = "fx";
    c.setAttribute("aria-hidden", "true");
    const ctx = c.getContext("2d");
    let W = 0, H = 0, host = null, raf = 0, parts = [], impulse = 0, t = 0;
    let bg = "#0f1c22", cols = ["#5cc2bd", "#e0b04f"], intensity = 1;
    const mouse = { x: -1e4, y: -1e4 };

    function colors() {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue("--stage").trim() || bg;
      cols = [cs.getPropertyValue("--stage-accent").trim() || cols[0], cs.getPropertyValue("--stage-brass").trim() || cols[1], "#e8efed"];
    }
    function spawn(p, any) {
      p.x = Math.random() * W; p.y = Math.random() * H;
      p.life = any ? Math.random() * 320 : 160 + Math.random() * 260;
      const r = Math.random(); p.c = r < 0.72 ? 0 : r < 0.94 ? 1 : 2;
      p.w = Math.random() * 1.2 + 0.3; p.s = 0.5 + Math.random() * 0.8;
      return p;
    }
    function size() {
      if (!host) return;
      const r = host.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const n = Math.round(Math.min(FINE.matches ? 300 : 110, (W * H) / (FINE.matches ? 3600 : 7000)) * intensity);
      while (parts.length < n) parts.push(spawn({}, true));
      parts.length = n;
      parts.forEach((p) => { if (p.x > W || p.y > H) spawn(p, true); });
      if (reduced()) still();
    }
    function angle(x, y) {
      const s = 0.0019;
      return Math.sin(x * s + t * 0.00022) * Math.cos(y * s * 1.4 - t * 0.00017) * Math.PI * 2 + Math.sin((x + y) * s * 0.45 + t * 0.0001);
    }
    function stepParticles(fade) {
      ctx.globalAlpha = fade; ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      impulse *= 0.93;
      for (const p of parts) {
        const a = angle(p.x, p.y);
        let vx = Math.cos(a) * p.s + impulse * p.s, vy = Math.sin(a) * p.s;
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 22000) { const d = Math.sqrt(d2) || 1, f = ((22000 - d2) / 22000) * 2.6; vx += (dx / d) * f; vy += (dy / d) * f; }
        const nx = p.x + vx, ny = p.y + vy;
        ctx.globalAlpha = Math.min(1, p.life / 50) * (p.c === 2 ? 0.35 : 0.5);
        ctx.strokeStyle = cols[p.c]; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
        p.x = nx; p.y = ny;
        if (--p.life <= 0 || nx < -20 || nx > W + 20 || ny < -20 || ny > H + 20) spawn(p, false);
      }
      ctx.globalAlpha = 1;
    }
    function still() { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 90; i++) stepParticles(0.03); }
    function frame(now) {
      raf = 0;
      if (!host || !host.isConnected || document.hidden || reduced()) return;
      t = now; stepParticles(0.07);
      raf = requestAnimationFrame(frame);
    }
    const ro = "ResizeObserver" in window ? new ResizeObserver(() => size()) : null;
    function mount(el, opts) {
      if (!el) return;
      intensity = (opts && opts.intensity) || 1;
      if (host !== el) { if (ro && host) ro.unobserve(host); host = el; el.prepend(c); colors(); if (ro) ro.observe(el); size(); }
      else if (!c.isConnected) el.prepend(c);
      if (!raf && !reduced()) raf = requestAnimationFrame(frame);
    }
    window.addEventListener("pointermove", (e) => {
      if (!host) return;
      const r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && host && !raf && !reduced()) raf = requestAnimationFrame(frame); });
    return { mount, kick: (dir) => { impulse = dir * 5; }, refresh: () => { colors(); size(); } };
  })();

  /* ---------- per-block choreography ---------- */
  function ganttFX(svg, d) {
    d = d || 0;
    play(svg.querySelector(".g-buffer"), FADE, { delay: d, duration: 1000 });
    $$(".g-grid, .g-month, .g-year", svg).forEach((el, i) => play(el, FADE, { delay: d + (i % 12) * 25, duration: 500 }));
    $$(".g-bar", svg).forEach((el, i) => play(el, GROW_X, { delay: d + 200 + i * 120, duration: 950, easing: "cubic-bezier(.65,0,.35,1)" }));
    $$(".g-bar-label, .g-dates", svg).forEach((el, i) => play(el, [{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], { delay: d + 160 + Math.floor(i / (svg.classList.contains("compact") ? 1 : 2)) * 120, duration: 600 }));
    play(svg.querySelector(".g-hard"), [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { delay: d + 900, duration: 900, easing: "cubic-bezier(.65,0,.35,1)" });
    $$(".g-hard-label, .g-buffer-label, .g-today-label", svg).forEach((el) => play(el, FADE, { delay: d + 1300, duration: 600 }));
    $$(".g-ms", svg).forEach((el, i) => play(el, POP, { delay: d + 1100 + i * 90, duration: 520, easing: BACK }));
    $$(".g-ms-label", svg).forEach((el, i) => play(el, RISE, { delay: d + 1200 + i * 90, duration: 520 }));
  }

  function sysFX(svg, d) {
    const nodes = $$(".node", svg);
    const core = svg.querySelector(".node.core");
    play(core, [{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { delay: d, duration: 750, easing: BACK });
    stagger(nodes.filter((n) => n !== core), [{ transform: "scale(.8)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { delay: d + 350, duration: 650, easing: BACK }, 110);
    const edges = $$(".edge", svg);
    edges.forEach((p, i) => {
      if (!p.getTotalLength) return;
      const len = p.getTotalLength();
      if (!p.classList.contains("old")) {
        p.style.strokeDasharray = `${len}`;
        play(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { delay: d + 800 + i * 120, duration: 600 });
      } else play(p, FADE, { delay: d + 800 + i * 120, duration: 600 });
    });
    $$(".elabel", svg).forEach((el, i) => play(el, FADE, { delay: d + 1100 + i * 100, duration: 500 }));
    if (reduced() || svg.dataset.packets) return;
    svg.dataset.packets = "1";
    const begin = ((d + 1500) / 1000).toFixed(2);
    edges.forEach((p, i) => {
      const flow = p.dataset.flow || "out";
      const old = p.classList.contains("old");
      const dirs = flow === "both" ? ["1;0", "0;1"] : ["0;1"];
      dirs.forEach((kp, j) => {
        const dur = (old ? 3.2 : 2.1 + (i % 3) * 0.35).toFixed(2);
        const offset = (j * 1.05 + (i % 2) * 0.5).toFixed(2);
        svg.insertAdjacentHTML("beforeend",
          `<circle class="packet${old ? " old" : ""}" r="${old ? 3 : 3.6}" opacity="0"><set attributeName="opacity" to="1" begin="${(+begin + +offset).toFixed(2)}s"/>` +
          `<animateMotion dur="${dur}s" begin="${(+begin + +offset).toFixed(2)}s" repeatCount="indefinite" path="${p.getAttribute("d")}" keyPoints="${kp}" keyTimes="0;1" calcMode="linear"/></circle>`);
      });
    });
  }

  function blockFX(b, d) {
    $$("[data-count]", b).forEach((el, i) => countUp(el, d + 120 + i * 90));
    if (b.matches(".s-figs")) stagger($$(".s-fig", b), [{ transform: "translateY(30px) scale(.96)", opacity: 0 }, { transform: "none", opacity: 1 }], { delay: d, duration: 750 }, 100);
    if (b.matches(".track")) {
      $$(".seg", b).forEach((s, i) => play(s, GROW_X, { delay: d + 200 + i * 700, duration: i ? 700 : 1300, easing: "cubic-bezier(.65,0,.35,1)" }));
      stagger($$(".pin", b), [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { delay: d + 700, duration: 450, easing: BACK }, 500);
      stagger($$(".tick", b), FADE, { delay: d + 400 }, 250);
    }
    if (b.matches(".split")) stagger($$(".b span", b), GROW_X, { delay: d + 200, duration: 1100, easing: "cubic-bezier(.65,0,.35,1)" }, 350);
    const sys = b.matches(".sys-wrap") && b.querySelector("svg");
    if (sys) sysFX(sys, d);
    const g = b.matches(".gantt-wrap") && b.querySelector("svg");
    if (g) ganttFX(g, d);
    if (b.matches(".s-cards")) {
      stagger($$(".s-card", b), [{ transform: "perspective(900px) rotateX(-60deg) translateY(36px)", opacity: 0 }, { transform: "perspective(900px) rotateX(0) translateY(0)", opacity: 1 }], { delay: d, duration: 900 }, 95);
    }
    if (b.matches(".s-options")) stagger($$(".s-option", b), [{ transform: "translateX(-24px)", opacity: 0 }, { transform: "none", opacity: 1 }], { delay: d, duration: 650 }, 110);
    if (b.matches(".weights")) {
      $$(".weight", b).forEach((w, i) => {
        play(w, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { delay: d + i * 80, duration: 500 });
        play(w.querySelector(".bar span"), GROW_X, { delay: d + 150 + i * 80, duration: 1000 });
      });
    }
    if (b.matches(".table-wrap")) stagger($$("tbody tr", b), [{ transform: "translateX(-18px)", opacity: 0 }, { transform: "none", opacity: 1 }], { delay: d, duration: 550 }, 55);
    if (b.matches(".s-goals, .s-list")) stagger($$("li", b), [{ transform: "translateX(-16px)", opacity: 0 }, { transform: "none", opacity: 1 }], { delay: d + 100, duration: 600 }, 120);
    if (b.matches(".s-rec")) play(b, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { delay: d + 500, duration: 800 });
  }

  /* ---------- slides ---------- */
  function enterSlide(slide, info) {
    FX.mount(slide, { intensity: slide.querySelector(".s-goals") ? 1.25 : 1 });
    if (!info.slideChanged && !info.viewChanged) return;
    FX.kick(info.dir);
    if (reduced()) return;
    const dir = info.dir;
    $$(".kicker span", slide).forEach((k, i) => scramble(k, 60 + i * 140));
    revealTitle(slide.querySelector("h1"), 120);
    const blocks = $$(".blocks > *", slide);
    blocks.forEach((b, i) => {
      const d = 420 + i * 160;
      play(b, [{ transform: `translateX(${dir * 46}px)`, opacity: 0, filter: "blur(8px)" }, { transform: "none", opacity: 1, filter: "blur(0px)" }], { delay: d, duration: 800 });
      blockFX(b, d);
    });
    play(slide.querySelector(".slide-foot"), FADE, { delay: 900, duration: 600 });
    play(slide.querySelector(".s-num"), [{ transform: `translate(${dir * 60}px, 30px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { delay: 200, duration: 1400, easing: "cubic-bezier(.16,1,.3,1)" });
    const cur = document.querySelector(".progress .cur");
    if (cur) play(cur, [{ transform: "scaleX(.2)", opacity: 0.4 }, { transform: "scaleX(1)", opacity: 1 }], { duration: 600, easing: BACK });
  }

  /* ---------- pages ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      revealPanel(e.target, 0);
    });
  }, { rootMargin: "0px 0px 80px 0px" }) : null;

  function revealPanel(el, d) {
    play(el, [{ transform: "translateY(34px)", opacity: 0 }, { transform: "none", opacity: 1 }], { delay: d, duration: 850 });
    $$("[data-count]", el).forEach((c, i) => countUp(c, d + 150 + i * 80));
    $$(".gantt", el).forEach((g) => ganttFX(g, d + 150));
    $$(".statusbar span", el).forEach((s, i) => play(s, GROW_X, { delay: d + 250 + i * 90, duration: 700 }));
    $$(".list > .row, .belief, tbody tr", el).slice(0, 14).forEach((r, i) => play(r, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { delay: d + 200 + i * 55, duration: 550 }));
    $$(".weight", el).forEach((w, i) => play(w.querySelector(".bar span"), GROW_X, { delay: d + 200 + i * 80, duration: 900 }));
    $$(".sv-bar .t span", el).slice(0, 40).forEach((b, i) => play(b, GROW_X, { delay: d + 200 + i * 45, duration: 800 }));
    $$(".sv-col i", el).forEach((b, i) => play(b, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { delay: d + 200 + i * 40, duration: 700 }));
    $$(".sv-q, .sv-res", el).slice(0, 10).forEach((r, i) => play(r, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { delay: d + 150 + i * 55, duration: 550 }));
  }

  function heroFX(hero, info) {
    FX.mount(hero, { intensity: 1.15 });
    if (reduced() || !info.viewChanged) return;
    scramble(hero.querySelector(".hero-copy .hero-kicker"), 100, 800);
    revealTitle(hero.querySelector(".hero-title"), 150);
    play(hero.querySelector(".hero-sub"), RISE, { delay: 650, duration: 800 });
    stagger($$(".hero-actions .btn", hero), RISE, { delay: 800, duration: 700 }, 110);
    play(hero.querySelector(".hero-count .hero-kicker"), FADE, { delay: 300 });
    odometer(hero.querySelector(".odo"), 300);
    play(hero.querySelector(".hero-date"), FADE, { delay: 1600, duration: 700 });
    play(hero.querySelector(".j-fill"), GROW_X, { delay: 900, duration: 1600, easing: "cubic-bezier(.65,0,.35,1)" });
    play(hero.querySelector(".j-buf"), GROW_X, { delay: 2400, duration: 700 });
    stagger($$(".j-stop", hero), [{ transform: "translateY(14px)", opacity: 0 }, { transform: "none", opacity: 1 }], { delay: 1100, duration: 650, easing: BACK }, 260);
  }

  function enterPage(root, info) {
    const hero = root.querySelector(".hero-stage");
    if (hero) heroFX(hero, info);
    if (!info.viewChanged || reduced()) return;
    const head = root.querySelector(".page-head h1");
    if (head) { revealTitle(head, 80); $$(".page-head > :not(h1)", root).forEach((el, i) => play(el, RISE, { delay: 200 + i * 90 })); }
    const blocks = $$(".page > :not(.page-head):not(.hero-stage)", root);
    const vh = window.innerHeight;
    blocks.forEach((b, i) => {
      if (b.classList.contains("grid-2") || b.classList.contains("grid-3")) {
        $$(":scope > *", b).forEach((child, j) => (child.getBoundingClientRect().top < vh && !io ? revealPanel(child, 250 + j * 110) : io ? io.observe(child) : null));
      } else if (b.getBoundingClientRect().top < vh || !io) revealPanel(b, 250 + i * 120);
      else io.observe(b);
    });
  }

  /* ---------- nav indicator ---------- */
  let navTop = null;
  // Slides the highlight to the current link. Links can sit inside collapsible groups; if the
  // current link is hidden (its group is collapsed) the highlight is hidden too.
  function navIndicator(animate) {
    const nav = document.querySelector(".nav");
    const ind = nav && nav.querySelector(".nav-ind");
    if (!ind) return;
    const cur = nav.querySelector("a[aria-current]");
    if (!cur || !cur.offsetHeight) { nav.classList.remove("has-ind"); navTop = null; return; }
    nav.classList.add("has-ind");
    const top = cur.offsetTop, h = cur.offsetHeight;
    ind.style.transform = `translateY(${top}px)`; ind.style.height = `${h}px`;
    if (animate !== false && navTop != null && navTop !== top) play(ind, [{ transform: `translateY(${navTop}px) scaleX(.94)` }, { transform: `translateY(${top}px)` }], { duration: 520, easing: BACK, fill: "none" });
    navTop = top;
  }

  /* ---------- pointer: spotlight + tilt ---------- */
  if (FINE.matches) {
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest && e.target.closest(".panel, .s-card, .figure, .s-fig");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      if (el.classList.contains("s-card") && !reduced()) {
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -6, ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
      }
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      const el = e.target.closest && e.target.closest(".s-card");
      if (el && !el.contains(e.relatedTarget)) el.style.transform = "";
    });
  }

  window.LOSMotion = {
    afterRender(main, info) {
      navIndicator();
      const slide = main.querySelector(".slide");
      if (slide) enterSlide(slide, info); else enterPage(main, info);
    },
    refreshTheme() { FX.refresh(); },
    nav(animate) { navIndicator(animate); },
  };
})();
