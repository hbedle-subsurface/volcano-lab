/* Read the Volcano - lab logic.
   Panel drawing keeps references to its own elements (no getElementById inside
   the panel), so the whole panel can move into a pop-out window and keep working. */
(() => {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const STORE = 'volclab-v1';
  const ST_COLORS = ['#0f8b8d', '#8e44ad', '#c48a00'];
  const CP = '#1f6fd1', CS = '#e0531f', CA = '#7b3fbf', RED = '#841617', SLATE = '#5C6670';

  const panelWrap = document.getElementById('panelWrap');
  const panel = document.getElementById('panel');
  const placeholder = document.getElementById('panelPlaceholder');
  const tabsEl = document.getElementById('tabs');
  const stepEl = document.getElementById('step');

  // ---------- state ----------
  const blank = () => ({ name: '', seed: null, step: 0, done: {}, answers: {}, completedAt: null });
  let S = blank();
  try { const raw = localStorage.getItem(STORE); if (raw) S = Object.assign(blank(), JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  const storageOK = (() => { try { localStorage.setItem('volclab-test', '1'); const ok = localStorage.getItem('volclab-test') === '1'; localStorage.removeItem('volclab-test'); return ok; } catch (e) { return false; } })();
  let saveFailed = !storageOK;
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { if (!saveFailed) { saveFailed = true; showStorageWarning(); } } };
  function showStorageWarning() {
    const col = document.getElementById('stepCol'); if (!col || document.getElementById('storeWarn')) return;
    const w = document.createElement('div'); w.id = 'storeWarn'; w.className = 'warn-banner';
    w.innerHTML = '<strong>Warning: this browser is not saving your work.</strong> If you close or reload this page, you will have to start over. Finish the lab in one sitting, or open it in a regular (not private or incognito) window of Chrome, Edge, Firefox or Safari.';
    col.insertBefore(w, col.firstChild);
  }
  window.addEventListener('beforeunload', e => { if (saveFailed && S.seed != null && !S.completedAt) { e.preventDefault(); e.returnValue = ''; } });

  let SC = null;
  const REF = {};
  function loadScenario() { SC = S.seed == null ? null : VOLC.build(S.seed); }
  loadScenario();

  // ---------- helpers ----------
  const T = (key, txt) => `<span class="term" data-term="${key}" tabindex="0">${txt}</span>`;
  const fmt = (v, d = 1) => (v == null || isNaN(v)) ? '-' : (+v).toFixed(d);
  function svg(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs = {}) { const t = svg('text', Object.assign({ x, y }, attrs), parent); t.textContent = s; return t; }
  function svgPoint(s, evt) {
    const pt = s.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(s.getScreenCTM().inverse());
  }
  function h(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function niceCeil(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p;
    const n = m <= 1 ? 1 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return n * p;
  }
  function slider(label, min, max, step, value, unit, oninput) {
    const wrap = h('label');
    wrap.innerHTML = `${label} `;
    const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = value;
    const out = h('span', 'readout');
    const upd = () => { out.textContent = ` ${(+r.value).toFixed(step < 1 ? 1 : 0)} ${unit}`; oninput(+r.value); };
    r.addEventListener('input', upd);
    wrap.append(r, out);
    setTimeout(upd, 0);
    return { wrap, input: r, out };
  }


  // ---------- step registry ----------
  const STEPS = [];
  const def = o => STEPS.push(o);

  function checkRow(onCheck, nextLabel) {
    const row = h('div', 'check-row');
    const b = h('button', 'btn', 'Check my answers'); b.type = 'button';
    const st = h('span', 'status');
    const nx = h('button', 'btn secondary', nextLabel || 'Next step →'); nx.type = 'button'; nx.hidden = true;
    b.onclick = () => {
      const ok = onCheck();
      st.className = 'status ' + (ok ? 'ok' : 'no');
      st.textContent = ok ? 'All correct - this step is complete.' : 'Not quite yet. Check the notes above, use a hint, and try again.';
      if (ok) { S.done[S.step] = true; save(); renderTabs(); nx.hidden = false; }
    };
    nx.onclick = () => go(S.step + 1);
    if (S.done[S.step]) { nx.hidden = false; st.className = 'status ok'; st.textContent = 'This step is complete.'; }
    row.append(b, st, nx);
    const wrap = h('div'); wrap.append(row, h('div', '', stuckBox()));
    return wrap;
  }
  // multiple-choice question
  function mcq(key, prompt, options, correct, right, wrong) {
    const q = h('div', 'q');
    q.innerHTML = `<div class="prompt">${prompt}</div>` + options.map((o, k) =>
      `<label class="opt"><input type="radio" name="${key}" value="${k}" ${S.answers[key] == k ? 'checked' : ''}> ${o}</label>`).join('') + '<div class="fb"></div>';
    q.addEventListener('change', e => { if (e.target.name === key) { S.answers[key] = +e.target.value; save(); } });
    q.check = () => {
      const v = S.answers[key];
      const ok = v === correct;
      q.className = 'q ' + (ok ? 'good' : 'bad');
      q.querySelector('.fb').innerHTML = v == null ? 'Choose an answer.' : (ok ? right : wrong);
      return ok;
    };
    return q;
  }
  function stuckBox() {
    return `<details class="hint stuck"><summary>Stuck, or something not working?</summary><div>
      <p><strong>Stuck on the science?</strong> Open the hints above, and click any underlined word for a short explanation. Each check tells you which answer to look at again, so change one thing at a time and check again.</p>
      <p><strong>Lost your progress?</strong> Your work is saved in this browser on this computer. A private or incognito window, a different browser or a different computer starts fresh. Go back to the same browser and it will be there.</p>
      <p><strong>Pop-out button does nothing?</strong> Your browser is blocking pop-ups. The lab works fine without them.</p>
      <p><strong>Still stuck?</strong> Send your instructor a Canvas message with your scenario number (${S.seed ?? '-'}), the step, and a screenshot.</p>
    </div></details>`;
  }
  function hint(html, title = 'Need a hint?') { return `<details class="hint poptext"><summary>${title}</summary><div>${html}</div></details>`; }


  function drawStartPanel(p) {
    const W = 760, H = 330;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig' }, p);
    svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#eef5fb' }, s);
    // shield
    svg('rect', { x: 0, y: 250, width: W, height: 80, fill: '#a8916b' }, s);
    svg('polygon', { points: '20,250 170,205 210,200 360,250', fill: '#5d4037' }, s);
    svg('path', { d: 'M190,200 q-6,-25 2,-40 M196,200 q4,-28 14,-36', stroke: '#ff7043', 'stroke-width': 4, fill: 'none' }, s);
    svg('path', { d: 'M230,212 q40,10 70,30', stroke: '#ff5722', 'stroke-width': 6, fill: 'none' }, s);
    txt(s, 190, 285, 'Kilauea, Hawaii', { 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle', fill: '#fff' });
    txt(s, 190, 305, 'broad shield, runny lava', { 'font-size': 12, 'text-anchor': 'middle', fill: '#fff' });
    // stratovolcano
    svg('polygon', { points: '420,250 540,110 575,110 700,250', fill: '#8d6e63' }, s);
    svg('path', { d: 'M550,112 C500,40 520,-10 560,10 C600,-10 640,40 565,112 Z', fill: '#757575', opacity: 0.85 }, s);
    svg('path', { d: 'M530,140 q30,40 60,110 l25,-5 q-20,-60 -45,-100 z', fill: '#9e9e9e', opacity: 0.7 }, s);
    txt(s, 560, 285, 'Mount St. Helens, Washington', { 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle', fill: '#fff' });
    txt(s, 560, 305, 'steep stratovolcano, explosive', { 'font-size': 12, 'text-anchor': 'middle', fill: '#fff' });
    txt(s, 380, 30, 'Why so different?', { 'font-size': 20, 'font-weight': 700, 'text-anchor': 'middle', fill: RED });
    txt(s, 380, 336, 'Sketch, not to scale', { 'font-size': 10, 'text-anchor': 'middle', fill: SLATE });
  }

  // ===== Step 0: Start =====
  def({
    tab: 'Start',
    panel(p) {
      p.append(h('p', 'panel-title', 'Two kinds of volcanoes'));
      drawStartPanel(p);
    },
    content(c) {
      c.innerHTML = `<h2>Read the Volcano</h2>
      <div class="poptext">
      <p>Kilauea in Hawaii pours out rivers of lava that people walk up to and photograph. Mount St. Helens in Washington blew its top off in 1980. Both are volcanoes, so why are they so different?</p>
      <p>In this lab we work through that question the way a volcanologist does: what's in the ${T('magma', 'magma')}, where volcanoes form and how fast the plate moves over a ${T('hotspot', 'hotspot')}, how scientists watched Mount St. Helens wake up, how fast volcanic hazards travel, and how we measure the size of an eruption. At the end, you classify a mystery volcano on your own.</p>
      <p>Each step checks your answers and has hints. There are six steps, and most people need about an hour to an hour and a half. At the end you get a certificate to upload to Canvas.</p>
      <p class="small">Click any word with a dotted underline for a short explanation.</p>
      </div>
      <div class="warn-box">
        <strong>Before you start</strong>
        <ul>
          <li>Use a laptop or desktop computer with Chrome, Edge, Firefox or Safari.</li>
          <li><strong>Do not use a private or incognito window.</strong> Your work will not be saved.</li>
          <li>Your work saves automatically, so you can stop and come back. Come back on the <strong>same computer and the same browser</strong>.</li>
          <li>When you get your <strong>scenario number</strong>, write it down. It is your backup if anything goes wrong.</li>
        </ul>
      </div>`;
      const box = h('div', 'q');
      if (S.seed == null) {
        box.innerHTML = `<div class="prompt">New to the lab? Type your first and last name the way it appears in Canvas</div>`;
        const inp = document.createElement('input'); inp.className = 'name-in'; inp.type = 'text'; inp.placeholder = 'First and last name'; inp.setAttribute('aria-label', 'Your first and last name');
        const b = h('button', 'btn', 'Start the lab'); b.type = 'button'; b.style.marginLeft = '8px';
        const fb = h('div', 'fb');
        b.onclick = () => {
          const nm = inp.value.trim().replace(/\s+/g, ' ');
          if (nm.length < 3 || !/\s/.test(nm)) { fb.textContent = 'Please enter your first and last name.'; box.className = 'q bad'; return; }
          S = blank(); S.name = nm; S.seed = 10000 + Math.floor(Math.random() * 89999); S.done[0] = true; save(); loadScenario();
          alert(`Your scenario number is ${S.seed}.\n\nWrite it down now. If you switch computers or browsers, or lose your work, you can use it with your name on the Start page to get the same lab back.`);
          go(1);
        };
        box.append(inp, b, fb);
        const rbox = h('div', 'q');
        rbox.innerHTML = `<div class="prompt">Already started on another computer or browser?</div>
          <p class="small" style="margin:0 0 6px">Type the same name and your scenario number to get the same mystery volcano back. You will go through the steps again, but it goes faster the second time.</p>`;
        const rn = document.createElement('input'); rn.className = 'name-in'; rn.type = 'text'; rn.placeholder = 'First and last name'; rn.setAttribute('aria-label', 'Your first and last name');
        const rs = document.createElement('input'); rs.type = 'number'; rs.placeholder = 'Scenario number'; rs.setAttribute('aria-label', 'Your scenario number');
        rs.style.cssText = 'font:inherit;padding:8px 10px;width:170px;border:1px solid #aab;border-radius:6px;margin-left:8px';
        const rb = h('button', 'btn secondary', 'Continue my lab'); rb.type = 'button'; rb.style.marginLeft = '8px';
        const rfb = h('div', 'fb');
        rb.onclick = () => {
          const nm = rn.value.trim().replace(/\s+/g, ' '), sd = parseInt(rs.value, 10);
          if (nm.length < 3 || !/\s/.test(nm)) { rfb.textContent = 'Please enter your first and last name.'; rbox.className = 'q bad'; return; }
          if (!(sd >= 10000 && sd <= 99999)) { rfb.textContent = 'The scenario number has five digits.'; rbox.className = 'q bad'; return; }
          S = blank(); S.name = nm; S.seed = sd; S.done[0] = true; save(); loadScenario(); go(1);
        };
        rbox.append(rn, rs, rb, rfb);
        c.append(box); box.after(rbox); return;
      } else {
        box.innerHTML = `<div class="prompt">Welcome back, ${escapeHtml(S.name)}.</div><p>Your scenario number is <strong>${S.seed}</strong>. Your work so far is saved.</p>`;
        const b = h('button', 'btn', 'Continue where I left off'); b.type = 'button'; b.onclick = () => go(firstOpen());
        const r = h('button', 'btn secondary', 'Start over'); r.type = 'button'; r.style.marginLeft = '8px';
        r.onclick = () => { if (confirm('Are you sure? Starting over ERASES your work in this browser and gives you a NEW scenario.\n\nIf you just want to keep going, click Cancel, then "Continue where I left off".')) { S = blank(); save(); loadScenario(); go(0); } };
        box.append(b, r);
      }
      c.append(box);
    }
  });

  // ===== Step 1: Magma and eruption style =====
  const magma = (si, gas) => {
    const logEta = Math.max(0.5, Math.min(12, 1 + (si - 48) * 0.33 - (gas - 2) * 0.25));
    const temp = Math.round((1200 - (si - 48) * 14) / 10) * 10;
    const E = Math.max(0, Math.min(1, (logEta - 1) / 9 * 0.65 + (gas - 0.5) / 5.5 * 0.35));
    const style = E < 0.25 ? 'Effusive - lava fountains and lava flows' : E < 0.45 ? 'Mildly explosive - bursts of lava and some ash' : E < 0.7 ? 'Explosive - ash columns and pyroclastic flows' : 'Very explosive - huge ash columns and pyroclastic flows';
    const slope = Math.max(3, Math.min(32, 4 + (logEta - 1) / 9 * 26));
    return { logEta, temp, E, style, slope, rock: VOLC.rockName(si) };
  };
  def({
    tab: '1. Magma',
    panel(p) {
      p.append(h('p', 'panel-title', 'Change the magma and watch the volcano change'));
      const ctr = h('div', 'controls');
      let si = S.answers.p1si ?? 50, gas = S.answers.p1gas ?? 1.5;
      const W = 760, H = 330;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig' });
      const g = svg('g', {}, s);
      const ro = h('div', 'readout');
      const draw = () => {
        while (g.firstChild) g.removeChild(g.firstChild);
        const m = magma(si, gas);
        // --- viscosity bar (fixed log axis 10^0 to 10^12 Pa s)
        const bx = 40, bw = 300, by = 30;
        txt(g, bx, by - 10, 'Viscosity (Pa·s)', { 'font-size': 12, 'font-weight': 700 });
        const grad = svg('linearGradient', { id: 'vg' }, svg('defs', {}, g));
        svg('stop', { offset: '0%', 'stop-color': '#f6c343' }, grad); svg('stop', { offset: '100%', 'stop-color': '#7a2e12' }, grad);
        svg('rect', { x: bx, y: by, width: bw, height: 16, fill: 'url(#vg)', rx: 3 }, g);
        for (let e = 0; e <= 12; e += 2) { const x = bx + e / 12 * bw; svg('line', { x1: x, x2: x, y1: by + 16, y2: by + 21, stroke: '#333' }, g); txt(g, x, by + 33, e === 0 ? '1' : '10' + String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''), { 'font-size': 10.5, 'text-anchor': 'middle', fill: SLATE }); }
        const mx = bx + m.logEta / 12 * bw;
        svg('polygon', { points: `${mx},${by - 2} ${mx - 7},${by - 12} ${mx + 7},${by - 12}`, fill: '#111' }, g);
        txt(g, bx, by + 50, 'runny like syrup', { 'font-size': 10.5, fill: SLATE }); txt(g, bx + bw, by + 50, 'stiff like cold tar', { 'font-size': 10.5, fill: SLATE, 'text-anchor': 'end' });
        // --- explosivity meter
        const ex = 40, ey = 110;
        txt(g, ex, ey - 10, 'Eruption style', { 'font-size': 12, 'font-weight': 700 });
        [['#2e86c1', 'effusive'], ['#f39c12', ''], ['#e74c3c', ''], ['#7b1f1f', 'very explosive']].forEach(([c], k) => svg('rect', { x: ex + k * 75, y: ey, width: 75, height: 16, fill: c }, g));
        txt(g, ex, ey + 30, 'effusive', { 'font-size': 10.5, fill: SLATE }); txt(g, ex + 300, ey + 30, 'very explosive', { 'font-size': 10.5, fill: SLATE, 'text-anchor': 'end' });
        const emx = ex + m.E * 300;
        svg('polygon', { points: `${emx},${ey - 2} ${emx - 7},${ey - 12} ${emx + 7},${ey - 12}`, fill: '#111' }, g);
        const st = txt(g, ex, ey + 50, m.style, { 'font-size': 12.5, 'font-weight': 700, fill: RED });
        // --- conduit with bubbles
        const cx = 120, cy = 205, cw = 80, ch = 118;
        txt(g, 40, cy - 14, 'Magma rising in the conduit', { 'font-size': 12, 'font-weight': 700 });
        svg('rect', { x: cx - cw / 2, y: cy, width: cw, height: ch, fill: m.rock === 'basalt' ? '#e8742f' : m.rock === 'andesite' ? '#c9603a' : m.rock === 'dacite' ? '#a9584a' : '#8b5a5a', rx: 8, stroke: '#555' }, g);
        const rr = VOLC.mulberry32(7);
        const nb = Math.round(4 + gas * 7);
        for (let k = 0; k < nb; k++) {
          const bx2 = cx - cw / 2 + 8 + rr() * (cw - 16), byy = cy + 8 + rr() * (ch - 16);
          const trapped = m.logEta > 5;
          const r = trapped ? 2 + rr() * 2 + (cy + ch - byy) / ch * 4 : 3 + rr() * 2;
          svg('circle', { cx: bx2, cy: byy, r, fill: '#fff', opacity: 0.85 }, g);
        }
        // escaping gas or blocked top
        if (m.logEta <= 5) for (let k = 0; k < 4; k++) svg('circle', { cx: cx - 20 + k * 13, cy: cy - 10 - (k % 2) * 8, r: 3, fill: '#bbb' }, g);
        else svg('rect', { x: cx - cw / 2, y: cy - 6, width: cw, height: 8, fill: '#5d4037', rx: 2 }, g);
        txt(g, cx + cw / 2 + 10, cy + 20, m.logEta <= 5 ? 'bubbles rise and escape' : 'bubbles are trapped', { 'font-size': 11, fill: SLATE });
        txt(g, cx + cw / 2 + 10, cy + 36, m.logEta <= 5 ? 'gently' : 'and build up pressure', { 'font-size': 11, fill: SLATE });
        // --- volcano profile (fixed scale)
        const vx0 = 420, vx1 = 740, vy = 300, half = 130;
        txt(g, vx0, 20, 'Volcano shape it builds', { 'font-size': 12, 'font-weight': 700 });
        svg('line', { x1: vx0, x2: vx1, y1: vy, y2: vy, stroke: '#888' }, g);
        const hgt = Math.tan(m.slope * Math.PI / 180) * half;
        const mid = (vx0 + vx1) / 2;
        svg('polygon', { points: `${mid - half},${vy} ${mid - 10},${vy - hgt} ${mid + 10},${vy - hgt} ${mid + half},${vy}`, fill: '#8d6e63', stroke: '#5d4037', 'stroke-width': 1.5 }, g);
        if (m.E < 0.25) { for (let k = -1; k <= 1; k++) svg('path', { d: `M${mid + k * 6},${vy - hgt} q${k * 8},-25 ${k * 14},-10`, stroke: '#ff7043', 'stroke-width': 3, fill: 'none' }, g); }
        else { const colH = 30 + m.E * 120; svg('path', { d: `M${mid - 8},${vy - hgt} C${mid - 25},${vy - hgt - colH * 0.5} ${mid - 50},${vy - hgt - colH} ${mid},${vy - hgt - colH} C${mid + 50},${vy - hgt - colH} ${mid + 25},${vy - hgt - colH * 0.5} ${mid + 8},${vy - hgt}`, fill: '#9e9e9e', opacity: 0.8 }, g); }
        txt(g, mid, vy + 18, `${m.slope < 12 ? 'shield volcano' : m.slope < 20 ? 'in between' : 'stratovolcano'} - slopes about ${Math.round(m.slope)}°`, { 'font-size': 12, 'text-anchor': 'middle', 'font-weight': 700 });
        ro.innerHTML = `Rock: <strong>${m.rock}</strong> &nbsp; Typical temperature: <strong>about ${m.temp.toLocaleString('en-US')}°C</strong>`;
      };
      const s1 = slider('Silica (SiO₂):', 45, 77, 1, si, '%', v => { si = v; S.answers.p1si = v; save(); draw(); });
      const s2 = slider('Dissolved gas:', 0.5, 6, 0.5, gas, '% water', v => { gas = v; S.answers.p1gas = v; save(); draw(); });
      ctr.append(s1.wrap, s2.wrap); p.append(ctr, ro, s);
      draw();
    },
    content(c) {
      c.innerHTML = `<h2>Magma and eruption style</h2>
      <div class="poptext">
      <p>Why does Kilauea pour out rivers of lava while Mount St. Helens blew apart? A lot of it comes down to two things in the ${T('magma', 'magma')}: how much ${T('silica', 'silica')} it has, and how much ${T('volatiles', 'dissolved gas')}.</p>
      <p>Silica links up into chains in the melt, and so high-silica magma is stiff - its ${T('viscosity', 'viscosity')} is high. In runny magma, gas bubbles rise and escape gently. In stiff magma the bubbles are trapped, the pressure builds, and the magma blasts apart into ash. The rock names change with silica too, from ${T('basalt', 'basalt')} to ${T('andesite', 'andesite')}, ${T('dacite', 'dacite')} and ${T('rhyolite', 'rhyolite')}.</p>
      <p>Move both sliders and watch the viscosity, the bubbles, the eruption style and the shape of volcano the lava builds - a broad ${T('shield', 'shield volcano')} or a steep ${T('stratovolcano', 'stratovolcano')}.</p>
      <p class="small">The viscosities and slopes here are approximate, chosen to show the trend.</p>
      </div>`;
      const q1 = mcq('v1q1', 'As silica goes up, what happens to the viscosity of the magma?', ['It goes down - the magma gets runnier', 'It goes up - the magma gets stiffer', 'It stays the same', 'Silica has no effect on magma'], 1,
        'Right. Look at the scale - from basalt to rhyolite the viscosity goes up by about a factor of a billion.', 'Move the silica slider from left to right and watch the black arrow on the viscosity bar.');
      const q2 = mcq('v1q2', 'Which magma would make the most explosive eruption?', ['Low silica, little gas', 'Low silica, lots of gas', 'High silica, little gas', 'High silica, lots of gas'], 3,
        'Right. Stiff magma traps the gas, and lots of gas means lots of pressure.', 'Try each combination with the two sliders and watch the eruption style meter.');
      const q3 = mcq('v1q3', 'Hawaiian volcanoes are broad shield volcanoes with gentle slopes. What kind of magma builds them?', ['Runny basalt that flows a long way before it cools', 'Stiff rhyolite that piles up near the vent', 'Only ash, no lava', 'Dacite from explosive eruptions'], 0,
        'Right. Runny basalt spreads out in thin flows over long distances, and so the volcano grows wide and gentle.', 'Set the silica to about 50% and look at the shape of the volcano.');
      const q4 = mcq('v1q4', 'A magma has 65% silica. What rock does it make?', ['Basalt', 'Andesite', 'Dacite', 'Rhyolite'], 2,
        'Right, dacite (63 to 69% silica) - the same kind of magma as the 1980 Mount St. Helens eruption.', 'Set the silica slider to 65% and read the rock name.');
      c.append(q1, q2, q3, q4, checkRow(() => [q1.check(), q2.check(), q3.check(), q4.check()].every(Boolean)));
    }
  });

  // ===== Step 2: Hotspot plate speed =====
  let islandView = 'all';
  def({
    tab: '2. Hotspot speed',
    panel(p) {
      p.append(h('p', 'panel-title', 'Age of the Hawaiian-Emperor volcanoes vs. distance from Kilauea'));
      const ctr = h('div', 'controls'); const seg = h('div', 'seg');
      [['all', 'Whole chain to Midway'], ['main', 'Main islands only']].forEach(([k, l]) => { const b = h('button', islandView === k ? 'on' : '', l); b.type = 'button'; b.onclick = () => { islandView = k; renderPanel(); }; seg.append(b); });
      ctr.append(seg); p.append(ctr);
      const XMAX = islandView === 'all' ? 2600 : 600, YMAX = islandView === 'all' ? 30 : 6;
      const W = 760, H = 380, L = 60, R = 20, Tp = 14, B = 46;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig' }, p);
      const X = d => L + d / XMAX * (W - L - R), Y = a => H - B - a / YMAX * (H - B - Tp);
      const xs = XMAX / 5 >= 500 ? 500 : 100, ys = YMAX / 6;
      for (let d = 0; d <= XMAX; d += xs) { svg('line', { x1: X(d), x2: X(d), y1: Y(0), y2: Y(YMAX), stroke: '#e3e5e8' }, s); txt(s, X(d), H - B + 16, d.toLocaleString('en-US'), { 'font-size': 11, 'text-anchor': 'middle', fill: SLATE }); }
      for (let a = 0; a <= YMAX + 1e-9; a += ys) { svg('line', { x1: X(0), x2: X(XMAX), y1: Y(a), y2: Y(a), stroke: '#e3e5e8' }, s); txt(s, L - 6, Y(a) + 4, +a.toFixed(1), { 'font-size': 11, 'text-anchor': 'end', fill: SLATE }); }
      txt(s, X(XMAX / 2), H - 8, 'Distance from Kilauea along the chain (km)', { 'font-size': 12, 'text-anchor': 'middle', fill: SLATE });
      const yl = txt(s, 14, Y(YMAX / 2), 'Age (millions of years)', { 'font-size': 12, 'text-anchor': 'middle', fill: SLATE }); yl.setAttribute('transform', `rotate(-90 14 ${Y(YMAX / 2)})`);
      const lineG = svg('g', {}, s);
      VOLC.ISLANDS.filter(([, d]) => d <= XMAX).forEach(([n, d, a]) => {
        svg('circle', { cx: X(d), cy: Y(a), r: 5, fill: RED, stroke: '#fff' }, s);
        if (['Kilauea', 'West Maui', 'Waianae (Oahu)', 'Kauai', 'Nihoa', 'Necker', 'Gardner Pinnacles', 'Laysan', 'Midway', 'Mauna Kea', 'Koolau (Oahu)'].includes(n) && (islandView === 'main' || d > 500 || n === 'Kilauea'))
          txt(s, X(d) + 7, Y(a) - 6, n, { 'font-size': 10.5, fill: '#5a1f1f' });
      });
      const ro = h('div', 'readout');
      const draw = v => {
        while (lineG.firstChild) lineG.removeChild(lineG.firstChild);
        const kmPerMyr = v * 10;
        const dEnd = Math.min(XMAX, kmPerMyr * YMAX);
        svg('line', { x1: X(0), y1: Y(0), x2: X(dEnd), y2: Y(dEnd / kmPerMyr), stroke: CP, 'stroke-width': 2.5 }, lineG);
        const lb = txt(lineG, X(dEnd) - 6, Y(dEnd / kmPerMyr) + 16, `${v.toFixed(1)} cm/yr`, { 'font-size': 12, 'font-weight': 700, fill: CP, 'text-anchor': 'end' });
        lb.setAttribute('paint-order', 'stroke'); lb.setAttribute('stroke', '#fff'); lb.setAttribute('stroke-width', 3);
        ro.innerHTML = `Blue line: a plate moving <strong>${v.toFixed(1)} cm per year</strong> = ${kmPerMyr.toFixed(0)} km per million years.`;
      };
      const sl = slider('Plate speed for the blue line:', 2, 16, 0.1, S.answers.v2line ?? 4, 'cm/yr', v => { S.answers.v2line = v; save(); draw(v); });
      ctr.append(sl.wrap); p.append(ro); draw(S.answers.v2line ?? 4);
    },
    content(c) {
      c.innerHTML = `<h2>Hotspot plate speed</h2>
      <div class="poptext">
      <p>Hawaii is in the middle of the Pacific plate, thousands of kilometers from a plate boundary. Its volcanoes come from a ${T('hotspot', 'hotspot')}, hot mantle rising from deep below. The hotspot stays roughly in place while the plate slides over it, and so each volcano is carried away and a new one grows over the hotspot.</p>
      <p>If that's right, the volcanoes should get older the farther they are from Kilauea. The red dots are real ages from ${T('k-ar', 'radiometric dating')} (Clague and Dalrymple, 1987). The blue line shows a plate moving at a steady speed - move the slider until the line runs through the middle of the dots.</p>
      ${hint('If the line is too steep (above most dots), the speed is too slow. If it is too flat (below most dots), the speed is too fast.')}
      ${hint('Here\'s a check: Midway is 2,432 km from Kilauea and 27.7 million years old. 2,432 km ÷ 27.7 million years = about 88 km per million years. And 10 km per million years is 1 cm per year, so that\'s about 8.8 cm per year.', 'Hint: working out a speed')}
      </div>`;
      const q1 = h('div', 'q');
      q1.innerHTML = `<div class="prompt">From your best-fit line, how fast does the Pacific plate move over the hotspot?</div>
        <input type="number" step="0.1" value="${S.answers.v2speed ?? ''}" aria-label="Plate speed in centimeters per year"> cm per year <div class="fb"></div>`;
      q1.querySelector('input').addEventListener('input', e => { S.answers.v2speed = e.target.value === '' ? null : +e.target.value; save(); });
      q1.check = () => {
        const v = S.answers.v2speed, ok = v != null && v >= 8 && v <= 11;
        q1.className = 'q ' + (ok ? 'good' : 'bad');
        q1.querySelector('.fb').innerHTML = v == null ? 'Enter a number.' : ok ? `Right - a best fit through all the dots is about ${VOLC.fitSpeed.toFixed(1)} cm per year, about as fast as our fingernails grow.` : v < 8 ? 'Too slow - your line runs above most of the dots. Speed it up.' : 'Too fast - your line runs below most of the dots. Slow it down.';
        return ok;
      };
      const q2 = mcq('v2q2', 'Kauai is about 5 million years old and no longer erupts, while Kilauea erupts often. Why?', ['Kauai ran out of magma because it is smaller', 'The plate carried Kauai away from the hotspot, so it lost its magma supply', 'Kauai is on a different plate', 'The hotspot moved east on its own'], 1,
        'Right. Each Hawaiian volcano is active while it sits over the hotspot, then rides away on the plate and goes quiet.', 'Think about what stays still and what moves in the hotspot model.');
      const q3 = mcq('v2q3', 'The volcanoes get older toward the northwest. Which way is the Pacific plate moving?', ['Northwest, away from the hotspot', 'Southeast, toward the hotspot', 'Straight north', 'It is not moving'], 0,
        'Right. The oldest volcanoes have been carried the farthest, to the northwest.', 'The oldest volcanoes have traveled the farthest from the hotspot.');
      const q4 = mcq('v2q4', 'The Cascade volcanoes (Rainier, St. Helens, Hood) form differently. What makes them?', ['A hotspot under Washington and Oregon', 'The Juan de Fuca plate sinking at a subduction zone, which releases water that melts the mantle above it', 'Meteorite impacts', 'The Columbia River'], 1,
        'Right. The Cascades are a volcanic arc above a subduction zone, and so they run in a line parallel to the coast - not in an age trail like Hawaii.', 'Think about what plate boundary is off the coast of Washington and Oregon.');
      c.append(q1, q2, q3, q4, checkRow(() => [q1.check(), q2.check(), q3.check(), q4.check()].every(Boolean)));
    }
  });

  // ===== Step 3: Watching Mount St. Helens wake up =====
  const D0 = Date.UTC(1980, 2, 15), DAY = 86400000;
  const dayOf = (m, d) => Math.round((Date.UTC(1980, m - 1, d) - D0) / DAY);
  const MSH_EVENTS = [
    [dayOf(3, 16), 'Mar 16', 'Small earthquakes begin beneath the volcano.', 'eq'],
    [dayOf(3, 20), 'Mar 20', 'A magnitude 4.2 earthquake at 3:47 p.m. - the first big sign the volcano is waking up.', 'eq'],
    [dayOf(3, 25), 'Mar 25-27', 'Earthquakes peak: 174 shocks larger than magnitude 2.6 in two days, with many hundreds of smaller ones.', 'eq'],
    [dayOf(3, 27), 'Mar 27', 'First steam explosions at 12:36 p.m. blast a new crater in the summit. Ash and steam rise about 6,000 feet above the volcano.', 'steam'],
    [dayOf(3, 31), 'Mar 31', 'Volcanic tremor is recorded for the first time.', 'eq'],
    [dayOf(4, 15), 'mid-April', 'A bulge on the north flank is obvious. Measurements show it pushing outward more than 1.5 m per day.', 'bulge'],
    [dayOf(4, 25), 'late April', 'The steam explosions have stopped, but the bulge keeps growing northward about 1.5 m (5 feet) per day.', 'bulge'],
    [dayOf(5, 12), 'May 12', 'Parts of the bulge near the summit are more than 450 feet (about 140 m) higher than before. About 10,000 earthquakes have been recorded since March.', 'bulge'],
    [dayOf(5, 18), 'May 18', '8:32 a.m.: a magnitude 5.1 earthquake shakes loose the bulging north flank. The largest landslide in recorded history uncorks the magma, and a sideways blast and a 9-hour eruption follow.', 'erupt']
  ];
  const LASTDAY = dayOf(5, 18);
  def({
    tab: '3. St. Helens wakes up',
    panel(p) {
      p.append(h('p', 'panel-title', 'Mount St. Helens, spring 1980 - schematic cross section, looking west'));
      const ctr = h('div', 'controls'); p.append(ctr);
      const W = 760, H = 300;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig' }, p);
      const g = svg('g', {}, s);
      const board = h('div', 'msh-board'); p.append(board);
      const draw = day => {
        while (g.firstChild) g.removeChild(g.firstChild);
        const groundY = 260, peakX = 300, peakY = 70;
        svg('rect', { x: 0, y: 0, width: W, height: H, fill: '#eef5fb' }, g);
        const erupted = day >= LASTDAY;
        const bulgeDays = Math.max(0, day - dayOf(3, 27));
        const b = Math.min(1, bulgeDays / (LASTDAY - dayOf(3, 27)));
        // volcano outline: south flank left, north flank right
        let path;
        if (!erupted) {
          const bx = 380 + b * 110, by = 150 - b * 60;
          path = `M40,${groundY} L${peakX - 30},${peakY + 8} L${peakX},${peakY} L${peakX + 25},${peakY + 10} Q${bx},${by} ${520},${groundY} Z`;
        } else {
          path = `M40,${groundY} L${peakX - 30},${peakY + 8} L${peakX - 20},${peakY + 60} Q${peakX + 40},${peakY + 120} ${520},${groundY} Z`;
        }
        svg('path', { d: path, fill: '#b9a37a', stroke: '#6d5b3a', 'stroke-width': 1.5 }, g);
        svg('rect', { x: 0, y: groundY, width: W, height: H - groundY, fill: '#a8916b' }, g);
        // magma body rising into the north side
        const mY = groundY + 20 - b * 130, mX = peakX + 10 + b * 40;
        if (!erupted && day >= dayOf(3, 16)) svg('ellipse', { cx: mX, cy: mY, rx: 22 + b * 18, ry: 16 + b * 12, fill: '#e2552d', opacity: 0.85 }, g);
        svg('rect', { x: peakX - 8, y: Math.min(mY, groundY), width: 16, height: H - Math.min(mY, groundY), fill: '#e2552d', opacity: erupted ? 0.3 : 0.6 }, g);
        // earthquakes
        const rr = VOLC.mulberry32(11);
        const nEq = day < dayOf(3, 16) ? 0 : day < dayOf(3, 20) ? 4 : day < dayOf(3, 25) ? 14 : day < dayOf(3, 28) ? 45 : 32;
        for (let k = 0; k < nEq; k++) svg('circle', { cx: peakX - 40 + rr() * 110, cy: 150 + rr() * 100, r: 2.5 + rr() * 2.5, fill: 'none', stroke: '#1f6fd1', 'stroke-width': 1.5 }, g);
        // steam/ash
        if (day >= dayOf(3, 27) && day < dayOf(4, 23) && !erupted) svg('path', { d: `M${peakX - 5},${peakY} c-20,-20 -10,-45 10,-50 c20,5 25,30 5,50 z`, fill: '#9e9e9e', opacity: 0.7 }, g);
        if (erupted) { svg('path', { d: `M${peakX - 10},${peakY + 40} C${peakX - 60},${-40} ${peakX + 80},${-60} ${peakX + 20},${peakY + 40}`, fill: '#6d6d6d', opacity: 0.85 }, g); svg('path', { d: `M${peakX + 20},${peakY + 70} q120,20 260,150 l-60,20 q-110,-90 -210,-130 z`, fill: '#8d7b62', opacity: 0.8 }, g); }
        txt(g, 60, 30, 'south', { 'font-size': 12, fill: SLATE }); txt(g, 700, 30, 'north', { 'font-size': 12, fill: SLATE, 'text-anchor': 'end' });
        txt(g, 560, 120, erupted ? 'north flank collapsed' : b > 0.15 ? 'north flank bulging' : '', { 'font-size': 12, fill: RED, 'font-weight': 700 });
        const date = new Date(D0 + day * DAY);
        txt(g, W - 10, H - 12, date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }), { 'font-size': 16, 'font-weight': 700, 'text-anchor': 'end' });
        // dashboard
        const seen = MSH_EVENTS.filter(e => e[0] <= day);
        const lvl = { eq: day < dayOf(3, 16) ? 'quiet' : day < dayOf(3, 20) ? 'a few small ones' : day < dayOf(5, 12) ? 'frequent - hundreds of small ones' : 'about 10,000 recorded since March', steam: erupted ? 'major eruption' : day < dayOf(3, 27) ? 'none' : day < dayOf(4, 23) ? 'frequent steam explosions' : 'quiet', bulge: erupted ? 'collapsed' : day < dayOf(4, 15) ? (day >= dayOf(3, 27) ? 'cracks at the summit' : 'none') : 'growing about 1.5 m per day' };
        board.innerHTML = `<div class="dash"><div><span class="dot" style="background:${day < dayOf(3, 16) ? '#9aa3ab' : '#1f6fd1'}"></span><strong>Earthquakes:</strong> ${lvl.eq}</div>
          <div><span class="dot" style="background:${lvl.steam === 'none' || lvl.steam === 'quiet' ? '#9aa3ab' : '#7a7a7a'}"></span><strong>Explosions:</strong> ${lvl.steam}</div>
          <div><span class="dot" style="background:${lvl.bulge === 'none' ? '#9aa3ab' : RED}"></span><strong>Bulge:</strong> ${lvl.bulge}</div></div>
          <div class="evt">${seen.length ? `<strong>${seen[seen.length - 1][1]}:</strong> ${seen[seen.length - 1][2]}` : 'March 15: the volcano has been quiet since 1857.'}</div>`;
      };
      const sl = slider('Date:', 0, LASTDAY, 1, S.answers.v3day ?? 0, '', v => { S.answers.v3day = v; save(); draw(v); });
      sl.out.hidden = true; sl.input.style.width = '420px';
      ctr.append(sl.wrap, h('span', 'small', 'March 15 to May 18, 1980')); draw(S.answers.v3day ?? 0);
    },
    content(c) {
      c.innerHTML = `<h2>Watching Mount St. Helens wake up</h2>
      <div class="poptext">
      <p>Mount St. Helens had been quiet since 1857. In March 1980 it woke up, and scientists from the USGS and the University of Washington watched it for two months with ${T('monitoring', 'monitoring')} instruments before the eruption on May 18.</p>
      <p>Move the date slider from March 15 to May 18. The cross section is a sketch, not to scale, but the events and the dashboard come from the USGS record. Blue circles are earthquakes, the red body is magma pushing into the volcano, and the north side swells into a ${T('bulge', 'bulge')}.</p>
      ${hint('Go slowly through late March and watch which line on the dashboard changes first.', 'Hint: the first signal')}
      ${hint('Distance = speed × time. 1.5 m per day for 20 days is 1.5 × 20.', 'Hint: the bulge')}
      </div>`;
      const q1 = mcq('v3q1', 'Which signal showed up first?', ['The bulge', 'Steam explosions', 'Earthquakes', 'Lava flows'], 2,
        'Right. Small earthquakes began around March 16, as magma started moving and cracking rock below the volcano.', 'Start the slider at March 15 and move it one day at a time.');
      const q2 = h('div', 'q');
      q2.innerHTML = `<div class="prompt">In late April the bulge was moving about 1.5 m per day. At that rate, how far would it move in 20 days?</div>
        <input type="number" step="1" value="${S.answers.v3bulge ?? ''}" aria-label="Bulge movement in meters"> meters <div class="fb"></div>`;
      q2.querySelector('input').addEventListener('input', e => { S.answers.v3bulge = e.target.value === '' ? null : +e.target.value; save(); });
      q2.check = () => {
        const v = S.answers.v3bulge, ok = v != null && Math.abs(v - 30) <= 2;
        q2.className = 'q ' + (ok ? 'good' : 'bad');
        q2.querySelector('.fb').innerHTML = v == null ? 'Enter a number.' : ok ? 'Right, about 30 m. The USGS measured one point on the bulge moving about 85 feet (26 m) in 20 days - close to our estimate.' : 'Not quite. Multiply the speed by the number of days.';
        return ok;
      };
      const q3 = mcq('v3q3', 'What was making the north side of the volcano bulge outward?', ['Melting glaciers', 'Magma pushing up into the volcano without reaching the surface', 'Strong winds', 'Groundwater freezing'], 1,
        'Right. A mass of magma was squeezing into the volcano and shoving its north flank outward.', 'Watch the red body in the cross section as you move the slider.');
      const q4 = mcq('v3q4', 'Scientists knew the volcano was dangerous and the north side was unstable. Why couldn\'t they say it would erupt on May 18 at 8:32 a.m.?', ['They were not watching the volcano', 'Volcanoes always erupt on schedule, so they should have known', 'The moment came when an earthquake shook the bulging flank loose - the signals showed growing danger, but not the exact time it would fail', 'The bulge had stopped growing'], 2,
        'Right. Monitoring showed the volcano was building toward an eruption, and so the area near the volcano was closed. The exact moment depended on when the bulging flank would give way, which no instrument could tell.', 'Look at what happened at 8:32 a.m. on May 18.');
      c.append(q1, q2, q3, q4, checkRow(() => [q1.check(), q2.check(), q3.check(), q4.check()].every(Boolean)));
      const src = h('p', 'small poptext', 'Sources: USGS, Mount St. Helens - From the 1980 Eruption to 2000 (General Interest Publication); Doukas, 1990, USGS Bulletin 1859.');
      c.append(src);
    }
  });

  // ===== Step 4: Hazards race =====
  const RACERS = [
    ['Pyroclastic flow', 160, '#7b1f1f', 20],
    ['Lahar', 50, '#8d6e63', 999],
    ['Basalt lava in a channel', 15, '#e8742f', 999],
    ['Andesite lava', 1, '#c9603a', 999],
    ['Person running', 12, '#1f6fd1', 999],
    ['Car on an evacuation route', 60, '#0f8b8d', 999]
  ];
  def({
    tab: '4. Hazards race',
    panel(p) {
      p.append(h('p', 'panel-title', 'How far does each hazard travel? Everyone starts at the vent at time 0.'));
      const ctr = h('div', 'controls'); p.append(ctr);
      const W = 760, L = 230, R = 30, rowH = 40, top = 30, DMAX = 60;
      const H = top + RACERS.length * rowH + 40;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig' }, p);
      const X = d => L + d / DMAX * (W - L - R);
      for (let d = 0; d <= DMAX; d += 10) { svg('line', { x1: X(d), x2: X(d), y1: top - 6, y2: H - 34, stroke: '#e3e5e8' }, s); txt(s, X(d), H - 18, d, { 'font-size': 11, 'text-anchor': 'middle', fill: SLATE }); }
      txt(s, X(DMAX / 2), H - 2, 'Distance from the vent (km)', { 'font-size': 12, 'text-anchor': 'middle', fill: SLATE });
      const g = svg('g', {}, s);
      let t = 10, town = 30;
      const ro = h('div', 'readout');
      const draw = () => {
        while (g.firstChild) g.removeChild(g.firstChild);
        svg('line', { x1: X(town), x2: X(town), y1: top - 14, y2: H - 34, stroke: RED, 'stroke-width': 2, 'stroke-dasharray': '6 4' }, g);
        txt(g, X(town), top - 18, `town, ${town} km`, { 'font-size': 12, 'font-weight': 700, fill: RED, 'text-anchor': 'middle' });
        const arrived = [];
        RACERS.forEach(([n, v, col, maxd], k) => {
          const y = top + k * rowH + 6;
          txt(g, L - 10, y + 16, `${n} (${v} km/h)`, { 'font-size': 12, 'text-anchor': 'end', fill: col, 'font-weight': 700 });
          const d = Math.min(maxd, v * t / 60, DMAX);
          svg('rect', { x: X(0), y, width: Math.max(1, X(d) - X(0)), height: 22, fill: col, rx: 4, opacity: 0.85 }, g);
          if (maxd < 999 && v * t / 60 >= maxd) txt(g, X(d) + 6, y + 16, 'most stop within about 10-20 km', { 'font-size': 10.5, fill: SLATE });
          if (k < 4 && maxd >= town && v * t / 60 >= town) arrived.push(n.toLowerCase());
        });
        ro.innerHTML = `After <strong>${t} minutes</strong>: ${arrived.length ? 'the ' + arrived.join(', the ') + ' ha' + (arrived.length > 1 ? 've' : 's') + ' reached the town.' : 'no hazard has reached the town yet.'}`;
      };
      const s1 = slider('Minutes after the eruption starts:', 0, 120, 1, t, 'min', v => { t = v; draw(); });
      const s2 = slider('Town distance:', 5, 60, 1, town, 'km', v => { town = v; draw(); });
      ctr.append(s1.wrap, s2.wrap); p.append(ro); draw();
    },
    content(c) {
      c.innerHTML = `<h2>Hazards race</h2>
      <div class="poptext">
      <p>Volcanoes threaten people in different ways, and how fast each hazard moves decides who can get away. A ${T('pyroclastic-flow', 'pyroclastic flow')} of hot gas and ash can move faster than 100 km per hour - the USGS gives speeds of 100 to 150 miles per hour. A ${T('lahar', 'lahar')}, a volcanic mudflow, moves tens of kilometers per hour down river valleys. Most ${T('lava-flow', 'lava flows')} are slow, though runny basalt in a channel can move 10 to 30 miles per hour.</p>
      <p>The speeds on the panel are typical values inside those ranges. Move the time slider to race them, and move the town closer or farther.</p>
      <p><strong>Mount Rainier</strong> is a good example of why lahars matter in the Cascades. It is covered in snow and glacier ice, and parts of it are weak, altered rock. At least nine large lahars have reached the Puget Lowland in the last 5,600 years, and more than 90,000 people now live in its lahar hazard zones. USGS models show a large lahar reaching the town of Orting in about 40 to 60 minutes, and so Orting has warning sirens and holds evacuation drills.</p>
      ${hint('Distance = speed × time. Time in hours = minutes ÷ 60. So 50 minutes is 50 ÷ 60 = 0.83 hours.', 'Hint: speed, distance and time')}
      </div>`;
      const q1 = h('div', 'q');
      q1.innerHTML = `<div class="prompt">A lahar moving 60 km/h takes 50 minutes to reach a town. About how far did it travel?</div>
        <input type="number" step="1" value="${S.answers.v4lahar ?? ''}" aria-label="Lahar distance in kilometers"> km <div class="fb"></div>`;
      q1.querySelector('input').addEventListener('input', e => { S.answers.v4lahar = e.target.value === '' ? null : +e.target.value; save(); });
      q1.check = () => {
        const v = S.answers.v4lahar, ok = v != null && Math.abs(v - 50) <= 3;
        q1.className = 'q ' + (ok ? 'good' : 'bad');
        q1.querySelector('.fb').innerHTML = v == null ? 'Enter a number.' : ok ? 'Right, about 50 km. 60 km/h × 50/60 of an hour = 50 km.' : 'Not quite. Open the hint about speed, distance and time.';
        return ok;
      };
      const q2 = h('div', 'q');
      q2.innerHTML = `<div class="prompt">A pyroclastic flow moving 160 km/h starts 8 km from a ranger station. How many minutes until it arrives?</div>
        <input type="number" step="0.1" value="${S.answers.v4pyro ?? ''}" aria-label="Minutes"> minutes <div class="fb"></div>`;
      q2.querySelector('input').addEventListener('input', e => { S.answers.v4pyro = e.target.value === '' ? null : +e.target.value; save(); });
      q2.check = () => {
        const v = S.answers.v4pyro, ok = v != null && Math.abs(v - 3) <= 0.4;
        q2.className = 'q ' + (ok ? 'good' : 'bad');
        q2.querySelector('.fb').innerHTML = v == null ? 'Enter a number.' : ok ? 'Right, 3 minutes. 8 km ÷ 160 km/h = 0.05 hours, and 0.05 × 60 = 3 minutes. There is no outrunning that, and so the only protection is being outside the hazard zone before it starts.' : 'Not quite. Time = distance ÷ speed, then multiply by 60 to get minutes. Or set the town to 8 km and use the time slider.';
        return ok;
      };
      const q3 = mcq('v4q3', 'Which hazard could a healthy person on foot usually get away from?', ['A pyroclastic flow', 'A lahar', 'An andesite lava flow', 'None of them'], 2,
        'Right. Stiff andesite lava creeps along at walking pace or slower. It destroys everything in its path, but people can usually step out of the way.', 'Compare each hazard\'s bar with the person running.');
      const q4 = mcq('v4q4', 'Why are lahars the biggest threat to people near Mount Rainier?', ['Mount Rainier makes the fastest lava in the world', 'Its snow, ice and weak rock can turn into mudflows that follow river valleys straight into towns, sometimes even without an eruption', 'Lahars only happen on Mount Rainier', 'Pyroclastic flows cannot happen in Washington'], 1,
        'Right. The Electron Mudflow about 500 years ago reached the Puget Lowland with no eruption at all, and the town of Orting is built on top of it.', 'Look at the paragraph about Mount Rainier.');
      c.append(q1, q2, q3, q4, checkRow(() => [q1.check(), q2.check(), q3.check(), q4.check()].every(Boolean)));
      const src = h('p', 'small poptext', 'Sources: Myers and Brantley, 1995, USGS Open-File Report 95-231; USGS Fact Sheet 002-97, What are volcano hazards?; USGS Cascades Volcano Observatory, Monitoring lahars at Mount Rainier.');
      c.append(src);
    }
  });

  // ===== Step 5: VEI =====
  def({
    tab: '5. How big? (VEI)',
    panel(p) {
      p.append(h('p', 'panel-title', 'Volcanic Explosivity Index - erupted volume of ash and pumice'));
      const ctr = h('div', 'controls'); p.append(ctr);
      const W = 760, H = 330, L = 30, R = 30;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fig' }, p);
      const EMIN = -6, EMAX = 4;
      const X = e => L + (e - EMIN) / (EMAX - EMIN) * (W - L - R);
      const bandCols = ['#d6eaf8', '#aed6f1', '#85c1e9', '#f9e79f', '#f8c471', '#f0b27a', '#e59866', '#d98880', '#c0392b'];
      const edges = [-6, -5, -3, -2, -1, 0, 1, 2, 3, 4];
      for (let v = 0; v <= 8; v++) {
        const a = v === 0 ? -6 : edges[v], b = v === 8 ? 4 : edges[v + 1];
        svg('rect', { x: X(a), y: 20, width: X(b) - X(a), height: 40, fill: bandCols[v] }, s);
        txt(s, (X(a) + X(b)) / 2, 46, 'VEI ' + v, { 'font-size': 11.5, 'text-anchor': 'middle', 'font-weight': 700, fill: v >= 7 ? '#fff' : '#333' });
      }
      const labs = { '-5': '0.00001', '-3': '0.001', '-2': '0.01', '-1': '0.1', '0': '1', '1': '10', '2': '100', '3': '1,000', '4': '10,000' };
      Object.keys(labs).forEach(e => { svg('line', { x1: X(+e), x2: X(+e), y1: 60, y2: 66, stroke: '#333' }, s); txt(s, X(+e), 78, labs[e], { 'font-size': 10, 'text-anchor': 'middle', fill: SLATE }); });
      txt(s, (X(EMIN) + X(EMAX)) / 2, 94, 'Erupted volume (km³, each grid step is 10 times more)', { 'font-size': 11.5, 'text-anchor': 'middle', fill: SLATE });
      [['Kilauea, typical', -5.5], ['St. Helens 1980', 0], ['Yellowstone, 2.1 Myr ago', Math.log10(2450)]].forEach(([n, e], k) => {
        svg('line', { x1: X(e), x2: X(e), y1: 14, y2: 66, stroke: '#111', 'stroke-width': 2 }, s);
        txt(s, X(e) + (k === 2 ? -4 : 4), 12, n, { 'font-size': 10.5, 'font-weight': 700, 'text-anchor': k === 2 ? 'end' : 'start' });
      });
      const g = svg('g', {}, s);
      const ro = h('div', 'readout');
      const draw = e => {
        while (g.firstChild) g.removeChild(g.firstChild);
        const v = Math.pow(10, e);
        svg('polygon', { points: `${X(e)},${64} ${X(e) - 8},${80} ${X(e) + 8},${80}`, fill: CP }, g);
        // cubes: St. Helens fixed size, slider cube scaled by cube root of volume
        const base = 22, side = Math.min(230, base * Math.cbrt(v));
        const y0 = 315;
        const cube = (x, sd, col, lab) => {
          const d = sd * 0.35;
          svg('polygon', { points: `${x},${y0} ${x + sd},${y0} ${x + sd},${y0 - sd} ${x},${y0 - sd}`, fill: col, stroke: '#333' }, g);
          svg('polygon', { points: `${x},${y0 - sd} ${x + d},${y0 - sd - d} ${x + sd + d},${y0 - sd - d} ${x + sd},${y0 - sd}`, fill: col, opacity: 0.75, stroke: '#333' }, g);
          svg('polygon', { points: `${x + sd},${y0} ${x + sd + d},${y0 - d} ${x + sd + d},${y0 - sd - d} ${x + sd},${y0 - sd}`, fill: col, opacity: 0.55, stroke: '#333' }, g);
          txt(g, x, y0 - sd - d - 6, lab, { 'font-size': 11, 'font-weight': 700 });
        };
        cube(60, base, '#9e9e9e', 'St. Helens 1980 (about 1 km³)');
        cube(330, Math.max(1, side), '#1f6fd1', `Your eruption (${v < 0.01 ? v.toExponential(0) : v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')} km³)`);
        if (side >= 240) txt(g, 330, y0 + 0, '(cube drawn at maximum size)', { 'font-size': 10, fill: SLATE });
        const ratio = v / 1;
        ro.innerHTML = `Volume <strong>${v < 0.01 ? v.toExponential(1) : v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString('en-US')} km³</strong> - <strong>VEI ${VOLC.veiOf(v)}</strong> - about ${ratio >= 1 ? Math.round(ratio).toLocaleString('en-US') + ' times' : '1/' + Math.round(1 / ratio).toLocaleString('en-US') + ' of'} the 1980 St. Helens eruption.`;
      };
      const sl = slider('Erupted volume:', -6, 4, 0.05, S.answers.v5e ?? 0, '', e => { S.answers.v5e = e; save(); draw(e); });
      sl.out.hidden = true; sl.input.style.width = '380px';
      ctr.append(sl.wrap); p.insertBefore(ro, s); draw(S.answers.v5e ?? 0);
    },
    content(c) {
      c.innerHTML = `<h2>How big was it? The VEI</h2>
      <div class="poptext">
      <p>Volcanologists compare explosive eruptions with the ${T('vei', 'Volcanic Explosivity Index (VEI)')}, from 0 to 8. It's based mostly on the volume of ash and pumice an eruption throws out, and on the height of the ${T('eruption-column', 'eruption column')}. Like the magnitude scale for earthquakes, it is ${T('logarithmic', 'logarithmic')}: each step up means about 10 times more material.</p>
      <p>The May 18, 1980 eruption of Mount St. Helens was a VEI 5, with about 1 km³ of material. Move the volume slider and compare the cubes - the blue cube holds your eruption's volume, drawn to the same scale as the gray St. Helens cube.</p>
      ${hint('Find the VEI band that the blue arrow sits in. The edges of the bands are 0.1, 1, 10, 100 and 1,000 km³.')}
      </div>`;
      const q1 = mcq('v5q1', 'An eruption throws out 0.5 km³ of ash and pumice. What is its VEI?', ['3', '4', '5', '6'], 1,
        'Right. 0.5 km³ is between 0.1 and 1 km³, which is VEI 4.', 'Move the slider until the readout shows about 0.5 km³.');
      const q2 = mcq('v5q2', 'Going up one step on the VEI scale means about how much more erupted material?', ['2 times', '10 times', '32 times', '100 times'], 1,
        'Right, about 10 times - each band on the scale covers ten times more volume than the one before.', 'Compare the volumes at the edges of two neighboring bands.');
      const q3 = mcq('v5q3', 'The 1980 St. Helens eruption (about 1 km\u00b3) was VEI 5. What VEI would an eruption 100 times bigger be?', ['VEI 6', 'VEI 7', 'VEI 8', 'VEI 105'], 1,
        'Right. 100 times bigger is two steps of 10, and so VEI 5 + 2 = VEI 7, like Tambora in 1815.', 'Each step is 10 times more. How many steps of 10 make 100?');
      const q4 = mcq('v5q4', 'Kilauea erupts very often but almost always rates VEI 0 or 1. Why?', ['Kilauea is not a real volcano', 'VEI measures explosive material like ash and pumice, and Kilauea mostly erupts runny lava that flows away', 'Kilauea is too far from people to count', 'Its eruptions are too hot to measure'], 1,
        'Right. VEI measures how explosive an eruption is. Kilauea\'s lava flows can still destroy homes - a low VEI does not mean harmless.', 'Think back to step 1 - what kind of eruptions does runny basalt make?');
      c.append(q1, q2, q3, q4, checkRow(() => [q1.check(), q2.check(), q3.check(), q4.check()].every(Boolean)));
      const src = h('p', 'small poptext', 'Sources: Newhall and Self, 1982; USGS Volcano Hazards Program photo glossary (VEI); National Park Service, Volcanic Explosivity Index.');
      c.append(src);
    }
  });

  // ===== Step 6: Your turn - a mystery volcano =====
  const ROCKS = ['basalt', 'andesite', 'dacite', 'rhyolite'];
  def({
    tab: '6. Your turn',
    panel(p) {
      const M = SC.myst;
      p.append(h('p', 'panel-title', 'Your mystery volcano - data card'));
      const card = h('div', 'mcard');
      card.innerHTML = `<div class="mcard-head">Mystery volcano #${SC.mystery + 1}</div>
        <table class="data"><tr><th>Where</th><td style="text-align:left">${M.card}</td></tr>
        <tr><th>Silica (SiO₂)</th><td style="text-align:left"><strong>about ${M.si}%</strong></td></tr></table>`;
      p.append(card);
      const tools = h('div', 'small'); tools.style.marginTop = '8px';
      tools.innerHTML = 'Tools from earlier steps: rock names change at 52, 63 and 69% silica. VEI bands start at 0.00001, 0.001, 0.01, 0.1, 1, 10, 100 and 1,000 km³ (VEI 1 to 8).';
      p.append(tools);
      // mini silica scale for reference
      const s = svg('svg', { viewBox: '0 0 760 70', class: 'fig' }, p);
      const X = si => 30 + (si - 45) / 32 * 700;
      [[45, 52, '#e8742f', 'basalt'], [52, 63, '#c9603a', 'andesite'], [63, 69, '#a9584a', 'dacite'], [69, 77, '#8b5a5a', 'rhyolite']].forEach(([a, b, col, n]) => {
        svg('rect', { x: X(a), y: 20, width: X(b) - X(a), height: 24, fill: col }, s);
        txt(s, (X(a) + X(b)) / 2, 37, n, { 'font-size': 12, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 700 });
      });
      [45, 52, 63, 69, 77].forEach(v => txt(s, X(v), 60, v + '%', { 'font-size': 10.5, 'text-anchor': 'middle', fill: SLATE }));
      txt(s, 30, 14, 'Silica scale', { 'font-size': 11, 'font-weight': 700 });
    },
    content(c) {
      const M = SC.myst;
      c.innerHTML = `<h2>Your turn - a mystery volcano</h2>
      <div class="poptext">
      <p>Here's a real volcano and one of its real eruptions, but without its name. Use the data card in the panel and what we worked out in steps 1 to 5 to classify it. When all five answers are right, the lab tells you which volcano it is.</p>
      ${hint('Use the silica scale under the data card.', 'Hint: rock type')}
      ${hint('Runny, low-silica magma makes lava flows and fountains. Stiff, high-silica magma traps gas and explodes. The data card also describes what the eruption did.', 'Hint: eruption style')}
      ${hint('Is the volcano in the middle of a plate, or in a line of volcanoes next to a trench where a plate sinks?', 'Hint: setting')}
      ${hint('Find which VEI band the erupted volume falls in.', 'Hint: VEI')}
      </div>`;
      const q1 = mcq('v6rock', 'What rock does this magma make?', ['Basalt', 'Andesite', 'Dacite', 'Rhyolite'], ROCKS.indexOf(M.rocks[0]), 'Right.', 'Check the silica value against the silica scale.');
      const q2 = mcq('v6style', 'What kind of eruption is described?', ['Effusive - lava fountains and flows', 'Explosive - ash, pumice and pyroclastic flows'], M.style === 'effusive' ? 0 : 1, 'Right.', 'Read the description of the eruption on the data card again.');
      const q3 = mcq('v6set', 'What tectonic setting made this volcano?', ['A hotspot', 'A subduction zone (volcanic arc)', 'A spreading ridge'], M.setting === 'hotspot' ? 0 : 1, 'Right.', 'Look at where the volcano is: in the middle of a plate, or above a sinking plate near a trench?');
      const q4 = mcq('v6vei', 'What is the VEI of the eruption on the card?', ['0', '1', '2', '3', '4', '5', '6', '7', '8'], M.vei, 'Right.', 'Find the erupted volume on the card and the VEI band it falls in.');
      const q5 = mcq('v6haz', 'What is the biggest hazard from an eruption like this one?', ['Lava flows', 'Pyroclastic flows and ash fall', 'Tsunamis only', 'None - it is harmless'], M.hazard === 'lava' ? 0 : 1, 'Right.', 'Think about how this volcano erupts - lava pouring out, or ash and pumice blasting out?');
      const rv = h('div', 'reveal'); rv.hidden = !S.done[6];
      const twist = M.name.startsWith('Yellowstone') ? ' Notice the twist: Yellowstone is a hotspot like Hawaii, but there the hot mantle melted thick continental crust, and so its magma is rhyolite and its eruptions are explosive. Silica, not the setting alone, decides the eruption style.'
        : M.name.startsWith('Tambora') ? ' Notice the twist: Tambora\'s magma is andesite, not rhyolite, and it still made a VEI 7 - the largest eruption in recorded history. Lots of dissolved gas matters too.' : '';
      rv.innerHTML = `<strong>Your mystery volcano is ${M.name}</strong> (${M.when}).${twist}`;
      c.append(q1, q2, q3, q4, q5, checkRow(() => {
        const ok = [q1.check(), q2.check(), q3.check(), q4.check(), q5.check()].every(Boolean);
        if (ok) rv.hidden = false;
        return ok;
      }, 'Get my certificate →'), rv);
    }
  });

  // ===== Certificate =====
  def({
    tab: 'Certificate',
    panel(p) { p.append(h('p', 'panel-title', '')); },
    content(c) {
      if (!S.completedAt) { S.completedAt = new Date().toISOString(); save(); }
      const when = new Date(S.completedAt);
      const code = VOLC.verifyCode(S.name, S.seed);
      const M = SC.myst;
      c.innerHTML = `<div class="cert-layout">
      <div class="cert-side no-print">
        <h2>Your certificate</h2>
        <div class="warn-box"><strong>You are not done until the certificate is in Canvas.</strong>
        <ol style="margin:4px 0 0 18px;padding:0">
          <li>Check that your name is spelled right. <button type="button" class="linkbtn" id="fixName">Fix my name</button></li>
          <li>Click <em>Print or save as PDF</em> and save the PDF, or take a screenshot that shows the whole certificate, including the verification code at the bottom.</li>
          <li>Upload it to the Canvas assignment, and check that the upload went through.</li>
        </ol></div>
        <p><button type="button" class="btn" id="printBtn">Print or save as PDF</button></p>
      </div>
      <div class="cert">
        <h3>Certified Volcano Reader</h3>
        <p class="sub">Read the Volcano - A Cascades and Hawaii Volcano Lab</p>
        <p class="who">${escapeHtml(S.name)}</p>
        <p class="sub">completed all six steps on ${when.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
        <div class="cert-grid">
        <table class="data">
          <tr><th>Pacific plate speed</th><td>${fmt(S.answers.v2speed)} cm/yr</td></tr>
          <tr><th>St. Helens bulge in 20 days</th><td>${fmt(S.answers.v3bulge, 0)} m</td></tr>
          <tr><th>Lahar distance in 50 min</th><td>${fmt(S.answers.v4lahar, 0)} km</td></tr>
          <tr><th>Pyroclastic flow time to 8 km</th><td>${fmt(S.answers.v4pyro)} min</td></tr>
        </table>
        <table class="data">
          <tr><th>Mystery volcano</th><td>${M.name}</td></tr>
          <tr><th>Rock</th><td>${M.rocks[0]}</td></tr>
          <tr><th>Setting</th><td>${M.setting === 'hotspot' ? 'hotspot' : 'subduction zone'}</td></tr>
          <tr><th>Eruption</th><td>${M.style}, VEI ${M.vei}</td></tr>
        </table></div>
        <p class="code"><span class="small">Scenario</span> ${S.seed} &nbsp; <span class="small">Verification code</span> ${code}</p>
      </div></div>`;
      c.querySelector('#printBtn').onclick = () => window.print();
      const fx = c.querySelector('#fixName');
      if (fx) fx.onclick = () => {
        const nm = (prompt('Type your first and last name the way it appears in Canvas:', S.name) || '').trim().replace(/\s+/g, ' ');
        if (nm.length >= 3 && /\s/.test(nm)) { S.name = nm; save(); go(S.step); }
      };
    }
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

  // ---------- navigation ----------
  const lastIdx = STEPS.length - 1;
  function unlocked(i) {
    if (i === 0) return true;
    if (S.seed == null) return false;
    if (i === lastIdx) { for (let k = 1; k < lastIdx; k++) if (!S.done[k]) return false; return true; }
    return !!S.done[i - 1];
  }
  function firstOpen() { for (let i = 1; i <= lastIdx; i++) if (!S.done[i] && unlocked(i)) return i; return lastIdx; }
  function renderTabs() {
    tabsEl.innerHTML = '';
    STEPS.forEach((st, i) => {
      const b = h('button', '', st.tab); b.type = 'button';
      if (i === S.step) b.classList.add('active');
      if (S.done[i] && i > 0 && i < lastIdx) b.classList.add('done');
      b.disabled = !unlocked(i);
      b.onclick = () => go(i);
      tabsEl.append(b);
    });
  }
  function renderPanel() {
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    STEPS[S.step].panel(panel);
  }
  function go(i) {
    if (!unlocked(i)) i = 0;
    S.step = i; save();
    document.querySelector('main').classList.toggle('certmode', i === lastIdx);
    renderTabs(); renderPanel();
    stepEl.innerHTML = '';
    STEPS[i].content(stepEl);
    if (i > 0 && i < lastIdx && S.seed != null) {
      const bar = h('div', 'scen-bar', `${escapeHtml(S.name)} - scenario number <strong>${S.seed}</strong> (write it down). ${saveFailed ? 'This browser is not saving your work.' : 'Your work saves automatically in this browser.'}`);
      stepEl.insertBefore(bar, stepEl.firstChild);
    }
    if (saveFailed) showStorageWarning();
    broadcast();
    const col = document.getElementById('stepCol'); if (col) col.scrollTop = 0;
    if (i > 0 && window.innerWidth < 1000) { const top = tabsEl.getBoundingClientRect().top; if (top < 0) tabsEl.scrollIntoView({ behavior: 'smooth' }); }
  }

  // ---------- pop-outs ----------
  let bc = null; try { bc = new BroadcastChannel('volclab'); } catch (e) { /* not supported */ }
  function broadcast() {
    if (!bc) return;
    const parts = [...stepEl.querySelectorAll('h2, .poptext')].map(n => n.outerHTML).join('');
    bc.postMessage({ type: 'text', html: parts.replace(/<details class="hint poptext">/g, '<details class="hint poptext" open>'), title: STEPS[S.step].tab });
  }
  if (bc) bc.onmessage = e => { if (e.data && e.data.type === 'hello') broadcast(); };
  document.getElementById('btnPopText').onclick = () => {
    const w = window.open('instructions.html', 'volclabText', 'width=560,height=760');
    if (!w) alert('Your browser blocked the pop-out window. Please allow pop-ups for this page.');
    else setTimeout(broadcast, 600);
  };
  let panelWin = null;
  function panelBack() {
    if (!panelWin) return;
    panelWrap.insertBefore(document.adoptNode(panel), placeholder);
    placeholder.hidden = true; panelWin = null;
  }
  document.getElementById('btnPopPanel').onclick = () => {
    if (panelWin && !panelWin.closed) { panelWin.focus(); return; }
    const w = window.open('', 'volclabPanel', 'width=1000,height=760');
    if (!w) { alert('Your browser blocked the pop-out window. Please allow pop-ups for this page.'); return; }
    const css = new URL('css/style.css?v=v1', location.href).href;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Panel - Read the Volcano</title><link rel="stylesheet" href="${css}"></head><body class="popwin"><div id="host"></div><div id="glossaryPop" class="gloss-pop" hidden></div></body></html>`);
    w.document.close();
    w.document.getElementById('host').appendChild(w.document.adoptNode(panel));
    Glossary.attach(w.document);
    placeholder.hidden = false; panelWin = w;
    w.addEventListener('pagehide', panelBack);
    w.addEventListener('beforeunload', panelBack);
  };
  document.getElementById('btnPanelBack').onclick = () => { const w = panelWin; panelBack(); if (w) w.close(); };
  window.addEventListener('beforeunload', () => { if (panelWin) panelWin.close(); });
  document.getElementById('btnGlossary').onclick = () => {
    const w = window.open('', 'volclabGloss', 'width=520,height=760');
    if (!w) return;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Glossary - Read the Volcano</title><link rel="stylesheet" href="${new URL('css/style.css', location.href).href}"></head><body class="popwin"><h2 style="color:#841617">Glossary</h2>${Glossary.listHTML()}</body></html>`);
    w.document.close();
  };

  Glossary.attach(document);
  go(S.seed == null ? 0 : S.step);
})();
