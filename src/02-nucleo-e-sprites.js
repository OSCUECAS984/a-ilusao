(() => {
'use strict';
/* =====================================================================
   A ILUSÃO · O Interior da Caverna  (versão 3 · reformulação em pixel art)
   Toda a arte é gerada em código num buffer de 384×216 px, ampliado sem
   suavização. Regra de escala: todos os sprites do Code são desenhados 1:1
   (1 pixel de arte = 1 pixel do buffer) e ancorados nos pés, em canvases
   do mesmo tamanho. Sentado, de pé, caído ou pulando: a escala nunca muda.
   Cenário: nada de esferas. A rocha nasce de máscaras de terreno com perfis
   angulosos e é pintada em facetas (terrain); as camadas são pré-renderizadas
   uma vez, e por quadro só há blits, partículas e o mapa de luz pontilhado.
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
// Cor empacotada (ABGR) para escrever direto no ImageData.
const C32 = h => (0xff000000 | parseInt(h.slice(5, 7), 16) << 16 | parseInt(h.slice(3, 5), 16) << 8 | parseInt(h.slice(1, 3), 16)) >>> 0;
const ramp = (...h) => { const r = h.map(C32); r.hex = h; return r; };
// Rampas de 6 tons: 0 = contorno … 5 = aresta iluminada.
// Toda rocha do jogo é feita de facetas angulosas e lascas; não há mais nenhuma "bola".
const RK = {
  cave:  ramp('#0c0814', '#1a1126', '#281a38', '#38264c', '#4c3564', '#674a84'),
  mid:   ramp('#090611', '#120b1b', '#1b1227', '#261934', '#322143', '#422c56'),
  far:   ramp('#07050d', '#0d0916', '#130c1e', '#191027', '#201530', '#2a1c3d'),
  wall:  ramp('#1a0f14', '#352227', '#483034', '#5a3f3e', '#6e4f49', '#876356'),
  hall:  ramp('#150c13', '#2a1d26', '#3a2932', '#4b363f', '#5f454c', '#77595c'),
  floor: ramp('#140b10', '#2a1a1e', '#3a2629', '#4a3232', '#5e403c', '#7a574c'),
  spike: ramp('#0c0813', '#1d1529', '#2e2340', '#463758', '#655478', '#8b7aa0'),
  lit:   ramp('#150b0f', '#2e1c1c', '#4a2f28', '#6b4634', '#916243', '#bd8757'),
  sun:   ramp('#2a1810', '#4a2e20', '#66432d', '#83593a', '#a3744a', '#c6965f'),
  earth: ramp('#2b1a12', '#47301f', '#5f4129', '#785434', '#916a42', '#ad8454'),
  mesa:  ramp('#4a3058', '#664068', '#855476', '#a86c7e', '#cf8a80', '#f2b488'),
  leaf:  ramp('#10301c', '#1b4a24', '#2a6a2a', '#488a2e', '#7aae36', '#b8d24a'),
  leafD: ramp('#0c2218', '#14361e', '#1e4e26', '#2c682a', '#46842e', '#6ea036'),
  pine:  ramp('#0e2420', '#163628', '#204a30', '#2c6036', '#3e7a3c', '#5a9644'),
  dusk:  ramp('#2a2450', '#3a3066', '#4e3e7a', '#6a4e8a', '#8a6296', '#b07e9c'),
};
const MOSS = ['#3a4618', '#5e6e26', '#8e9c36', '#c0c858'];
const VINE = ['#263a1a', '#3c5a22', '#6a8a30'];
const HP = { skin:'#f1c59c', skinSh:'#d39a6e', skinHi:'#fbdcb8', hair:'#7b4a2c', hairSh:'#573019', hairHi:'#a06a3e',
  tunic:'#d8c5a4', tunicSh:'#b59f7e', tunicDk:'#8f7a5c', tunicHi:'#ebdcc0', belt:'#6b4027', beltHi:'#8e5c38',
  pants:'#cbb894', pantsSh:'#a38c6b', boot:'#74462a', bootSh:'#4e2c18', bootHi:'#93603c',
  out:'#150c0e', eye:'#1a1014', eyeW:'#fffaf0', lid:'#8a5236', mouth:'#8a2e24', iron:'#5a5f6c', ironHi:'#a3aab6', burn:'#e0502e' };
const NPCP = {
  mistico:   { skin:'#c98e62', skinSh:'#9c6843', skinHi:'#e0aa7c', hair:'#aaa5a0', hairSh:'#76716e', hairHi:'#d8d4ce', tunic:'#d8c5a4' },
  arrogante: { skin:'#e3b189', skinSh:'#b98560', skinHi:'#f4cca6', hair:'#4a2c1c', hairSh:'#2c180e', hairHi:'#6e4830', tunic:'#d8c5a4' },
};

// ------------------------------------------------ ruído e pontilhado
function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177) | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
// perfil anguloso: retas entre pontos sorteados (pedra lascada, nada de senoides)
function jag(x, step, amp, seed) { const i = Math.floor(x / step), f = x / step - i, a = hash2(i, seed, 11), b = hash2(i + 1, seed, 11); return (a + (b - a) * f - .5) * 2 * amp; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (BAYER[(y & 3) << 2 | x & 3] + .5) / 16;
// véu de pixels pontilhados sobre um canvas: fn(x, y) devolve a cobertura 0..1 (profundidade, névoa, sombra)
function veil(g, x0, y0, w, h, col, fn, onlyOpaque) {
  const im = g.getImageData(x0, y0, w, h), d = new Uint32Array(im.data.buffer), c = C32(col);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) if ((!onlyOpaque || d[i] >>> 24) && fn(x + x0, y + y0) > bay(x + x0, y + y0)) d[i] = c;
  g.putImageData(im, x0, y0);
}
// buffer de pixels para gerar terreno ponto a ponto
class Pix {
  constructor(w, h) { this.w = w; this.h = h; const [c, g] = mk(w, h); this.c = c; this.g = g; this.im = g.createImageData(w, h); this.d = new Uint32Array(this.im.data.buffer); }
  done() { this.g.putImageData(this.im, 0, 0); return [this.c, this.g]; }
}
// fileira de estalactites/estalagmites somada a um perfil
function spikeRow(R, x0, x1, gapMin, gapVar, lenMin, lenVar, wMin, wVar) {
  const out = []; let x = x0 + R() * gapVar;
  while (x < x1) { out.push({ x, l: lenMin + R() * R() * lenVar, w: wMin + R() * wVar, k: (R() - .5) * .5 }); x += gapMin + R() * gapVar; }
  return out;
}
function spikeAt(row, x) { let m = 0; for (const s of row) { const d = Math.abs(x - s.x - s.k * 3); if (d < s.w) { const v = s.l * Math.pow(1 - d / s.w, 1.35); if (v > m) m = v; } } return m; }

// ------------------------------------------------- rocha facetada
// Células de Voronoi com métrica "octogonal": dão blocos irregulares de arestas retas.
function facetIds(M, w, h, cw, ch, seed) {
  const id = new Int32Array(w * h), gw = Math.ceil(w / cw) + 4, gh = Math.ceil(h / ch) + 3, px = new Float32Array(gw * gh), py = new Float32Array(gw * gh), asp = cw / ch;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    px[j * gw + i] = (i - 2 + .12 + .76 * hash2(i, j, seed)) * cw + (j & 1 ? cw * .5 : 0);
    py[j * gw + i] = (j - 1 + .15 + .7 * hash2(i, j, seed + 7)) * ch;
  }
  for (let y = 0, k = 0; y < h; y++) {
    const gj = Math.floor(y / ch) + 1;
    for (let x = 0; x < w; x++, k++) {
      if (!M[k]) continue;
      const gi = Math.floor(x / cw) + 2; let best = 1e9, bi = 1;
      for (let j = gj - 1; j <= gj + 1; j++) { if (j < 0 || j >= gh) continue; for (let i = gi - 2; i <= gi + 1; i++) {
        if (i < 0 || i >= gw) continue;
        const q = j * gw + i, dx = Math.abs(x - px[q]), dy = Math.abs(y - py[q]) * asp, d = Math.max(dx, dy) + .5 * Math.min(dx, dy);
        if (d < best) { best = d; bi = q + 1; }
      } }
      id[k] = bi;
    }
  }
  return id;
}
// Transforma uma máscara (sólido/ar) em rocha: contorno escuro, topo iluminado, facetas com aresta clara
// e fenda escura, e um miolo que escurece com a profundidade.
// o: { ramp | rampAt(x,y), cw, ch, seed, lx (lado da luz: -1 esq., 1 dir.), contrast, edge (0..1: quantas fendas), deep, top, x0,y0,x1,y1 }
function terrain(pix, solid, o) {
  const { w, h, d } = pix, cw = o.cw || 13, ch = o.ch || 8, lx = o.lx || -1, seed = o.seed || 1, con = o.contrast ?? 1, deep = o.deep ?? 12, edge = o.edge ?? 1;
  const x0 = Math.max(0, o.x0 || 0), y0 = Math.max(0, o.y0 || 0), x1 = Math.min(w, o.x1 || w), y1 = Math.min(h, o.y1 || h);
  const M = new Uint8Array(w * h), D = new Uint8Array(w * h);
  for (let y = y0; y < y1; y++) for (let x = x0, i = y * w + x0; x < x1; x++, i++) if (solid(x, y)) M[i] = 1;
  const id = facetIds(M, w, h, cw, ch, seed);
  const at = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 1 : M[y * w + x];
  // distância até o ar (chamfer em duas passadas)
  for (let y = y0; y < y1; y++) for (let x = x0, i = y * w + x0; x < x1; x++, i++) if (M[i]) D[i] = Math.min(250, Math.min(x > x0 ? D[i - 1] : 250, y > y0 ? D[i - w] : 250) + 1);
  for (let y = y1 - 1; y >= y0; y--) for (let x = x1 - 1, i = y * w + x; x >= x0; x--, i--) if (M[i]) D[i] = Math.min(D[i], Math.min(x < x1 - 1 ? D[i + 1] : 250, y < y1 - 1 ? D[i + w] : 250) + 1);
  for (let y = y0; y < y1; y++) for (let x = x0, i = y * w + x0; x < x1; x++, i++) {
    if (!M[i]) continue;
    const R = o.rampAt ? o.rampAt(x, y) : o.ramp, c = id[i], up = at(x, y - 1), dn = at(x, y + 1), lf = at(x - 1, y), rt = at(x + 1, y);
    const hs = hash2(c, seed, 3);
    let t = 2 + (hs < .24 * con ? -1 : hs > 1 - .22 * con ? 1 : 0);
    if (up && id[i - w] !== c) { if (hash2(c, seed, 5) < .75 * edge) t += 1; }          // aresta de cima da faceta
    else if (dn && id[i + w] !== c) { if (hash2(c, seed, 6) < edge) t -= 1; }             // fenda embaixo
    if ((lx < 0 ? rt : lf) && id[i + (lx < 0 ? 1 : -1)] !== c && hash2(c, seed, 9) < .6) t -= 1;   // fenda do lado da sombra
    if ((lx < 0 ? lf : rt) && id[i + (lx < 0 ? -1 : 1)] !== c && hash2(c, seed, 13) < .3 * con) t += 1;
    if (hash2(x, y, seed) < .045) t -= 1;                                                 // grão
    const dd = D[i] + (bay(x, y) - .5) * 5;
    if (deep) { if (dd > deep) t -= 1; if (dd > deep * 2.3) t -= 1; if (dd > deep * 4) t -= 1; }
    const litOpen = lx < 0 ? !lf : !rt, shOpen = lx < 0 ? !rt : !lf;
    if (!up) t = o.top ?? (shOpen && !litOpen ? 3 : 5);                                   // superfície de cima
    else if (!at(x, y - 2)) t = Math.max(t + 1, 3);
    else if (!dn) t = 0;                                                                  // barriga
    else if (litOpen) t = Math.max(t, 3);
    else if (shOpen) t = 0;
    d[i] = R[t < 0 ? 0 : t > 5 ? 5 : t];
  }
  return M;
}

// --------------------------------------------- peças de cenário
// estaca irregular: afina em degraus, entorta, um lado claro e outro escuro (dir -1 aponta para cima, 1 para baixo)
function spike(g, x, base, w, h, P, dir, R) {
  const rows = []; let cx = x; const bend = (R() - .5) * .6;
  for (let i = 0; i < h; i++) { const k = i / h; rows.push([cx, Math.max(1, Math.round(w * Math.pow(1 - k, 1.2) + (R() < .18 ? 1 : 0)))]); cx += bend * (R() < .5 ? 1 : 0); }
  const H2 = P.hex;
  rows.forEach(([c, ww], i) => { const y = dir < 0 ? base - 1 - i : base + i; rect(g, Math.round(c - ww / 2) - 1, y, ww + 2, 1, H2[0]); });
  rows.forEach(([c, ww], i) => {
    const y = dir < 0 ? base - 1 - i : base + i, xa = Math.round(c - ww / 2), k = i / h;
    rect(g, xa, y, ww, 1, H2[2]); rect(g, xa, y, Math.max(1, Math.round(ww * .34)), 1, H2[k > .55 ? 5 : 4]);
    if (ww > 3) rect(g, xa + ww - 1, y, 1, 1, H2[1]); if (ww > 5 && (i & 3) === 1) rect(g, xa + (ww >> 1), y, 1, 1, H2[1]);
  });
  const tip = rows[rows.length - 1]; rect(g, Math.round(tip[0] - tip[1] / 2), dir < 0 ? base - h : base + h - 1, 1, 1, H2[5]);
}
// lasca de pedra solta (polígono pequeno, anguloso)
function chip(g, x, y, w, h, P) {
  const H2 = P.hex; rect(g, x, y - h, w, h, H2[0]); rect(g, x + 1, y - h, w - 2, 1, H2[0]);
  if (w > 2 && h > 1) { rect(g, x + 1, y - h + 1, w - 2, h - 1, H2[2]); rect(g, x + 1, y - h + 1, Math.max(1, w - 3), 1, H2[4]); rect(g, x + w - 2, y - 1, 1, 1, H2[1]); }
}
function mossTop(g, x0, x1, y, R, lush = 1) {
  for (let x = Math.round(x0); x < x1; x++) {
    rect(g, x, y - 1, 1, 2, MOSS[2]); if (R() < .4) rect(g, x, y - 1, 1, 1, MOSS[3]);
    if (R() < .2 * lush) rect(g, x, y - 2 - (R() < .3 ? 1 : 0), 1, 2, R() < .5 ? MOSS[3] : MOSS[2]);
    const dr = R(); rect(g, x, y + 1, 1, dr < .5 ? 1 : dr < .82 ? 2 : 3 + ((R() * 3) | 0), MOSS[1]);
    if (dr > .94) rect(g, x, y + 2, 1, 4 + ((R() * 7) | 0), MOSS[0]);
  }
}
function vine(g, x, y, len, R) {
  let cx = Math.round(x);
  for (let i = 0; i < len; i++) { if (R() < .22) cx += R() < .5 ? -1 : 1; rect(g, cx, y + i, 1, 1, VINE[i % 3 ? 0 : 1]); if (i % 4 === 2) rect(g, cx + (R() < .5 ? -1 : 1), y + i, 1, 1, VINE[2]); }
  rect(g, cx - 1, y + len, 2, 1, VINE[1]);
}
// cogumelo luminoso (o brilho é somado no desenho)
function shroom(g, x, y, big) {
  const C = ['#3a2466', '#7a4ec8', '#b48cff', '#ead8ff'];
  if (big) { rect(g, x, y - 4, 1, 4, '#cdb8e8'); rect(g, x - 2, y - 6, 5, 2, C[1]); rect(g, x - 1, y - 7, 3, 1, C[2]); rect(g, x - 1, y - 6, 1, 1, C[3]); rect(g, x - 2, y - 4, 5, 1, C[0]); }
  else { rect(g, x, y - 2, 1, 2, '#cdb8e8'); rect(g, x - 1, y - 4, 3, 2, C[1]); rect(g, x, y - 4, 1, 1, C[3]); }
}
// jarro de barro em degraus (silhueta de pixel, sem elipses)
function amphora(g, x, y) {
  const O = '#140c10', B = '#8a4a2a', D = '#5e2f1a', L = '#b8683c', Hh = '#d88a50', BAND = '#3a1c10';
  const rows = [9, 5, 5, 5, 7, 11, 13, 15, 15, 15, 15, 13, 13, 11, 9, 7, 5, 7];
  rows.forEach((w, i) => { const yy = y - rows.length + i; rect(g, x - (w >> 1) - 1, yy, w + 2, 1, O); });
  rect(g, x - 4, y - rows.length - 1, 9, 1, O);
  rows.forEach((w, i) => {
    const yy = y - rows.length + i, xa = x - (w >> 1);
    rect(g, xa, yy, w, 1, B); rect(g, xa, yy, Math.max(1, w >> 2), 1, D); if (w > 6) { rect(g, xa + w - 3, yy, 2, 1, L); if (i > 5 && i < 10) rect(g, xa + w - 3, yy, 1, 1, Hh); }
  });
  rect(g, x - 4, y - 18, 9, 1, Hh); rect(g, x - 7, y - 11, 15, 1, BAND); rect(g, x - 7, y - 8, 15, 1, BAND); for (let i = -6; i < 7; i += 3) rect(g, x + i, y - 10, 1, 2, BAND);
  rect(g, x - 5, y - 16, 1, 4, O); rect(g, x - 6, y - 15, 1, 3, O); rect(g, x + 5, y - 16, 1, 4, O); rect(g, x + 6, y - 15, 1, 3, O);
}
function ringPlate(g, x, y) {
  rect(g, x - 5, y - 5, 11, 11, '#0e0a12'); rect(g, x - 4, y - 4, 9, 9, '#4d525e'); rect(g, x - 4, y - 4, 9, 1, '#8a90a0'); rect(g, x + 4, y - 4, 1, 9, '#6d7380');
  rect(g, x - 4, y - 3, 1, 8, '#33363e'); rect(g, x - 1, y - 1, 3, 3, '#1b1820'); rect(g, x, y, 1, 1, '#6d7380');
  rect(g, x - 2, y + 5, 5, 1, '#9aa1ad'); rect(g, x - 3, y + 5, 1, 3, '#5a5f6c'); rect(g, x + 3, y + 5, 1, 3, '#5a5f6c'); rect(g, x - 2, y + 8, 5, 1, '#5a5f6c');
}
// rachadura: caminhada aleatória descendo pela pedra
function crack(g, x, y, len, col, R) { for (let i = 0; i < len; i++) { rect(g, x, y, 1, 1, col); y++; const r = R(); if (r < .3) x--; else if (r > .7) x++; if (R() < .12) rect(g, x + (R() < .5 ? -1 : 1), y, 2, 1, col); } }

// ===================================================== SPRITES: Code
// Canvas 40×40 com âncora nos pés em (20,38); após o contorno: 42×42, âncora (21,39).
// Desenho novo (folha de referência): cabeça grande, cabelo castanho espetado, olhos pretos altos,
// túnica bege de manga comprida, faixa marrom na cintura, calça e botas. Contorno escuro de 1 px.
const AX = 20, AY = 38, SPR_W = 42, SPR_AX = 21, SPR_AY = 39;
function heroCanvas(fn) { const [c, g] = mk(40, 40); fn((x, y, w, h, col) => rect(g, AX + x, AY + y, w, h, col)); return outlined(c, HP.out); }
// Cabeças em mapa de pixels: H cabelo, h sombra, L brilho, S pele, s sombra da pele, E olho.
const HEAD = {
  code: [
    '.....H..HH..H...', '...HHHHHHHHHH.H.', '..HHHLLHHHLHHHH.', '.HHHLLHHHLLHHHH.', 'HHHLLHHHHHHHLHHH', '.HHHHHHHHHHHHHH.', 'HHHHHhHHHHHHHHHH', 'HHHhHHHHHhHHHHH.',
    '.HHHHhHSHHHSSHHH', 'HHHHhSSSSHSSSSH.', '.HHhSSSSEESSSES.', 'HHHhSSSSEESSSES.', '.HHHsSSSEESSSES.', '..HhsSSSSSSSSSS.', '...hssSSSSSSSs..', '.....sssSSSs....'],
  codeBack: [
    '....H..HH...H...', '..HHHHHHHHHHHH..', '.HHHLLHHHLLHHHH.', 'HHHLLHHHLLHHHHHH', '.HHLHHHHHHHHLHH.', 'HHHHHHHHHHHHHHHH', 'HHHHhHHHHHhHHHH.', '.HHhHHHHhHHHHhHH',
    'HHHHHhHHHHHhHHH.', '.HHhHHHhHHHHHHHH', 'HHHHhHHHHhHHhHH.', '.HHHHhHHHHHhHHH.', '..HhHHhHHhHHHH..', '...H.hH.Hh.HH...'],
  mistico: [
    '.....HHHHHH.....', '...HHHLLHHHHH...', '..HHLLHHHHLHHH..', '.HHLHHHHHHHHHH..', '.HHHHHHHHHHHHHH.', '.HHHhHHHHHSSSSH.', '.HHHHHHhSLLLSLL.', '.HHhHHHHSSEESSE.',
    '.HHHHHhHSSEESSE.', '.HHHhHHHsSSSSSSS', '.HHHHHHHHHLHHHH.', '.HHhHHhHHLHHHHH.', '.HHHHHHHHHHLHH..', '..HHhHHhHHHHHH..', '..HHHHHHHLHHH...', '...HhHH.HHHHH...',
    '...HH...hHHH....', '....H....HH.....', '..........H.....'],
  misticoBack: [
    '......HHHH......', '....HHHHHHHH....', '...HHLLHHHHHH...', '..HHLLHHHHHHHH..', '..HLLHHHhHHHHH..', '.HHLHHHHhHHHhHH.', '.HHLHhHHhHHHhHH.', '.HHLHhHHhHHHhHH.',
    '.HHLHhHHHHhHhHH.', '.HHHHhHHHHhHhHH.', '.HHHHhHLHHhHHHH.', 'HHHhHhHLHHhHHhHH', 'HHHhHHHLHHhHHhHH', '.HHhHHHLHhHHHhH.', 'HHHhHLHHHhHHHhHH', '.HHhHLHHHhHHhHH.',
    '.HHHHLHhHHHHhHH.', '..HHhHHhHHLHhH..', '..HhHH.HhHL.HH..', '...H.h..H...h...'],
  arrogante: [
    '......HHHHHH....', '....HHHLLHHHHH..', '...HHLLHHHHLHHH.', '..HHLHHHHHHHHHH.', '..HHHHHHHHHHHHH.', '..HHHhHHHHHSSHH.', '..HHHHHSSSSSSSS.', '..HHhHSSSEESSES.',
    '..HHHsSSSEESSES.', '...HHsSSSSSSSSSS', '...hHsSSSSSSSSS.', '....ssSSSHHHHS..', '.....ssSSSHHH...', '.......sSSHH....'],
  arroganteBack: [
    '.....HHHHHH.....', '...HHHLLHHHHH...', '..HHLLHHHHLHHH..', '..HLHHHHHHHHHH..', '.HHHHHHhHHHHHHH.', '.HHHhHHHHHHhHHH.', '.HHHHHHHhHHHHHH.', '.HHhHHHHHHHHhHH.',
    'sSHHHHhHHHhHHHSs', 'sSHHhHHHHHHHHHSs', '..HHHHHhHHHhHH..', '...hHHHHHHHHh...', '....sSSSSSSs....'],
};
const headPal = Q => ({ H: Q.hair, h: Q.hairSh, L: Q.hairHi, S: Q.skin, s: Q.skinSh, E: HP.eye, W: HP.eyeW, M: HP.mouth, l: HP.lid });
const HEADPAL = headPal(HP);
function stamp(r, rows, x0, y0, pal, flip) {
  for (let j = 0; j < rows.length; j++) for (let i = 0, n = rows[j].length; i < n; i++) { const col = pal[rows[j][i]]; if (col) r(flip ? x0 + n - 1 - i : x0 + i, y0 + j, 1, 1, col); }
}
const rotCW = m => m[0].map((_, x) => m.map(r => r[x]).reverse());
const flipH = m => m.map(r => [...r].reverse());
// rosto do Code com expressão (olhos e boca trocados no mapa)
function codeFace(eyes = 'n', mouth = 'n') {
  const m = HEAD.code.map(r => r.split('')), put = (c, r, ch) => { m[r][c] = ch; };
  const wipe = () => { for (let r = 10; r <= 12; r++) { put(8, r, 'S'); put(9, r, 'S'); put(13, r, 'S'); } };
  if (eyes === 'closed') { wipe(); put(8, 12, 'l'); put(9, 12, 'l'); put(13, 12, 'l'); }
  else if (eyes === 'squint') { wipe(); put(8, 11, 'E'); put(9, 11, 'E'); put(13, 11, 'E'); put(8, 10, 'l'); put(9, 10, 'l'); }
  else if (eyes === 'wide') { put(8, 9, 'E'); put(9, 9, 'E'); put(13, 9, 'E'); put(9, 10, 'W'); }
  else if (eyes === 'hurt') { wipe(); put(8, 10, 'E'); put(9, 11, 'E'); put(8, 12, 'E'); put(13, 11, 'E'); }
  if (mouth === 'open') { put(10, 14, 'M'); put(11, 14, 'M'); put(10, 15, 'M'); }
  else if (mouth === 'grit') { put(10, 14, 'W'); put(11, 14, 'W'); put(12, 14, 'W'); }
  else put(11, 14, 's');
  return m;
}
function sLeg(r, f, lift, front, tuck) {
  const pc = front ? HP.pants : HP.pantsSh, bc = front ? HP.boot : HP.bootSh, hx = front ? 0 : -3, d = front ? 1 : -1;
  if (tuck) { r(hx + d, -8, 3, 3, pc); r(hx + 2 * d, -6, 3, 3, bc); r(hx + 3 * d, -4, 3, 1, bc); return; }
  r(hx + Math.round(f * .5), -7, 3, 3 - Math.min(1, lift), pc);
  r(hx + f, -4 - lift, 3, 2, bc); r(hx + f, -2 - lift, 4, 2, bc);
  if (front) r(hx + f, -4 - lift, 1, 2, HP.bootHi);
}
function sArm(r, mode, s, t, L, front, o) {
  const sc = front ? HP.tunicHi : HP.tunicSh, hc = front ? HP.skin : HP.skinSh, y = -16 + t;
  if (mode === 'down') {
    const x = front ? L - 1 : L + 1, dx = front ? s : -s, mx = x + Math.round(dx / 2);
    r(mx, y, 3, 3, sc); r(x + dx, y + 3, 3, 3, sc);
    if (front) { r(mx - 1, y + 1, 1, 2, HP.tunicSh); r(x + dx - 1, y + 3, 1, 3, HP.tunicSh); }
    r(x + dx, y + 6, 3, 2, hc); if (o.cuffs !== false) r(x + dx, y + 5, 3, 1, HP.iron);
  } else if (mode === 'out') {
    if (front) { r(L + 2, y, 7, 3, sc); r(L + 2, y + 2, 7, 1, HP.tunicSh); r(L + 9, y, 2, 3, hc); } else { r(L - 11, y, 7, 3, sc); r(L - 13, y, 2, 3, hc); }
  } else if (mode === 'up') {
    if (front) { r(L + 3, y - 1, 3, 3, sc); r(L + 5, y - 6, 3, 6, sc); r(L + 5, y - 8, 3, 2, hc); }
    else { r(L - 7, y - 1, 3, 3, sc); r(L - 9, y - 6, 3, 6, sc); r(L - 9, y - 8, 3, 2, hc); }
  } else if (mode === 'wall') { r(L + 1, y, 5, 3, sc); r(L + 5, y - 4, 3, 5, sc); r(L + 6, y - 6, 3, 2, hc); }
  else if (mode === 'eyes') { r(L, y, 3, 3, sc); r(L + 2, y - 4, 3, 5, sc); r(L + 1, y - 8, 6, 4, sc); r(L + 1, y - 5, 6, 1, HP.tunicSh); r(L + 6, y - 8, 2, 3, hc); }
  else if (mode === 'clutch') { r(L - 1, y, 3, 4, sc); r(L, y + 3, 5, 3, sc); r(L + 5, y + 2, 3, 4, o.burn ? HP.burn : hc); }
  else if (mode === 'point') { r(L, y, 3, 3, sc); r(L + 2, y + 1, 7, 3, sc); r(L + 9, y + 1, 2, 3, hc); }
}
// Vista lateral (olhando para a direita)
function sidePose(o = {}) {
  return heroCanvas(r => {
    const b = (o.bob || 0) + (o.kneel ? 5 : 0), L = o.lean || 0, br = o.breath ? 1 : 0, t = b + br;
    sArm(r, o.armB || 'down', o.swB || 0, t, L, false, o);
    if (o.kneel) { r(-6, -4, 6, 3, HP.pantsSh); r(-9, -3, 4, 3, HP.bootSh); r(-1, -6, 6, 3, HP.pants); r(3, -4, 3, 2, HP.pants); r(3, -2, 4, 2, HP.boot); }
    else { sLeg(r, o.fB || 0, o.lB || 0, false, o.tuck); sLeg(r, o.fF || 0, o.lF || 0, true, o.tuck); }
    // saia da túnica, faixa com a ponta solta e peito
    r(L - 5, -9 + b, 10, 2, HP.tunic); r(L - 5, -9 + b, 2, 2, HP.tunicSh); r(L - 4, -8 + b, 8, 1, HP.tunicSh);
    r(L - 4, -11 + b, 8, 2, HP.belt); r(L - 4, -11 + b, 8, 1, HP.beltHi); r(L + 2, -11 + b, 2, 2, HP.beltHi); r(L + 2, -9 + b, 1, 2, HP.belt);
    r(L - 4, -17 + t, 8, 6 - br, HP.tunic); r(L - 4, -17 + t, 2, 6 - br, HP.tunicSh); r(L + 3, -16 + t, 1, 4 - br, HP.tunicHi);
    r(L + 1, -17 + t, 2, 1, HP.skin); r(L + 1, -16 + t, 1, 1, HP.skinSh);
    stamp(r, codeFace(o.eyes, o.mouth), L - 8 + (o.hx || 0), -33 + t + (o.hy || 0), HEADPAL);
    sArm(r, o.armF || 'down', o.swF || 0, t, L, true, o);
  });
}
// Deitado de costas (desmaiado): a cabeça é o mesmo mapa, girado
function lying(open) {
  return heroCanvas(r => {
    r(-18, -7, 3, 6, HP.boot); r(-18, -7, 3, 1, HP.bootHi); r(-16, -4, 4, 3, HP.bootSh);
    r(-12, -4, 4, 3, HP.pants); r(-12, -2, 4, 1, HP.pantsSh);
    r(-8, -7, 10, 6, HP.tunic); r(-8, -2, 10, 1, HP.tunicSh); r(-8, -7, 10, 1, HP.tunicHi); r(-5, -7, 2, 6, HP.belt);
    r(-6, -3, 6, 2, HP.tunicSh); r(-8, -3, 2, 2, HP.skin);
    stamp(r, rotCW(flipH(codeFace(open ? 'n' : 'closed'))), 2, -16, HEADPAL);
  });
}
// Costas, sentado no chão (prisioneiro). arm = pose do braço direito.
const SIT_WRIST = { down:[8,-6], reach:[13,-7], hold:[10,-16], up:[8,-25], strike:[-5,-9] };
const SIT_STONE = { reach:[17,-6], hold:[12,-18], up:[9,-28], strike:[-10,-7] };
const SIT_HEAD = { code: -29, mistico: -30, arrogante: -28 };
function backSit(o = {}) {
  const n = o.npc, NP = n ? NPCP[n] : HP, pal = headPal(NP), T = NP.tunic, X = n === 'arrogante' ? 1 : 0, SK = NP.skin, SL = HP.tunicHi;
  return heroCanvas(r => {
    r(-11, -3, 3, 3, HP.bootSh); r(8, -3, 3, 3, HP.boot);
    r(-9, -6, 18, 6, T); r(-9, -1, 18, 1, HP.tunicDk); r(-9, -6, 2, 5, HP.tunicSh); r(-4, -4, 1, 3, HP.tunicSh); r(3, -5, 1, 4, HP.tunicSh);
    r(-6 - X, -15, 12 + 2 * X, 9, T); r(-6 - X, -15, 3, 9, HP.tunicSh); r(4 + X, -15, 2, 8, HP.tunicHi); r(0, -13, 1, 5, HP.tunicSh);
    r(-6 - X, -8, 12 + 2 * X, 2, HP.belt); r(-6 - X, -8, 12 + 2 * X, 1, HP.beltHi);
    // braço esquerdo apoiado no chão, algemado
    r(-9 - X, -14, 3, 8, HP.tunicSh); r(-10 - X, -4, 3, 2, NP.skinSh);
    if (o.broken) r(-10 - X, -6, 3, 1, HP.iron); else { r(-10 - X, -6, 3, 2, HP.iron); r(-10 - X, -6, 1, 1, HP.ironHi); }
    r(-1, -16, 3, 1, NP.skinSh);
    if (o.turn && n) stamp(r, HEAD[n], -8, SIT_HEAD[n], pal, o.turn < 0);
    else stamp(r, HEAD[(n || 'code') + 'Back'], -8, SIT_HEAD[n || 'code'], pal);
    const a = o.arm || 'down', cuff = (x, y, w, h) => { r(x, y, w, h, HP.iron); r(x, y, 1, 1, HP.ironHi); };
    if (a === 'down') { r(6 + X, -14, 3, 8, SL); r(7 + X, -4, 3, 2, SK); if (o.broken) r(7 + X, -6, 3, 1, HP.iron); else cuff(7 + X, -6, 3, 2); }
    if (a === 'reach') { r(6, -14, 3, 4, SL); r(8, -11, 4, 3, SL); r(11, -9, 3, 3, SL); cuff(12, -7, 3, 1); r(13, -6, 3, 3, SK); }
    if (a === 'hold') { r(6, -14, 3, 4, SL); r(8, -12, 3, 2, SL); r(9, -15, 3, 4, SL); cuff(9, -16, 3, 1); r(9, -18, 3, 2, SK); }
    if (a === 'up') { r(6, -15, 3, 3, SL); r(7, -24, 3, 10, SL); cuff(7, -25, 3, 1); r(7, -27, 3, 2, SK); }
    if (a === 'strike') { r(4, -14, 3, 3, SL); r(-2, -12, 7, 3, SL); r(-6, -10, 5, 3, SL); cuff(-7, -9, 1, 3); r(-10, -9, 3, 3, SK); }
  });
}
// Costas, de pé / ajoelhado (transição ao se levantar)
function backStand(o = {}) {
  return heroCanvas(r => {
    const k = o.kneel ? 5 : 0;
    if (o.kneel) { r(-4, -3, 3, 3, HP.bootSh); r(1, -3, 3, 3, HP.boot); r(-4, -5, 8, 2, HP.pants); }
    else { r(-3, -7, 3, 3, HP.pantsSh); r(0, -7, 3, 3, HP.pants); r(-4, -4, 4, 4, HP.bootSh); r(0, -4, 4, 4, HP.boot); }
    r(-5, -9 + k, 10, 2, HP.tunic); r(-5, -8 + k, 10, 1, HP.tunicSh);
    r(-4, -17 + k, 8, 6, HP.tunic); r(-4, -17 + k, 2, 6, HP.tunicSh); r(-4, -11 + k, 8, 2, HP.belt); r(-4, -11 + k, 8, 1, HP.beltHi);
    r(-7, -16 + k, 3, 6, HP.tunicSh); r(4, -16 + k, 3, 6, HP.tunicHi); r(-7, -10 + k, 3, 2, HP.skinSh); r(4, -10 + k, 3, 2, HP.skin); r(-7, -11 + k, 3, 1, HP.iron); r(4, -11 + k, 3, 1, HP.iron);
    stamp(r, HEAD.codeBack, -8, -31 + k, HEADPAL);
  });
}

// ============================================ SPRITES: estátuas e sombras
// Formas talhadas em polígonos (octógonos no lugar de círculos).
const oct = (g, cx, cy, r) => poly(g, [[cx - r * .45, cy - r], [cx + r * .45, cy - r], [cx + r, cy - r * .45], [cx + r, cy + r * .45], [cx + r * .45, cy + r], [cx - r * .45, cy + r], [cx - r, cy + r * .45], [cx - r, cy - r * .45]]);
function shapeHorse(g) {
  poly(g, [[8,15],[13,12],[27,12],[32,15],[33,21],[29,25],[12,25],[8,22]]);
  poly(g, [[27,16],[32,6],[36,5],[37,10],[31,20]]);
  poly(g, [[32,5],[35,2],[37,1],[39,3],[43,8],[43,11],[39,11],[35,9]]);
  poly(g, [[34,3],[34,-1],[36,2]]);
  poly(g, [[28,9],[33,4],[33,8],[30,14]]);
  g.fillRect(10, 22, 3, 13); g.fillRect(14, 23, 3, 12); g.fillRect(25, 23, 3, 12); poly(g, [[29,21],[32,21],[36,28],[34,30],[31,26]]);
  poly(g, [[9,16],[5,19],[3,29],[6,28],[9,21]]);
}
function shapeSpear(g) {
  oct(g, 11, 12, 4.2); poly(g, [[8,9],[11,5],[14,9]]);
  poly(g, [[7,17],[15,17],[17,38],[5,38]]);
  g.fillRect(7, 38, 3, 16); g.fillRect(12, 38, 3, 16);
  poly(g, [[15,18],[19,24],[18,26],[14,21]]);
  g.fillRect(18.5, 6, 1.7, 50); poly(g, [[17,8],[19.3,0],[21.6,8]]);
}
function shapeShield(g) {
  oct(g, 12, 7, 4.2);
  poly(g, [[7,12],[17,12],[19,34],[5,34]]);
  g.fillRect(7, 34, 3, 15); g.fillRect(13, 34, 3, 15);
  poly(g, [[22,15],[28,15],[32,20],[32,29],[28,34],[22,34],[19,29],[19,20]]);   // escudo afastado do corpo, para a silhueta se ler
  poly(g, [[16,15],[22,21],[22,25],[15,20]]);
  poly(g, [[6,13],[2,24],[4,25],[8,17]]);
}
function shapeBird(g) {
  poly(g, [[5,12],[9,8],[14,8],[17,12],[16,18],[11,21],[6,19]]);
  oct(g, 15, 6, 3.4);
  poly(g, [[18,5],[22,7],[18,8]]); poly(g, [[7,17],[1,24],[5,24],[10,19]]);
  g.fillRect(9.5, 20, 1.6, 4); g.fillRect(13, 20, 1.6, 4);
}
function shapeTree(g) {
  g.fillRect(17, 28, 5, 22); poly(g, [[17,46],[11,51],[28,51],[22,46]]);
  poly(g, [[17,31],[9,24],[11,23],[18,28]]); poly(g, [[22,31],[30,24],[28,23],[21,28]]);
  [[19.5,15,11,9],[9,22,7,6],[30,22,7,6],[12,11,7,6],[27,10,7,6],[19.5,5,7,5],[6,29,5,4],[33,29,5,4]].forEach(([x, y, rx, ry]) =>
    poly(g, [[x - rx * .5, y - ry], [x + rx * .5, y - ry], [x + rx, y - ry * .3], [x + rx * .8, y + ry * .7], [x + rx * .2, y + ry], [x - rx * .6, y + ry * .8], [x - rx, y]]));
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
// Sombra projetada: silhueta chapada com uma franja pontilhada de 2 px (a penumbra já vem no sprite).
function makeShadow(fn, w, h, s) {
  const [c, g] = mk(Math.ceil(w * s) + 10, Math.ceil(h * s) + 10); g.translate(5, 5); g.scale(s, s); g.fillStyle = '#07030b'; fn(g);
  hardAlpha(c);
  const W2 = c.width, H2 = c.height, im = g.getImageData(0, 0, W2, H2), d = new Uint32Array(im.data.buffer), src = d.slice(), col = C32('#07030b');
  const on = (x, y) => x >= 0 && y >= 0 && x < W2 && y < H2 && src[y * W2 + x] >>> 24;
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    if (on(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { if ((x + y) & 1) d[y * W2 + x] = col; }
    else if ((on(x - 2, y) || on(x + 2, y) || on(x, y - 2) || on(x, y + 2) || on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)) && (x + y * 2) % 4 === 0) d[y * W2 + x] = col;
  }
  g.putImageData(im, 0, 0);
  return c;
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
function squirrel(hop) {
  const [c, g] = mk(12, 11), r = (x, y, w, h, col) => rect(g, x, y, w, h, col), B = '#b0683a', D = '#7e4424', Lc = '#ecd0a4';
  if (hop) { r(3, 6, 6, 3, B); r(8, 4, 3, 3, B); r(9, 3, 1, 1, B); r(0, 3, 3, 4, D); r(1, 2, 3, 2, B); r(4, 9, 2, 1, D); r(8, 8, 2, 1, D); r(10, 5, 1, 1, '#1a0f0c'); r(5, 8, 3, 1, Lc); }
  else { r(4, 5, 4, 5, B); r(7, 3, 3, 3, B); r(8, 2, 1, 1, B); r(1, 2, 3, 6, D); r(2, 1, 3, 3, B); r(0, 4, 2, 3, B); r(4, 10, 5, 1, D); r(9, 4, 1, 1, '#1a0f0c'); r(6, 7, 2, 2, Lc); }
  return outlined(c, '#3a1e10');
}
// Nuvem em pixel: base reta que afina nas pontas, topo em degraus, faixas de luz do poente e sombra lilás.
function cloudArt(R, w, hMax, C) {
  const [c, g] = mk(w, hMax + 1), top = new Int16Array(w), humps = [];
  let x = 3; while (x < w - 5) { const r = 4 + R() * hMax * .7; humps.push([x + r * .7, r]); x += r * (.7 + R() * .7); }
  const hgt = (i, list) => { let m = 0; for (const [cx, r] of list) { const d = Math.abs(i - cx); if (d < r) m = Math.max(m, r * Math.min(1, (1 - d / r) * 1.7)); } return m; };
  for (let i = 0; i < w; i++) { const env = Math.min(1, i / (w * .3), (w - 1 - i) / (w * .3)); top[i] = Math.max(1, Math.min(hMax, Math.round(hgt(i & ~1, humps) * (.35 + .65 * env) / 2) * 2)); }
  for (let i = 0; i < w; i++) {
    const hh = top[i], y0 = hMax - hh;
    for (let y = y0; y < hMax; y++) {
      const k = (y - y0) / hh, d = y - y0;
      rect(g, i, y, 1, 1, d < 1 ? C[0] : d < 3 && hh > 5 ? C[1] : k > .9 && hh > 3 ? C[4] : k > .58 + .08 * ((i >> 2) & 1) ? C[3] : C[2]);
    }
  }
  // gomos internos: a borda de cada gomo menor aparece dentro da massa
  for (const [cx, r] of humps) for (let i = Math.max(0, cx - r) | 0; i < Math.min(w, cx + r); i++) {
    const hh = Math.round(hgt(i & ~1, [[cx, r]]) * .62 / 2) * 2, y = hMax - hh;
    if (hh > 3 && hh < top[i] - 3) rect(g, i, y, 1, 1, C[1]);
  }
  return c;
}

const S = {};
function buildSprites() {
  const sp = sidePose;
  S.idle = [sp({}), sp({ breath: 1 })];
  S.idleBlink = [sp({ eyes: 'closed' }), sp({ breath: 1, eyes: 'closed' })];
  // ciclo de caminhada em 6 quadros: contato, peso, passagem (para cada perna)
  const LEGS = [{ fF: 3, fB: -3, s: -2 }, { fF: 2, fB: -2, lB: 1, bob: 1, s: -1 }, { fF: 0, fB: 0, lB: 2, s: 0 }, { fF: -3, fB: 3, s: 2 }, { fF: -2, fB: 2, lF: 1, bob: 1, s: 1 }, { fF: 0, fB: 0, lF: 2, s: 0 }];
  const walkSet = ex => LEGS.map(l => sp({ ...l, swF: l.s, swB: l.s, ...ex }));
  S.walk = walkSet({});
  S.wall = walkSet({ armF: 'wall' }); S.wallIdle = sp({ armF: 'wall', breath: 1 });
  S.coverWalk = walkSet({ armF: 'eyes', eyes: 'closed' }); S.coverIdle = sp({ armF: 'eyes', eyes: 'closed' });
  S.wob = [sp({ lean: -1, armF: 'out', armB: 'out', fF: 2, fB: -3, eyes: 'wide' }), sp({ lean: 1, armF: 'out', armB: 'out', fF: -3, fB: 2, eyes: 'wide', mouth: 'open' })];
  S.jump = [sp({ tuck: 1, armF: 'up', armB: 'up' }), sp({ fF: 2, fB: -2, lF: 2, lB: 1, armF: 'out', armB: 'out' })];
  S.fall = [sp({ fF: 2, fB: -3, lB: 1, armF: 'up', armB: 'up', eyes: 'wide', mouth: 'open', hy: -1 }), sp({ fF: 3, fB: -2, lF: 1, armF: 'up', armB: 'up', eyes: 'wide', mouth: 'open', hy: -1 })];
  S.shock = [sp({ armF: 'up', armB: 'up', eyes: 'wide', mouth: 'open' }), sp({ armF: 'up', armB: 'up', eyes: 'wide', mouth: 'open', breath: 1 })];
  S.awe = sp({ eyes: 'wide', mouth: 'open' });
  S.kneel = sp({ kneel: 1, eyes: 'squint' });
  // escalada pelos cipós: braços alternando no alto, pernas buscando apoio
  S.climb = [sp({ armF: 'up', armB: 'wall', fF: 1, lF: 2, fB: -1 }), sp({ armF: 'up', armB: 'wall', fF: 1, lF: 1, fB: -1, bob: 1 }), sp({ armF: 'wall', armB: 'up', fF: 0, fB: 0, lB: 2 }), sp({ armF: 'wall', armB: 'up', fF: 0, fB: 0, lB: 1, bob: 1 })];
  S.reach = sp({ armF: 'point' });
  S.hurt = [sp({ armF: 'clutch', armB: 'out', eyes: 'hurt', mouth: 'grit', lean: -1, burn: 1 }), sp({ armF: 'clutch', armB: 'out', eyes: 'hurt', mouth: 'open', burn: 1, bob: 1 })];
  S.lie = lying(false); S.lieOpen = lying(true);
  // desmaio: cambaleia para trás, cai de joelhos, tomba
  S.faint = [sp({ lean: -1, eyes: 'closed', armF: 'out', armB: 'out', fF: 1, fB: -2, bob: 1 }), sp({ lean: -1, eyes: 'closed', armF: 'out', armB: 'out', fF: 2, fB: -2, bob: 2, hx: -1, hy: 1 }),
    sp({ kneel: 1, eyes: 'closed' }), sp({ kneel: 1, eyes: 'closed', bob: 2, hx: 2, hy: 3 }), S.lie];
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
  S.lantern = fromMap(['....k....', '...kkk...', '..kmmmk..', '.kkkkkkk.', '.koYYYok.', '.kYWkWYk.', '.kYWkWYk.', '.kYYkYYk.', '.koYYYok.', '.kkkkkkk.', '..kmmmk..', '...kkk...'],
    { k: '#140c10', m: '#4a3a3c', o: '#d9772a', Y: '#ffc24a', W: '#fff3c4' });
  const SC = 1.3;
  S.statue = { shield: makeStatue(shapeShield, 34, 50, SC), horse: makeStatue(shapeHorse, 46, 36, SC), spear: makeStatue(shapeSpear, 24, 56, SC), tree: makeStatue(shapeTree, 40, 52, SC), bird: makeStatue(shapeBird, 24, 26, SC) };
  S.shadow = { shield: makeShadow(shapeShield, 34, 50, 1.4), horse: makeShadow(shapeHorse, 46, 36, 1.5), spear: makeShadow(shapeSpear, 24, 56, 1.35), tree: makeShadow(shapeTree, 40, 52, 1.4), bird: makeShadow(shapeBird, 24, 26, 1.5) };
  S.stag = { graze: stag('graze'), alert: stag('alert'), run: [stag('run', 0), stag('run', 1)] };
  S.rabbit = [rabbit(false), rabbit(true)]; S.squirrel = [squirrel(false), squirrel(true)];
  const R = rng(99), NEAR = ['#fff3cc', '#ffd9a0', '#f6b48e', '#cf8a9c', '#9a6a9e'], FAR = ['#ffd6a8', '#f4b08e', '#d98a98', '#a8709e', '#80589a'];
  S.clouds = [cloudArt(R, 92, 22, NEAR), cloudArt(R, 60, 15, NEAR), cloudArt(R, 124, 28, NEAR), cloudArt(R, 74, 18, NEAR), cloudArt(R, 48, 12, NEAR)];
  S.cloudsFar = [cloudArt(R, 70, 9, FAR), cloudArt(R, 110, 11, FAR), cloudArt(R, 54, 7, FAR), cloudArt(R, 88, 9, FAR)];
  const bk = { k: '#2a1c3a' };
  S.bird = [fromMap(['k.....k', '.k...k.', '..kkk..', '...k...'], bk), fromMap(['.......', 'kk...kk', '..kkk..', '...k...'], bk), fromMap(['.......', '..kkk..', '.k.k.k.', 'k.....k'], bk)];
  S.perch = fromMap(['..kk...', '.kbbk..', 'kbbwbk.', '.kbbbbk', '..kkkk.', '...k.k.'], { k: '#1e1a24', b: '#4a6aa8', w: '#e8e4d8' });
}

// ========================================================= RETRATOS 32×32
// Mesmo traço dos sprites: rosto largo, olhos pretos altos, cabelo em mechas pontudas.
const CHAR = {
  code:     { bg1:'#4a3418', bg2:'#35240f', skin:HP.skin, skinSh:HP.skinSh, skinHi:HP.skinHi, hair:HP.hair, hairSh:HP.hairSh, hairHi:HP.hairHi, style:'spiky', tunic:HP.tunic, tunicSh:HP.tunicSh },
  mistico:  { bg1:'#2c1c44', bg2:'#1c1030', skin:'#c98e62', skinSh:'#9c6843', skinHi:'#e0aa7c', hair:'#aaa5a0', hairSh:'#76716e', hairHi:'#d8d4ce', style:'elder', tunic:HP.tunic, tunicSh:HP.tunicSh },
  arrogante:{ bg1:'#4a1814', bg2:'#300e0a', skin:'#e3b189', skinSh:'#b98560', skinHi:'#f4cca6', hair:'#4a2c1c', hairSh:'#2c180e', hairHi:'#6e4830', style:'neat', tunic:HP.tunic, tunicSh:HP.tunicSh },
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
  const [c, g] = mk(32, 32), r = (x, y, w, h, col) => rect(g, x, y, w, h, col), rs = (list, col) => list.forEach(([x, y, w, h]) => r(x, y, w, h, col));
  if (who === 'sistema') {
    r(0, 0, 32, 32, '#10262a'); dither(g, 0, 20, 32, 12, '#0a1a1d');
    ell(g, 16, 16, 13, 8, '#0a1214'); ell(g, 16, 16, 12, 7, '#efe4cf'); ell(g, 16, 17, 12, 5, '#d8ccb6');
    ell(g, 16, 16, 5, 5, '#c97a20'); ell(g, 16, 16, 4, 4, '#f2a33a'); ell(g, 16, 16, 2, 2, '#140c10'); r(17, 13, 2, 2, '#fff');
    for (const [x, y] of [[6, 7], [11, 5], [16, 4], [21, 5], [26, 7]]) r(x, y, 1, 2, '#7fd4c8');
  } else if (who === 'narrador') {
    r(0, 0, 32, 32, '#1a0c08'); dither(g, 0, 0, 32, 10, '#120806');
    for (const [w, y, col] of [[14, 26, '#8a2414'], [16, 23, '#8a2414'], [14, 20, '#b8361b'], [12, 17, '#b8361b'], [10, 14, '#b8361b'], [6, 11, '#b8361b'], [4, 8, '#b8361b'], [2, 5, '#b8361b']]) r(16 - w / 2, y, w, 3, col);
    for (const [w, y, col] of [[10, 25, '#f57f24'], [10, 22, '#f57f24'], [8, 19, '#f57f24'], [6, 16, '#f57f24'], [4, 13, '#f57f24'], [2, 10, '#f57f24'], [6, 24, '#ffcf4a'], [4, 21, '#ffcf4a'], [2, 18, '#ffcf4a'], [2, 24, '#fff6c8']]) r(16 - w / 2, y, w, 3, col);
    r(7, 28, 18, 3, '#3a2214'); r(7, 28, 18, 1, '#6a4428'); r(10, 27, 3, 5, '#5a3a24');
  } else {
    const ch = CHAR[who] || CHAR.code, M = MOODS[mood] || MOODS.normal, Hc = ch.hair, Hs = ch.hairSh, Hh = ch.hairHi;
    r(0, 0, 32, 32, ch.bg1); for (let y = 16; y < 32; y++) for (let x = y & 1; x < 32; x += 2) if (y > 23 || (x + y) % 4 === 0) r(x, y, 1, 1, ch.bg2);
    // ombros e decote
    r(5, 27, 22, 5, ch.tunic); r(3, 29, 26, 3, ch.tunic); r(3, 29, 5, 3, ch.tunicSh); r(22, 28, 5, 4, ch.tunicSh);
    r(13, 25, 6, 4, ch.skinSh); r(14, 29, 4, 1, ch.skinSh); r(15, 30, 2, 1, ch.skinSh); r(12, 27, 1, 3, ch.tunicSh); r(19, 27, 1, 3, ch.tunicSh);
    // rosto largo de cantos chanfrados, orelhas
    r(8, 9, 16, 14, ch.skin); r(7, 11, 18, 10, ch.skin); r(9, 23, 14, 1, ch.skin); r(11, 24, 10, 1, ch.skin);
    r(23, 11, 2, 10, ch.skinSh); r(22, 21, 2, 2, ch.skinSh); r(20, 23, 3, 1, ch.skinSh); r(11, 24, 10, 1, ch.skinSh); r(9, 10, 5, 1, ch.skinHi);
    r(5, 14, 2, 5, ch.skin); r(5, 15, 1, 3, ch.skinSh); r(25, 14, 2, 5, ch.skinSh);
    if (ch.style === 'spiky') {
      rs([[6, 2, 20, 8], [4, 4, 24, 7], [3, 7, 4, 8], [25, 7, 4, 8], [9, 1, 14, 1], [7, 0, 2, 2], [12, 0, 3, 1], [18, 0, 2, 1], [23, 1, 3, 1], [2, 5, 2, 2], [28, 4, 2, 2], [1, 9, 2, 2], [29, 9, 2, 2], [2, 13, 2, 3], [28, 13, 2, 3], [4, 15, 2, 3], [26, 15, 2, 3], [5, 18, 1, 2], [26, 18, 1, 2]], Hc);
      rs([[7, 10, 4, 3], [8, 13, 2, 1], [11, 10, 2, 2], [13, 10, 4, 3], [14, 13, 2, 1], [17, 10, 2, 1], [19, 10, 3, 3], [20, 13, 1, 1], [22, 10, 3, 2]], Hc);       // franja em dentes
      rs([[8, 3, 5, 1], [10, 4, 4, 1], [17, 2, 5, 1], [19, 3, 4, 1], [23, 5, 3, 1], [5, 7, 3, 1], [13, 6, 4, 1], [6, 5, 2, 1]], Hh);
      rs([[6, 10, 1, 3], [25, 8, 2, 3], [12, 8, 2, 1], [20, 8, 2, 1], [16, 9, 1, 2], [4, 12, 1, 3], [27, 12, 1, 3], [9, 7, 1, 2], [22, 7, 1, 2]], Hs);
    } else if (ch.style === 'elder') {
      rs([[8, 1, 16, 9], [6, 3, 20, 7], [4, 6, 5, 24], [23, 6, 5, 24], [3, 12, 2, 16], [27, 12, 2, 16], [5, 30, 3, 2], [24, 30, 3, 2], [11, 0, 10, 1]], Hc);
      rs([[9, 2, 5, 1], [8, 3, 3, 1], [17, 2, 5, 1], [5, 9, 1, 15], [7, 11, 1, 16], [25, 10, 1, 16]], Hh);
      rs([[6, 10, 1, 17], [24, 9, 1, 18], [26, 12, 1, 15], [15, 3, 1, 5], [3, 20, 1, 6], [28, 18, 1, 8]], Hs);
      // barba longa e bigode
      rs([[8, 20, 16, 9], [9, 29, 14, 2], [11, 31, 10, 1], [10, 19, 5, 1], [17, 19, 5, 1]], Hc);
      rs([[10, 22, 1, 7], [14, 23, 1, 7], [18, 22, 1, 8], [21, 23, 1, 6], [12, 20, 2, 1], [18, 20, 2, 1]], Hh);
      rs([[12, 23, 1, 7], [16, 24, 1, 7], [20, 24, 1, 6], [8, 21, 1, 7], [23, 21, 1, 7]], Hs);
    } else {
      rs([[8, 0, 16, 9], [6, 2, 20, 7], [5, 5, 3, 9], [24, 5, 3, 9], [10, 9, 13, 1], [17, 9, 7, 2], [21, 11, 3, 1]], Hc);                  // topete penteado
      rs([[10, 1, 6, 1], [9, 2, 4, 1], [17, 3, 5, 1], [19, 4, 4, 1], [12, 5, 1, 4]], Hh);
      rs([[6, 8, 1, 5], [25, 7, 1, 6], [16, 2, 1, 6], [21, 6, 2, 1], [9, 8, 2, 1]], Hs);
      rs([[13, 23, 6, 2], [14, 25, 4, 1], [12, 19, 8, 1], [11, 20, 1, 1], [20, 20, 1, 1]], Hc); r(15, 25, 2, 1, Hs);                          // bigode e cavanhaque
    }
    // olhos (3 de largura, altos)
    const E = '#1a1014', WH = '#fffaf0';
    const eyeAt = (cx, side) => {
      switch (M.e) {
        case 'wide': r(cx - 1, 13, 3, 6, E); r(cx - 2, 14, 5, 4, E); r(cx - 1, 14, 1, 2, WH); break;
        case 'closed': r(cx - 1, 18, 3, 1, E); r(cx - 2, 17, 1, 1, E); r(cx + 2, 17, 1, 1, E); break;
        case 'happy': r(cx - 2, 17, 1, 2, E); r(cx - 1, 16, 3, 1, E); r(cx + 2, 17, 1, 2, E); break;
        case 'hurt': for (let k = 0; k < 3; k++) { r(cx - side * (1 - k), 15 + k, 1, 1, E); r(cx - side * (1 - k), 19 - k, 1, 1, E); } break;
        case 'up': r(cx - 1, 13, 3, 5, E); r(cx - 1, 13, 1, 1, WH); r(cx - 1, 18, 3, 1, ch.skinSh); break;
        case 'squint': r(cx - 1, 16, 3, 2, E); r(cx - 2, 15, 5, 1, ch.skinSh); break;
        case 'lid': r(cx - 1, 16, 3, 3, E); r(cx - 2, 15, 5, 1, Hs); r(cx - 1, 14, 3, 1, ch.skinSh); break;
        case 'side': r(cx - 1, 14, 3, 5, E); r(cx + 1, 15, 1, 2, WH); break;
        default: r(cx - 1, 14, 3, 5, E); r(cx - 1, 14, 1, 1, WH);
      }
    };
    eyeAt(11, -1); eyeAt(20, 1);
    const BR = ch.style === 'elder' ? Hh : Hs, bw = ch.style === 'elder' ? 2 : 1;
    switch (M.b) {
      case 'up': r(9, 11 - bw, 5, bw, BR); r(18, 11 - bw, 5, bw, BR); break;
      case 'up1': r(9, 12 - bw, 5, bw, BR); r(18, 11 - bw, 5, bw, BR); break;
      case 'angry': r(9, 11 - bw, 2, bw, BR); r(11, 12 - bw, 3, bw, BR); r(18, 12 - bw, 3, bw, BR); r(21, 11 - bw, 2, bw, BR); break;
      case 'worry': r(9, 12 - bw, 2, bw, BR); r(11, 11 - bw, 3, bw, BR); r(18, 11 - bw, 3, bw, BR); r(21, 12 - bw, 2, bw, BR); break;
      default: r(9, 12 - bw, 5, bw, BR); r(18, 12 - bw, 5, bw, BR);
    }
    r(15, 18, 2, 1, ch.skinSh); if (ch.style !== 'spiky') r(16, 16, 1, 2, ch.skinSh);
    const MO = '#8a2e24', LN = ch.style === 'elder' ? '#4a3a36' : '#8a4a3a', TE = '#fffaf0', my = ch.style === 'elder' ? 21 : 20;
    switch (M.m) {
      case 'frown': r(13, my + 2, 1, 1, LN); r(14, my + 1, 4, 1, LN); r(18, my + 2, 1, 1, LN); break;
      case 'smile': r(13, my, 1, 1, LN); r(14, my + 1, 4, 1, LN); r(18, my, 1, 1, LN); break;
      case 'open': r(14, my, 4, 3, MO); r(15, my + 1, 2, 1, '#3a0f0c'); break;
      case 'small': r(15, my, 2, 2, MO); break;
      case 'grin': r(13, my, 6, 2, TE); r(13, my + 2, 6, 1, MO); r(12, my, 1, 1, MO); r(19, my, 1, 1, MO); break;
      case 'grit': r(13, my, 6, 2, TE); r(14, my, 1, 2, MO); r(16, my, 1, 2, MO); r(18, my, 1, 2, MO); r(13, my + 2, 6, 1, MO); break;
      case 'smirk': r(14, my + 1, 4, 1, LN); r(18, my, 1, 1, LN); break;
      case 'shout': r(13, my, 6, 4, MO); r(14, my + 2, 4, 2, '#c04a3a'); break;
      default: r(14, my + 1, 4, 1, LN);
    }
    if (M.x === 'sweat') { r(26, 6, 1, 1, '#cfeaff'); r(25, 7, 2, 3, '#9fd4ff'); }
    if (M.x === 'tear') { r(10, 19, 1, 3, '#9fd4ff'); r(21, 19, 1, 3, '#9fd4ff'); }
    if (M.x === 'sparkle') for (const [x, y] of [[2, 3], [29, 3], [29, 25], [2, 26]]) { r(x, y, 1, 1, '#ffe9a0'); r(x - 1, y + 1, 3, 1, '#ffe9a0'); r(x, y + 2, 1, 1, '#ffe9a0'); }
  }
  PORT[key] = c; return c;
}

