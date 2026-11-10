
// =============================================================== ÁUDIO
// Tudo sintetizado com Web Audio: nenhuma dependência de arquivo, funciona offline.
const AU = { C: null, master: null, music: null, sfx: null, amb: {}, cur: 'none', want: 'none', muted: false, next: {}, noise: null, waterNear: 0 };
function audioInit() {
  if (AU.C) { if (AU.C.state === 'suspended') AU.C.resume(); return; }
  try { AU.C = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AU.C = null; return; }
  const C = AU.C;
  const comp = C.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(C.destination);
  AU.master = C.createGain(); AU.master.gain.value = AU.muted ? 0 : .9; AU.master.connect(comp);
  AU.music = C.createGain(); AU.music.gain.value = .6; AU.music.connect(AU.master);
  AU.sfx = C.createGain(); AU.sfx.gain.value = .8; AU.sfx.connect(AU.master);
  const len = C.sampleRate * 2, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = buf;
  buildCaveAmb(); buildNatureAmb();
  setAmbience(AU.want, 2.5);
}
function noiseSrc() { const s = AU.C.createBufferSource(); s.buffer = AU.noise; s.loop = true; s.start(); return s; }
// Caverna: drone grave com filtro oscilante, eco longo, gotas e notas soltas
function buildCaveAmb() {
  const C = AU.C, out = C.createGain(); out.gain.value = 0; out.connect(AU.music);
  const echo = C.createDelay(2), fb = C.createGain(), lp = C.createBiquadFilter();
  echo.delayTime.value = .48; fb.gain.value = .48; lp.type = 'lowpass'; lp.frequency.value = 1500;
  echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(out);
  const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 5; f.connect(out);
  [[55, 'sawtooth', .06], [55.35, 'sawtooth', .06], [82.4, 'triangle', .1], [110.2, 'sine', .03]].forEach(([fr, ty, v]) => { const o = C.createOscillator(), og = C.createGain(); o.type = ty; o.frequency.value = fr; og.gain.value = v; o.connect(og).connect(f); o.start(); });
  const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = .06; lg.gain.value = 170; lfo.connect(lg).connect(f.frequency); lfo.start();
  const n = noiseSrc(), nf = C.createBiquadFilter(), ng = C.createGain(); nf.type = 'lowpass'; nf.frequency.value = 160; ng.gain.value = .18; n.connect(nf).connect(ng).connect(out);
  AU.amb.cave = { out, wet: echo };
}
// Natureza: vento em rajadas, água corrente, pad suave, pássaros e notas pentatônicas
function buildNatureAmb() {
  const C = AU.C, out = C.createGain(); out.gain.value = 0; out.connect(AU.music);
  const wn = noiseSrc(), wf = C.createBiquadFilter(), wg = C.createGain(); wf.type = 'bandpass'; wf.frequency.value = 520; wf.Q.value = .7; wg.gain.value = .16;
  const wl = C.createOscillator(), wlg = C.createGain(); wl.frequency.value = .09; wlg.gain.value = .11; wl.connect(wlg).connect(wg.gain); wl.start();
  const wl2 = C.createOscillator(), wlg2 = C.createGain(); wl2.frequency.value = .05; wlg2.gain.value = 260; wl2.connect(wlg2).connect(wf.frequency); wl2.start();
  wn.connect(wf).connect(wg).connect(out);
  const an = noiseSrc(), hp = C.createBiquadFilter(), lp = C.createBiquadFilter(), ag = C.createGain(); hp.type = 'highpass'; hp.frequency.value = 420; lp.type = 'lowpass'; lp.frequency.value = 2600; ag.gain.value = .05;
  an.connect(hp).connect(lp).connect(ag).connect(out);
  const pf = C.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 1100; const pg = C.createGain(); pg.gain.value = .5; pf.connect(pg).connect(out);
  [261.6, 329.6, 392, 493.9, 196].forEach((fr, i) => { const o = C.createOscillator(), og = C.createGain(); o.type = 'triangle'; o.frequency.value = fr; o.detune.value = (i - 2) * 4; og.gain.value = .016; o.connect(og).connect(pf); o.start(); });
  const echo = C.createDelay(1), fb = C.createGain(); echo.delayTime.value = .33; fb.gain.value = .3; echo.connect(fb).connect(echo); echo.connect(out);
  AU.amb.nature = { out, water: ag, wet: echo };
}
function setAmbience(name, t = 2) {
  AU.want = name; if (!AU.C) return;
  const now = AU.C.currentTime;
  for (const k in AU.amb) AU.amb[k].out.gain.setTargetAtTime(k === name ? 1 : 0, now, t / 3);
  AU.cur = name;
}
function note(dest, wet, f, dur, type, vol, attack = .02, delay = 0) {
  const C = AU.C, t = C.currentTime + delay, o = C.createOscillator(), gn = C.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + attack); gn.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(gn); gn.connect(dest); if (wet) gn.connect(wet); o.start(t); o.stop(t + dur + .05);
}
// Agenda os eventos musicais ambientes (chamado a cada quadro)
function audioTick(time) {
  if (!AU.C || AU.muted) return;
  const N = AU.next;
  if (AU.cur === 'cave') {
    const A = AU.amb.cave;
    if ((N.note || 0) < time) {
      const sc = [220, 233.1, 261.6, 293.7, 329.6, 349.2, 392], f = sc[(Math.random() * sc.length) | 0] * (Math.random() < .5 ? .5 : 1);
      note(A.out, A.wet, f, 3.2, 'sine', .05, .5);
      if (Math.random() < .35) note(A.out, A.wet, f * 1.5, 3, 'sine', .025, .6, .5);
      N.note = time + 4 + Math.random() * 4;
    }
    if ((N.drip || 0) < time) { const C = AU.C, t = C.currentTime, o = C.createOscillator(), g = C.createGain(); o.frequency.setValueAtTime(1500 + Math.random() * 900, t); o.frequency.exponentialRampToValueAtTime(500, t + .09); g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); o.connect(g); g.connect(A.out); g.connect(A.wet); o.start(t); o.stop(t + .15); N.drip = time + 2 + Math.random() * 5; }
  } else if (AU.cur === 'nature') {
    const A = AU.amb.nature, C = AU.C;
    A.water.gain.setTargetAtTime(.04 + AU.waterNear * .12, C.currentTime, .5);
    if ((N.bird || 0) < time) {
      const pan = C.createStereoPanner ? C.createStereoPanner() : null; if (pan) { pan.pan.value = Math.random() * 1.6 - .8; pan.connect(A.out); }
      const dest = pan || A.out, base = 2200 + Math.random() * 2000, syl = 2 + ((Math.random() * 4) | 0), t0 = C.currentTime;
      for (let i = 0; i < syl; i++) {
        const t = t0 + i * (.09 + Math.random() * .05), o = C.createOscillator(), g = C.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(base * (.9 + Math.random() * .3), t); o.frequency.exponentialRampToValueAtTime(base * (Math.random() < .5 ? 1.4 : .7), t + .07);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
        o.connect(g).connect(dest); o.start(t); o.stop(t + .1);
      }
      N.bird = time + .8 + Math.random() * 3.2;
    }
    if ((N.pluck || 0) < time) {
      const sc = [523.3, 587.3, 659.3, 784, 880, 1046.5], f = sc[(Math.random() * sc.length) | 0];
      note(A.out, A.wet, f, 1.6, 'triangle', .03, .01);
      N.pluck = time + 2.5 + Math.random() * 3;
    }
  }
}
function tone(f, d, type = 'square', v = .06, slide = 0, delay = 0) {
  if (!AU.C || AU.muted) return;
  const C = AU.C, t = C.currentTime + delay, o = C.createOscillator(), gn = C.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(gn).connect(AU.sfx); o.start(t); o.stop(t + d + .03);
}
function hiss(d, v = .08, freq = 1200, type = 'bandpass', delay = 0, q = 1) {
  if (!AU.C || AU.muted) return;
  const C = AU.C, t = C.currentTime + delay, s = C.createBufferSource(), f = C.createBiquadFilter(), gn = C.createGain();
  s.buffer = AU.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d);
  s.connect(f).connect(gn).connect(AU.sfx); s.start(t, Math.random()); s.stop(t + d + .05);
}
const SFX = {
  click: () => { tone(880, .05, 'square', .04); tone(1320, .07, 'square', .03, 0, .04); },
  tick: () => tone(660, .04, 'square', .03),
  select: () => { tone(523, .06, 'square', .04); tone(784, .09, 'square', .035, 0, .05); },
  pick: () => { [784, 988, 1319].forEach((f, i) => tone(f, .14, 'triangle', .05, 0, i * .05)); },
  hit: () => { hiss(.1, .16, 3000); [1180, 1580, 2340].forEach(f => tone(f, .35, 'sine', .04, -60)); },
  miss: () => { tone(150, .25, 'sawtooth', .05, -70); hiss(.1, .05, 400); },
  break: () => { hiss(.45, .2, 1800); [880, 1175, 1568, 2093].forEach((f, i) => tone(f, .5, 'triangle', .045, -40, i * .05)); tone(110, .4, 'sine', .12, -60); },
  thud: () => { tone(120, .3, 'sine', .16, -80); hiss(.15, .1, 300); },
  jump: () => { tone(260, .12, 'square', .03, 360); hiss(.05, .03, 2000); },
  land: () => hiss(.06, .06, 500),
  stepStone: () => hiss(.035, .035, 900, 'bandpass', 0, 2),
  stepGrass: () => hiss(.05, .03, 2600, 'bandpass', 0, 1.5),
  splash: () => { hiss(.25, .08, 1800, 'highpass'); tone(500, .1, 'sine', .03, 300); },
  death: () => { hiss(.3, .16, 900); tone(420, .45, 'square', .05, -360); },
  reveal: () => { [392, 466, 587].forEach((f, i) => tone(f, .7, 'triangle', .05, 0, i * .12)); },
  glare: () => { tone(220, 2, 'sine', .07, 660); tone(330, 2, 'sine', .05, 990, .1); hiss(1.8, .05, 6000, 'highpass'); },
  burn: () => { hiss(.9, .2, 3500, 'highpass'); hiss(.4, .14, 800); tone(520, .5, 'sawtooth', .06, -300, .05); tone(780, .3, 'square', .04, -500, .1); },
  crackle: () => hiss(.03, .05 + Math.random() * .05, 1500 + Math.random() * 2000),
  fall: () => tone(760, 1.3, 'sine', .05, -620),
  blip: f => tone(f * (.95 + Math.random() * .1), .035, 'square', .018),
};
const sfx = (n, a) => { try { SFX[n] && SFX[n](a); } catch (e) {} };

