
// ============================================================ MAPAS
const LAYER = {};

// ---------------- Cenários I e II: a câmara das sombras e o salão do fogo
const CH = { W: 1040, floor: 182, rings: [44, 105, 175, 240], ringY: 140, wallTop: 98, wallEnd: 480, fireX: 890, fireY: 139, exitX: 1012 };
const PRIS = { mistico: 70, code: 140, arrogante: 210 };
const STATUES = [ { k: 'shield', x: 652 }, { k: 'horse', x: 708 }, { k: 'spear', x: 768 }, { k: 'tree', x: 828 }, { k: 'bird', x: 952 } ];
const SHADOWS = [ { k: 'shield', x: 252, b: 179 }, { k: 'horse', x: 312, b: 179 }, { k: 'spear', x: 364, b: 182 }, { k: 'tree', x: 410, b: 181 }, { k: 'bird', x: 458, b: 146 } ];

function buildChamber() {
  const WW = CH.W, [c, g] = mk(WW, H), R = rng(7);
  rect(g, 0, 0, WW, H, '#07040a');
  for (let i = 0; i < 360; i++) { const x = R() * WW, y = 20 + R() * 160, rr = 7 + R() * 16; boulder(g, x, y, rr, rr * .8, ROCK_DIM, R); }
  const gr = g.createLinearGradient(0, 0, 0, 110); gr.addColorStop(0, 'rgba(3,1,6,.97)'); gr.addColorStop(.65, 'rgba(3,1,6,.7)'); gr.addColorStop(1, 'rgba(3,1,6,.1)');
  g.fillStyle = gr; g.fillRect(0, 0, WW, 110);
  // cachos de rocha no alto, como na referência
  for (let i = 0; i < 24; i++) boulder(g, R() * 70 - 10, R() * 84, 9 + R() * 9, 7 + R() * 6, ROCK_MID, R);
  for (let i = 0; i < 14; i++) boulder(g, 300 + R() * 180, R() * 26, 10 + R() * 10, 7 + R() * 6, ROCK_MID, R);
  // montes de pedra atrás do muro
  for (const mx of [110, 250, 345, 440]) for (let i = 0; i < 11; i++) { const a = R() * Math.PI; boulder(g, mx + Math.cos(a) * 32 * R(), 96 - Math.sin(a) * 20 * R(), 7 + R() * 7, 6 + R() * 4, ROCK_MID, R); }
  // o muro das sombras
  brickWall(g, 0, CH.wallTop, CH.wallEnd, CH.floor - CH.wallTop, R, BRICK, 13, 7, 9);
  let x = 0;
  while (x < CH.wallEnd) { const w = 16 + ((R() * 8) | 0); rect(g, x, CH.wallTop - 5, w, 6, '#140c12'); rect(g, x + 1, CH.wallTop - 4, w - 2, 4, '#5e4c4e'); rect(g, x + 1, CH.wallTop - 4, w - 2, 1, '#7e6a68'); rect(g, x + 1, CH.wallTop - 1, w - 2, 1, '#3a2e30'); x += w; }
  for (let y = CH.wallTop - 4; y < CH.floor; y += 8) boulder(g, CH.wallEnd + 2 + R() * 4, y, 5 + R() * 3, 5, ROCK, R);
  for (const rx of CH.rings) ringPlate(g, rx, CH.ringY);
  // salão das estátuas: fundo de grandes blocos
  brickWall(g, 490, 64, WW - 490, CH.floor - 64, R, BLOCK, 20, 12, 12);
  const g2 = g.createLinearGradient(0, 40, 0, 140); g2.addColorStop(0, 'rgba(3,1,6,.96)'); g2.addColorStop(1, 'rgba(3,1,6,0)');
  g.fillStyle = g2; g.fillRect(490, 40, WW - 490, 100);
  for (let i = 0; i < 44; i++) boulder(g, 490 + R() * (WW - 490), R() * 36, 9 + R() * 12, 7 + R() * 7, ROCK_MID, R);
  for (let x2 = 934; x2 < 996; x2++) { const y = 5 + Math.round(Math.sin(x2 * .23) * 2 + Math.sin(x2 * .61)); rect(g, x2, y - 1, 1, 4, '#3a2418'); rect(g, x2, y, 1, 2, x2 % 3 ? '#ffe0a0' : '#f0b860'); }
  column(g, 500, 46, 20, 136, R); column(g, 556, 46, 20, 136, R); column(g, 598, 130, 18, 52, R);
  for (let i = 0; i < 6; i++) boulder(g, 594 + R() * 26, 128 - R() * 4, 3 + R() * 3, 2 + R() * 2, ROCK, R);
  // parapeito com pedestais e estátuas
  rect(g, 616, 146, 358, 5, '#140c12'); rect(g, 617, 147, 356, 3, '#6a565c'); rect(g, 617, 147, 356, 1, '#8a767c');
  brickWall(g, 618, 151, 354, CH.floor - 151, R, BLOCK, 18, 10, 10);
  for (const s of STATUES) {
    const spr = S.statue[s.k], pw = Math.max(18, Math.round(spr.width * .5));
    rect(g, s.x - pw / 2 - 2, 138, pw + 4, 4, '#140c12'); rect(g, s.x - pw / 2 - 1, 139, pw + 2, 2, '#86727a');
    rect(g, s.x - pw / 2 - 1, 141, pw + 2, 6, '#140c12'); rect(g, s.x - pw / 2, 141, pw, 5, '#5d4a52'); rect(g, s.x + pw / 2 - 3, 141, 3, 5, '#3c2e36');
    g.drawImage(spr, Math.round(s.x - spr.width / 2), 139 - (spr.height - 6));
  }
  // braseiro sobre degraus
  const fx = CH.fireX;
  const step = (x0, y0, w, h) => { rect(g, x0, y0, w, h, '#140c12'); rect(g, x0 + 1, y0 + 1, w - 2, h - 1, '#4f3e46'); rect(g, x0 + 1, y0 + 1, w - 2, 1, '#7a646c'); rect(g, x0 + w - 4, y0 + 2, 3, h - 2, '#33282e'); };
  step(fx - 30, 172, 60, 10); step(fx - 24, 163, 48, 10); step(fx - 18, 156, 36, 8);
  rect(g, fx - 6, 148, 12, 8, '#140c12'); rect(g, fx - 5, 148, 10, 8, '#3d3036'); rect(g, fx - 5, 148, 3, 8, '#5a4a50');
  for (let i = 0; i < 8; i++) rect(g, fx - 18 + i, 140 + i, 36 - 2 * i, 1, i === 0 ? '#8a767c' : i < 3 ? '#5a4a50' : '#40343a');
  rect(g, fx - 19, 138, 38, 3, '#140c12'); rect(g, fx - 18, 139, 36, 1, '#9a8288');
  amphora(g, 532, 182); amphora(g, 640, 182); amphora(g, 992, 182);
  for (let i = 0; i < 28; i++) boulder(g, 620 + R() * 360, 179 + R() * 2, 2 + R() * 3, 2 + R() * 1.5, ROCK, R);
  // passagem de saída
  ell(g, 1030, 138, 20, 46, '#140c12'); ell(g, 1030, 140, 17, 43, '#020104');
  for (let a = Math.PI * .55; a < Math.PI * 1.5; a += .2) boulder(g, 1030 + Math.cos(a) * 21, 138 + Math.sin(a) * 46, 5 + R() * 3, 4 + R() * 2, ROCK, R);
  // chão: meio-fio de lajes e pedras redondas
  curb(g, 0, WW, CH.floor, R);
  for (let x2 = -6; x2 < WW + 6; x2 += 9 + R() * 6) boulder(g, x2, 198 + R() * 5, 7 + R() * 5, 6 + R() * 3, ROCK, R);
  for (let x2 = -6; x2 < WW + 6; x2 += 10 + R() * 6) boulder(g, x2, 212 + R() * 4, 7 + R() * 5, 5 + R() * 3, ROCK_MID, R);
  const g3 = g.createLinearGradient(0, 196, 0, 216); g3.addColorStop(0, 'rgba(3,1,6,0)'); g3.addColorStop(1, 'rgba(3,1,6,.8)'); g.fillStyle = g3; g.fillRect(0, 196, WW, 20);
  return c;
}

