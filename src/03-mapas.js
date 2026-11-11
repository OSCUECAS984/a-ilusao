// ============================================================ MAPAS
const LAYER = {};
// polígono preenchido por varredura, sem antialias
function polyFill(g, pts, col) {
  let ya = 1e9, yb = -1e9; for (const p of pts) { ya = Math.min(ya, p[1]); yb = Math.max(yb, p[1]); }
  g.fillStyle = col;
  for (let y = Math.ceil(ya); y <= Math.floor(yb); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) g.fillRect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1);
  }
}
// alvenaria de blocos talhados, de larguras e alturas desiguais (parapeito, canal do riacho)
function blocks(g, x0, y0, w, h, R, P) {
  const Hx = P.hex; rect(g, x0, y0, w, h, Hx[0]);
  let y = y0;
  while (y < y0 + h) {
    const bh = Math.min(7 + ((R() * 4) | 0), y0 + h - y); let x = x0 - ((R() * 8) | 0);
    while (x < x0 + w) {
      const bw = 12 + ((R() * 12) | 0), xa = Math.max(x, x0), xb = Math.min(x + bw - 1, x0 + w), ww = xb - xa, hh = bh - 1;
      if (ww > 2 && hh > 1) {
        rect(g, xa, y, ww, hh, Hx[2 + ((R() * 2) | 0)]); rect(g, xa, y, ww, 1, Hx[4]); rect(g, xb - 1, y, 1, hh, Hx[4]); rect(g, xa, y + hh - 1, ww, 1, Hx[1]); rect(g, xa, y, 1, hh, Hx[1]);
        rect(g, xa, y, 1, 1, Hx[0]); if (R() < .5) rect(g, xb - 1, y + hh - 1, 1, 1, Hx[0]);
        if (ww > 6 && R() < .3) crack(g, xa + 2 + ((R() * (ww - 4)) | 0), y + 1, hh - 2, Hx[1], R);
      }
      x += bw;
    }
    y += bh;
  }
}

// ---------------- Cenários I e II: a câmara das sombras e o salão do fogo
const CH = { W: 1040, floor: 182, rings: [44, 105, 175, 240], ringY: 140, wallTop: 80, wallEnd: 480, fireX: 890, fireY: 169, exitX: 1012, lampX: 538, lampY: 67 };
const PRIS = { mistico: 70, code: 140, arrogante: 210 };
// Estátuas: x; y = topo do pedestal (onde ela pisa); hw = meia largura do nicho escavado atrás dela; iy = altura do ícone de inspeção.
const STATUES = [ { k: 'shield', x: 652, y: 132, hw: 22, iy: 62 }, { k: 'horse', x: 708, y: 132, hw: 30, iy: 80 }, { k: 'spear', x: 768, y: 142, hw: 20, iy: 64 },
  { k: 'tree', x: 822, y: 142, hw: 28, iy: 69 }, { k: 'bird', x: 952, y: 118, iy: 79 } ];
const SHADOWS = [ { k: 'shield', x: 252, b: 179 }, { k: 'horse', x: 312, b: 179 }, { k: 'spear', x: 364, b: 182 }, { k: 'tree', x: 410, b: 181 }, { k: 'bird', x: 458, b: 146 } ];
const HALL_SHROOMS = [[490, 1], [495, 0], [997, 0], [1002, 1]];   // cogumelos luminosos no chão: [x, grande?]
// Perfil do que foi talhado no salão: a passarela das estátuas desce em dois patamares e uma escada até o estrado da fogueira.
function hallTop(x) { return x < 616 ? 999 : x < 744 ? 140 : x < 852 ? 150 : x < 859 ? 157 : x < 866 ? 164 : x < 916 ? 170 : x < 923 ? 174 : x < 930 ? 178 : 999; }
// cabeça de estátua quebrada, largada no chão
function stoneHead(g, x, y, P) {
  const Hx = P.hex; rect(g, x, y - 8, 9, 8, Hx[0]); rect(g, x + 1, y - 9, 6, 1, Hx[0]); rect(g, x + 1, y - 8, 7, 7, Hx[3]); rect(g, x + 1, y - 8, 7, 1, Hx[5]);
  rect(g, x + 6, y - 7, 2, 5, Hx[4]); rect(g, x + 1, y - 7, 2, 6, Hx[2]); rect(g, x + 5, y - 6, 2, 1, Hx[0]); rect(g, x + 8, y - 5, 2, 2, Hx[0]); rect(g, x + 8, y - 5, 1, 1, Hx[4]); rect(g, x + 5, y - 3, 3, 1, Hx[1]); rect(g, x + 1, y - 2, 3, 1, Hx[0]);
}