// =============================================================== ENTRADA
const keys = { left: false, right: false, jump: false, act: false, hold: false, ok: false, yes: false, no: false };
const pressed = new Set();
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyE: 'act', ShiftLeft: 'hold', ShiftRight: 'hold', Enter: 'ok', NumpadEnter: 'ok', KeyS: 'yes', KeyN: 'no', KeyM: 'mute' };
const hit = a => pressed.has(a);
const advance = () => hit('act') || hit('ok') || hit('jump') || hit('click');
addEventListener('keydown', e => {
  const a = KEYMAP[e.code]; if (!a) return;
  if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
  e.preventDefault(); audioInit();
  if (a === 'mute') { if (!e.repeat) toggleMute(); return; }
  if (!keys[a]) pressed.add(a);
  keys[a] = true;
});
addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a && a !== 'mute') keys[a] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const stage = document.getElementById('stage');
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('#mute') || e.target.closest('.choice')) return;
  audioInit();
  const r = cv.getBoundingClientRect();
  G.click = { x: (e.clientX - r.left) / r.width * W + G.camX, y: (e.clientY - r.top) / r.height * H + G.camY };
  pressed.add('click');
});
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); audioInit(); if (!keys[k]) pressed.add(k); keys[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
});

// ========================================================== INTERFACE
const $ = id => document.getElementById(id);
const UI = { dialog: $('dialog'), face: $('d-face'), portrait: $('portrait'), dwho: $('dialog-who'), dtext: $('dialog-text'), dnext: $('dialog-next'), choices: $('dialog-choices'),
  prompt: $('prompt'), card: $('card'), cardEye: $('card-eyebrow'), cardTitle: $('card-title'), toast: $('toast'), qte: $('qte'), qLabel: $('qte-label'), qZone: $('qte-zone'),
  qCursor: $('qte-cursor'), qBar: $('qte-bar'), qHint: $('qte-hint'), pips: [...document.querySelectorAll('.pips i')], meter: $('meter'),
  mFirm: $('m-firm'), mBal: $('m-bal'), hud: $('hud'), hudScene: $('hud-scene'), goal: $('hud-goal'), goalText: $('hud-goal-text'), hudCycle: $('hud-cycle'), hudDeaths: $('hud-deaths'),
  mute: $('mute'), ending: $('ending'), endLines: $('ending-lines'), endCycle: $('ending-cycle'), title: $('title'), start: $('start'), tCycle: $('t-cycle') };
