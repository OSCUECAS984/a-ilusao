(() => {
'use strict';
/* =====================================================================
   A ILUSÃO · O Interior da Caverna  (versão 2)
   Toda a arte é gerada em código num buffer de 384×216 px, ampliado sem
   suavização. Regra de escala: todos os sprites do Code são desenhados 1:1
   (1 pixel de arte = 1 pixel do buffer) e ancorados nos pés, em canvases
   do mesmo tamanho. Sentado, de pé, caído ou pulando: a escala nunca muda.
   ===================================================================== */

// ---------------------------------------------------------------- base
const W = 384, H = 216, TAU = Math.PI * 2;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { // mulberry32: arte estática determinística
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
const roman = n => { const m = [[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };

// ------------------------------------------------- primitivas de pixel
function rect(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
// elipse preenchida por linhas inteiras: borda nítida, sem antialias
function ell(g, cx, cy, rx, ry, c) {
  g.fillStyle = c; const R = Math.max(0.5, ry), n = Math.floor(R);
  for (let dy = -n; dy <= n; dy++) {
    const hw = rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (R * R)));
    const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
    if (x1 > x0) g.fillRect(x0, Math.round(cy) + dy, x1 - x0, 1);
  }
}
// pontilhado (dithering) em xadrez, típico de pixel art
function dither(g, x, y, w, h, c, ph = 0) { g.fillStyle = c; for (let yy = 0; yy < h; yy++) for (let xx = (yy + ph) & 1; xx < w; xx += 2) g.fillRect(Math.round(x) + xx, Math.round(y) + yy, 1, 1); }
// remove o antialias de formas desenhadas com path (alpha binário)
function hardAlpha(c) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 100 ? 255 : 0;
  g.putImageData(d, 0, 0); return c;
}
// contorno de 1px em volta de um sprite (devolve canvas 2px maior)
function outlined(c, col) {
  const [o, g] = mk(c.width + 2, c.height + 2), [s, sg] = mk(c.width, c.height);
  sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col; sg.fillRect(0, 0, c.width, c.height);
  g.drawImage(s, 0, 1); g.drawImage(s, 2, 1); g.drawImage(s, 1, 0); g.drawImage(s, 1, 2); g.drawImage(c, 1, 1);
  return o;
}
function fromMap(rows, pal) {
  const h = rows.length, w = rows[0].length, [c, g] = mk(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }
  return c;
}
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
// linha grossa pixelada (galhos, raízes)
function thick(g, x1, y1, x2, y2, w1, w2, col) {
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let i = 0; i <= n; i++) { const t = i / n, w = lerp(w1, w2, t); rect(g, lerp(x1, x2, t) - w / 2, lerp(y1, y2, t) - w / 2, w, w, col); }
}

// ---------------------------------------------------------- paletas
const ROCK     = { out:'#0f0911', shade:'#241a27', base:'#322636', hi:'#463746', hi2:'#5b4858' };
const ROCK_DIM = { out:'#060309', shade:'#110b15', base:'#18111e', hi:'#211829', hi2:'#2b2133' };
const ROCK_MID = { out:'#0b070e', shade:'#1c141f', base:'#271d2b', hi:'#352a3a', hi2:'#45384a' };
const ROCK_SUN = { out:'#3a2a24', shade:'#6a564a', base:'#8a7466', hi:'#a8917e', hi2:'#c8b09a' };
const ROCK_SPK = { out:'#0f0911', shade:'#1e1622', base:'#2c2232', hi:'#45374a' };
const BONE     = { out:'#140c12', shade:'#5a4e56', base:'#8b7f86', hi:'#cfc2c4' };
const BRICK    = { mortar:'#1a1216', b:['#4e3e40','#544245','#483a3d','#5a474a'], hi:'#73605e', sh:'#33272b', spk:'#3e3034' };
const BLOCK    = { mortar:'#120c10', b:['#3a2e34','#40333a','#362a30'], hi:'#5a484e', sh:'#251c22', spk:'#2e242a' };
const HP = { skin:'#e8b07a', skinSh:'#b8743f', skinHi:'#f7d0a0', hair:'#4a2a17', hairSh:'#2c170b', hairHi:'#7c4c2a',
  tunic:'#f1ead8', tunicSh:'#c7b99c', tunicDk:'#9c8d72', belt:'#7a4a26', beltHi:'#a8703c', buckle:'#d8a84a', sandal:'#5e3a1e',
  out:'#1a0f0c', eye:'#1a0f0c', eyeW:'#fffaf0', mouth:'#8a2e24', iron:'#5a5f6c', ironHi:'#a3aab6', burn:'#e0502e' };
const NPCP = {
  mistico:  { hair:'#9a9088', hairSh:'#5f5750', hairHi:'#d0c6bc', band:'#6a3f9a', tunic:'#ddd2bc' },
  arrogante:{ hair:'#1c110b', hairSh:'#0e0805', hairHi:'#5a3a24', stripe:'#a83a2a', tunic:'#e6dcc2' },
};

// ------------------------------------------------- texturas orgânicas
function boulder(g, cx, cy, rx, ry, pal, R) {
  cx = Math.round(cx); cy = Math.round(cy);
  ell(g, cx, cy + 1, rx + 1, ry + 1, pal.out);
  ell(g, cx, cy, rx, ry, pal.base);
  ell(g, cx + rx * .18, cy + ry * .35, rx * .68, ry * .46, pal.shade);
  ell(g, cx - rx * .22, cy - ry * .3, rx * .6, ry * .48, pal.hi);
  ell(g, cx - rx * .38, cy - ry * .5, rx * .26, ry * .2, pal.hi2);
  g.fillStyle = pal.shade;
  const n = (rx * ry * .1) | 0;
  for (let i = 0; i < n; i++) { const a = R() * TAU, d = Math.sqrt(R()) * .8; g.fillRect(Math.round(cx + Math.cos(a) * rx * d), Math.round(cy + Math.sin(a) * ry * d), 1, 1); }
}
function brickWall(g, x0, y0, w, h, R, P, bwMin = 13, bwVar = 7, bh = 9) {
  rect(g, x0, y0, w, h, P.mortar);
  for (let row = 0; y0 + row * bh < y0 + h; row++) {
    let x = x0 - (row % 2 ? Math.floor(bwMin * .55) : 0) - ((R() * 4) | 0);
    const y = y0 + row * bh;
    while (x < x0 + w) {
      const bw = bwMin + ((R() * bwVar) | 0);
      const bx = Math.max(x, x0), bx2 = Math.min(x + bw - 1, x0 + w), hh = Math.min(bh - 1, y0 + h - y);
      if (bx2 - bx > 2 && hh > 2) {
        const ww = bx2 - bx;
        rect(g, bx, y, ww, hh, P.b[(R() * P.b.length) | 0]);
        dither(g, bx + 1, y + hh - 3, ww - 2, 2, P.sh, (bx + y) & 1);
        rect(g, bx, y, ww, 1, P.hi); rect(g, bx, y, 1, hh, P.hi);
        rect(g, bx, y + hh - 1, ww, 1, P.sh); rect(g, bx2 - 1, y, 1, hh, P.sh);
        rect(g, bx, y, 1, 1, P.mortar); rect(g, bx2 - 1, y + hh - 1, 1, 1, P.mortar);
        if (R() < .5) rect(g, bx2 - 1, y, 1, 1, P.mortar); if (R() < .5) rect(g, bx, y + hh - 1, 1, 1, P.mortar);
        for (let k = 0; k < ww * hh * .05; k++) rect(g, bx + 1 + R() * (ww - 2), y + 1 + R() * (hh - 2), 1, 1, P.spk);
        if (R() < .22) { let cx = bx + 2 + R() * (ww - 4), cy = y + 1; for (let k = 0; k < 5 && cy < y + hh - 1; k++) { rect(g, cx, cy, 1, 1, P.sh); cx += R() < .5 ? 1 : -1; cy++; } }
      }
      x += bw;
    }
  }
}
function curb(g, x0, x1, y, R) {
  const b = ['#4a3c44', '#463840', '#514249'];
  let x = x0;
  while (x < x1) {
    const w = 11 + ((R() * 10) | 0);
    rect(g, x, y, w, 8, '#140c12'); rect(g, x + 1, y + 1, w - 2, 6, b[(R() * 3) | 0]);
    rect(g, x + 1, y + 1, w - 2, 1, '#6e5a62'); rect(g, x + 1, y + 5, w - 2, 2, '#2e2428'); dither(g, x + 2, y + 3, w - 4, 2, '#3a2e34', x & 1);
    x += w;
  }
}
function spikeUp(g, x, base, w, h, P) {
  for (let i = 0; i < h; i++) { const ww = Math.max(1, Math.round(w * (i + 1) / h)), y = base - h + i, x0 = Math.round(x - ww / 2); rect(g, x0 - 1, y, ww + 2, 1, P.out); }
  for (let i = 0; i < h; i++) {
    const ww = Math.max(1, Math.round(w * (i + 1) / h)), y = base - h + i, x0 = Math.round(x - ww / 2);
    rect(g, x0, y, ww, 1, P.base); rect(g, x0, y, Math.max(1, ww >> 2), 1, P.hi); if (ww > 2) rect(g, x0 + ww - 1, y, 1, 1, P.shade);
  }
}
function spikeDown(g, x, top, w, h, P) {
  for (let i = 0; i < h; i++) { const ww = Math.max(1, Math.round(w * (h - i) / h)), y = top + i, x0 = Math.round(x - ww / 2); rect(g, x0 - 1, y, ww + 2, 1, P.out); }
  for (let i = 0; i < h; i++) {
    const ww = Math.max(1, Math.round(w * (h - i) / h)), y = top + i, x0 = Math.round(x - ww / 2);
    rect(g, x0, y, ww, 1, P.base); rect(g, x0, y, 1, 1, P.hi); if (ww > 2) rect(g, x0 + ww - 1, y, 1, 1, P.shade);
  }
}
// coluna quadrada de blocos com capitel (como na imagem do salão das estátuas)
function column(g, x, top, w, h, R) {
  const C = { out:'#120c12', b:'#4c3e44', hi:'#6e5c62', hi2:'#8a767c', sh:'#2e2428' };
  rect(g, x - 4, top, w + 8, 7, C.out); rect(g, x - 3, top + 1, w + 6, 5, C.b); rect(g, x - 3, top + 1, w + 6, 1, C.hi2);
  rect(g, x - 3, top + 2, 1, 4, C.hi); rect(g, x + w + 2, top + 2, 1, 4, C.sh); rect(g, x - 3, top + 5, w + 6, 1, C.sh);
  rect(g, x - 2, top + 7, w + 4, 3, C.out); rect(g, x - 1, top + 7, w + 2, 2, C.b);
  for (let y = top + 10; y < top + h - 9; y += 12) {
    const hh = Math.min(12, top + h - 9 - y);
    rect(g, x, y, w, hh, C.out); rect(g, x + 1, y, w - 2, hh - 1, C.b); rect(g, x + 1, y, 3, hh - 1, C.hi); rect(g, x + 1, y, w - 2, 1, C.hi2); rect(g, x + w - 3, y, 2, hh - 1, C.sh);
    dither(g, x + 4, y + 2, w - 8, hh - 4, '#443840', y & 1);
    if (R && R() < .6) rect(g, x + (R() < .5 ? 1 : w - 3), y + 3 + R() * 5, 2, 2, C.out);
  }
  rect(g, x - 3, top + h - 9, w + 6, 9, C.out); rect(g, x - 2, top + h - 8, w + 4, 7, C.b); rect(g, x - 2, top + h - 8, w + 4, 1, C.hi2); rect(g, x + w, top + h - 8, 2, 7, C.sh);
}
function amphora(g, x, y) {
  const O = '#140c10', B = '#8a4a2a', D = '#5e2f1a', L = '#b8683c', Hh = '#d88a50', BAND = '#3a1c10';
  ell(g, x, y - 9, 8, 9, O); ell(g, x, y - 9, 7, 8, B); ell(g, x + 2, y - 7, 4, 5, D); ell(g, x - 3, y - 12, 2, 3, L); rect(g, x - 3, y - 13, 1, 2, Hh);
  rect(g, x - 6, y - 11, 13, 1, BAND); rect(g, x - 6, y - 7, 13, 1, BAND); for (let i = -5; i < 6; i += 3) rect(g, x + i, y - 9, 1, 1, BAND);
  rect(g, x - 3, y - 22, 7, 5, O); rect(g, x - 2, y - 21, 5, 4, B); rect(g, x - 2, y - 21, 1, 4, L);
  rect(g, x - 4, y - 23, 9, 2, O); rect(g, x - 3, y - 23, 7, 1, Hh);
  rect(g, x - 6, y - 20, 1, 6, O); rect(g, x - 5, y - 21, 2, 1, O); rect(g, x + 6, y - 20, 1, 6, O); rect(g, x + 4, y - 21, 2, 1, O);
  rect(g, x - 3, y - 1, 7, 1, O);
}
function ringPlate(g, x, y) {
  rect(g, x - 5, y - 5, 11, 11, '#0e0a12'); rect(g, x - 4, y - 4, 9, 9, '#4d525e'); rect(g, x - 4, y - 4, 9, 1, '#8a90a0'); rect(g, x - 4, y - 4, 1, 9, '#6d7380');
  rect(g, x + 4, y - 3, 1, 8, '#33363e'); rect(g, x - 1, y - 1, 3, 3, '#1b1820'); rect(g, x, y, 1, 1, '#6d7380');
  rect(g, x - 2, y + 5, 5, 1, '#9aa1ad'); rect(g, x - 3, y + 5, 1, 3, '#5a5f6c'); rect(g, x + 3, y + 5, 1, 3, '#5a5f6c'); rect(g, x - 2, y + 8, 5, 1, '#5a5f6c');
}
// folhagem: um tufo arredondado com borda recortada e textura
function leafCluster(g, cx, cy, r, L, R) {
  ell(g, cx, cy + 1, r + 1, r * .75 + 1, L.out);
  ell(g, cx, cy, r, r * .75, L.b);
  ell(g, cx + r * .2, cy + r * .25, r * .7, r * .42, L.sh);
  ell(g, cx - r * .2, cy - r * .2, r * .62, r * .45, L.mid);
  ell(g, cx - r * .35, cy - r * .38, r * .3, r * .2, L.hi);
  for (let k = 0; k < r * 1.8; k++) { const a = Math.PI + R() * Math.PI, x2 = cx + Math.cos(a) * r * .95, y2 = cy + Math.sin(a) * r * .72; rect(g, x2, y2 - 1, 2, 2, L.b); rect(g, x2, y2 - 1, 1, 1, L.mid); }
  for (let k = 0; k < r * r * .18; k++) rect(g, cx + (R() * 2 - 1) * r * .75, cy + (R() * 2 - 1) * r * .5, 1, 1, R() < .5 ? L.sh : L.mid);
  if (R() < .6) ell(g, cx - r * .45, cy - r * .5, r * .14, r * .1, L.hi2);
}

// ===================================================== SPRITES: Code
// Canvas 40×40 com âncora nos pés em (20,38); após o contorno: 42×42, âncora (21,39).
const AX = 20, AY = 38, SPR_W = 42, SPR_AX = 21, SPR_AY = 39;
function heroCanvas(fn) { const [c, g] = mk(40, 40); fn((x, y, w, h, col) => rect(g, AX + x, AY + y, w, h, col)); return outlined(c, HP.out); }

function sLeg(r, f, front, tuck) {
  const col = front ? HP.skin : HP.skinSh, hx = front ? 0 : -2;
  if (tuck) { r(hx, -9, 3, 3, col); r(hx + f + 1, -7, 3, 4, col); r(hx + f + 1, -4, 4, 2, HP.sandal); return; }
  r(hx + Math.round(f * .4), -9, 3, 4, col); r(hx + f, -5, 3, 4, col); if (front) r(hx + f, -5, 1, 3, HP.skinHi);
  r(hx + f, -2, 4, 2, HP.sandal); r(hx + f, -3, 3, 1, HP.sandal);
}
function sArm(r, mode, s, b, L, front, o) {
  const col = front ? HP.skin : HP.skinSh, x = front ? L + 1 : L - 4, y = -19 + b;
  if (mode === 'down') { const dx = front ? s : -s; r(x + Math.round(dx / 2), y, 3, 5, col); r(x + dx, y + 5, 3, 4, col); r(x + dx, y + 9, 3, 2, front ? HP.skinHi : HP.skin); if (o.cuffs !== false) r(x + dx, y + 7, 3, 1, HP.iron); }
  else if (mode === 'out') { if (front) { r(x, y, 9, 3, col); r(x + 9, y, 2, 3, HP.skinHi); } else r(x - 8, y, 9, 3, col); }
  else if (mode === 'up') { if (front) { r(x + 1, y - 3, 3, 3, col); r(x + 2, y - 9, 3, 6, col); r(x + 2, y - 11, 3, 2, HP.skinHi); } else { r(x - 1, y - 3, 3, 3, col); r(x - 2, y - 9, 3, 6, col); r(x - 2, y - 11, 3, 2, col); } }
  else if (mode === 'wall') { r(x + 1, y, 5, 3, col); r(x + 5, y - 5, 3, 6, col); r(x + 5, y - 7, 4, 2, HP.skinHi); }
  else if (mode === 'eyes') { r(x, y, 3, 4, col); r(x + 1, y - 4, 3, 4, col); r(x + 2, y - 10, 4, 6, HP.skinHi); }
  else if (mode === 'clutch') { r(x, y, 3, 4, col); r(x + 1, y + 3, 5, 3, col); r(x + 5, y + 2, 3, 4, o.burn ? HP.burn : HP.skinHi); }
  else if (mode === 'point') { r(x, y, 3, 4, col); r(x + 2, y + 1, 8, 3, col); r(x + 10, y + 1, 2, 3, HP.skinHi); }
}
// Vista lateral (olhando para a direita)
function sidePose(o = {}) {
  return heroCanvas(r => {
    const b = (o.bob || 0) + (o.kneel ? 6 : 0), L = o.lean || 0;
    sArm(r, o.armB || 'down', o.swB || 0, b, L, false, o);
    if (o.kneel) { r(-4, -5, 3, 4, HP.skinSh); r(-6, -2, 4, 2, HP.sandal); r(-1, -8, 7, 3, HP.skin); r(4, -6, 3, 5, HP.skin); r(4, -2, 4, 2, HP.sandal); }
    else { sLeg(r, o.fB || 0, false, o.tuck); sLeg(r, o.fF || 0, true, o.tuck); }
    // túnica sem mangas, cinto e saia
    r(L - 4, -20 + b, 9, 7, HP.tunic); r(L - 4, -20 + b, 2, 7, HP.tunicSh); r(L + 1, -20 + b, 3, 2, HP.skin); r(L + 1, -20 + b, 1, 1, HP.skinHi);
    r(L + 2, -17 + b, 1, 3, HP.tunicSh);
    r(L - 4, -14 + b, 9, 2, HP.belt); r(L - 4, -14 + b, 9, 1, HP.beltHi); r(L + 2, -14 + b, 2, 2, HP.buckle);
    r(L - 5, -12 + b, 11, 4, HP.tunic); r(L - 5, -12 + b, 2, 4, HP.tunicSh); r(L, -11 + b, 1, 3, HP.tunicSh); r(L + 3, -11 + b, 1, 2, HP.tunicSh);
    r(L - 5, -8 + b, 11, 1, HP.tunicDk); r(L - 4, -8 + b, 2, 1, HP.tunicSh);
    // cabeça
    r(L - 1, -22 + b, 3, 2, HP.skinSh);
    r(L - 3, -30 + b, 8, 8, HP.skin); r(L - 3, -23 + b, 2, 1, HP.skinSh);
    r(L + 5, -27 + b, 1, 2, HP.skin); r(L + 5, -26 + b, 1, 1, HP.skinSh);
    r(L - 1, -27 + b, 2, 2, HP.skinSh);
    // cabelo cacheado
    r(L - 4, -33 + b, 8, 4, HP.hair); r(L - 5, -31 + b, 3, 7, HP.hair); r(L - 4, -34 + b, 2, 1, HP.hair); r(L, -34 + b, 3, 1, HP.hair); r(L + 4, -32 + b, 1, 2, HP.hair);
    r(L + 1, -30 + b, 4, 1, HP.hair); r(L + 4, -29 + b, 1, 1, HP.hair); r(L - 2, -29 + b, 1, 2, HP.hair);
    r(L - 2, -32 + b, 3, 1, HP.hairHi); r(L + 2, -33 + b, 2, 1, HP.hairHi); r(L - 4, -29 + b, 1, 1, HP.hairHi); r(L - 5, -26 + b, 1, 1, HP.hairHi);
    r(L - 5, -27 + b, 1, 1, HP.hairSh); r(L - 3, -31 + b, 1, 1, HP.hairSh); r(L + 1, -32 + b, 1, 1, HP.hairSh); r(L - 4, -25 + b, 1, 1, HP.hairSh);
    // olhos, sobrancelha e boca
    const e = o.eyes || 'n';
    if (e === 'wide') { r(L + 2, -28 + b, 3, 3, HP.eyeW); r(L + 3, -27 + b, 1, 1, HP.eye); r(L + 2, -30 + b, 3, 1, HP.hairSh); }
    else if (e === 'closed') { r(L + 2, -26 + b, 3, 1, HP.skinSh); r(L + 2, -28 + b, 2, 1, HP.hairSh); }
    else if (e === 'squint') { r(L + 2, -27 + b, 3, 1, HP.eye); r(L + 2, -28 + b, 3, 1, HP.hairSh); }
    else if (e === 'hurt') { r(L + 2, -28 + b, 1, 1, HP.eye); r(L + 3, -27 + b, 1, 1, HP.eye); r(L + 2, -26 + b, 1, 1, HP.eye); r(L + 3, -29 + b, 2, 1, HP.hairSh); }
    else { r(L + 3, -27 + b, 1, 2, HP.eye); r(L + 2, -29 + b, 2, 1, HP.hairSh); }
    const m = o.mouth || 'n';
    if (m === 'open') r(L + 3, -24 + b, 2, 2, HP.mouth);
    else if (m === 'grit') { r(L + 2, -24 + b, 3, 1, HP.eyeW); r(L + 2, -23 + b, 3, 1, HP.mouth); }
    else r(L + 3, -24 + b, 2, 1, HP.skinSh);
    sArm(r, o.armF || 'down', o.swF || 0, b, L, true, o);
  });
}
// Deitado (desmaiado / caído)
function lying(open) {
  return heroCanvas(r => {
    r(-17, -4, 10, 3, HP.skin); r(-17, -2, 10, 1, HP.skinSh); r(-18, -5, 2, 4, HP.sandal);
    r(-8, -7, 13, 7, HP.tunic); r(-8, -2, 13, 2, HP.tunicSh); r(-2, -7, 2, 7, HP.belt);
    r(-4, -2, 9, 2, HP.skinSh);
    r(6, -9, 9, 9, HP.skin); r(13, -10, 4, 10, HP.hair); r(7, -10, 8, 2, HP.hair); r(9, -11, 3, 1, HP.hair); r(8, -10, 2, 1, HP.hairHi); r(14, -8, 1, 2, HP.hairHi);
    r(10, -5, 2, 2, HP.skinSh);
    if (open) { r(8, -7, 1, 1, HP.eye); } else r(7, -7, 2, 1, HP.skinSh);
    r(6, -3, 1, 2, HP.skinSh);
  });
}
// Costas, sentado no chão (prisioneiro). arm = pose do braço direito.
const SIT_WRIST = { down:[8,-6], reach:[11,-12], hold:[8,-11], up:[8,-22], strike:[-3,-12] };
const SIT_STONE = { reach:[16,-10], hold:[9,-17], up:[8,-33], strike:[-9,-12] };
function backSit(o = {}) {
  const n = o.npc, NP = n ? NPCP[n] : { hair:HP.hair, hairSh:HP.hairSh, hairHi:HP.hairHi, tunic:HP.tunic };
  const X = n === 'arrogante' ? 1 : 0, T = NP.tunic;
  return heroCanvas(r => {
    r(-12, -3, 4, 2, HP.skin); r(8, -3, 4, 2, HP.skin); r(-13, -2, 2, 2, HP.sandal); r(11, -2, 2, 2, HP.sandal);
    r(-9, -8, 18, 8, T); r(-9, -2, 18, 2, HP.tunicSh); r(-5, -7, 1, 5, HP.tunicSh); r(3, -6, 1, 4, HP.tunicSh); r(-8, -4, 2, 1, HP.tunicSh); r(6, -4, 2, 1, HP.tunicSh);
    r(-6 - X, -18, 12 + 2 * X, 10, HP.skin); r(0, -17, 1, 8, HP.skinSh); r(4 + X, -18, 2, 10, HP.skinSh); r(-4, -17, 3, 1, HP.skinHi); r(2, -16, 2, 1, HP.skinHi);
    for (let k = 0; k < 10; k++) { r(-6 - X, -18 + k, 3 + k, 1, T); r(-4 - X + k, -18 + k, 1, 1, HP.tunicSh); }
    if (n === 'arrogante') for (let k = 0; k < 10; k++) r(-3 - X + k, -18 + k, 1, 1, NP.stripe);
    r(-7 - X, -9, 14 + 2 * X, 1, HP.tunicSh);
    // braço esquerdo (no chão, algemado)
    r(-8 - X, -17, 2, 7, HP.skinSh); r(-9 - X, -10, 2, 5, HP.skinSh); r(-10 - X, -5, 3, 2, HP.skin);
    if (o.broken) r(-10 - X, -7, 3, 1, HP.iron); else { r(-10 - X, -7, 3, 2, HP.iron); r(-10 - X, -7, 1, 1, HP.ironHi); }
    const a = o.arm || 'down';
    if (a === 'down') { r(6 + X, -17, 2, 7, HP.skinSh); r(7 + X, -10, 2, 5, HP.skinSh); r(7 + X, -5, 3, 2, HP.skin); if (o.broken) r(7 + X, -7, 3, 1, HP.iron); else { r(7 + X, -7, 3, 2, HP.iron); r(9 + X, -7, 1, 1, HP.ironHi); } }
    if (a === 'reach') { r(6, -17, 2, 5, HP.skinSh); r(7, -13, 7, 2, HP.skin); r(14, -12, 2, 3, HP.skinHi); r(10, -13, 2, 2, HP.iron); }
    if (a === 'hold') { r(6, -17, 2, 5, HP.skinSh); r(7, -13, 2, 3, HP.skin); r(7, -15, 3, 2, HP.skinHi); r(7, -11, 2, 1, HP.iron); }
    if (a === 'up') { r(6, -19, 2, 3, HP.skinSh); r(7, -29, 2, 10, HP.skin); r(7, -22, 2, 1, HP.iron); r(7, -31, 2, 2, HP.skinHi); }
    if (a === 'strike') { r(4, -16, 3, 2, HP.skinSh); r(-6, -13, 11, 2, HP.skin); r(-9, -11, 3, 2, HP.skinHi); r(-4, -13, 2, 1, HP.iron); }
    r(-1, -19, 3, 1, HP.skinSh);
    // cabeça vista de trás
    const Hc = NP.hair, Hs = NP.hairSh, Hh = NP.hairHi;
    if (n === 'mistico') {
      r(-5, -28, 11, 10, Hc); r(-5, -19, 11, 3, Hc); r(-4, -16, 2, 1, Hc); r(0, -16, 3, 1, Hc); r(4, -16, 1, 2, Hc);
      r(-3, -27, 1, 7, Hh); r(1, -28, 1, 6, Hh); r(3, -26, 1, 8, Hs); r(-1, -24, 1, 6, Hs);
      r(-5, -25, 11, 1, NP.band); r(5, -25, 2, 3, NP.band);
    } else if (n === 'arrogante') {
      r(-4, -28, 9, 8, Hc); r(-3, -29, 7, 1, Hc); r(-2, -27, 5, 1, Hh); r(-3, -26, 1, 2, Hh);
      r(-5, -24, 1, 3, HP.skin); r(5, -24, 1, 3, HP.skin); r(-3, -20, 7, 1, HP.skinSh);
    } else {
      r(-4, -28, 9, 9, Hc); r(-5, -27, 1, 6, Hc); r(5, -27, 1, 6, Hc); r(-3, -29, 7, 1, Hc); r(-4, -29, 1, 1, Hc); r(4, -29, 1, 1, Hc);
      [[-2,-27],[1,-28],[3,-26],[-3,-24],[0,-25],[2,-23]].forEach(([x, y]) => r(x, y, 1, 1, Hh));
      [[-1,-26],[2,-27],[-4,-25],[4,-24],[0,-22],[-2,-21]].forEach(([x, y]) => r(x, y, 1, 1, Hs));
      r(-5, -23, 1, 3, HP.skin); r(5, -23, 1, 3, HP.skin); r(-2, -20, 5, 1, HP.skinSh);
    }
    // cabeça virada de perfil para quem fala (turn = 1 direita, -1 esquerda)
    if (o.turn) {
      const F = (x, y, w, h, c) => o.turn > 0 ? r(x, y, w, h, c) : r(1 - x - w, y, w, h, c);
      F(2, -26, 4, 7, HP.skin); F(6, -24, 1, 2, HP.skin); F(4, -24, 1, 1, HP.eye); F(3, -25, 2, 1, Hs); F(3, -21, 2, 1, HP.skinSh);
      if (n === 'mistico') { F(2, -21, 4, 3, Hc); F(2, -25, 4, 1, NP.band); }
    }
  });
}
// Costas, de pé / ajoelhado (transição ao se levantar) — mesma escala
function backStand(o = {}) {
  return heroCanvas(r => {
    const k = o.kneel ? 6 : 0;
    if (o.kneel) { r(-4, -4, 3, 4, HP.skinSh); r(1, -4, 3, 4, HP.skinSh); }
    else { r(-4, -8, 3, 8, HP.skinSh); r(1, -8, 3, 8, HP.skinSh); r(-4, -2, 3, 2, HP.sandal); r(1, -2, 3, 2, HP.sandal); }
    r(-5, -20 + k, 10, 8, HP.tunic); r(-6, -12 + k, 12, 4, HP.tunic); r(-6, -9 + k, 12, 1, HP.tunicSh); r(2, -20 + k, 3, 12, HP.tunicSh);
    r(-5, -14 + k, 10, 2, HP.belt); r(-5, -14 + k, 10, 1, HP.beltHi); r(1, -20 + k, 4, 2, HP.skin);
    r(-7, -19 + k, 2, 9, HP.skinSh); r(5, -19 + k, 2, 9, HP.skinSh); r(-7, -10 + k, 2, 2, HP.skin); r(5, -10 + k, 2, 2, HP.skin);
    r(-7, -12 + k, 2, 1, HP.iron); r(5, -12 + k, 2, 1, HP.iron);
    r(-1, -22 + k, 3, 2, HP.skinSh);
    r(-4, -31 + k, 9, 9, HP.hair); r(-5, -30 + k, 1, 6, HP.hair); r(5, -30 + k, 1, 6, HP.hair); r(-3, -32 + k, 7, 1, HP.hair);
    [[-2,-30],[1,-31],[3,-29],[-3,-27],[0,-28]].forEach(([x, y]) => r(x, y + k, 1, 1, HP.hairHi));
    [[-1,-29],[2,-30],[-4,-28],[4,-27],[0,-25]].forEach(([x, y]) => r(x, y + k, 1, 1, HP.hairSh));
    r(-5, -26 + k, 1, 3, HP.skin); r(5, -26 + k, 1, 3, HP.skin);
  });
}

// ============================================ SPRITES: estátuas e sombras
function shapeHorse(g) {
  g.beginPath(); g.ellipse(20, 19, 12, 6.5, 0, 0, TAU); g.fill();
  poly(g, [[27,16],[32,6],[36,5],[37,10],[31,20]]);
  poly(g, [[32,5],[35,2],[37,1],[39,3],[43,8],[43,11],[39,11],[35,9]]);
  poly(g, [[34,3],[34,-1],[36,2]]);
  poly(g, [[28,9],[33,4],[33,8],[30,14]]);
  g.fillRect(10, 22, 3, 13); g.fillRect(14, 23, 3, 12); g.fillRect(25, 23, 3, 12); poly(g, [[29,21],[32,21],[36,28],[34,30],[31,26]]);
  poly(g, [[9,16],[5,19],[3,29],[6,28],[9,21]]);
}
function shapeSpear(g) {
  g.beginPath(); g.arc(11, 12, 4.2, 0, TAU); g.fill();
  poly(g, [[7,17],[15,17],[17,38],[5,38]]);
  g.fillRect(7, 38, 3, 16); g.fillRect(12, 38, 3, 16);
  poly(g, [[15,18],[19,24],[18,26],[14,21]]);
  g.fillRect(18.5, 6, 1.7, 50); poly(g, [[17,8],[19.3,0],[21.6,8]]);
}
function shapeShield(g) {
  g.beginPath(); g.arc(12, 7, 4.2, 0, TAU); g.fill();
  poly(g, [[7,12],[17,12],[19,34],[5,34]]);
  g.fillRect(7, 34, 3, 15); g.fillRect(13, 34, 3, 15);
  g.beginPath(); g.ellipse(21, 24, 7, 9, 0, 0, TAU); g.fill();
  poly(g, [[6,13],[2,24],[4,25],[8,17]]);
}
function shapeBird(g) {
  g.beginPath(); g.ellipse(11, 14, 6, 7, -.35, 0, TAU); g.fill();
  g.beginPath(); g.arc(15, 6, 3.4, 0, TAU); g.fill();
  poly(g, [[18,5],[22,7],[18,8]]); poly(g, [[7,17],[1,24],[5,24],[10,19]]);
  g.fillRect(9.5, 20, 1.6, 4); g.fillRect(13, 20, 1.6, 4);
}
function shapeTree(g) {
  g.fillRect(17, 28, 5, 22); poly(g, [[17,46],[11,51],[28,51],[22,46]]);
  [[19.5,16,10],[10,22,7],[29,22,7],[13,12,7],[26,11,7],[19.5,6,6.5],[7,29,5],[32,29,5]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); });
}
// Estátua iluminada pela fogueira (luz da direita): base clara + duas sombras deslocadas + textura
function makeStatue(fn, w, h, s) {
  const [c, g] = mk(Math.ceil(w * s) + 10, Math.ceil(h * s) + 10); g.translate(5, 5); g.scale(s, s);
  g.fillStyle = '#e2b88c'; fn(g);
  g.globalCompositeOperation = 'source-atop';
  g.save(); g.translate(-.9, 0); g.fillStyle = '#a5806a'; fn(g); g.restore();
  g.save(); g.translate(-2.6, .9); g.fillStyle = '#674e48'; fn(g); g.restore();
  hardAlpha(c);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data, R = rng(w * 31 + h);
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] && R() < .1) { a[i] *= .8; a[i + 1] *= .8; a[i + 2] *= .8; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(d, 0, 0);
  return outlined(c, '#170e12');
}
function makeShadow(fn, w, h, s) {
  const [c, g] = mk(Math.ceil(w * s) + 6, Math.ceil(h * s) + 6); g.translate(3, 3); g.scale(s, s); g.fillStyle = '#000'; fn(g);
  return hardAlpha(c);
}