function buildChamber() {
  const WW = CH.W, F = CH.floor, pix = new Pix(WW, H), R = rng(7), R2 = rng(70), fx = CH.fireX;
  const stal = spikeRow(R, 0, WW, 12, 34, 5, 30, 3, 5), ceil = new Float32Array(WW), lip = new Float32Array(WW);
  for (let x = 0; x < WW; x++) {
    ceil[x] = x > 938 && x < 992 ? 0 : (x < 484 ? 30 : 20) + jag(x, 34, 9, 1) + jag(x, 9, 2.5, 2) + spikeAt(stal, x) * (x < 484 ? 1 : x < 600 ? .35 : .6);
    lip[x] = CH.wallTop + jag(x, 41, 4, 3) + jag(x, 11, 1.5, 4);
  }
  const corner = y => 486 + jag(y, 13, 3, 5), inX = (x, a, b) => x >= a && x < b;
  // A rocha do salão muda de cor com a distância do fogo: brasa → marrom → malva → roxo frio, em transições pontilhadas
  // (o mesmo recurso da boca da caverna). Longe do fogo ela é a mesma pedra roxa das outras fases.
  const warm = (x, y) => { const d = Math.hypot(x - fx, (y - 150) * 1.2) + (bay(x, y) - .5) * 46; return d < 92 ? RK.lit : d < 215 ? RK.wall : d < 360 ? RK.hall : RK.cave; };
  const hx = (x, y) => warm(x, y).hex;
  // nichos escavados na parede, um atrás de cada estátua: o fundo escuro faz a pedra clara saltar
  for (const s of STATUES) if (s.hw) s.nt = s.y - (S.statue[s.k].height - 12) - 9;
  const niche = (x, y) => { for (const s of STATUES) { if (!s.hw || y < s.nt || y >= hallTop(s.x)) continue; const t = y - s.nt; if (Math.abs(x - s.x) < (t < 9 ? s.hw * (.5 + .5 * t / 9) : s.hw) + jag(y, 5, 1.2, s.x)) return true; } return false; };
  // pórtico em ruínas (duas colunas, lintel e meio frontão), coluna quebrada e o pilar natural onde pousa o pássaro
  const gate = (x, y) => {
    if (y < 36) return false;
    if (y < 46) return x >= 497 + (46 - y) * 4 && x < 551 + jag(y, 3, 3, 33);
    if (y < 58) return inX(x, 493, 583);
    if (y < 64 || y >= F - 6) return inX(x, 497, 523) || inX(x, 553, 579);
    return inX(x, 500, 520) || inX(x, 556, 576);
  };
  const stump = (x, y) => (inX(x, 594, 610) && y >= 141 + jag(x, 4, 3, 37)) || (inX(x, 592, 612) && y >= F - 5);
  const perch = (x, y) => y >= 118 && Math.abs(x - 952) < (y < 121 ? 7 : 4 + (y - 118) * .11 + jag(y, 9, 1.5, 39));
  const built = (x, y) => y < F && (y >= hallTop(x) || gate(x, y) || stump(x, y) || perch(x, y));
  // 1. rocha recuada, no escuro  2. o paredão das sombras: liso, talhado  3. fundo do salão, com os nichos
  // 4. tudo o que foi talhado no salão  5. teto com estalactites  6. chão (aquecido perto do fogo)
  terrain(pix, () => true, { ramp: RK.far, cw: 22, ch: 12, seed: 3, lx: 1, contrast: .8, deep: 0 });
  terrain(pix, (x, y) => x < corner(y) && y >= lip[x], { ramp: RK.wall, cw: 34, ch: 15, seed: 5, lx: 1, contrast: .4, edge: .5, deep: 0, x1: 494 });
  terrain(pix, (x, y) => x >= corner(y) && y >= 44 + jag(x, 37, 5, 8) && !niche(x, y), { rampAt: warm, cw: 19, ch: 10, seed: 9, lx: 1, contrast: .9, deep: 0, x0: 480 });
  terrain(pix, built, { rampAt: (x, y) => x < 612 ? RK.hall : warm(x, y), cw: 11, ch: 7, seed: 15, lx: 1, deep: 11, x0: 484 });
  terrain(pix, (x, y) => y < ceil[x], { ramp: RK.cave, cw: 15, ch: 9, seed: 11, lx: 1, deep: 8, y1: 112 });
  terrain(pix, (x, y) => y >= F, { rampAt: (x, y) => x > 620 && Math.abs(x - fx) + (bay(x, y) - .5) * 44 < 84 ? RK.lit : RK.floor, cw: 30, ch: 9, seed: 13, lx: 1, contrast: .4, edge: .6, deep: 18, y0: F });
  const [c, g] = pix.done(), WH = RK.wall.hex, HH = RK.hall.hex;

  // ---------- Fase 1: estratos, marcas de picareta e rachaduras (caverna escavada, sem pedras empilhadas)
  for (const [y0, s] of [[104, 31], [128, 32], [156, 33]]) for (let x = 0; x < 482; x++) if (hash2(x >> 3, s, 1) < .7) rect(g, x, y0 + Math.round(jag(x, 57, 3, s)), 1, 1, WH[1]);
  for (let i = 0; i < 120; i++) {
    const x = (R() * 474) | 0, y = lip[x] + 6 + R() * (F - lip[x] - 14), n = 2 + ((R() * 3) | 0), dir = R() < .7 ? 1 : -1;
    for (let k = 0; k < n; k++) { rect(g, x + k * dir, y + k, 1, 1, WH[1]); if (k) rect(g, x + k * dir, y + k - 1, 1, 1, WH[4]); }
  }
  for (let i = 0; i < 7; i++) { const x = 20 + ((R() * 450) | 0); crack(g, x, Math.round(lip[x]) + 1, 10 + R() * 30, WH[0], R); }
  for (const rx of CH.rings) ringPlate(g, rx, CH.ringY);
  for (const [x, w, h] of [[16, 7, 16], [290, 6, 11], [300, 9, 22], [468, 8, 19], [478, 5, 10]]) spike(g, x, F, w, h, RK.wall, -1, R);

  // ---------- Fase 2: o salão dos fazedores de sombras
  // marcas de ferramenta no fundo
  for (let i = 0; i < 70; i++) {
    const x = 500 + ((R2() * 520) | 0), y = (52 + R2() * 84) | 0, n = 2 + ((R2() * 3) | 0); if (niche(x, y) || built(x, y)) continue;
    const Hc = hx(x, y); for (let k = 0; k < n; k++) rect(g, x + k, y + k, 1, 1, Hc[1]);
  }
  // fenda no teto por onde a fumaça sai e a luz do dia entra; a vida já desce por ela (musgo e cipós)
  for (let x = 940; x < 990; x++) { const y = 3 + Math.round(jag(x, 6, 2.5, 21)), th = 2 + (hash2(x, 3, 4) < .4 ? 1 : 0); rect(g, x, 0, 1, y, '#1c1210'); rect(g, x, y - 1, 1, th + 2, '#4a2c18'); rect(g, x, y, 1, th, x % 3 ? '#ffe6a8' : '#f4bc64'); }
  for (let x = 936; x < 994; x += 2) if (R2() < .6) rect(g, x, 7 + ((R2() * 3) | 0), 2, 1, MOSS[1 + ((R2() * 2) | 0)]);
  for (const [vx, len] of [[944, 12], [957, 24], [969, 15], [986, 19]]) vine(g, vx, 6, len, R2);
  // pórtico: juntas dos tambores, caneluras, capitéis, entalhes do lintel, corrente da lanterna
  for (const cx0 of [500, 556]) {
    for (let y = 77; y < F - 8; y += 14) { rect(g, cx0, y, 20, 1, HH[0]); rect(g, cx0 + 1, y + 1, 18, 1, HH[4]); }
    for (const dx of [5, 10, 15]) for (let y = 66; y < F - 8; y += 2) rect(g, cx0 + dx, y, 1, 1, HH[1]);
    rect(g, cx0 - 3, 58, 26, 1, HH[5]); rect(g, cx0 - 3, 63, 26, 1, HH[0]); rect(g, cx0 - 3, F - 6, 26, 1, HH[5]);
    crack(g, cx0 + 3 + ((R2() * 12) | 0), 70 + ((R2() * 40) | 0), 14 + R2() * 16, HH[0], R2);
  }
  rect(g, 493, 46, 90, 1, HH[5]); rect(g, 493, 56, 90, 1, HH[1]); for (let x = 499; x < 580; x += 9) rect(g, x, 49, 2, 5, HH[1]);
  for (let y = 58; y < CH.lampY; y += 2) rect(g, CH.lampX, y, 1, 1, '#8d93a0');
  stoneHead(g, 580, F + 1, RK.hall); for (let i = 0; i < 5; i++) chip(g, 590 + ((R2() * 22) | 0), F + 1, 3 + ((R2() * 4) | 0), 2 + ((R2() * 3) | 0), RK.hall);
  // passarela: lajes de arremate e friso entalhado em grega
  for (const [x0, x1, top] of [[616, 744, 140], [744, 852, 150]]) {
    let x = x0; while (x < x1) { const w = Math.min(x1 - x, 13 + ((R2() * 9) | 0)), Hc = hx(x, top); rect(g, x, top, w, 3, Hc[4]); rect(g, x, top, w, 1, Hc[5]); rect(g, x + w - 1, top, 1, 3, Hc[1]); rect(g, x, top + 3, w, 1, Hc[0]); x += w; }
    for (x = x0 + 5; x + 7 <= x1 - 3; x += 8) { const col = hx(x, top + 9)[1], y = top + 7; rect(g, x, y, 6, 1, col); rect(g, x, y, 1, 5, col); rect(g, x, y + 4, 5, 1, col); rect(g, x + 4, y + 2, 1, 2, col); rect(g, x + 2, y + 2, 3, 1, col); }
  }
  // pedestais e estátuas (o pássaro pousa direto no topo do pilar)
  for (const s of STATUES) {
    const spr = S.statue[s.k], pw = Math.max(18, Math.round(spr.width * .5)), Hc = hx(s.x, s.y), hh = hallTop(s.x) - s.y - 2, xa = Math.round(s.x - pw / 2);
    if (s.hw) { rect(g, xa - 2, s.y, pw + 4, 3, Hc[0]); rect(g, xa - 1, s.y, pw + 2, 2, Hc[5]); rect(g, xa - 1, s.y + 2, pw + 2, hh, Hc[0]); rect(g, xa, s.y + 2, pw, hh, Hc[3]); rect(g, xa, s.y + 2, 3, hh, Hc[1]); rect(g, xa + pw - 2, s.y + 2, 2, hh, Hc[4]); }
    if (s.x > fx) { g.save(); g.translate(s.x * 2, 0); g.scale(-1, 1); }   // à direita do fogo a estátua é espelhada: o lado claro fica virado para a chama
    g.drawImage(spr, Math.round(s.x - spr.width / 2), s.y - (spr.height - 6));
    if (s.x > fx) g.restore();
  }
  // a fogueira: leito de cinzas, anel de pedras, toras cruzadas e brasas
  rect(g, fx - 12, 167, 24, 3, '#1c1210');
  for (let i = -15; i <= 12; i += 5) chip(g, fx + i, 171, 5, 3 + (i & 1), RK.lit);
  thick(g, fx - 12, 168, fx + 3, 158, 3, 3, '#24140c'); thick(g, fx + 12, 168, fx - 3, 158, 3, 3, '#24140c');
  thick(g, fx - 12, 167, fx + 3, 157, 1, 1, '#7a5030'); thick(g, fx + 12, 167, fx - 3, 157, 1, 1, '#6a4428');
  rect(g, fx - 10, 165, 20, 3, '#24140c'); rect(g, fx - 10, 165, 20, 1, '#7a5030'); rect(g, fx + 8, 165, 2, 3, '#b8864e');
  for (let i = -8; i < 9; i += 4) rect(g, fx + i, 168, 2, 1, '#e0602a');
  amphora(g, 532, F); amphora(g, 630, F); amphora(g, 978, F);
  for (const [x, big] of HALL_SHROOMS) shroom(g, x, F, big);
  for (let i = 0; i < 26; i++) chip(g, 20 + ((R2() * 1000) | 0), F + 1, 2 + ((R2() * 4) | 0), 1 + ((R2() * 3) | 0), RK.floor);
  // passagem de saída: arco irregular talhado na rocha, já com musgo e cipós
  polyFill(g, [[1007, F], [1005, 150], [1008, 121], [1015, 101], [1027, 91], [1040, 88], [1040, F]], HH[0]);
  polyFill(g, [[1012, F], [1010, 151], [1013, 124], [1019, 106], [1029, 97], [1040, 94], [1040, F]], '#020104');
  for (const [x, y, w, h] of [[1003, 168, 7, 10], [1002, 150, 6, 10], [1004, 130, 6, 9], [1008, 110, 7, 9], [1017, 95, 8, 7]]) { rect(g, x, y, w, h, HH[0]); rect(g, x + 1, y + 1, w - 2, h - 2, HH[3]); rect(g, x + 1, y + 1, w - 2, 1, HH[5]); rect(g, x + 1, y + h - 2, w - 2, 1, HH[1]); }
  for (const [x, y, w] of [[1004, 129, 5], [1008, 109, 6], [1018, 94, 7]]) { rect(g, x, y, w, 2, MOSS[1]); rect(g, x + 1, y, w - 2, 1, MOSS[2]); }
  vine(g, 1026, 97, 15, R2); vine(g, 1035, 95, 9, R2);
  // profundidade: véu pontilhado de escuro no alto e no rodapé
  veil(g, 0, 0, WW, 50, '#05030a', (x, y) => .55 - y / 44);
  veil(g, 0, F + 16, WW, H - F - 16, '#05030a', (x, y) => (y - F - 16) / 40);
  return c;
}
// primeiro plano da câmara: pontas quase pretas no alto e no rodapé, com paralaxe mais rápida (profundidade)
function buildChamberFg() {
  const w = Math.ceil(W + (CH.W - W) * 1.25), pix = new Pix(w, H), R = rng(81), BK = ramp('#020104', '#040208', '#06040b', '#09050f', '#0c0714', '#130b1e');
  const dn = spikeRow(R, 60, w, 70, 120, 12, 26, 7, 6), up = spikeRow(R, 30, w, 110, 160, 5, 9, 10, 8);
  terrain(pix, (x, y) => y < 2 + spikeAt(dn, x) + jag(x, 17, 2, 82) || y > H - 2 - spikeAt(up, x), { ramp: BK, cw: 14, ch: 9, seed: 83, lx: 1, deep: 6 });
  return pix.done()[0];
}