// ---------------- Cenário III: o parkour
const PK = { W: 1100, death: 198, exitX: 1068 };
const PK_SOLIDS = [
  { x: 0,   y: 150, w: 120, h: 66 },
  { x: 150, y: 140, w: 46,  h: 10, f: 1, moss: [.3, 1] },
  { x: 226, y: 116, w: 40,  h: 10, f: 1, moss: [0, .6] },
  { x: 296, y: 150, w: 40,  h: 66 },
  { x: 474, y: 104, w: 40,  h: 10, f: 1, moss: [.2, .9] },
  { x: 544, y: 84,  w: 36,  h: 10, f: 1 },
  { x: 612, y: 132, w: 40,  h: 84, moss: [0, .5] },
  { x: 756, y: 92,  w: 44,  h: 10, f: 1, moss: [.4, 1] },
  { x: 832, y: 70,  w: 36,  h: 10, f: 1, moss: [0, .7] },
  { x: 900, y: 56,  w: 200, h: 160, moss: [0, .3] },
];
const MOVERS_DEF = [
  { x: 360, y: 128, w: 40, h: 10, ax: 'x', a: 360, b: 426, per: 3.6 },
  { x: 684, y: 130, w: 40, h: 10, ax: 'y', a: 100, b: 160, per: 3.4 },
];
function moss(g, x0, x1, y, R) {
  for (let x = Math.round(x0); x < x1; x++) {
    rect(g, x, y - 1, 1, 2, '#a3b84e'); if (R() < .3) rect(g, x, y - 2, 1, 1, '#c4d468');
    if (R() < .7) rect(g, x, y + 1, 1, 1 + ((R() * 3) | 0), '#71892e');
    if (R() < .25) rect(g, x, y + 1, 1, 3 + ((R() * 9) | 0), '#55691f');
  }
}
function platformArt(g, s, R) {
  const bottom = s.f ? s.y + s.h + 1 : Math.min(H + 4, s.y + s.h + 4);
  for (let yy = s.y + 7; yy < bottom; yy += 7)
    for (let xx = s.x + 3; xx < s.x + s.w; xx += 7 + R() * 4) boulder(g, xx + R() * 2, yy + R() * 2, 4 + R() * 3, 4 + R() * 2, ROCK, R);
  if (s.f) for (let xx = s.x + 4; xx < s.x + s.w - 2; xx += 5 + R() * 6) spikeDown(g, xx, s.y + s.h + 1, 4 + R() * 3, 4 + R() * 10, ROCK_SPK);
  let xx = s.x;
  while (xx < s.x + s.w) {
    const bw = Math.min(7 + ((R() * 6) | 0), s.x + s.w - xx);
    rect(g, xx, s.y, bw, 6, ROCK.out);
    if (bw > 2) { rect(g, xx + 1, s.y + 1, bw - 2, 4, ROCK.hi); rect(g, xx + 1, s.y + 1, bw - 2, 1, ROCK.hi2); rect(g, xx + 1, s.y + 4, bw - 2, 1, ROCK.base); }
    xx += bw;
  }
  if (s.moss) moss(g, s.x + s.moss[0] * s.w, s.x + s.moss[1] * s.w, s.y, R);
}
function buildParkourBg() {
  const w = Math.ceil(W + (PK.W - W) * .5), [c, g] = mk(w, H), R = rng(19);
  rect(g, 0, 0, w, H, '#0a0610');
  for (let i = 0; i < 80; i++) boulder(g, R() * w, R() * H, 10 + R() * 16, 8 + R() * 12, ROCK_DIM, R);
  for (let i = 0; i < 36; i++) spikeUp(g, R() * w, H + 4, 14 + R() * 22, 60 + R() * 120, { out: '#0b0710', base: i % 2 ? '#191120' : '#1e1526', hi: '#2a1f33', shade: '#130d19' });
  for (let i = 0; i < 22; i++) spikeDown(g, R() * w, 0, 10 + R() * 16, 30 + R() * 50, { out: '#0b0710', base: '#1a1222', hi: '#241a2c', shade: '#130d19' });
  const hz = g.createLinearGradient(0, 80, 0, H); hz.addColorStop(0, 'rgba(70,36,40,0)'); hz.addColorStop(1, 'rgba(70,36,40,.32)');
  g.fillStyle = hz; g.fillRect(0, 80, w, H - 80);
  return c;
}
function buildParkour() {
  const WW = PK.W, [c, g] = mk(WW, H), R = rng(21);
  for (let y = 0; y < H; y += 9) boulder(g, 3 + R() * 6, y, 8 + R() * 4, 6 + R() * 3, ROCK, R);
  for (let x = -8; x < WW + 8; x += 9 + R() * 7) { if (Math.abs(x - 254) < 18 || Math.abs(x - 724) < 18) continue; boulder(g, x, 4 + R() * 7, 9 + R() * 6, 7 + R() * 4, ROCK, R); }
  for (const hx of [254, 724]) { ell(g, hx, 0, 15, 9, '#e8a050'); ell(g, hx, 0, 12, 7, '#ffd890'); ell(g, hx, 0, 8, 4, '#fff2c8'); }
  thick(g, 252, 0, 247, 8, 2, 1, '#2a1a14'); thick(g, 247, 6, 240, 10, 1, 1, '#2a1a14'); thick(g, 257, 0, 263, 7, 1, 1, '#2a1a14'); thick(g, 261, 5, 266, 8, 1, 1, '#2a1a14');
  for (const hx of [254, 724]) for (const k of [-1, 1]) boulder(g, hx + k * 17, 6, 7, 6, ROCK, R);
  for (let i = 0; i < 36; i++) { const x = 16 + R() * 1050; if (Math.abs(x - 254) < 22 || Math.abs(x - 724) < 22) continue; spikeDown(g, x, 12 + R() * 5, 5 + R() * 7, 8 + R() * 26, ROCK_SPK); }
  for (let y = -4; y < 60; y += 8) boulder(g, 1095 + R() * 4, y, 7 + R() * 4, 6, ROCK, R);
  const ex = 1084, ey = 30;
  ell(g, ex, ey, 17, 26, '#1a0f0c'); ell(g, ex, ey, 15, 24, '#d88a3a'); ell(g, ex + 1, ey, 12, 21, '#f6c068'); ell(g, ex + 2, ey + 1, 9, 17, '#ffe2a0'); ell(g, ex + 3, ey + 1, 6, 12, '#fff6d8');
  for (let a = Math.PI * .6; a < Math.PI * 1.45; a += .3) boulder(g, ex + Math.cos(a) * 17, ey + Math.sin(a) * 26, 4 + R() * 2, 4, ROCK, R);
  for (let x = -4; x < WW; x += 7 + R() * 5) boulder(g, x, 212, 5 + R() * 3, 4, ROCK, R);
  for (let x = 118; x < 902; x += 5 + R() * 3) spikeUp(g, x, 213, 5 + R() * 3, 10 + R() * 9, BONE);
  for (const s of PK_SOLIDS) platformArt(g, s, R);
  column(g, 14, 104, 14, 46, R); amphora(g, 62, 150); amphora(g, 946, 56); column(g, 1010, 28, 12, 28, R);
  return c;
}
function buildMover(m) {
  const [c, g] = mk(m.w + 2, 26), R = rng(m.x);
  platformArt(g, { x: 1, y: 0, w: m.w, h: m.h, f: 1, moss: [.3, .9] }, R);
  rect(g, 4, 2, 2, 2, '#5a5f6c'); rect(g, m.w - 4, 2, 2, 2, '#5a5f6c');
  return c;
}