// ============================================= SPRITES: mundo exterior
function stag(pose, frame) {
  const [c, g] = mk(34, 34), r = (x, y, w, h, col) => rect(g, x, y, w, h, col);
  const B = '#a8683c', Bs = '#7e4a26', Lb = '#ecd0a4', D = '#3a2212', A = '#d8c4a0', oy = 8;
  r(6, oy + 10, 17, 7, B); r(7, oy + 15, 15, 2, Bs); r(9, oy + 16, 11, 1, Lb); r(5, oy + 11, 2, 5, B); r(4, oy + 10, 2, 3, Lb);
  r(8, oy + 10, 10, 1, '#c4864e');
  const leg = (x, y, h) => { r(x, y, 2, h, Bs); r(x, y + h - 1, 2, 1, D); };
  if (pose === 'run') {
    if (frame) { r(5, oy + 16, 2, 5, Bs); r(2, oy + 20, 4, 2, Bs); r(9, oy + 16, 2, 5, Bs); r(6, oy + 20, 4, 2, Bs); r(20, oy + 16, 2, 4, Bs); r(22, oy + 19, 4, 2, Bs); r(17, oy + 16, 2, 4, Bs); r(19, oy + 19, 4, 2, Bs); }
    else { leg(9, oy + 16, 8); leg(11, oy + 16, 8); leg(17, oy + 16, 8); leg(19, oy + 16, 8); }
  } else { leg(8, oy + 16, 9); leg(11, oy + 16, 9); leg(18, oy + 16, 9); leg(21, oy + 16, 9); }
  if (pose === 'graze') {
    r(21, oy + 12, 3, 8, B); r(22, oy + 19, 5, 4, B); r(26, oy + 21, 1, 1, D); r(23, oy + 18, 2, 2, B);
    r(22, oy + 15, 1, 3, A); r(24, oy + 14, 1, 4, A); r(21, oy + 14, 2, 1, A); r(25, oy + 13, 1, 2, A);
  } else {
    r(21, oy + 3, 3, 9, B); r(22, oy + 1, 6, 4, B); r(27, oy + 3, 2, 2, B); r(28, oy + 3, 1, 1, D); r(21, oy, 2, 2, B); r(25, oy + 2, 1, 1, D);
    r(22, oy - 6, 1, 6, A); r(20, oy - 5, 2, 1, A); r(19, oy - 7, 1, 2, A); r(24, oy - 6, 1, 3, A); r(25, oy - 7, 1, 2, A); r(23, oy - 3, 2, 1, A); r(26, oy - 4, 1, 1, A);
  }
  return outlined(c, '#2a160a');
}
function rabbit(hop) {
  const [c, g] = mk(12, 11), r = (x, y, w, h, col) => rect(g, x, y, w, h, col);
  const B = '#c8b8a4', D = '#8a7868';
  if (hop) { r(1, 5, 7, 3, B); r(7, 3, 3, 3, B); r(7, 0, 1, 3, B); r(8, 0, 1, 3, D); r(0, 5, 1, 1, '#fff'); r(1, 8, 3, 1, D); r(7, 7, 3, 1, D); r(9, 4, 1, 1, '#1a0f0c'); }
  else { r(1, 6, 7, 4, B); r(6, 4, 3, 3, B); r(6, 0, 1, 4, B); r(7, 0, 1, 4, D); r(0, 6, 1, 1, '#fff'); r(2, 9, 5, 1, D); r(8, 5, 1, 1, '#1a0f0c'); }
  return outlined(c, '#3a2e26');
}
function cloudArt(R, w) {
  const [c, g] = mk(w + 12, 34);
  const blobs = []; for (let i = 0; i < 8; i++) blobs.push([8 + R() * (w - 12), 15 + R() * 6, 6 + R() * 7]);
  for (const b of blobs) ell(g, b[0] + 1, b[1] + 4, b[2] * 1.3, b[2] * .85, '#c8b0d6');
  for (const b of blobs) ell(g, b[0], b[1] + 2, b[2] * 1.3, b[2] * .85, '#ecd2dc');
  for (const b of blobs) ell(g, b[0] - 1, b[1], b[2] * 1.2, b[2] * .8, '#fff4ec');
  for (const b of blobs) ell(g, b[0] - b[2] * .4, b[1] - b[2] * .35, b[2] * .5, b[2] * .35, '#ffffff');
  g.clearRect(0, 28, w + 12, 6);
  return c;
}