// ---------------- Sala secreta (à esquerda da câmara)
// A laje fica no canto esquerdo do paredão, logo depois da estalagmite. Atrás dela: um vestíbulo onde se fica
// de pé, um túnel de 27 px de altura (só passa agachado) e a sala escondida, alta, com alvenaria talhada,
// duas pilastras e um nicho com um plinto vazio. O conteúdo da sala ainda será decidido.
const SECRET = { code: '984', doorX: 33, doorW: 24, doorH: 28 };
const SEC = { W: 600, floor: 182, tunnelA: 250, tunnelB: 470, lowX: 575, nicheX: 134,
  shrooms: [[70, 182, 1], [206, 182, 0], [292, 182, 0], [366, 182, 1], [438, 182, 0], [540, 182, 0]] };
const SEC_SOLIDS = [
  { x: -40, y: 182, w: 700, h: 60 },    // chão
  { x: -60, y: -60, w: 82, h: 300 },    // parede da sala, à esquerda
  { x: 250, y: -60, w: 220, h: 215 },   // teto do túnel: termina em 155 (agachado cabe, de pé não)
  { x: 470, y: -60, w: 105, h: 160 },   // teto do vestíbulo (100)
  { x: 575, y: -60, w: 100, h: 214 },   // passagem baixa de volta à câmara (154)
];
// numerais romanos talhados acima do nicho
const GLYPH = { I: ['x', 'x', 'x', 'x', 'x'], V: ['x.x', 'x.x', 'x.x', 'x.x', '.x.'], X: ['x.x', 'x.x', '.x.', 'x.x', 'x.x'] };
function carve(g, text, cx, y, P) {
  const w = [...text].reduce((a, ch) => a + (ch === ' ' ? 4 : GLYPH[ch][0].length + 1), -1);
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    if (ch === ' ') { x += 4; continue; }
    const m = GLYPH[ch];
    m.forEach((row, j) => [...row].forEach((c, i) => { if (c === 'x') { rect(g, x + i, y + j, 1, 1, P.hex[0]); rect(g, x + i, y + j + 1, 1, 1, P.hex[4]); } }));
    x += m[0].length + 1;
  }
}
function buildSecret() {
  const WW = SEC.W, F = SEC.floor, A = SEC.tunnelA, B = SEC.tunnelB, LX = SEC.lowX, R = rng(984), HH = RK.hall.hex, nx = SEC.nicheX;
  const bg = new Pix(WW, H);
  terrain(bg, () => true, { ramp: RK.far, cw: 20, ch: 11, seed: 41, lx: 1, contrast: .7, deep: 0 });
  const [c, g] = bg.done();
  // sala: alvenaria de blocos, pilastras e o nicho em arco com o plinto vazio
  blocks(g, 22, 40, A - 22, F - 40, R, RK.hall);
  for (const px of [52, 218]) {
    rect(g, px - 6, 58, 12, F - 58, HH[0]); rect(g, px - 5, 64, 10, F - 66, HH[3]); rect(g, px - 5, 64, 2, F - 66, HH[1]); rect(g, px + 3, 64, 2, F - 66, HH[4]);
    for (let y = 80; y < F - 6; y += 16) { rect(g, px - 5, y, 10, 1, HH[1]); rect(g, px - 5, y + 1, 10, 1, HH[4]); }
    rect(g, px - 8, 56, 16, 7, HH[0]); rect(g, px - 7, 57, 14, 5, HH[4]); rect(g, px - 7, 57, 14, 1, HH[5]); rect(g, px - 8, F - 5, 16, 5, HH[0]); rect(g, px - 7, F - 4, 14, 4, HH[3]); rect(g, px - 7, F - 4, 14, 1, HH[5]);
  }
  const arch = d => [[nx - 17 + d, F], [nx - 17 + d, 102], [nx - 13 + d, 93 + d], [nx - 6, 89 + d], [nx + 6, 89 + d], [nx + 13 - d, 93 + d], [nx + 17 - d, 102], [nx + 17 - d, F]];
  polyFill(g, arch(0), HH[0]); polyFill(g, arch(2), '#0c0714'); polyFill(g, arch(4), '#120b1b');
  rect(g, nx - 10, 150, 20, F - 150, HH[0]); rect(g, nx - 9, 151, 18, F - 151, HH[3]); rect(g, nx - 9, 151, 18, 1, HH[5]); rect(g, nx - 9, 152, 3, F - 152, HH[2]); rect(g, nx + 6, 152, 3, F - 152, HH[4]);
  rect(g, nx - 11, 147, 22, 4, HH[0]); rect(g, nx - 10, 148, 20, 2, HH[4]); rect(g, nx - 10, 148, 20, 1, HH[5]);
  carve(g, 'IX VIII IV', nx, 78, RK.hall);
  for (let i = 0; i < 5; i++) crack(g, 30 + ((R() * 200) | 0), 60 + ((R() * 60) | 0), 8 + R() * 18, HH[0], R);
  // o túnel foi revestido de pedra, como a sala: atrás de Code se vê a alvenaria, mais escura, sob a rocha bruta
  blocks(g, A - 4, 146, B - A + 8, F - 146, rng(985), RK.hall);
  veil(g, A - 4, 146, B - A + 8, F - 146, '#05030a', () => .42);
  veil(g, B, 96, WW - B, F - 96, '#05030a', () => .12);
  // rocha da frente: teto, chão e paredes (o teto nunca desce abaixo dos sólidos)
  const fg = new Pix(WW, H), stal = spikeRow(R, 30, A - 10, 14, 26, 4, 14, 3, 4);
  const top = x => x < A ? 40 + jag(x, 21, 5, 62) + jag(x, 6, 1.5, 63) + spikeAt(stal, x) : x < B ? 154 - Math.abs(jag(x, 9, 2.5, 64)) : x < LX ? 99 - Math.abs(jag(x, 15, 6, 65)) : 153 - Math.abs(jag(x, 7, 2, 66));
  terrain(fg, (x, y) => y >= F || y < top(x) || x < 21 + jag(y, 9, 2, 61), { rampAt: (x, y) => y >= F ? RK.floor : RK.cave, cw: 13, ch: 8, seed: 98, lx: 1, deep: 20, contrast: 1.1 });
  g.drawImage(fg.done()[0], 0, 0);
  // vida que chegou até aqui: musgo, raízes curtas no teto do túnel, cogumelos e lascas no chão
  mossTop(g, 24, 46, F, R, .6); mossTop(g, 470, 500, F, R, .5);
  for (let x = A + 12; x < B - 8; x += 18 + R() * 22) vine(g, x, Math.round(top(x | 0)), 2 + R() * 3, R);
  for (const [x, y, big] of SEC.shrooms) shroom(g, x, y, big);
  for (let i = 0; i < 18; i++) chip(g, 30 + ((R() * 540) | 0), F + 1, 2 + ((R() * 4) | 0), 1 + ((R() * 3) | 0), RK.floor);
  amphora(g, 92, F); stoneHead(g, 176, F + 1, RK.hall);
  veil(g, 0, 0, WW, 46, '#05030a', (x, y) => .55 - y / 44);
  veil(g, 0, F + 16, WW, H - F - 16, '#05030a', (x, y) => (y - F - 16) / 40);
  return c;
}

// ---------------- Cenário III: a ascensão no escuro
const PK = { W: 1100, H: 360, death: 338, exitX: 1062, base: 300, top: 92,
  post: { x: 621, y: 204, stand: 230 },   // lanterna pendurada no poste, sobre o pilar (stand = chão onde Code pega)
  lamp: { state: 'post' } };   // 'post' | 'hand' | 'ground' (com x, y = chão onde foi deixada)