// ---------------- Cenário IV: a boca da caverna
const MOUTH = { W: 640, cx: 612, cy: 108, rx: 96, ry: 82, trig: 548 };
function mouthEdge(a) { return 1 + .07 * Math.sin(a * 5 + 1) + .05 * Math.sin(a * 11 + 2) + .03 * Math.sin(a * 17); }
function buildMouth() {
  const [c, g] = mk(MOUTH.W, H), R = rng(33);
  rect(g, 0, 0, MOUTH.W, H, '#09050d');
  for (let i = 0; i < 320; i++) { const x = R() * MOUTH.W, y = R() * H, r = 7 + R() * 15; boulder(g, x, y, r, r * .8, i < 160 ? ROCK_DIM : ROCK, R); }
  for (let x = 0; x < MOUTH.W; x += 8 + R() * 8) spikeDown(g, x, 8 + R() * 10, 5 + R() * 6, 8 + R() * 22, ROCK_SPK);
  for (let y = 0; y < H; y++) for (let x = 440; x < MOUTH.W; x++) {
    const dx = (x - MOUTH.cx) / MOUTH.rx, dy = (y - MOUTH.cy) / MOUTH.ry, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d < mouthEdge(a) && y < CH.floor) {
      const hill = 150 + Math.sin(x * .05) * 5 + Math.sin(x * .017 + 1) * 7;
      let col = d < .35 ? '#ffffff' : d < .6 ? '#fffbea' : d < .8 ? '#fff0bc' : '#ffd98c';
      if (y > hill) col = y > hill + 8 ? '#cfe3a2' : '#e2efbe';
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
  }
  thick(g, 560, 150, 556, 120, 3, 2, '#d8d0b0'); ell(g, 556, 112, 12, 10, '#e4e8c4'); ell(g, 552, 108, 7, 6, '#eef2d6');
  const lit = { out: '#140c10', shade: '#3a2a2c', base: '#5e4640', hi: '#a07656', hi2: '#d0a070' };
  for (let a = Math.PI * .5; a < Math.PI * 1.5; a += .12) {
    const e = mouthEdge(a);
    boulder(g, MOUTH.cx + Math.cos(a) * MOUTH.rx * e - 3, MOUTH.cy + Math.sin(a) * MOUTH.ry * e, 6 + R() * 5, 5 + R() * 3, lit, R);
  }
  for (let a = Math.PI * .55; a < Math.PI * 1.45; a += .25) { const e = mouthEdge(a); moss(g, MOUTH.cx + Math.cos(a) * MOUTH.rx * e - 8, MOUTH.cx + Math.cos(a) * MOUTH.rx * e + 2, MOUTH.cy + Math.sin(a) * MOUTH.ry * e - 5, R); }
  curb(g, 0, MOUTH.W, CH.floor, R);
  for (let x = -6; x < MOUTH.W + 6; x += 9 + R() * 6) boulder(g, x, 198 + R() * 5, 7 + R() * 5, 6 + R() * 3, ROCK, R);
  for (let x = -6; x < MOUTH.W + 6; x += 10 + R() * 6) boulder(g, x, 212 + R() * 4, 7 + R() * 5, 5 + R() * 3, ROCK_MID, R);
  for (let x = 470; x < MOUTH.W; x += 3 + R() * 4) { const h = 2 + R() * 5; rect(g, x, CH.floor - h, 1, h, R() < .5 ? '#7aa83a' : '#a8c85a'); }
  // a flor na fenda (ponto de inspeção)
  rect(g, 446, 172, 1, 10, '#5a8a2e'); rect(g, 447, 176, 2, 1, '#5a8a2e');
  rect(g, 444, 170, 5, 3, '#f2e66a'); rect(g, 445, 169, 3, 5, '#f2e66a'); rect(g, 446, 171, 1, 1, '#d8762a');
  return c;
}