const S = {};
function buildSprites() {
  const sp = sidePose;
  S.idle = [sp({}), sp({ bob: 1 })];
  S.walk = [sp({ fF: 3, fB: -3, swF: -2, swB: 2 }), sp({ bob: 1, fF: 1, fB: -1 }), sp({ fF: -3, fB: 3, swF: 2, swB: -2 }), sp({ bob: 1, fF: -1, fB: 1 })];
  S.wall = [sp({ fF: 2, fB: -2, armF: 'wall' }), sp({ armF: 'wall', bob: 1 }), sp({ fF: -2, fB: 2, armF: 'wall' }), sp({ armF: 'wall', bob: 1 })];
  S.wallIdle = S.wall[1];
  S.wob = [sp({ lean: -1, armF: 'out', armB: 'out', fF: 2, fB: -3, eyes: 'wide' }), sp({ lean: 1, armF: 'out', armB: 'out', fF: -3, fB: 2, eyes: 'wide', mouth: 'open' })];
  S.jump = sp({ fF: 3, fB: -1, armF: 'up', armB: 'out', tuck: 1 });
  S.fall = sp({ fF: 2, fB: -3, armF: 'out', armB: 'up', eyes: 'wide', mouth: 'open' });
  S.shock = [sp({ armF: 'up', armB: 'up', eyes: 'wide', mouth: 'open' }), sp({ armF: 'up', armB: 'up', eyes: 'wide', mouth: 'open', bob: 1 })];
  S.awe = sp({ eyes: 'wide', mouth: 'open' });
  S.coverWalk = [sp({ fF: 3, fB: -3, swB: 2, armF: 'eyes', eyes: 'closed' }), sp({ bob: 1, armF: 'eyes', eyes: 'closed' }), sp({ fF: -3, fB: 3, swB: -2, armF: 'eyes', eyes: 'closed' }), sp({ bob: 1, armF: 'eyes', eyes: 'closed' })];
  S.coverIdle = sp({ armF: 'eyes', eyes: 'closed' });
  S.kneel = sp({ kneel: 1, eyes: 'squint' });
  S.reach = sp({ armF: 'point', eyes: 'n' });
  S.hurt = [sp({ armF: 'clutch', armB: 'out', eyes: 'hurt', mouth: 'grit', lean: -1, burn: 1 }), sp({ armF: 'clutch', armB: 'out', eyes: 'hurt', mouth: 'open', burn: 1, bob: 1 })];
  S.lie = lying(false); S.lieOpen = lying(true);
  S.sit = {};
  for (const a of ['down', 'reach', 'hold', 'up', 'strike']) S.sit[a] = backSit({ arm: a });
  S.sitFree = backSit({ arm: 'down', broken: 1 });
  S.npc = {};
  for (const n of ['mistico', 'arrogante']) S.npc[n] = { 0: backSit({ npc: n }), 1: backSit({ npc: n, turn: 1 }), '-1': backSit({ npc: n, turn: -1 }) };
  S.kneelBack = backStand({ kneel: 1 }); S.standBack = backStand({});
  const bp = { k: '#140c10', w: '#fff7e6', r: '#c4381e' };
  S.bubble = {
    '!': fromMap(['.kkkkkkk.','kwwwwwwwk','kwwwrwwwk','kwwwrwwwk','kwwwrwwwk','kwwwwwwwk','kwwwrwwwk','kwwwwwwwk','.kkkwkkk.','....k....'], bp),
    '?': fromMap(['.kkkkkkk.','kwwwwwwwk','kwwrrrwwk','kwwwwrwwk','kwwwrrwwk','kwwwwwwwk','kwwwrwwwk','kwwwwwwwk','.kkkwkkk.','....k....'], bp),
  };
  const lens = ['.kkkkk.', 'kwwwwwk', 'kwkkkwk', 'kkk.kwk', '..kkwk.', '..kwk..', '..kkk..', '..kwk..', '..kkk..'];
  S.lens = fromMap(lens, { k: '#1a0f0c', w: '#ffd38a' });
  S.lensSeen = fromMap(lens, { k: '#1a0f0c', w: '#8a7a70' });
  S.arrow = fromMap(['kkkkkkkkk', 'kwwwwwwwk', '.kwwwwwk.', '..kwwwk..', '...kwk...', '....k....'], { k: '#1a0f0c', w: '#ffd38a' });
  S.stone = fromMap(['...kkkk...', '.kkhhbbkk.', 'khhhbbbbsk', 'khbbbbbbsk', 'kbbbbbbssk', '.kbbsssskk', '..kkkkkk..'], { k: '#1a1014', h: '#efe2c4', b: '#a89880', s: '#6e6052' });
  const SC = 1.3;
  S.statue = { shield: makeStatue(shapeShield, 30, 50, SC), horse: makeStatue(shapeHorse, 46, 36, SC), spear: makeStatue(shapeSpear, 24, 56, SC), tree: makeStatue(shapeTree, 40, 52, SC), bird: makeStatue(shapeBird, 24, 26, SC) };
  S.shadow = { shield: makeShadow(shapeShield, 30, 50, 1.4), horse: makeShadow(shapeHorse, 46, 36, 1.5), spear: makeShadow(shapeSpear, 24, 56, 1.35), tree: makeShadow(shapeTree, 40, 52, 1.4), bird: makeShadow(shapeBird, 24, 26, 1.5) };
  S.stag = { graze: stag('graze'), alert: stag('alert'), run: [stag('run', 0), stag('run', 1)] };
  S.rabbit = [rabbit(false), rabbit(true)];
  const R = rng(99); S.clouds = [cloudArt(R, 70), cloudArt(R, 46), cloudArt(R, 96), cloudArt(R, 58), cloudArt(R, 38)];
  S.bird = [fromMap(['k.....k', '.k...k.', '..k.k..', '...k...'], { k: '#2b2d3a' }), fromMap(['.......', 'kkk.kkk', '...k...', '.......'], { k: '#2b2d3a' })];
  S.perch = fromMap(['..kk...', '.kbbk..', 'kbbwbk.', '.kbbbbk', '..kkkk.', '...k.k.'], { k: '#1e1a24', b: '#4a6aa8', w: '#e8e4d8' });
}