const PK_SOLIDS = [
  { x: 0,   y: 300, w: 120, h: 80,  moss: [.5, 1],  sh: [[104, 1]] },
  { x: 150, y: 288, w: 46,  h: 10, f: 1, moss: [.2, 1],  sh: [[8, 0], [36, 1]] },
  { x: 226, y: 262, w: 40,  h: 10, f: 1, moss: [0, .7],  sh: [[31, 0]] },
  { x: 296, y: 284, w: 40,  h: 90,  moss: [.1, .8], sh: [[6, 1]] },
  { x: 474, y: 236, w: 40,  h: 10, f: 1, moss: [.2, .9], sh: [[6, 0], [32, 1]] },
  { x: 544, y: 212, w: 36,  h: 10, f: 1, moss: [0, .6],  sh: [[29, 0]] },
  { x: 612, y: 230, w: 40,  h: 140, moss: [0, .5],  sh: [[35, 0]] },
  { x: 756, y: 140, w: 44,  h: 10, f: 1, moss: [.3, 1],  sh: [[6, 1]] },
  { x: 832, y: 114, w: 36,  h: 10, f: 1, moss: [0, .7],  sh: [[29, 0]] },
  { x: 900, y: 92,  w: 200, h: 280, moss: [0, .5],  sh: [[9, 1], [148, 1], [155, 0]] },
];
const PK_CEIL = { x: 820, y: -100, w: 280, h: 112 };   // teto baixo sobre o último trecho
const MOVERS_DEF = [
  { x: 360, y: 262, w: 40, h: 10, ax: 'x', a: 360, b: 426, per: 3.6 },
  { x: 684, y: 226, w: 40, h: 10, ax: 'y', a: 150, b: 226, per: 4.2 },
];
// plataforma solta: topo reto (onde se pisa), barriga irregular com pontas pendentes
const slabDepth = (xx, w, seed, hang) => Math.max(3, (6 + jag(xx, 7, 2, seed) + spikeAt(hang, xx)) * Math.min(1, (Math.min(xx, w - 1 - xx) + 2.5) / 6));
function buildParkourBg() {
  const w = Math.ceil(W + (PK.W - W) * .5), h = Math.ceil(H + (PK.H - H) * .5), pix = new Pix(w, h), R = rng(19);
  terrain(pix, () => true, { ramp: RK.far, cw: 26, ch: 14, seed: 17, lx: 1, contrast: .7, deep: 0 });
  const up = spikeRow(R, 0, w, 26, 60, 40, 150, 9, 14), dn = spikeRow(R, 0, w, 22, 50, 20, 90, 7, 10), top = new Float32Array(w), bot = new Float32Array(w);
  for (let x = 0; x < w; x++) { top[x] = 6 + spikeAt(dn, x) + jag(x, 11, 2, 4); bot[x] = h - 12 - spikeAt(up, x) + jag(x, 9, 2, 3); }
  terrain(pix, (x, y) => y > bot[x] || y < top[x], { ramp: RK.mid, cw: 16, ch: 10, seed: 19, lx: 1, deep: 10 });
  return pix.done()[0];
}
function buildParkour() {
  const WW = PK.W, HH = PK.H, pix = new Pix(WW, HH), R = rng(21), M2 = new Uint8Array(WW * HH);
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < WW && y < HH) M2[(y | 0) * WW + (x | 0)] = 1; };
  for (const s of PK_SOLIDS) {
    const hang = spikeRow(R, 5, s.w - 3, 7, 9, 5, 15, 3, 3);
    for (let x = s.x; x < s.x + s.w; x++) { const dp = s.f ? slabDepth(x - s.x, s.w, s.x, hang) : HH; for (let y = s.y; y < Math.min(HH, s.y + dp); y++) mark(x, y); }
    if (!s.f) for (let y = s.y + 5; y < HH; y++) {   // laterais lascadas dos pilares (crescem só para fora)
      const k = Math.min(1, (y - s.y - 5) / 10), bl = Math.max(0, Math.round((1.5 + jag(y, 11, 2, s.x + 1) + (y - s.y) * .03) * k)), br = Math.max(0, Math.round((1.5 + jag(y, 13, 2, s.x + 2) + (y - s.y) * .03) * k));
      for (let q = 1; q <= bl; q++) mark(s.x - q, y); for (let q = 0; q < br; q++) mark(s.x + s.w + q, y);
    }
  }
  const stal = spikeRow(R, 0, WW, 9, 22, 4, 24, 3, 4), ceil = new Float32Array(WW), pit = new Float32Array(WW);
  for (let x = 0; x < WW; x++) { ceil[x] = 11 + jag(x, 29, 5, 31) + jag(x, 8, 2, 32) + spikeAt(stal, x) * (x > 880 ? .45 : 1); pit[x] = 351 + jag(x, 23, 3, 41); }
  terrain(pix, (x, y) => M2[y * WW + x] || y < ceil[x] || y >= pit[x] || x < 6 + jag(y, 17, 3, 51) || x >= WW - 8 + jag(y, 19, 3, 52), { ramp: RK.cave, cw: 13, ch: 8, seed: 21, lx: 1, deep: 8 });
  const [c, g] = pix.done(), CV = RK.cave.hex, T = PK.top;
  // a passagem de saída, no alto: um arco escuro talhado na parede da direita (nenhuma luz do dia chega aqui)
  polyFill(g, [[1066, T], [1064, T - 22], [1068, T - 38], [1078, T - 48], [1092, T - 52], [WW, T - 52], [WW, T]], CV[0]);
  polyFill(g, [[1071, T], [1069, T - 21], [1073, T - 35], [1081, T - 44], [1093, T - 47], [WW, T - 47], [WW, T]], '#020104');
  for (const [x, y, w, h] of [[1062, T - 11, 7, 11], [1061, T - 26, 7, 10], [1065, T - 40, 8, 9], [1075, T - 51, 9, 7]]) { rect(g, x, y, w, h, CV[0]); rect(g, x + 1, y + 1, w - 2, h - 2, CV[3]); rect(g, x + 1, y + 1, w - 2, 1, CV[5]); rect(g, x + 1, y + h - 2, w - 2, 1, CV[1]); }
  vine(g, 1080, T - 46, 12, R); vine(g, 1090, T - 48, 8, R);
  // a passagem de entrada, embaixo à esquerda: o túnel por onde Code chega do salão (e volta para ele)
  const B = PK.base;
  polyFill(g, [[0, B], [0, B - 46], [9, B - 50], [20, B - 47], [29, B - 38], [33, B - 24], [34, B]], CV[0]);
  polyFill(g, [[0, B], [0, B - 41], [8, B - 45], [18, B - 42], [25, B - 35], [28, B - 22], [29, B]], '#020104');
  for (const [x, y, w, h] of [[27, B - 12, 7, 12], [28, B - 25, 6, 11], [23, B - 38, 8, 9], [12, B - 50, 10, 7], [0, B - 49, 9, 6]]) { rect(g, x, y, w, h, CV[0]); rect(g, x + 1, y + 1, w - 2, h - 2, CV[3]); rect(g, x + 1, y + 1, w - 2, 1, CV[5]); rect(g, x + 1, y + h - 2, w - 2, 1, CV[1]); }
  rect(g, 0, B, 30, 1, CV[1]); vine(g, 16, B - 48, 9, R);
  // musgo, cogumelos luminosos e cipós nas plataformas
  PK.shrooms = [];
  for (const s of PK_SOLIDS) {
    if (s.f) for (let k = 0; k < 2; k++) if (R() < .75) vine(g, s.x + 6 + R() * (s.w - 12), s.y + 4, 9 + R() * 18, R);
    if (s.moss) mossTop(g, s.x + s.moss[0] * s.w, s.x + s.moss[1] * s.w, s.y, R);
    for (const [dx, big] of s.sh || []) { shroom(g, s.x + dx, s.y, big); PK.shrooms.push([s.x + dx, s.y, big]); }
  }
  // estacas no fundo do poço: escuras, tortas e desiguais
  for (let x = 124; x < 898; x += 4 + R() * 5) {
    if (PK_SOLIDS.some(s => !s.f && x > s.x - 6 && x < s.x + s.w + 6)) continue;
    spike(g, x, Math.round(pit[x | 0]) + 2, 4 + R() * 4, 9 + R() * 13, RK.spike, -1, R);
  }
  amphora(g, 62, 300);
  rect(g, 614, 202, 3, 28, '#140c10'); rect(g, 615, 203, 1, 27, '#4a3a3c'); rect(g, 614, 202, 9, 2, '#140c10'); rect(g, 612, 228, 7, 2, '#140c10');   // poste da lanterna
  return c;
}
function buildMover(m) {
  const pix = new Pix(m.w + 4, 34), R = rng(m.x), hang = spikeRow(R, 5, m.w - 3, 7, 8, 5, 12, 3, 3);
  terrain(pix, (x, y) => x >= 2 && x < m.w + 2 && y >= 5 && y < 5 + slabDepth(x - 2, m.w, m.x, hang), { ramp: RK.cave, cw: 11, ch: 7, seed: m.x, lx: 1, deep: 6 });
  const [c, g] = pix.done(); mossTop(g, 2 + m.w * .15, 2 + m.w * .85, 5, R); shroom(g, m.w - 6, 5, false);
  return c;
}