const pctx = UI.portrait.getContext('2d'); pctx.imageSmoothingEnabled = false;

function toggleMute() {
  AU.muted = !AU.muted; UI.mute.textContent = AU.muted ? 'Som desligado' : 'Som ligado'; UI.mute.setAttribute('aria-pressed', String(AU.muted));
  if (AU.master) AU.master.gain.setTargetAtTime(AU.muted ? 0 : .9, AU.C.currentTime, .1);
}
UI.mute.addEventListener('click', () => { audioInit(); toggleMute(); UI.mute.blur(); });

// Falantes: nome, cor do nome e "voz" (altura dos bipes da digitação)
const SPK = {
  code:      { name: 'Code', color: '#f2a33a', voice: 560 },
  mistico:   { name: 'O Místico', color: '#c4a4f0', voice: 330 },
  arrogante: { name: 'O Arrogante', color: '#f07a5a', voice: 210 },
  sistema:   { name: 'Como jogar', color: '#7fd4c8', voice: 900 },
  narrador:  { name: 'Narrador', color: '#a99c8c', voice: 0 },
};
// Diálogo com retrato, efeito de máquina de escrever e escolhas
const D = { active: false, text: '', shown: 0, res: null, who: 'narrador', choices: null, sel: 0, blipT: 0 };
function say(text, who = 'narrador', mood = 'normal') { return openDialog(text, who, mood, null); }
function ask(text, opts, who = 'sistema', mood = 'normal') { return openDialog(text, who, mood, opts); }
function openDialog(text, who, mood, opts) {
  return new Promise(res => {
    Object.assign(D, { active: true, text, shown: 0, res, who, choices: opts, sel: 0, blipT: 0 });
    const sp = SPK[who] || SPK.narrador;
    UI.dwho.textContent = sp.name; UI.dwho.style.color = sp.color;
    pctx.clearRect(0, 0, 32, 32); pctx.drawImage(portrait(who, mood), 0, 0);
    UI.dtext.textContent = ''; UI.dnext.hidden = true; UI.choices.hidden = true; UI.choices.innerHTML = '';
    if (opts) opts.forEach((o, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.innerHTML = `<kbd>${o.key}</kbd>${o.label}`;
      b.addEventListener('click', () => { if (D.shown >= D.text.length) pickChoice(i); });
      UI.choices.appendChild(b);
    });
    UI.dialog.classList.add('open'); UI.face.classList.add('talk');
  });
}
function pickChoice(i) { D.sel = i; sfx('select'); closeDialog(i); }
function updateDialog(dt) {
  if (!D.active) return false;
  const before = Math.floor(D.shown);
  D.shown = Math.min(D.text.length, D.shown + dt * 44);
  const now = Math.floor(D.shown);
  if (now !== before) {
    UI.dtext.textContent = D.text.slice(0, now);
    const v = (SPK[D.who] || SPK.narrador).voice; D.blipT += now - before;
    if (v && D.blipT >= 2 && D.text[now - 1] !== ' ') { D.blipT = 0; sfx('blip', v); }
  }
  const done = D.shown >= D.text.length;
  if (done) UI.face.classList.remove('talk');
  if (D.choices) {
    UI.choices.hidden = !done;
    if (done) {
      if (hit('left') || hit('right')) { D.sel = (D.sel + (hit('right') ? 1 : -1) + D.choices.length) % D.choices.length; sfx('tick'); }
      [...UI.choices.children].forEach((b, i) => b.classList.toggle('sel', i === D.sel));
      D.choices.forEach((o, i) => { if (hit(o.code)) pickChoice(i); });
      if (D.active && (hit('act') || hit('ok'))) pickChoice(D.sel);
    } else if (advance()) { D.shown = D.text.length; UI.dtext.textContent = D.text; }
    UI.dnext.hidden = true;
    return true;
  }
  UI.dnext.hidden = !done;
  if (advance()) {
    if (!done) { D.shown = D.text.length; UI.dtext.textContent = D.text; }
    else { closeDialog(); sfx('tick'); }
  }
  return true;
}
function closeDialog(val) {
  const r = D.res; D.active = false; D.res = null; D.choices = null;
  UI.dialog.classList.remove('open'); UI.face.classList.remove('talk'); UI.choices.hidden = true;
  if (r) r(val);
}
// sequência de falas: [quem, humor, texto]
async function talk(lines, id) { for (const [w, m, t] of lines) { if (id !== undefined && id !== run) return; await say(t, w, m); } }
const YESNO = [{ label: 'Sim', key: 'S', code: 'yes' }, { label: 'Não', key: 'N', code: 'no' }];