// ---------------- Cenário V: o mundo exterior (camadas em paralaxe)
const OUT = { W: 1500, ground: 168, edge: 1384, streamX: 830, streamW: 26 };
const PAR = { far: .1, hills: .22, valley: .4, near: .65 };
const VALLEY = { river: [], fall: { x: 676, y: 60, w: 16, h: 92 } };
const layerW = f => Math.ceil(W + (OUT.W - W) * f) + 2;
function cypress(g, x, base, h, R, P) {
  rect(g, x - 1, base - 4, 2, 4, '#4a3020');
  for (let y = 0; y < h; y++) {
    const t = y / h, w = Math.max(1, Math.round(h * .17 * Math.pow(Math.sin(Math.PI * Math.min(1, (1 - t) * .95 + .05)), .7) * (1 - t * .25)));
    const yy = base - 4 - y;
    rect(g, x - w - 1, yy, 2 * w + 2, 1, P.out); rect(g, x - w, yy, 2 * w, 1, P.b); rect(g, x - w, yy, Math.max(1, Math.round(w * .6)), 1, P.hi);
    if (R() < .3) rect(g, x + (R() * 2 - 1) * w, yy, 1, 1, P.sh);
  }
}
function flowerAt(g, x, y, kind) {
  if (kind === 0) { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x - 1, y, 3, 1, '#ffffff'); rect(g, x, y - 1, 1, 3, '#ffffff'); rect(g, x, y, 1, 1, '#f2c84a'); }
  else if (kind === 1) { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x - 1, y - 1, 3, 2, '#9a6ad8'); rect(g, x, y - 2, 1, 1, '#c8a8f0'); }
  else if (kind === 2) { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x - 1, y - 1, 3, 2, '#e8463a'); rect(g, x, y - 1, 1, 1, '#2a1010'); }
  else { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x, y - 1, 2, 2, '#ffd84a'); }
}
function bigTree(g, x, base, s, R) {
  const BK = { out: '#2a160c', b: '#6b4428', hi: '#8e5e36', hi2: '#b07a48', sh: '#4a2c18' };
  const th = Math.round(86 * s);
  for (const [dx, dy] of [[-26, 2], [-14, 4], [12, 4], [26, 2], [-34, 0], [32, 0]]) thick(g, x, base - 6, x + dx * s, base + dy * .5, 6 * s, 2, BK.out);
  for (const [dx, dy] of [[-26, 2], [-14, 4], [12, 4], [26, 2]]) thick(g, x, base - 7, x + dx * s, base + dy * .5 - 1, 4 * s, 1, BK.b);
  for (let y = base; y > base - th; y--) {
    const k = (base - y) / th, w = Math.round((24 - 10 * k) * s + (y > base - 10 ? (10 - (base - y)) * 1.2 : 0)), cx = x + Math.round(Math.sin(k * 2.4) * 6 * s);
    rect(g, cx - w / 2 - 1, y, w + 2, 1, BK.out); rect(g, cx - w / 2, y, w, 1, BK.b); rect(g, cx - w / 2, y, Math.max(2, w * .3), 1, BK.hi); rect(g, cx - w / 2 + 1, y, 1, 1, BK.hi2); rect(g, cx + w / 2 - 3, y, 3, 1, BK.sh);
  }
  for (let i = 0; i < 60 * s; i++) { const y = base - R() * th, k = (base - y) / th, cx = x + Math.sin(k * 2.4) * 6 * s, w = (24 - 10 * k) * s; rect(g, cx - w / 2 + 2 + R() * (w - 4), y, 1, 2 + R() * 5, BK.sh); }
  const top = base - th, tx = x + Math.round(Math.sin(2.4) * 6 * s);
  for (const [dx, dy, w] of [[-60, -40, 6], [56, -48, 6], [-10, -62, 5], [80, -20, 4], [-78, -16, 4]]) { thick(g, tx, top + 6, tx + dx * s, top + dy * s, w * s + 1, 2, BK.out); thick(g, tx, top + 6, tx + dx * s, top + dy * s, w * s, 1, BK.b); }
  const Ld = { out: '#16300e', b: '#2f5a1c', sh: '#224414', mid: '#3e7424', hi: '#5a9030', hi2: '#7aa83a' };
  const L = { out: '#1e3e14', b: '#4c8a28', sh: '#2f5a1c', mid: '#78b034', hi: '#b0d44a', hi2: '#e2ec7c' };
  const pts = [];
  for (let i = 0; i < 46 * s; i++) { const a = R() * TAU, d = Math.sqrt(R()); pts.push([tx + Math.cos(a) * d * 82 * s, top - 34 * s + Math.sin(a) * d * 46 * s, (11 + R() * 10) * s]); }
  for (const p of pts) leafCluster(g, p[0] + 5, p[1] + 6, p[2], Ld, R);
  pts.sort((a, b) => a[1] - b[1]);
  for (const p of pts) leafCluster(g, p[0], p[1], p[2], L, R);
  return { cx: tx, cy: top - 34 * s, rx: 82 * s, ry: 46 * s };
}
function buildOutside() {
  // céu em faixas, como o pôr da luz na referência
  let [c, g] = mk(W, H);
  const bands = ['#2458c0','#2a64c8','#3270d0','#3c7ed6','#4a8edc','#5c9fe2','#72b0e6','#8cc0ea','#a8cee8','#c4dae2','#dce2d4','#eee2bc','#f8e2a8'];
  bands.forEach((col, i) => { rect(g, 0, i * 12, W, 12, col); if (i) dither(g, 0, i * 12, W, 2, bands[i - 1], i & 1); });
  rect(g, 0, bands.length * 12, W, H, '#f8e2a8');
  LAYER.sky = c;
  // montanhas distantes, lilases
  [c, g] = mk(layerW(PAR.far), H);
  const ridge = (base, amp, f, ph, col, sh, top) => {
    for (let x = 0; x < c.width; x++) {
      const hgt = amp * (.55 * Math.sin(x * f + ph) + .3 * Math.sin(x * f * 2.3 + ph * 3) + .15 * Math.sin(x * f * 5.1 + 1));
      const t = Math.round(base - hgt), slope = Math.cos(x * f + ph);
      rect(g, x, t, 1, H - t, slope < 0 ? sh : col); rect(g, x, t, 1, 2, top);
    }
  };
  ridge(118, 52, .022, 1.2, '#9a98d4', '#8886c4', '#c8c4ec');
  ridge(134, 32, .034, 3.1, '#7c82c4', '#6c72b4', '#a4a8dc');
  for (let y = 132; y < H; y += 2) { g.fillStyle = `rgba(214,218,236,${clamp((y - 132) / 60, 0, .55)})`; g.fillRect(0, y, c.width, 2); }
  LAYER.far = c;
  // colinas com ciprestes e a vila de colunas
  [c, g] = mk(layerW(PAR.hills), H); let R = rng(41);
  const hill = x => 130 + 8 * Math.sin(x * .018) + 5 * Math.sin(x * .047 + 2);
  for (let x = 0; x < c.width; x++) { const t = Math.round(hill(x)); rect(g, x, t, 1, H - t, '#6a9a78'); rect(g, x, t, 1, 2, '#9ac496'); }
  const hill2 = x => 146 + 6 * Math.sin(x * .03 + 1) + 3 * Math.sin(x * .09);
  for (let x = 0; x < c.width; x++) { const t = Math.round(hill2(x)); rect(g, x, t, 1, H - t, '#558866'); rect(g, x, t, 1, 1, '#7aae80'); }
  const CY = { out: '#1e3a26', b: '#2e5a3a', hi: '#4a7a52', sh: '#22442c' };
  for (let i = 0; i < 22; i++) { const x = R() * c.width; if (Math.abs(x - 470) < 40) continue; cypress(g, x, hill(x) + 3, 16 + R() * 18, R, CY); }
  for (let i = 0; i < 26; i++) { const x = R() * c.width; ell(g, x, hill2(x) - 2, 4 + R() * 3, 3, '#3e6e4a'); ell(g, x - 1, hill2(x) - 3, 2, 1.5, '#5e8e64'); }
  const vx = 470, vy = Math.round(hill(vx)) + 2;
  const Wl = '#ecd6ac', Ws = '#c9a878', Rf = '#b85a3a', Rs = '#8a3e28', Cl = '#f6ead0', Dk = '#5a3a2a', O = '#3a2418';
  rect(g, vx - 24, vy - 22, 48, 22, O); rect(g, vx - 23, vy - 21, 46, 21, Wl); rect(g, vx + 14, vy - 21, 9, 21, Ws);
  for (let i = 0; i < 5; i++) { rect(g, vx - 20 + i * 8, vy - 19, 3, 18, Cl); rect(g, vx - 18 + i * 8, vy - 19, 1, 18, Ws); }
  for (let k = 0; k < 9; k++) rect(g, vx - 27 + k * 3, vy - 23 - k, 54 - k * 6, 1, k === 0 ? Rs : Rf);
  rect(g, vx - 27, vy - 23, 54, 1, O); rect(g, vx - 3, vy - 12, 6, 12, Dk);
  rect(g, vx + 26, vy - 14, 22, 14, O); rect(g, vx + 27, vy - 13, 20, 13, Wl); rect(g, vx + 41, vy - 13, 6, 13, Ws);
  rect(g, vx + 25, vy - 17, 24, 3, Rf); rect(g, vx + 25, vy - 17, 24, 1, '#d87a50'); rect(g, vx + 31, vy - 10, 3, 4, Dk); rect(g, vx + 37, vy - 10, 3, 4, Dk);
  rect(g, vx - 52, vy - 10, 18, 10, O); rect(g, vx - 51, vy - 9, 16, 9, Wl); rect(g, vx - 53, vy - 13, 20, 3, Rf); rect(g, vx - 47, vy - 7, 3, 4, Dk);
  for (let i = 0; i < 4; i++) rect(g, vx - 8 - i * 2, vy + i * 2, 16 + i * 4, 2, i % 2 ? '#d8c09a' : '#c8ae88');
  cypress(g, vx - 32, vy + 2, 26, R, CY); cypress(g, vx + 54, vy + 2, 22, R, CY);
  OUT.sheep = []; for (let i = 0; i < 9; i++) { const x = 120 + R() * 280; OUT.sheep.push([x, hill2(x) + 4 + R() * 10]); }
  LAYER.hills = c;
  // vale: floresta, rio, lago e a cachoeira
  [c, g] = mk(layerW(PAR.valley), 300); R = rng(43);
  rect(g, 0, 150, c.width, 150, '#2e6a3a');
  const FO = { out: '#1a4224', b: '#3a7a3e', sh: '#2a5a30', mid: '#4e9448', hi: '#74b45a', hi2: '#9ad070' };
  for (let row = 0; row < 3; row++) for (let x = -8; x < c.width + 8; x += 7 + R() * 7) leafCluster(g, x, 124 + row * 9 + R() * 6, 6 + R() * 5, FO, R);
  const cl = { out: '#3a2418', shade: '#7a5234', base: '#a8784a', hi: '#c8986a', hi2: '#e0b888' };
  for (let y = 62; y < 154; y += 7) for (let x = 650; x < 726; x += 8 + R() * 3) boulder(g, x + R() * 3, y + R() * 2, 5 + R() * 3, 4 + R() * 2, cl, R);
  rect(g, 646, 56, 84, 5, '#4e9448'); rect(g, 646, 56, 84, 1, '#9ad070');
  for (let x = 650; x < 726; x += 7) leafCluster(g, x, 52 + R() * 3, 5 + R() * 3, FO, R);
  cypress(g, 712, 56, 26, R, CY);
  const river = [[0, 160], [70, 156], [140, 161], [210, 155], [290, 152], [360, 150], [430, 154], [510, 158], [580, 154], [650, 153], [690, 152]];
  for (let i = 0; i < river.length - 1; i++) {
    const [x1, y1] = river[i], [x2, y2] = river[i + 1];
    for (let x = x1; x <= x2; x++) { const y = Math.round(lerp(y1, y2, (x - x1) / (x2 - x1))); rect(g, x, y - 3, 1, 1, '#2a5a2e'); rect(g, x, y - 2, 1, 5, '#3f8fd0'); rect(g, x, y - 2, 1, 1, '#8ccff0'); rect(g, x, y + 3, 1, 1, '#2a5a2e'); }
  }
  VALLEY.river = river;
  ell(g, 360, 151, 56, 6, '#2a5a2e'); ell(g, 360, 151, 54, 5, '#4aa0dc'); ell(g, 350, 149, 34, 2, '#a8e0f8');
  ell(g, 684, 153, 18, 4, '#4aa0dc');
  for (let row = 0; row < 6; row++) for (let x = -8; x < c.width + 8; x += 8 + R() * 8) leafCluster(g, x, 172 + row * 20 + R() * 8, 8 + R() * 6, FO, R);
  for (let y = 190; y < 300; y += 2) { g.fillStyle = `rgba(200,220,210,${clamp((y - 190) / 140, 0, .6)})`; g.fillRect(0, y, c.width, 2); }
  LAYER.valley = c;
  // árvores próximas, abaixo do penhasco
  [c, g] = mk(layerW(PAR.near), 300); R = rng(47);
  const NE = { out: '#163a1e', b: '#2f7036', sh: '#22522a', mid: '#47904a', hi: '#6cb456', hi2: '#98d070' };
  for (let x = 30; x < c.width; x += 120 + R() * 90) cypress(g, x, 200, 70 + R() * 40, R, { out: '#14301a', b: '#285a32', hi: '#3e7a46', sh: '#1c4024' });
  for (let x = -10; x < c.width + 10; x += 14 + R() * 12) { const y = 150 + R() * 16; rect(g, x - 2, y, 4, 60, '#4a3020'); leafCluster(g, x, y, 12 + R() * 8, NE, R); }
  for (let row = 0; row < 5; row++) for (let x = -10; x < c.width + 10; x += 12 + R() * 10) leafCluster(g, x, 186 + row * 22 + R() * 8, 12 + R() * 6, NE, R);
  for (let y = 200; y < 300; y += 2) { g.fillStyle = `rgba(190,214,204,${clamp((y - 200) / 120, 0, .65)})`; g.fillRect(0, y, c.width, 2); }
  LAYER.near = c;
  // o planalto onde Code caminha
  [c, g] = mk(OUT.W, 380); R = rng(55);
  const grass = { top: '#9cd452', b: '#6aae3a', dk: '#4a8a2a' };
  rect(g, 0, 174, OUT.edge, 206, '#4e4038');
  for (let y = 176; y < 380; y += 9) for (let x = -6; x < OUT.edge - 4; x += 11 + R() * 6) boulder(g, x + R() * 4, y + R() * 3, 7 + R() * 5, 6 + R() * 3, y < 220 ? ROCK_SUN : { out: '#2a201c', shade: '#4a3c34', base: '#5e4c42', hi: '#76604e', hi2: '#8a7260' }, R);
  for (let y = 136; y < 380; y += 7) boulder(g, OUT.edge - 2 + R() * 6, y, 5 + R() * 4, 5 + R() * 2, ROCK_SUN, R);
  // monte rochoso da saída da caverna
  for (let y = 66; y < 172; y += 7) { const half = 30 + (y - 66) * .8; for (let x = 70 - half; x < 70 + half; x += 9 + R() * 4) boulder(g, x + R() * 3, y + R() * 2, 6 + R() * 4, 5 + R() * 3, ROCK_SUN, R); }
  moss(g, 40, 100, 66, R); for (let x = 30; x < 112; x += 5) rect(g, x, 62 + Math.abs(x - 70) * .3 + R() * 3, 3, 2, '#7cc243');
  ell(g, 70, 142, 17, 30, '#2a1e1a'); ell(g, 70, 145, 14, 27, '#0d0809');
  // grama do topo, com franja caindo sobre a rocha
  rect(g, 0, 166, OUT.edge, 8, grass.b); rect(g, 0, 166, OUT.edge, 1, grass.top);
  for (let x = 0; x < OUT.edge; x++) {
    if (R() < .6) { const h = 1 + ((R() * 4) | 0); rect(g, x, 166 - h, 1, h, R() < .5 ? grass.b : grass.top); }
    rect(g, x, 174, 1, 1 + ((R() * 3) | 0), grass.dk);
    if (R() < .12) rect(g, x, 174, 1, 4 + ((R() * 9) | 0), '#5a9a34');
  }
  // o riacho atravessa o planalto e cai pela rocha
  rect(g, OUT.streamX - 2, 166, OUT.streamW + 4, 8, '#3a5a3a');
  for (const sx of [OUT.streamX - 4, OUT.streamX + OUT.streamW + 3]) for (let y = 164; y < 216; y += 6) boulder(g, sx + R() * 2, y, 3 + R() * 2, 3, ROCK_SUN, R);
  rect(g, OUT.streamX + 2, 174, OUT.streamW - 4, 42, '#3a3a40');
  const T1 = bigTree(g, 300, 168, 1, R); OUT.treeTop = T1;
  bigTree(g, 1080, 168, .62, R);
  const BU = { out: '#1f4f2c', b: '#3c9448', sh: '#2c6e36', mid: '#62bb56', hi: '#98da74', hi2: '#c8ec96' };
  for (const bx of [170, 560, 760, 1180, 1290]) for (let i = 0; i < 6; i++) leafCluster(g, bx + R() * 30 - 15, 160 + R() * 6, 6 + R() * 5, BU, R);
  for (let i = 0; i < 12; i++) { const x = 140 + R() * 1200; if (Math.abs(x - OUT.streamX - 13) < 30) continue; boulder(g, x, 166, 4 + R() * 4, 3 + R() * 2, ROCK_SUN, R); moss(g, x - 3, x + 3, 163, R); }
  for (let i = 0; i < 170; i++) { const x = 130 + R() * (OUT.edge - 140); if (Math.abs(x - OUT.streamX - 13) < 20) continue; flowerAt(g, x, 163 + R() * 3, (R() * 4) | 0); }
  LAYER.ground = c;
  // primeiro plano: samambaias e o arbusto que esconde a borda do penhasco
  [c, g] = mk(OUT.W, H); R = rng(57);
  const FE = { out: '#163a14', b: '#3a8a2e', sh: '#286a22', mid: '#5aaa3e', hi: '#8ed05a', hi2: '#b8e47a' };
  for (let x = -10; x < OUT.W; x += 26 + R() * 30) for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * .38, len = 14 + R() * 8; thick(g, x, 220, x + Math.cos(a) * len * 1.4, 220 + Math.sin(a) * len, 3, 1, k % 2 ? FE.b : FE.mid); }
  for (let i = 0; i < 10; i++) leafCluster(g, 1364 + R() * 40, 150 + R() * 14, 7 + R() * 6, BU, R);
  for (let i = 0; i < 14; i++) rect(g, 1360 + R() * 46, 144 + R() * 18, 1, 1, ['#e8463a', '#ffd84a', '#ffffff'][(R() * 3) | 0]);
  LAYER.front = c;
}
// quadros animados de água (cachoeira e cascata do riacho)
function waterFrames(w, h, n, seed) {
  const R = rng(seed), off = []; for (let x = 0; x < w; x++) off.push((R() * 10) | 0);
  const out = [];
  for (let f = 0; f < n; f++) {
    const [c, g] = mk(w, h);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const v = (((y - f * 10 / n * 2 + off[x]) % 10) + 10) % 10;
      g.fillStyle = v < 1.6 ? '#ffffff' : v < 4.5 ? '#c4e8f8' : (x === 0 || x === w - 1) ? '#5aa8d8' : '#8ccbe8';
      g.fillRect(x, y, 1, 1);
    }
    for (let k = 0; k < w * 2; k++) { g.fillStyle = '#ffffff'; g.fillRect((R() * w) | 0, h - 1 - ((R() * 5) | 0), 1, 1); }
    out.push(c);
  }
  return out;
}