// ---------------- Cenário IV: a entrada da caverna
// Abertura larga e orgânica (contorno polar com ruído anguloso), lábio de estalactites, pedras ao pé.
const MOUTH = { W: 640, cx: 598, cy: 114, rx: 152, ry: 98, trig: 566 };
function mouthD(x, y) {
  const dx = (x - MOUTH.cx) / MOUTH.rx, dy = (y - MOUTH.cy) / MOUTH.ry, a = Math.atan2(dy, dx) * 40;
  return Math.hypot(dx, dy) / (1 + jag(a, 9, .1, 71) + jag(a, 3.5, .035, 72));
}
function buildMouth() {
  const WW = MOUTH.W, F = CH.floor, pix = new Pix(WW, H), R = rng(33);
  const stal = spikeRow(R, 0, WW, 12, 26, 5, 30, 3, 5), big = spikeRow(R, 452, WW, 15, 24, 16, 44, 5, 6), mound = spikeRow(R, 400, 482, 8, 9, 8, 30, 6, 7);
  const ceil = new Float32Array(WW), pile = new Float32Array(WW), DM = new Float32Array(WW * H);
  for (let x = 0; x < WW; x++) { ceil[x] = 24 + jag(x, 31, 8, 61) + jag(x, 9, 2.5, 62) + spikeAt(stal, x) + spikeAt(big, x); pile[x] = spikeAt(mound, x); }
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < WW; x++, i++) DM[i] = mouthD(x, y);
  // a rocha esquenta de cor conforme chega perto da luz: transição pontilhada entre as rampas
  const rampAt = (x, y) => { const d = DM[y * WW + x] + (bay(x, y) - .5) * .24; return d < 1.3 ? RK.lit : d < 1.8 ? RK.wall : d < 2.7 ? RK.cave : RK.mid; };
  terrain(pix, (x, y) => DM[y * WW + x] >= 1 || y >= F, { rampAt, cw: 20, ch: 11, seed: 35, lx: 1, contrast: .8, deep: 0 });
  terrain(pix, (x, y) => y < F && y >= F - pile[x], { rampAt, cw: 9, ch: 7, seed: 37, lx: 1, deep: 7 });
  terrain(pix, (x, y) => y < ceil[x], { rampAt: (x, y) => DM[y * WW + x] < 1.22 ? RK.lit : RK.cave, cw: 14, ch: 9, seed: 39, lx: 1, deep: 7, y1: 130 });
  terrain(pix, (x, y) => y >= F, { rampAt: (x, y) => { if (x > 506 + (bay(x, y) - .5) * 36) return RK.earth; const r = rampAt(x, F - 4); return r === RK.cave || r === RK.mid ? RK.floor : r; }, cw: 24, ch: 9, seed: 41, lx: 1, contrast: .5, deep: 9, y0: F });
  const [c, g] = pix.done();
  // musgo agarrado à borda da abertura
  for (let a = Math.PI * .58; a < Math.PI * 1.45; a += .045 + R() * .05) {
    let rr = 1; while (rr < 1.4 && mouthD(MOUTH.cx + Math.cos(a) * MOUTH.rx * rr, MOUTH.cy + Math.sin(a) * MOUTH.ry * rr) < 1.03) rr += .01;
    const x = Math.round(MOUTH.cx + Math.cos(a) * MOUTH.rx * rr), y = Math.round(MOUTH.cy + Math.sin(a) * MOUTH.ry * rr);
    if (y >= F - 2 || R() < .5) continue;
    const mw = 2 + ((R() * 6) | 0); rect(g, x - mw, y, mw + 1, 2, MOSS[1]); rect(g, x - mw + 1, y, mw - 1, 1, MOSS[2]); if (R() < .4) rect(g, x - 1, y, 1, 1, MOSS[3]); if (R() < .5) rect(g, x - 1 - ((R() * mw) | 0), y + 2, 1, 1 + ((R() * 4) | 0), MOSS[0]);
  }
  // cipós pendendo do lábio de cima, relva que entra pela soleira, a flor na fenda
  for (let x = 470; x < WW; x += 8 + R() * 16) vine(g, x, Math.round(ceil[x | 0]) - 2, 8 + R() * 30, R);
  for (let x = 484; x < WW; x++) {
    const k = clamp((x - 484) / 70, 0, 1); if (R() > k) continue;
    rect(g, x, F, 1, 2, '#74ae38'); rect(g, x, F + 2, 1, 1 + ((R() * 2) | 0), '#427c2c');
    if (R() < .6) rect(g, x, F - 1 - ((R() * 3 * k) | 0), 1, 2, R() < .5 ? '#c2d84e' : '#74ae38');
  }
  for (let i = 0; i < 12; i++) chip(g, 380 + ((R() * 120) | 0), F + 1, 2 + ((R() * 4) | 0), 1 + ((R() * 3) | 0), RK.lit);
  rect(g, 446, 172, 1, 10, '#5a8a2e'); rect(g, 447, 176, 2, 1, '#5a8a2e');
  rect(g, 444, 170, 5, 3, '#f2e66a'); rect(g, 445, 169, 3, 5, '#f2e66a'); rect(g, 446, 171, 1, 1, '#d8762a');
  veil(g, 0, F + 10, WW, H - F - 10, '#05030a', (x, y) => (y - F - 10) / 30 * (x < 500 ? 1 : .5), true);
  return c;
}
// primeiro plano: silhuetas quase pretas de estalactites e estalagmites (paralaxe mais rápida = profundidade)
function buildMouthFg() {
  const w = Math.ceil(W + (MOUTH.W - W) * 1.35), pix = new Pix(w, H), R = rng(77), BK = ramp('#020104', '#040208', '#06040b', '#09050f', '#0c0714', '#130b1e');
  const up = spikeRow(R, 30, w * .6, 70, 90, 30, 70, 10, 10), dn = spikeRow(R, 0, w * .64, 36, 70, 30, 110, 9, 12);
  terrain(pix, (x, y) => (x < w * .68 && y < 4 + spikeAt(dn, x) + jag(x, 13, 3, 78)) || y > H - 3 - spikeAt(up, x), { ramp: BK, cw: 14, ch: 9, seed: 79, lx: 1, deep: 6 });
  return pix.done()[0];
}