// ========================================================= RETRATOS 32×32
const CHAR = {
  code:     { bg1:'#3a2214', bg2:'#2a160c', skin:HP.skin, skinSh:HP.skinSh, skinHi:HP.skinHi, hair:HP.hair, hairSh:HP.hairSh, hairHi:HP.hairHi, style:'curly', tunic:HP.tunic, tunicSh:HP.tunicSh },
  mistico:  { bg1:'#2a1a3a', bg2:'#1c1028', skin:'#d89a6a', skinSh:'#a86a40', skinHi:'#ecc08e', hair:'#9a9088', hairSh:'#5f5750', hairHi:'#d0c6bc', style:'wild', band:'#6a3f9a', tunic:'#ddd2bc', tunicSh:'#a89c84' },
  arrogante:{ bg1:'#3a1410', bg2:'#280c08', skin:'#e0a874', skinSh:'#a8703e', skinHi:'#f2c898', hair:'#1c110b', hairSh:'#0e0805', hairHi:'#5a3a24', style:'neat', tunic:'#e6dcc2', tunicSh:'#b0a284', accent:'#a83a2a' },
};
const MOODS = {
  normal:{ e:'n', b:'n', m:'n' }, worried:{ e:'n', b:'worry', m:'frown' }, shock:{ e:'wide', b:'up', m:'open' },
  happy:{ e:'happy', b:'n', m:'smile' }, hurt:{ e:'hurt', b:'angry', m:'grit', x:'sweat' }, determined:{ e:'n', b:'angry', m:'n' },
  dazzled:{ e:'closed', b:'worry', m:'open', x:'tear' }, think:{ e:'side', b:'up1', m:'smirk' }, awe:{ e:'wide', b:'up', m:'small' },
  ecstatic:{ e:'up', b:'up', m:'grin', x:'sparkle' }, whisper:{ e:'squint', b:'n', m:'smile' },
  smug:{ e:'lid', b:'up1', m:'smirk' }, angry:{ e:'n', b:'angry', m:'shout' }, laugh:{ e:'happy', b:'up', m:'grin' }, scorn:{ e:'lid', b:'angry', m:'frown' },
};
const PORT = {};
function portrait(who, mood = 'normal') {
  const key = who + '|' + mood; if (PORT[key]) return PORT[key];
  const [c, g] = mk(32, 32), r = (x, y, w, h, col) => rect(g, x, y, w, h, col);
  if (who === 'sistema') {
    r(0, 0, 32, 32, '#10262a'); dither(g, 0, 20, 32, 12, '#0a1a1d');
    ell(g, 16, 16, 13, 8, '#0a1214'); ell(g, 16, 16, 12, 7, '#efe4cf'); ell(g, 16, 17, 12, 5, '#d8ccb6');
    ell(g, 16, 16, 5, 5, '#c97a20'); ell(g, 16, 16, 4, 4, '#f2a33a'); ell(g, 16, 16, 2, 2, '#140c10'); r(17, 13, 2, 2, '#fff');
    for (const [x, y] of [[6, 7], [11, 5], [16, 4], [21, 5], [26, 7]]) r(x, y, 1, 2, '#7fd4c8');
  } else if (who === 'narrador') {
    r(0, 0, 32, 32, '#1a0c08'); dither(g, 0, 0, 32, 10, '#120806');
    ell(g, 16, 20, 9, 9, '#8a2414'); ell(g, 16, 19, 8, 8, '#b8361b'); ell(g, 16, 18, 6, 7, '#f57f24'); ell(g, 16, 19, 4, 5, '#ffcf4a'); ell(g, 16, 21, 2, 3, '#fff6c8');
    g.fillStyle = '#b8361b'; poly(g, [[12, 14], [16, 3], [20, 14]]); g.fillStyle = '#f57f24'; poly(g, [[13, 15], [16, 6], [19, 15]]);
    r(7, 27, 18, 3, '#3a2214'); r(7, 27, 18, 1, '#6a4428'); r(10, 26, 3, 5, '#5a3a24');
  } else {
    const ch = CHAR[who] || CHAR.code, M = MOODS[mood] || MOODS.normal;
    r(0, 0, 32, 32, ch.bg1); for (let y = 18; y < 32; y++) for (let x = y & 1; x < 32; x += 2) if (y > 23 || (x + y) % 4 === 0) r(x, y, 1, 1, ch.bg2);
    ell(g, 16, 34, 15, 9, ch.tunic); ell(g, 23, 34, 7, 7, ch.tunicSh);
    if (ch.accent) for (let k = 0; k < 8; k++) r(17 + k, 25 + k, 3, 1, ch.accent);
    r(13, 21, 6, 7, ch.skin); r(13, 21, 6, 2, ch.skinSh);
    ell(g, 16, 15, 8, 9.5, ch.skin);
    for (let y = 8; y <= 24; y++) { const hw = 8 * Math.sqrt(Math.max(0, 1 - ((y - 15) / 9.5) ** 2)); if (hw > 2) r(Math.round(16 + hw) - 2, y, 2, 1, ch.skinSh); }
    r(14, 24, 4, 1, ch.skinSh); r(11, 8, 4, 2, ch.skinHi);
    r(7, 13, 2, 5, ch.skin); r(7, 14, 1, 3, ch.skinSh); r(23, 13, 2, 5, ch.skinSh);
    const Hc = ch.hair, Hs = ch.hairSh, Hh = ch.hairHi;
    if (ch.style === 'curly') {
      ell(g, 16, 6, 10.5, 5.5, Hc); ell(g, 7.5, 11, 2.6, 5, Hc); ell(g, 24.5, 11, 2.6, 5, Hc);
      [[9,10],[12,10.5],[15,10],[18,10.5],[21,10],[23.5,9.5]].forEach(([x, y]) => ell(g, x, y, 2.2, 1.8, Hc));
      [[8,4],[12,2],[16,3],[20,2],[24,5],[11,6],[19,6],[14,7],[22,8],[6,9]].forEach(([x, y]) => { r(x, y, 2, 1, Hh); r(x + 1, y + 1, 1, 1, Hs); });
      [[10,8],[17,8],[25,10],[7,12],[13,5],[21,4]].forEach(([x, y]) => r(x, y, 1, 1, Hs));
    } else if (ch.style === 'wild') {
      ell(g, 16, 5, 11, 5, Hc); r(4, 7, 6, 21, Hc); r(22, 7, 6, 21, Hc); r(4, 28, 2, 2, Hc); r(8, 28, 2, 1, Hc); r(23, 28, 2, 2, Hc); r(27, 27, 1, 2, Hc);
      for (const x of [5, 7, 24, 26]) r(x, 9, 1, 17, Hh); for (const x of [6, 25]) r(x, 10, 1, 16, Hs);
      r(9, 3, 3, 1, Hh); r(16, 2, 4, 1, Hh);
      r(6, 8, 20, 2, ch.band); r(6, 8, 20, 1, '#9a6ac8'); r(25, 8, 3, 4, ch.band); r(27, 11, 1, 3, ch.band);
      ell(g, 16, 24, 7.5, 6, Hc); r(12, 19, 8, 1, Hc); r(14, 25, 1, 3, Hh); r(18, 24, 1, 3, Hh); r(16, 27, 2, 1, Hs);
      r(11, 17, 3, 1, ch.skinSh); r(19, 17, 3, 1, ch.skinSh);
    } else {
      ell(g, 16, 6.5, 9.5, 5, Hc); r(7, 7, 3, 7, Hc); r(22, 7, 3, 7, Hc); r(9, 9, 14, 1, Hc);
      r(12, 3, 1, 6, Hh); r(17, 3, 4, 1, Hh); r(19, 4, 3, 1, Hh);
      r(14, 23, 4, 2, Hc); r(15, 25, 2, 1, Hc); r(13, 19, 6, 1, Hc);
    }
    // olhos
    const eyeAt = (cx, side) => {
      const EYE = '#1a0f0c', WH = '#fffaf0';
      switch (M.e) {
        case 'wide': r(cx - 1, 13, 3, 3, WH); r(cx, 14, 1, 1, EYE); break;
        case 'closed': r(cx - 1, 15, 3, 1, EYE); break;
        case 'happy': r(cx - 1, 15, 1, 1, EYE); r(cx, 14, 1, 1, EYE); r(cx + 1, 15, 1, 1, EYE); break;
        case 'hurt': if (side < 0) { r(cx - 1, 13, 1, 1, EYE); r(cx, 14, 1, 1, EYE); r(cx - 1, 15, 1, 1, EYE); } else { r(cx + 1, 13, 1, 1, EYE); r(cx, 14, 1, 1, EYE); r(cx + 1, 15, 1, 1, EYE); } break;
        case 'up': r(cx - 1, 13, 3, 3, WH); r(cx, 13, 1, 1, EYE); break;
        case 'squint': r(cx - 1, 15, 3, 1, EYE); r(cx, 14, 1, 1, EYE); break;
        case 'lid': r(cx - 1, 15, 3, 1, WH); r(cx, 15, 1, 1, EYE); r(cx - 1, 14, 3, 1, ch.skinSh); r(cx - 2, 14, 1, 1, EYE); break;
        case 'side': r(cx - 1, 14, 3, 2, WH); r(cx - 1, 14, 1, 1, EYE); break;
        default: r(cx - 1, 14, 3, 2, WH); r(cx, 14, 1, 2, EYE);
      }
    };
    eyeAt(12, -1); eyeAt(20, 1);
    const BR = Hs;
    switch (M.b) {
      case 'up': r(10, 11, 4, 1, BR); r(18, 11, 4, 1, BR); break;
      case 'up1': r(10, 12, 4, 1, BR); r(18, 11, 4, 1, BR); break;
      case 'angry': r(10, 11, 2, 1, BR); r(12, 12, 2, 1, BR); r(18, 12, 2, 1, BR); r(20, 11, 2, 1, BR); break;
      case 'worry': r(10, 12, 2, 1, BR); r(12, 11, 2, 1, BR); r(18, 11, 2, 1, BR); r(20, 12, 2, 1, BR); break;
      default: r(10, 12, 4, 1, BR); r(18, 12, 4, 1, BR);
    }
    if (ch.style === 'neat') { r(16, 14, 2, 4, ch.skinSh); r(15, 18, 3, 1, ch.skinSh); } else { r(16, 15, 1, 3, ch.skinSh); r(15, 18, 3, 1, ch.skinSh); }
    const MO = '#8a2e24', LN = '#8a4a3a', TE = '#fffaf0';
    switch (M.m) {
      case 'frown': r(13, 22, 1, 1, LN); r(14, 21, 4, 1, LN); r(18, 22, 1, 1, LN); break;
      case 'smile': r(13, 20, 1, 1, LN); r(14, 21, 4, 1, LN); r(18, 20, 1, 1, LN); break;
      case 'open': r(14, 20, 4, 3, MO); r(15, 21, 2, 1, '#3a0f0c'); break;
      case 'small': r(15, 20, 2, 2, MO); break;
      case 'grin': r(13, 20, 6, 2, TE); r(13, 22, 6, 1, MO); r(12, 20, 1, 1, MO); r(19, 20, 1, 1, MO); break;
      case 'grit': r(13, 20, 6, 2, TE); r(14, 20, 1, 2, MO); r(16, 20, 1, 2, MO); r(18, 20, 1, 2, MO); r(13, 22, 6, 1, MO); break;
      case 'smirk': r(14, 21, 4, 1, LN); r(18, 20, 1, 1, LN); break;
      case 'shout': r(13, 20, 6, 4, MO); r(14, 22, 4, 2, '#c04a3a'); break;
      default: r(14, 21, 4, 1, LN);
    }
    if (M.x === 'sweat') { r(25, 7, 1, 1, '#cfeaff'); r(24, 8, 2, 3, '#9fd4ff'); }
    if (M.x === 'tear') { r(10, 16, 1, 3, '#9fd4ff'); r(21, 16, 1, 3, '#9fd4ff'); }
    if (M.x === 'sparkle') for (const [x, y] of [[3, 4], [28, 5], [27, 24], [3, 22]]) { r(x, y, 1, 1, '#ffe9a0'); r(x - 1, y + 1, 3, 1, '#ffe9a0'); r(x, y + 2, 1, 1, '#ffe9a0'); }
  }
  PORT[key] = c; return c;
}