// Prompt flutuante ancorado num ponto do mundo (ou seguindo Code)
const PR = { on: false, x: 0, y: 0, follow: false, tag: '', html: '' };
function setPrompt(html, x, y, follow = false, tag = '') {
  if (PR.html !== html) UI.prompt.innerHTML = html;
  Object.assign(PR, { on: true, x, y, follow, tag, html }); UI.prompt.hidden = false; placePrompt();
}
function hidePrompt(tag) { if (tag && PR.tag !== tag) return; PR.on = false; PR.html = ''; PR.tag = ''; UI.prompt.hidden = true; }
function placePrompt() {
  if (!PR.on) return;
  const x = PR.follow ? P.x : PR.x, y = PR.follow ? P.y - 40 : PR.y;
  UI.prompt.style.left = clamp((x - G.camX) / W * 100, 12, 88) + '%';
  UI.prompt.style.top = clamp((y - G.camY) / H * 100, 16, 96) + '%';
}
function setGoal(text) {
  if (UI.goalText.textContent === text) return;
  UI.goalText.textContent = text; UI.goal.classList.remove('flash'); void UI.goal.offsetWidth; UI.goal.classList.add('flash');
}
function card(eye, title) { UI.cardEye.textContent = eye; UI.cardTitle.textContent = title; UI.card.hidden = false; UI.card.classList.remove('show'); void UI.card.offsetWidth; UI.card.classList.add('show'); }
UI.card.addEventListener('animationend', () => { UI.card.hidden = true; UI.card.classList.remove('show'); });
function toast(text, dur = 3.5) { UI.toast.textContent = text; UI.toast.style.setProperty('--dur', dur + 's'); UI.toast.hidden = false; UI.toast.classList.remove('show'); void UI.toast.offsetWidth; UI.toast.classList.add('show'); }
UI.toast.addEventListener('animationend', () => { UI.toast.hidden = true; UI.toast.classList.remove('show'); });
function meter(show, firm = 0, bal = 1) {
  UI.meter.hidden = !show; if (!show) return;
  UI.mFirm.style.width = (firm * 100).toFixed(1) + '%'; UI.mBal.style.width = (clamp(bal, 0, 1) * 100).toFixed(1) + '%';
  UI.mBal.classList.toggle('low', bal < .35);
}
const SCENE_NAMES = { chains: 'I · As Correntes e a Fagulha', steps: 'II · Os Primeiros Passos e a Fogueira', parkour: 'III · O Parkour da Caverna',
  light: 'IV · A Revelação e o Ofuscamento', outside: 'V · O Mundo Exterior', ending: '' };
function hud() {
  UI.hud.hidden = G.scene === 'title' || G.scene === 'starting' || G.scene === 'ending';
  UI.hudScene.textContent = SCENE_NAMES[G.scene] || '';
  UI.hudCycle.textContent = 'Ciclo ' + roman(G.cycle);
  UI.hudDeaths.hidden = G.scene !== 'parkour' || !G.deaths;
  UI.hudDeaths.textContent = 'Quedas: ' + G.deaths;
}