// ---------------- Cenário V: o mundo exterior (camadas em paralaxe, luz de fim de tarde)
const OUT = { W: 1500, ground: 168, edge: 1384, edgeY: 122, streamX: 540, streamW: 26 };
const PAPER = { x: 586, y: 150 };   // easter egg: papel amassado na margem direita do riacho
// Relevo do planalto: [x onde o patamar começa, altura do topo]. Degraus de até ~24 px se sobem pulando;
// os paredões mais altos (CLIMBS) só se vencem escalando pelos cipós com E.
const OUT_STEPS = [[-20, 168], [420, 150], [540, 174], [566, 150], [700, 92], [960, 122], [1100, 168], [1130, 122]];
function outTop(x) { if (x >= OUT.edge) return 999; let y = 168; for (const s of OUT_STEPS) if (x >= s[0]) y = s[1]; return y; }
const OUT_SOLIDS = OUT_STEPS.map((s, i) => ({ x: s[0], y: s[1], w: (i + 1 < OUT_STEPS.length ? OUT_STEPS[i + 1][0] : OUT.edge) - s[0], h: 420 }));
const CLIMBS = [{ x: 700, top: 92, bot: 150 }, { x: 1130, top: 122, bot: 168 }];
const PAR = { far: .1, hills: .22, valley: .4 };
const VALLEY = { river: [[0, 157], [130, 155], [270, 157], [410, 154], [540, 156], [676, 154]], fall: { x: 676, y: 58, w: 16, h: 96 } };
const layerW = f => Math.ceil(W + (OUT.W - W) * f) + 2;
const SKY = ['#2c3684', '#3f3c94', '#58449e', '#7a4ea2', '#a45a9c', '#cc6a8c', '#ec8272', '#f9a05e', '#ffc062', '#ffdc86'];
// pinheiro: camadas em dente de serra; cipreste: fuso estreito de borda recortada. O lado do sol fica claro.
function pine(g, x, base, h, P, lx) {
  const Hx = P.hex, n = h - 2, tiers = Math.max(2, Math.round(h / 7)), row = i => { const k = (i + 1) / n, ph = (i * tiers / n) % 1; return Math.round((.35 + .65 * ph) * k * h * .3); };
  rect(g, x, base - 3, 1, 3, '#3a2418');
  for (let i = 0; i < n; i++) rect(g, x - row(i) - 1, base - h + i, row(i) * 2 + 3, 1, Hx[0]);
  for (let i = 0; i < n; i++) { const hw = row(i), y = base - h + i; rect(g, x - hw, y, hw * 2 + 1, 1, Hx[2]); if (hw) { rect(g, lx > 0 ? x + 1 : x - hw, y, hw, 1, Hx[3]); rect(g, lx > 0 ? x + hw : x - hw, y, 1, 1, Hx[5]); rect(g, lx > 0 ? x - hw : x + hw, y, 1, 1, Hx[1]); } }
}
function cypress(g, x, base, h, P, lx, seed) {
  const Hx = P.hex, n = h - 3, row = i => { const k = i / n; return Math.max(0, Math.round(h * .13 * Math.min(1, k * 3.2, (1 - k) * 5 + .45) + (hash2(i, seed, 2) < .3 ? 1 : 0) - (hash2(i, seed, 3) < .2 ? 1 : 0))); };
  rect(g, x, base - 3, 1, 3, '#3a2418');
  for (let i = 0; i < n; i++) rect(g, x - row(i) - 1, base - 3 - n + i, row(i) * 2 + 3, 1, Hx[0]);
  for (let i = 0; i < n; i++) {
    const hw = row(i), y = base - 3 - n + i; rect(g, x - hw, y, hw * 2 + 1, 1, Hx[2]); if (!hw) continue;
    rect(g, lx > 0 ? x + 1 : x - hw, y, hw, 1, Hx[3]); if (i % 3) rect(g, lx > 0 ? x + hw : x - hw, y, 1, 1, Hx[5]); rect(g, lx > 0 ? x - hw : x + hw, y, 1, 1, Hx[1]);
    if (hash2(i, seed, 5) < .3) rect(g, x - hw + 1 + ((hash2(i, seed, 6) * hw * 2) | 0), y, 1, 1, Hx[1]);
  }
}
function flowerAt(g, x, y, kind) {
  if (kind === 0) { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x - 1, y, 3, 1, '#ffffff'); rect(g, x, y - 1, 1, 3, '#ffffff'); rect(g, x, y, 1, 1, '#f2c84a'); }
  else if (kind === 1) { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x - 1, y - 1, 3, 2, '#9a6ad8'); rect(g, x, y - 2, 1, 1, '#c8a8f0'); }
  else if (kind === 2) { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x - 1, y - 1, 3, 2, '#e8463a'); rect(g, x, y - 1, 1, 1, '#2a1010'); }
  else { rect(g, x, y + 1, 1, 3, '#3f8a32'); rect(g, x, y - 1, 2, 2, '#ffd84a'); }
}
function fence(g, x0, x1, base) {
  rect(g, x0, base - 7, x1 - x0, 1, '#9a6a40'); rect(g, x0, base - 6, x1 - x0, 1, '#5e3a22'); rect(g, x0, base - 3, x1 - x0, 1, '#8a5c38');
  for (let x = x0; x <= x1; x += 11) { rect(g, x - 1, base - 10, 4, 10, '#2a160c'); rect(g, x, base - 9, 2, 9, '#7a4c2c'); rect(g, x + 1, base - 9, 1, 9, '#a87444'); }
}
function cottage(g, x, base) {
  const O = '#2a1620', Wl = '#e2b888', Ws = '#a87c66', Rf = '#b0503a', Rh = '#dc7e50', Rs = '#7a3430', Wn = '#ffd866';
  rect(g, x - 15, base - 16, 30, 16, O); rect(g, x - 14, base - 15, 28, 15, Ws); rect(g, x - 14, base - 15, 17, 15, Wl);
  for (let k = 0; k < 9; k++) { rect(g, x - 19 + k * 2, base - 17 - k, 38 - k * 4, 1, O); rect(g, x - 18 + k * 2, base - 17 - k, 36 - k * 4, 1, k ? Rf : Rs); rect(g, x - 18 + k * 2, base - 17 - k, 3, 1, Rh); }
  rect(g, x - 11, base - 11, 5, 5, O); rect(g, x - 10, base - 10, 3, 3, Wn); rect(g, x + 6, base - 11, 5, 5, O); rect(g, x + 7, base - 10, 3, 3, Wn); rect(g, x - 2, base - 8, 4, 8, '#4a2a1e');
  rect(g, x + 7, base - 29, 4, 7, O); rect(g, x + 8, base - 28, 2, 6, Ws);
  // pórtico de colunas ao lado
  rect(g, x + 18, base - 15, 24, 3, O); rect(g, x + 19, base - 14, 22, 1, '#f0dcc0');
  for (let k = 0; k < 4; k++) { rect(g, x + 20 + k * 6, base - 12, 3, 12, O); rect(g, x + 21 + k * 6, base - 12, 1, 12, '#f0dcc0'); }
  for (let k = 0; k < 4; k++) rect(g, x + 20 + k * 3, base - 16 - k, 20 - k * 6, 1, k === 3 ? O : Rf);
}
// cordilheira de arestas retas: cada pico tem uma face clara (virada para o sol) e outra em sombra, separadas por um veio em zigue-zague
function mountains(pix, peaks, P, sunX, seed, hazeY, hazeCol) {
  const { w, h, d } = pix, hz = C32(hazeCol);
  for (let x = 0; x < w; x++) {
    let top = 1e9, pk = peaks[0];
    for (const p of peaks) { const y = p[1] + (x < p[0] ? (p[0] - x) * p[2] : (x - p[0]) * p[3]); if (y < top) { top = y; pk = p; } }
    top = Math.round(top + jag(x, 9, 2.5, seed) + jag(x, 3, .8, seed + 1));
    const side = sunX > pk[0] ? 1 : -1;
    for (let y = Math.max(0, top); y < h; y++) {
      const div = pk[0] + jag(y, 7, 4, seed + (pk[0] | 0)) - side * (y - pk[1]) * .18, lit = (x - div) * side > 0;
      const band = jag(x * (lit ? .8 : -.8) + y * 1.3, 11, 1, seed + 5);
      let t = lit ? 4 : 2; if (band > .5) t -= 1; else if (band < -.62) t += 1;
      if (y - top < 1) t = lit ? 5 : 3; else if (y - top < 3 && lit) t = 5;
      d[y * w + x] = (y - hazeY) / 34 > bay(x, y) ? hz : P[t];
    }
  }
}
// Tufo de folhas: contorno recortado em dentes, luz no alto e do lado do sol, sombra na barriga e textura
// de folhinhas em tracinhos de 2 px (nada de bolhas nem de pedra).
function leafClump(g, cx, cy, rx, ry, P, seed, lx = 1) {
  const Hx = P.hex, x0 = Math.floor(cx - rx - 3), y0 = Math.floor(cy - ry - 3), x1 = Math.ceil(cx + rx + 3), y1 = Math.ceil(cy + ry + 3);
  const inside = (x, y) => { const dx = Math.abs(x - cx) / rx, dy = Math.abs(y - cy) / ry; return Math.max(dx, dy) * .5 + (dx + dy) * .5 < 1 + (hash2(x >> 1, y >> 1, seed) - .5) * .32 + jag(x * 2 + y * 3, 6, .1, seed); };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!inside(x, y)) continue;
    const l = -(y - cy) / ry * .9 + (x - cx) / rx * lx * .38 + (hash2(x >> 1, y, seed + 3) - .5) * .55;
    let t = l > .66 ? 5 : l > .28 ? 4 : l > -.18 ? 3 : l > -.6 ? 2 : 1;
    if (!inside(x, y + 1)) t = 0; else if (!inside(x, y - 1)) t = Math.max(t, 4);
    rect(g, x, y, 1, 1, Hx[t]);
  }
}
function bush(g, x, base, s, seed) {
  leafClump(g, x - 9 * s, base - 4 * s, 9 * s, 6 * s, RK.leafD, seed); leafClump(g, x + 10 * s, base - 5 * s, 10 * s, 7 * s, RK.leafD, seed + 1);
  leafClump(g, x, base - 7 * s, 13 * s, 9 * s, RK.leaf, seed + 2);
}
// Árvore grande: raízes, tronco de casca sulcada, galhos em forquilha e copa em tufos sobrepostos
// (uma camada de sombra atrás, os tufos claros na frente, de baixo para cima).
const TREE_LOBES = [[-54, 8, 24, 13], [-24, 13, 22, 12], [10, 12, 24, 13], [46, 9, 24, 13], [-66, -6, 18, 11], [66, -4, 18, 11], [-38, -9, 26, 15], [0, -4, 28, 16], [36, -11, 26, 15], [-16, -24, 24, 13], [22, -26, 22, 12], [2, -36, 17, 9]];
function bigTree(g, x, base, s, R, seed) {
  const BK = ['#24140c', '#432716', '#633d22', '#84562f', '#a87440'], th = Math.round(58 * s);
  const cxAt = y => x + Math.round(5 * s * Math.pow(clamp((base - y) / th, 0, 1), 1.5));
  const wAt = y => Math.max(5, Math.round((15 - 5 * (base - y) / th) * s + Math.max(0, 7 - (base - y)) * 1.6 * s));
  for (const [dx, w] of [[-20, 4], [-10, 3], [12, 3], [22, 4]]) { thick(g, x, base - 6, x + dx * s, base, w * s + 2, 3, BK[0]); thick(g, x, base - 6, x + dx * s, base - 1, w * s, 1, BK[2]); }
  const top = base - th, tx = cxAt(top), cy0 = top - 32 * s, boughs = [[-46, 4, 6], [-18, -16, 5], [16, -20, 5], [44, 2, 6]];
  for (const [dx, dy, w] of boughs) thick(g, tx, top + 6, tx + dx * s, cy0 + dy * s, w * s + 2, 3, BK[0]);
  for (const [dx, dy, w] of boughs) { thick(g, tx, top + 6, tx + dx * s, cy0 + dy * s, w * s, 2, BK[2]); thick(g, tx + 1, top + 5, tx + dx * s + 1, cy0 + dy * s - 1, 1, 1, BK[4]); }
  for (let y = base; y > top; y--) { const w = wAt(y); rect(g, cxAt(y) - w / 2 - 1, y, w + 2, 1, BK[0]); }
  for (let y = base; y > top; y--) {
    const w = wAt(y), xa = Math.round(cxAt(y) - w / 2), e = Math.max(2, Math.round(w * .28));
    rect(g, xa, y, w, 1, BK[2]); rect(g, xa, y, e, 1, BK[1]); rect(g, xa + w - e, y, e, 1, BK[3]); rect(g, xa + w - 1, y, 1, 1, BK[4]);
  }
  // casca: sulcos compridos que acompanham o tronco, e um nó
  for (let i = 0; i < Math.round(5 * s) + 1; i++) {
    const f = .2 + R() * .6, y0 = base - 3 - ((R() * 8) | 0), len = Math.round((.4 + R() * .5) * th);
    for (let k = 0; k < len; k++) { const y = y0 - k, w = wAt(y); if (y <= top + 2 || (k % 9) > 6) continue; rect(g, Math.round(cxAt(y) - w / 2 + w * f), y, 1, 1, i % 2 ? BK[1] : BK[0]); }
  }
  const ky = Math.round(base - th * .45), kx = cxAt(ky); rect(g, kx - 1, ky - 2, 3, 4, BK[0]); rect(g, kx, ky - 1, 1, 2, BK[1]); rect(g, kx - 2, ky - 3, 5, 1, BK[3]);
  TREE_LOBES.forEach(([dx, dy, rx, ry], i) => leafClump(g, tx + (dx + 3) * s, cy0 + (dy + 5) * s, rx * s * 1.05, ry * s * 1.05, RK.leafD, seed + i));
  TREE_LOBES.forEach(([dx, dy, rx, ry], i) => leafClump(g, tx + dx * s + (R() - .5) * 3, cy0 + dy * s + (R() - .5) * 2, rx * s, ry * s, RK.leaf, seed + 20 + i));
  return { cx: tx, cy: cy0 - 8 * s, rx: 80 * s, ry: 36 * s };
}
// Cordilheira do fundo com as faces claras viradas para sunX (coordenada dentro da camada).
function farLayer(sunX) {
  const pix = new Pix(layerW(PAR.far), H);
  mountains(pix, [[30, 80, .55, .5], [124, 54, .62, .7], [214, 98, .4, .45], [306, 50, .66, .56], [392, 78, .5, .6], [476, 60, .6, .5]], ramp('#4a4088', '#5a4894', '#6c52a0', '#8a60a4', '#b87aa0', '#e8a090'), sunX, 61, 118, '#f6a878');
  mountains(pix, [[-14, 106, .5, .45], [84, 92, .5, .62], [166, 122, .34, .4], [262, 116, .4, .42], [350, 88, .56, .5], [438, 108, .46, .5], [508, 96, .5, .5]], ramp('#2e2862', '#3a3070', '#4a3a7e', '#684888', '#965c88', '#cc8280'), sunX, 67, 132, '#f09a74');
  return pix.done()[0];
}
// Colinas ao entardecer, com pinheiros, cerca e as casas ao longe. lx: lado da luz (-1 esquerda, 1 direita).
function hillsLayer(lx, withSheep) {
  const pix = new Pix(layerW(PAR.hills), H), R = rng(41);
  const hillA = x => 136 + jag(x, 53, 7, 81) + jag(x, 17, 2, 82), hillB = x => 151 + jag(x, 37, 5, 83) + jag(x, 11, 1.5, 84);
  terrain(pix, (x, y) => y >= hillA(x), { ramp: ramp('#22384a', '#2c4c50', '#386452', '#507e54', '#84a058', '#d0c064'), cw: 20, ch: 5, seed: 85, lx, contrast: .5, deep: 0 });
  terrain(pix, (x, y) => y >= hillB(x), { ramp: ramp('#182c38', '#203e3c', '#2a5440', '#3e6e44', '#688e48', '#b0b454'), cw: 16, ch: 5, seed: 86, lx, contrast: .5, deep: 0 });
  const [c, g] = pix.done();
  for (let i = 0; i < 34; i++) { const x = (R() * c.width) | 0; if (Math.abs(x - 484) < 50) continue; (R() < .6 ? pine : cypress)(g, x, Math.round(hillA(x)) + 3, 12 + ((R() * 16) | 0), RK.pine, lx, i); }
  const vx = 470, vy = Math.round(hillA(vx)) + 3;
  cottage(g, vx, vy); fence(g, vx - 58, vx - 22, vy + 1); cypress(g, vx - 24, vy + 1, 26, RK.pine, lx, 7); pine(g, vx + 50, vy + 1, 22, RK.pine, lx);
  for (let i = 0; i < 30; i++) { const x = (R() * c.width) | 0; pine(g, x, Math.round(hillB(x)) + 3, 9 + ((R() * 9) | 0), RK.leafD, lx); }
  if (withSheep) { OUT.sheep = []; for (let i = 0; i < 9; i++) { const x = 120 + R() * 280; OUT.sheep.push([x, hillB(x) + 5 + R() * 10]); } }
  return c;
}
// Cenário IV: posição fixa do sol dentro da camada das montanhas (ele se move junto com elas, como algo distante)
const SUN4 = { x: 391, y: 74 };
function buildOutside() {
  // céu de fim de tarde: faixas pontilhadas do índigo ao dourado, com estrias de nuvem no horizonte
  let pix = new Pix(W, H), R = rng(40), c, g;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) { const v = clamp(y / 146, 0, 1) * (SKY.length - 1), b = v | 0, f = v - b; pix.d[i] = C32(SKY[Math.min(SKY.length - 1, b + (f > bay(x, y) ? 1 : 0))]); }
  [c, g] = pix.done();
  for (let i = 0; i < 9; i++) { const y = 96 + i * 5 + ((R() * 4) | 0), x = (R() * W) | 0, w = 30 + ((R() * 70) | 0), col = i % 2 ? '#ffd9a0' : '#f6a888'; rect(g, x, y, w, 1, col); rect(g, x + 6, y - 1, w - 16, 1, col); rect(g, x + 10, y + 1, w - 14, 1, '#d88a98'); }
  LAYER.sky = c;
  // montanhas e colinas. Cada fase recebe a sua versão, com a luz vindo do lado onde o sol aparece nela:
  // no Cenário V o sol fica à esquerda; no Cenário IV ele aparece na boca da caverna, à direita.
  LAYER.far = farLayer(210); LAYER.hills = hillsLayer(-1, true);
  LAYER.farMouth = farLayer(SUN4.x); LAYER.hillsMouth = hillsLayer(1, false);
  // vale: a mesa com a cachoeira, o lago, a floresta de pontas e a névoa lá embaixo
  pix = new Pix(layerW(PAR.valley), 300); R = rng(43);
  const VW = pix.w, mesaTop = x => 58 + jag(x, 23, 3, 91) + jag(x, 7, 1, 92), mesaL = y => 606 - (y - 58) * .3 + jag(y, 9, 3, 93), mesaR = y => 772 + (y - 58) * .22 + jag(y, 11, 3, 94);
  const backT = spikeRow(R, 0, VW, 4, 6, 5, 16, 3, 3), frontT = spikeRow(R, 0, VW, 5, 8, 8, 24, 4, 4), tb = new Float32Array(VW), tf = new Float32Array(VW);
  // além da mesa o terreno despenca: é o abismo que se vê da borda do planalto. A floresta próxima afunda e,
  // lá embaixo, surgem faixas de mata cada vez mais pálidas e miúdas (perspectiva aérea), com um rio distante.
  const gorge = x => clamp((x - 694) / 44, 0, 1), tiny = [spikeRow(R, 680, VW, 2, 3, 2, 4, 2, 1), spikeRow(R, 680, VW, 3, 4, 3, 6, 2, 2), spikeRow(R, 680, VW, 4, 5, 5, 10, 3, 2)];
  for (let x = 0; x < VW; x++) { const q = gorge(x); tb[x] = 146 - spikeAt(backT, x) + jag(x, 31, 3, 95) + q * 60; tf[x] = 170 - spikeAt(frontT, x) + jag(x, 43, 4, 96) + q * q * 150; }
  terrain(pix, (x, y) => y < 158 && y >= mesaTop(x) && x >= mesaL(y) && x < mesaR(y), { ramp: RK.mesa, cw: 8, ch: 13, seed: 97, lx: -1, deep: 0 });
  terrain(pix, (x, y) => y >= tb[x] && y < 153, { ramp: ramp('#1c2c44', '#243a48', '#2e4c4c', '#3e6450', '#5a8054', '#8ea45c'), cw: 7, ch: 5, seed: 98, lx: -1, contrast: 1.3, deep: 0 });
  for (let y = 151; y < 164; y++) for (let x = 0; x < 708 + jag(y, 3, 4, 90); x++) {   // lago e rio: azul do fim de tarde com reflexos do sol
    const sun = Math.max(0, 1 - Math.abs(x - 372) / 70), hh = hash2((x + y * 2) >> 3, y, 99);
    pix.d[y * VW + x] = C32(y > 152 && hh < sun * .55 ? (hh < sun * .2 ? '#ffd890' : '#f49a6c') : hh > .86 ? '#8aa2e2' : y < 153 ? '#39468e' : '#4a5cae');
  }
  const HAZE = [ramp('#8f7fae', '#9a88b2', '#a691b5', '#b49cb8', '#c6aaba', '#dcbcbc'), ramp('#5c6890', '#677691', '#738693', '#839896', '#99ac98', '#b8c09c'), ramp('#2c4460', '#335264', '#3c6266', '#4a7668', '#5e8c6a', '#80a470')];
  [147, 180, 218].forEach((gy, k) => terrain(pix, (x, y) => x > 690 + jag(y, 7, 3, 110 + k) && y >= gy - spikeAt(tiny[k], x) + jag(x, 29 + k * 9, 3 + k, 113 + k), { ramp: HAZE[k], cw: 5 + k * 2, ch: 4 + k, seed: 116 + k, lx: -1, contrast: 1.2, deep: 0, x0: 680 }));
  terrain(pix, (x, y) => y >= tf[x], { ramp: RK.pine, cw: 8, ch: 6, seed: 100, lx: -1, contrast: 1.4, deep: 0 });
  [c, g] = pix.done();
  for (let x = 716; x < VW; x++) { const y = 203 + Math.round(jag(x, 19, 6, 120)); if (y < tf[x] - 2 && hash2(x >> 2, 5, 121) < .8) { rect(g, x, y, 1, 2, '#c4d2f0'); if (x % 5 === 0) rect(g, x, y, 1, 1, '#ffe4b0'); } }   // rio lá embaixo
  for (let x = 610; x < 770; x++) { const y = Math.round(mesaTop(x)); if (x >= mesaL(y + 2) && x < mesaR(y + 2)) { rect(g, x, y - 1, 1, 3, '#5a8a3e'); rect(g, x, y - 1, 1, 1, '#a8c456'); if (R() < .3) rect(g, x, y + 2, 1, 1 + ((R() * 3) | 0), '#3e6a34'); } }
  for (let i = 0; i < 16; i++) { const x = 614 + ((R() * 150) | 0); if (Math.abs(x - 684) < 13) continue; (R() < .5 ? pine : cypress)(g, x, Math.round(mesaTop(x)), 9 + ((R() * 12) | 0), RK.pine, -1, i); }
  rect(g, 676, 57, 16, 3, '#39468e'); rect(g, 670, 153, 28, 2, '#e8f2ff'); rect(g, 666, 155, 36, 1, '#b8cdf2');
  veil(g, 0, 164, VW, 136, '#c4a0bc', (x, y) => (y - 182) / 150 + .08 * jag(x, 29, 1, 44) + gorge(x) * (y < tf[x] ? .22 + (y - 164) / 420 : 0), true);
  LAYER.valley = c;
  // o planalto: relva sobre terra em blocos, degraus para pular, o riacho, paredões com cipós para escalar e o precipício no fim
  pix = new Pix(OUT.W, 380); R = rng(55);
  const E = OUT.edge, ET = OUT.edgeY, SX = OUT.streamX, SW = OUT.streamW, SUN = RK.sun.hex;
  // o penhasco de onde sai a caverna: patamares de rocha, e não uma rampa lisa
  const crag = x => (x < 54 ? 40 : x < 100 ? 56 : x < 124 ? 84 : x < 144 ? 116 : x < 160 ? 146 : 999) + jag(x, 13, 4, 101) + jag(x, 5, 1.5, 102);
  const edgeX = y => E - Math.min(9, Math.max(0, y - ET - 3) * .4) + Math.min(0, jag(y, 11, 3.5, 103));
  terrain(pix, (x, y) => (x < edgeX(y) && y >= outTop(x)) || y >= crag(x),
    { rampAt: (x, y) => x < 172 + (bay(x, y) - .5) * 20 && y < 184 + (bay(x, y) - .5) * 14 ? RK.sun : RK.earth, cw: 14, ch: 9, seed: 105, lx: 1, deep: 16 });
  [c, g] = pix.done();
  // a boca da caverna de onde ele saiu: arco irregular com três planos de profundidade, borda iluminada pelo sol,
  // dentes de pedra no lábio, cipós, musgo e pedras caídas ao pé
  const arch = [[46, 168], [45, 150], [48, 134], [55, 121], [66, 113], [78, 111], [90, 116], [98, 127], [103, 142], [104, 168]], inset = k => arch.map(([x, y]) => [75 + (x - 75) * k, 168 + (y - 168) * k]);
  polyFill(g, inset(1.07), SUN[0]); polyFill(g, arch, '#2c1812'); polyFill(g, inset(.86), '#160c0a'); polyFill(g, inset(.68), '#080405');
  const side = (pts, y) => { for (let i = 0; i + 1 < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; if (y >= y1 && y <= y2) return x1 + (x2 - x1) * (y - y1) / (y2 - y1 || 1); } return pts[pts.length - 1][0]; };
  const rs = [[78, 111], [90, 116], [98, 127], [103, 142], [104, 168]], ls = [[78, 111], [66, 113], [55, 121], [48, 134], [45, 150], [46, 168]];
  for (let y = 112; y < 168; y++) { const xr = Math.round(side(rs, y)) + 2, xl = Math.round(side(ls, y)) - 3; rect(g, xr, y, 2, 1, SUN[y % 7 < 5 ? 4 : 3]); rect(g, xr + 1, y, 1, 1, SUN[5]); rect(g, xl, y, 2, 1, SUN[1]); if (y % 9 === 4) rect(g, xr, y, 3, 1, SUN[0]); }
  for (const [sx, sy, sw, sh] of [[59, 118, 4, 7], [69, 113, 5, 10], [84, 114, 4, 8], [93, 121, 4, 6]]) spike(g, sx, sy, sw, sh, RK.sun, 1, R);
  for (const [vx, vy, vl] of [[55, 122, 12], [75, 112, 19], [88, 116, 10], [97, 127, 15]]) vine(g, vx, vy, vl, R);
  for (const [mx, my, mw] of [[60, 111, 7], [79, 106, 9], [93, 114, 6], [101, 136, 4]]) { rect(g, mx, my, mw, 2, MOSS[1]); rect(g, mx + 1, my, mw - 2, 1, MOSS[2]); rect(g, mx + 2, my - 1, 2, 1, MOSS[3]); }
  for (let x = 48; x < 106; x += 11 + ((R() * 4) | 0)) { rect(g, x, 168, 9, 2, SUN[3]); rect(g, x, 168, 9, 1, SUN[5]); rect(g, x + 8, 168, 1, 2, SUN[1]); }   // lajes gastas na soleira
  chip(g, 30, 169, 6, 4, RK.sun); chip(g, 36, 169, 10, 7, RK.sun); chip(g, 104, 169, 9, 6, RK.sun); chip(g, 114, 169, 5, 3, RK.sun);
  for (let x = 0; x < 160; x++) { const y = Math.round(crag(x)); if (y < 900 && R() < .85) { rect(g, x, y - 1, 1, 3, '#74ae38'); if (R() < .5) rect(g, x, y - 2 - ((R() * 2) | 0), 1, 2, '#c2d84e'); if (R() < .3) rect(g, x, y + 2, 1, 1 + ((R() * 3) | 0), '#427c2c'); } }
  // árvores, arbustos e cercas: tudo plantado no chão do patamar em que está, e nada perto da borda do precipício
  OUT.treeTop = bigTree(g, 300, 169, 1, R, 201);
  bigTree(g, 1236, ET + 1, .58, R, 202);
  for (const [bx, s] of [[190, 1], [476, 1], [612, .9], [770, 1.1], [1020, 1], [1160, .9]]) bush(g, bx, outTop(bx), s, bx);
  fence(g, 340, 406, 168); fence(g, 990, 1078, 122);
  for (const [px, ph] of [[236, 46], [596, 44], [904, 52], [1176, 46]]) cypress(g, px, outTop(px), ph, RK.pine, 1, px);
  // relva: acompanha cada patamar; faixa clara em cima, lâminas, franja caindo sobre a terra
  const GR = { top: '#c2d84e', b: '#74ae38', dk: '#427c2c', fr: '#2c5a24' };
  for (let x = 110; x < E - 12; x++) {
    if (x >= SX && x < SX + SW) continue;
    const gy = outTop(x);
    rect(g, x, gy - 2, 1, 7, GR.b); rect(g, x, gy - 2, 1, 1, GR.top); if (hash2(x, 1, 7) < .5) rect(g, x, gy - 1, 1, 1, GR.top);
    if (R() < .55) { const hh = 1 + ((R() * 4) | 0); rect(g, x, gy - 2 - hh, 1, hh, R() < .5 ? GR.b : GR.top); }
    rect(g, x, gy + 5, 1, 1 + ((R() * 3) | 0), GR.dk); if (R() < .12) rect(g, x, gy + 5, 1, 4 + ((R() * 8) | 0), GR.fr);
  }
  // cipós grossos nos paredões que se escalam
  for (const cl of CLIMBS) {
    rect(g, cl.x - 4, cl.top - 3, 10, 3, MOSS[2]); rect(g, cl.x - 3, cl.top - 4, 7, 1, MOSS[3]);
    for (let k = 0; k < 4; k++) vine(g, cl.x - 3 + k * 2, cl.top - 1, cl.bot - cl.top - 5 - k * 5, R);
    for (let y = cl.top; y < cl.bot - 4; y++) { rect(g, cl.x - 1 + (y % 6 < 3 ? 0 : 1), y, 2, 1, VINE[1]); if (y % 3 === 0) rect(g, cl.x - 5 + ((y * 5) % 9), y, 3, 2, RK.leaf.hex[3 + (y % 2)]); if (y % 4 === 1) rect(g, cl.x - 4 + ((y * 3) % 8), y, 2, 1, RK.leaf.hex[5]); }   // hera folhuda: mostra onde dá para subir
  }
  rect(g, SX, 174, SW, 2, RK.earth.hex[0]); for (let i = 0; i < 5; i++) rect(g, SX + 2 + i * 5, 173, 3, 1, SUN[3]);   // leito de seixos do riacho
  for (let i = 0; i < 14; i++) { const x = 150 + ((R() * 1180) | 0), gy = outTop(x); if (gy !== outTop(x + 9) || gy !== outTop(x - 2) || gy > 170) continue; chip(g, x, gy - 1, 4 + ((R() * 5) | 0), 2 + ((R() * 3) | 0), RK.sun); }
  for (let i = 0; i < 150; i++) { const x = Math.round(130 + R() * (E - 250)), gy = outTop(x); if (gy !== outTop(x + 2) || gy !== outTop(x - 2) || gy > 170) continue; flowerAt(g, x, gy - 5 + ((R() * 3) | 0), (R() * 4) | 0); }
  // a borda: a relva acaba, sobra rocha nua rachada e o vazio
  for (let i = 0; i < 5; i++) crack(g, E - 3 - i * 5 - ((R() * 3) | 0), ET + 1, 8 + R() * 22, RK.earth.hex[0], R);
  chip(g, E - 22, ET, 4, 2, RK.sun); chip(g, E - 9, ET, 3, 2, RK.sun);
  LAYER.ground = c;
}
// quadros animados de água (cachoeira e queda do riacho)
function waterFrames(w, h, n, seed) {
  const R = rng(seed), off = []; for (let x = 0; x < w; x++) off.push((R() * 10) | 0);
  const out = [];
  for (let f = 0; f < n; f++) {
    const [c, g] = mk(w, h);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
      const v = (((y - f * 10 / n * 2 + off[x]) % 10) + 10) % 10;
      g.fillStyle = v < 1.6 ? '#ffffff' : v < 4.5 ? '#c4e0f8' : (x === 0 || x === w - 1) ? '#5a88d0' : '#8cb4e8';
      g.fillRect(x, y, 1, 1);
    }
    for (let k = 0; k < w * 2; k++) { g.fillStyle = '#ffffff'; g.fillRect((R() * w) | 0, h - 1 - ((R() * 5) | 0), 1, 1); }
    out.push(c);
  }
  return out;
}

