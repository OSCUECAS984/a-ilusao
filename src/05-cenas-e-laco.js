
// ======================================================= ESTADO GLOBAL
const G = { scene: 'title', time: 0, camX: 0, camY: 0, camTX: null, shake: 0, flash: 0, flashCol: '255,255,255', white: 0, control: false,
  cycle: 1, deaths: 0, burns: 0, click: { x: 0, y: 0 }, focusIt: null, step: 'stepStone' };
try { G.cycle = Math.max(1, parseInt(localStorage.getItem('ilusao-ciclo'), 10) || 1); } catch (e) {}
const P = { x: 0, y: 0, vx: 0, vy: 0, hw: 5, h: 32, face: 1, onGround: false, ground: null, coyote: 0, jumpBuf: 0, cut: false, walkT: 0,
  pose: null, bubble: null, jitter: 0, hidden: false, stepT: 0, sweat: false, burnT: 0 };
function resetPlayer(x, y) {
  Object.assign(P, { x, y, vx: 0, vy: 0, face: 1, onGround: true, ground: null, coyote: 0, jumpBuf: 0, cut: false, walkT: 0, pose: null, bubble: null, jitter: 0, hidden: false, sweat: false, burnT: 0 });
}
const val = v => typeof v === 'function' ? v() : v;

// Esperas assíncronas para os roteiros (cutscenes)
const waits = [];
const wait = s => new Promise(r => waits.push({ t: G.time + s, r }));
const until = fn => new Promise(r => waits.push({ fn, r }));
function tickWaits() {
  for (let i = waits.length - 1; i >= 0; i--) {
    const w = waits[i];
    if ((w.fn && w.fn()) || (!w.fn && G.time >= w.t)) { waits.splice(i, 1); w.r(); }
  }
}
const fade = { a: 1, color: '#000', from: 1, to: 1, t: 0, dur: 0, res: null };
function fadeTo(to, dur = .8, color) {
  if (color) fade.color = color;
  return new Promise(res => { if (fade.res) fade.res(); Object.assign(fade, { from: fade.a, to, t: 0, dur: Math.max(.001, dur), res }); });
}
function updateFade(dt) {
  if (!fade.dur) return;
  fade.t += dt; const k = clamp(fade.t / fade.dur, 0, 1); fade.a = lerp(fade.from, fade.to, k);
  if (k >= 1) { fade.dur = 0; const r = fade.res; fade.res = null; if (r) r(); }
}

// ============================================================ PARTÍCULAS
const parts = [];
function emit(x, y, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const life = (o.life || .6) * (.6 + Math.random() * .7);
    parts.push({ x: x + (Math.random() * 2 - 1) * (o.jx || 0), y: y + (Math.random() * 2 - 1) * (o.jy || 0),
      vx: (o.vx || 0) + (Math.random() * 2 - 1) * (o.sx ?? 30), vy: (o.vy || 0) + (Math.random() * 2 - 1) * (o.sy ?? 30),
      life, max: life, col: o.cols[(Math.random() * o.cols.length) | 0], g: o.g || 0, s: o.size || 1, add: !!o.add, a: o.alpha ?? 1 });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); }
  if (parts.length > 500) parts.splice(0, parts.length - 500);
}
function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.max * 1.6, 0, 1) * p.a; ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x - G.camX), Math.round(p.y - G.camY), p.s, p.s);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// ================================================================ FÍSICA
// Colisão AABB resolvida por eixo, em subpassos de 1/240 s (sem atravessar
// plataformas finas). Corrige cantos ao bater a cabeça e nunca zera a queda
// ao encostar numa parede lateral (sem "grudar").
const PHY = { g: 1000, jump: 330, maxFall: 380, run: 100, accG: 1100, decG: 1500, accA: 760 };
const overlaps = s => P.x + P.hw > s.x && P.x - P.hw < s.x + s.w && P.y > s.y && P.y - P.h < s.y + s.h;
function physics(dt, solids) {
  const n = Math.ceil(dt / (1 / 240)), h = dt / n, wasGround = P.onGround;
  for (let i = 0; i < n; i++) {
    P.x += P.vx * h;
    for (const s of solids) if (overlaps(s)) {
      if (P.vx > 0) P.x = s.x - P.hw; else if (P.vx < 0) P.x = s.x + s.w + P.hw;
      else { const l = (P.x + P.hw) - s.x, r = (s.x + s.w) - (P.x - P.hw); P.x += l < r ? -l : r; }
      P.vx = 0;
    }
    P.vy = Math.min(P.vy + PHY.g * h, PHY.maxFall);
    P.y += P.vy * h; P.onGround = false;
    for (const s of solids) if (overlaps(s)) {
      if (P.vy >= 0) { P.y = s.y; P.vy = 0; P.onGround = true; P.ground = s; }
      else {
        const inL = (P.x + P.hw) - s.x, inR = (s.x + s.w) - (P.x - P.hw);
        if (inL <= 4) P.x = s.x - P.hw - .01; else if (inR <= 4) P.x = s.x + s.w + P.hw + .01;
        else { P.y = s.y + s.h + P.h; P.vy = 0; }
      }
    }
  }
  if (!P.onGround) P.ground = null;
  if (P.onGround && !wasGround) { sfx('land'); emit(P.x, P.y - 1, 5, { cols: G.step === 'stepGrass' ? ['#9cd452', '#6aae3a'] : ['#8a7a80', '#5a4a52'], sx: 30, sy: 6, vy: -12, life: .35 }); }
}
function controlPlayer(dt, opt = {}) {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), max = opt.max ?? PHY.run;
  const acc = P.onGround ? (dir ? PHY.accG : PHY.decG) : PHY.accA, target = dir * max;
  if (P.vx < target) P.vx = Math.min(target, P.vx + acc * dt); else if (P.vx > target) P.vx = Math.max(target, P.vx - acc * dt);
  if (dir) P.face = dir;
  if (opt.jump !== false) {
    P.coyote = P.onGround ? .1 : Math.max(0, P.coyote - dt);
    P.jumpBuf = hit('jump') ? .13 : Math.max(0, P.jumpBuf - dt);
    if (P.jumpBuf > 0 && P.coyote > 0) { P.vy = -PHY.jump; P.jumpBuf = 0; P.coyote = 0; P.onGround = false; P.cut = true; sfx('jump'); }
    if (P.cut && !keys.jump && P.vy < -80) { P.vy *= .45; P.cut = false; }
    if (P.vy >= 0) P.cut = false;
  }
  if (P.onGround && Math.abs(P.vx) > 5) { P.stepT += Math.abs(P.vx) * dt; if (P.stepT > 26) { P.stepT = 0; sfx(G.step); } }
  P.walkT += Math.abs(P.vx) * dt;
}

// =========================================================== DESENHO
function flicker() { const t = G.time; return .9 + .06 * Math.sin(t * 11) + .04 * Math.sin(t * 23 + 1.3) + .03 * Math.sin(t * 37); }
function glow(x, y, r, rgb, a) {
  if (a <= 0) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
}
// Mapa de escuridão em meia resolução: a luz fica "em blocos", como pixel art
const LW = W / 2, LH = H / 2, [LC, LG] = mk(LW, LH);
function lighting(amb, lights) {
  LG.globalCompositeOperation = 'source-over'; LG.clearRect(0, 0, LW, LH);
  LG.fillStyle = `rgba(5,2,10,${amb})`; LG.fillRect(0, 0, LW, LH);
  LG.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const x = l.x / 2, y = l.y / 2, r = Math.max(1, l.r / 2), gr = LG.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${l.a})`); gr.addColorStop(.55, `rgba(0,0,0,${l.a * .55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    LG.fillStyle = gr; LG.fillRect(x - r, y - r, r * 2, r * 2);
  }
  LG.globalCompositeOperation = 'source-over';
  ctx.drawImage(LC, 0, 0, W, H);
}
function flame(x, y, w, h) {
  const t = G.time;
  for (let i = -w; i <= w; i++) {
    const k = 1 - (i * i) / (w * w + 1);
    const n = Math.max(1, Math.round(h * k * (.72 + .18 * Math.sin(t * 9 + i * 1.9) + .1 * Math.sin(t * 15.3 + i * .7))));
    for (let j = 0; j < n; j++) {
      const f = j / n + Math.abs(i) / w * .35;
      ctx.fillStyle = f < .3 ? '#fff6c8' : f < .55 ? '#ffcf4a' : f < .8 ? '#f57f24' : '#b8361b';
      ctx.fillRect(x + i, y - j, 1, 1);
    }
  }
  ctx.fillStyle = '#f57f24'; ctx.fillRect(x + Math.round(Math.sin(t * 5) * 2), y - Math.round(h * .95 + Math.sin(t * 7) * 3), 1, 2);
}
function torch(x, y) {
  rect(ctx, x - 3, y + 1, 7, 2, '#3a2a20'); rect(ctx, x - 1, y + 3, 3, 7, '#5a4030'); rect(ctx, x - 2, y + 9, 5, 2, '#3a2a20');
  flame(Math.round(x), Math.round(y), 2, 9);
}
function lightRays(x0, x1, y0, dx, len, a, n = 4) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const k = i / n, xa = lerp(x0, x1, k), xb = lerp(x0, x1, k + .5 / n), al = a * (.6 + .4 * Math.sin(G.time * .7 + i * 1.7));
    const gr = ctx.createLinearGradient(xa, y0, xa + dx, y0 + len); gr.addColorStop(0, `rgba(255,214,140,${al})`); gr.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(xa, y0); ctx.lineTo(xb, y0); ctx.lineTo(xb + dx * 1.15, y0 + len); ctx.lineTo(xa + dx * .9, y0 + len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
const POSE_ANIM = { wall: 'walk', coverWalk: 'walk' };
const POSE_RATE = { wob: 6, shock: 3, hurt: 8 };
function heroFrame() {
  const t = G.time;
  if (P.pose === 'sitCode') return C1.broken ? S.sitFree : S.sit[C1.arm];
  if (P.pose) {
    const v = S[P.pose];
    if (Array.isArray(v)) return v[(POSE_ANIM[P.pose] ? Math.floor(P.walkT / 7) : Math.floor(t * (POSE_RATE[P.pose] || 3))) % v.length];
    return v;
  }
  if (!P.onGround) return P.vy < 0 ? S.jump : S.fall;
  if (Math.abs(P.vx) > 5) return S.walk[Math.floor(P.walkT / 7) % 4];
  return S.idle[Math.floor(t * 1.6) % 2];
}
const NOFLIP = new Set(['sitCode', 'kneelBack', 'standBack']);
function blit(spr, x, y, flip) {
  if (flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -SPR_AX, y - SPR_AY); ctx.restore(); }
  else ctx.drawImage(spr, x - SPR_AX, y - SPR_AY);
}
const [TC, TG] = mk(SPR_W, SPR_W);
function drawHero(tint, alpha = 1) {
  if (P.hidden) return;
  const spr = heroFrame();
  const x = Math.round(P.x - G.camX + (P.jitter ? (Math.floor(G.time * 30) % 2 ? P.jitter : -P.jitter) : 0)), y = Math.round(P.y - G.camY);
  const flip = P.face < 0 && !NOFLIP.has(P.pose);
  if (tint) {
    TG.clearRect(0, 0, SPR_W, SPR_W); TG.globalCompositeOperation = 'source-over'; TG.drawImage(spr, 0, 0);
    TG.globalCompositeOperation = 'source-in'; TG.fillStyle = tint; TG.fillRect(0, 0, SPR_W, SPR_W); TG.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha; blit(TC, x, y, flip); ctx.globalAlpha = 1;
  } else blit(spr, x, y, flip);
  if (P.bubble) { const b = S.bubble[P.bubble]; ctx.drawImage(b, x - 4 + (flip ? -3 : 3), y - 48 + (Math.floor(G.time * 4) % 2)); }
  if (P.sweat) { ctx.fillStyle = '#9fd4ff'; const sy = y - 32 + ((G.time * 20) % 7); ctx.fillRect(x + (flip ? -7 : 6), Math.round(sy), 1, 2); }
}

// ======================================================= PONTOS DE INSPEÇÃO
let INSPECT = [];
function setInspect(list) { INSPECT = list || []; for (const it of INSPECT) it.seen = false; G.focusIt = null; }
function updateInspect() {
  if (!G.control || D.active || !INSPECT.length || !P.onGround) { if (PR.tag === 'insp') hidePrompt('insp'); G.focusIt = null; return; }
  let best = null, bd = 1e9;
  for (const it of INSPECT) { if (it.cond && !it.cond()) continue; const d = Math.abs(P.x - val(it.x)); if (d < (it.r || 18) && d < bd) { bd = d; best = it; } }
  G.focusIt = best;
  if (best) { setPrompt(`<kbd>E</kbd> ${best.verb || 'Examinar'}: ${val(best.label)}`, val(best.x), best.iy - 8, false, 'insp'); if (hit('act')) runInspect(best); }
  else hidePrompt('insp');
}
async function runInspect(it) {
  const id = run; G.control = false; P.vx = 0; hidePrompt('insp'); G.focusIt = null;
  if (!it.seen) { it.seen = true; G.seenCount = (G.seenCount || 0) + 1; }
  P.face = val(it.x) >= P.x ? 1 : -1; sfx('select');
  await it.run();
  if (id !== run) return;
  G.control = true; if (G.onInspected) G.onInspected();
}
function drawInspectIcons() {
  for (const it of INSPECT) {
    if (it.cond && !it.cond()) continue;
    const x = Math.round(val(it.x) - G.camX - 3), y = Math.round(it.iy - G.camY - 10 + Math.sin(G.time * 3 + val(it.x)) * 1.5);
    if (x < -10 || x > W + 10) continue;
    if (G.focusIt === it) glow(x + 3, y + 4, 10, '255,210,140', .35);
    ctx.drawImage(it.seen ? S.lensSeen : S.lens, x, y);
  }
}

// ================================================= CENÁRIO I · Correntes
const STONE = { x: 162, y: 181 };
const C1 = { arm: 'down', stone: 'off', broken: false, jolt: 0, strikeT: 0, sparked: false, sel: false, focus: 1, busy: false, talkIdx: { mistico: 0, arrogante: 0 } };
const TALK = {
  mistico: [
    [['mistico', 'whisper', 'Shhh! Fale baixo, Code. O Grande Cavalo está galopando pelo céu de pedra.'],
     ['mistico', 'ecstatic', 'Cada sombra é um deus! O pássaro traz recados do além. Ontem ele me contou que o muro respira.'],
     ['code', 'worried', 'E se forem só formas? Alguma coisa passando na frente de uma luz?'],
     ['mistico', 'ecstatic', 'Hahaha! Blasfêmia sagrada! As sombras dançam porque o cosmos sonha conosco!']],
    [['mistico', 'awe', 'Ouviu isso? O guerreiro da lança anunciou: "o fim é o começo".'],
     ['mistico', 'whisper', '...ou talvez tenha dito "estou com fome". Os deuses são vagos.']],
    [['mistico', 'whisper', 'Quando fecho os olhos, as sombras continuam lá dentro. Isso prova que são eternas.'],
     ['code', 'think', 'Ou prova que nunca vimos outra coisa.']],
  ],
  arrogante: [
    [['arrogante', 'smug', 'Lá vem você com perguntas de novo. Que cansativo.'],
     ['arrogante', 'smug', 'As sombras são a única verdade do universo. Estudo todas elas. Sei qual vem depois de qual.'],
     ['code', 'worried', 'E se houver algo atrás de nós? Algo que faz as sombras?'],
     ['arrogante', 'angry', '"Atrás"? Não existe "atrás", seu louco! Existe o muro. Só o muro!']],
    [['arrogante', 'laugh', 'Venci três vezes o concurso de quem adivinha a próxima sombra. Respeite os campeões.']],
    [['arrogante', 'scorn', 'Continue questionando a parede e vai perder o juízo. Fique quieto e olhe.']],
  ],
};
const TALK_STONE = {
  mistico: [['mistico', 'ecstatic', 'Se bater nas correntes, os deuses do muro vão ouvir. Bata com fé!']],
  arrogante: [['arrogante', 'smug', 'Bata o quanto quiser. Correntes são parte da realidade, como as sombras.']],
};
function c1Targets() {
  return [
    { id: 'mistico', x: PRIS.mistico, y: 150, label: 'Falar com o Místico' },
    C1.stone === 'hand' ? { id: 'free', x: PRIS.code, y: 146, label: 'Libertar-se das correntes' } : { id: 'stone', x: STONE.x, y: 168, label: 'Pegar a pedra' },
    { id: 'arrogante', x: PRIS.arrogante, y: 150, label: 'Falar com o Arrogante' },
  ];
}
function codeWrist(side) {
  if (side === 'l') return [P.x - 9, P.y - 6];
  const w = SIT_WRIST[C1.arm]; return [P.x + w[0], P.y + w[1]];
}
function chain(x1, y1, x2, y2, sag, jolt = 0) {
  const n = Math.max(4, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(x1, x2, t) + Math.sin(G.time * 40 + i) * jolt * t, y = lerp(y1, y2, t) + sag * 4 * t * (1 - t);
    ctx.fillStyle = i % 2 ? '#4a4e5a' : '#8d93a0';
    ctx.fillRect(Math.round(x - G.camX), Math.round(y - G.camY), i % 2 ? 1 : 2, i % 2 ? 2 : 1);
  }
}
function hangingChain(x, y, len) {
  const sw = Math.sin(G.time * 1.6 + x) * 2;
  for (let i = 0; i <= len; i += 2) { ctx.fillStyle = (i / 2) % 2 ? '#4a4e5a' : '#8d93a0'; ctx.fillRect(Math.round(x + sw * (i / len) - G.camX), Math.round(y + i - G.camY), (i / 2) % 2 ? 1 : 2, 2); }
}
function npcTurn(n) { return D.active && D.who === n ? (P.x > PRIS[n] ? 1 : -1) : 0; }
function drawPrisoners() {
  const [r1, r2, r3, r4] = CH.rings, ry = CH.ringY + 8, f = CH.floor, m = PRIS.mistico, a = PRIS.arrogante;
  chain(r1, ry, m - 9, f - 6, 9); chain(r2, ry, m + 8, f - 6, 9);
  chain(r3, ry, a - 10, f - 6, 9); chain(r4, ry, a + 9, f - 6, 9);
  if (!C1.broken) { const l = codeWrist('l'), rr = codeWrist('r'); chain(r2, ry, l[0], l[1], 8, C1.jolt); chain(r3, ry, rr[0], rr[1], 7, C1.jolt); }
  else { hangingChain(r2, ry, 26); hangingChain(r3, ry, 24); }
  blit(S.npc.mistico[npcTurn('mistico')], Math.round(m - G.camX), f, false);
  blit(S.npc.arrogante[npcTurn('arrogante')], Math.round(a - G.camX), f, false);
}
function drawStone() {
  if (C1.stone === 'off') return;
  let x, y;
  if (C1.stone === 'ground' || C1.stone === 'used') { x = STONE.x; y = STONE.y; }
  else { const o = SIT_STONE[C1.arm] || SIT_STONE.hold; x = P.x + o[0]; y = P.y + o[1]; }
  const sx = Math.round(x - G.camX), sy = Math.round(y - G.camY);
  if (C1.stone !== 'used') {
    const p = .5 + .5 * Math.sin(G.time * 4);
    glow(sx, sy - 3, 14 + p * 6, '255,200,110', .35 + p * .35);
    if (Math.floor(G.time * 3) % 3 === 0) { ctx.fillStyle = '#fff3c4'; ctx.fillRect(sx + 4, sy - 8, 1, 1); ctx.fillRect(sx - 5, sy - 4, 1, 1); }
  }
  ctx.drawImage(S.stone, sx - 5, sy - 6);
}
function drawShadowsOnWall() {
  const fl = flicker(), amp = G.scene === 'title' ? 4 : 1.6, sway = Math.sin(G.time * 1.1) * amp;
  ctx.globalAlpha = .48 + (fl - .9) * 1.4;
  SHADOWS.forEach((s, i) => { const spr = S.shadow[s.k]; ctx.drawImage(spr, Math.round(s.x - spr.width / 2 + sway + Math.sin(G.time * .7 + i) * amp * .5 - G.camX), Math.round(s.b - (spr.height - 3))); });
  ctx.globalAlpha = 1;
}
function drawSelectArrow() {
  if (!C1.sel || C1.busy || D.active || Q.active || G.scene !== 'chains') return;
  const t = c1Targets()[C1.focus];
  ctx.drawImage(S.arrow, Math.round(t.x - 4 - G.camX), Math.round(t.y - 44 + (Math.floor(G.time * 4) % 2)));
}
function drawChamber() {
  const cx = G.camX, fl = flicker();
  ctx.drawImage(LAYER.chamber, -Math.round(cx), 0);
  glow(330 - cx, 140, 170, '255,140,60', .22 * fl);
  drawShadowsOnWall();
  const fx = CH.fireX - cx;
  if (fx > -60 && fx < W + 60) flame(Math.round(fx), CH.fireY, 11, 28);
  drawPrisoners(); drawStone(); drawHero(); drawParts();
  const L = [{ x: fx, y: 130, r: 340 * fl, a: 1 }, { x: 330 - cx, y: 140, r: 300, a: .92 }, { x: P.x - cx, y: P.y - 16, r: 90, a: .55 }, { x: 965 - cx, y: 4, r: 160, a: .8 }];
  if (C1.stone === 'ground' || C1.stone === 'hand') { const o = C1.stone === 'hand' ? SIT_STONE[C1.arm] || [0, 0] : [0, 0], bx = C1.stone === 'hand' ? P.x + o[0] : STONE.x, by = C1.stone === 'hand' ? P.y + o[1] : STONE.y; L.push({ x: bx - cx, y: by, r: 50 + Math.sin(G.time * 4) * 7, a: .9 }); }
  lighting(.82, L);
  glow(fx, 126, 120, '255,140,50', .3 * fl);
  if (cx > 420) lightRays(940 - cx, 1000 - cx, 0, -150, 200, .07, 4);
  if (Math.random() < .3) emit(CH.fireX + (Math.random() * 12 - 6), CH.fireY - 18, 1, { cols: ['#ffcf4a', '#f57f24', '#fff6c8'], sx: 8, sy: 6, vy: -30, life: 1.3, add: true });
  if (Math.random() < .08) emit(CH.fireX, CH.fireY - 30, 1, { cols: ['#5a4a50', '#6a5a62'], sx: 4, sy: 2, vy: -14, life: 3, size: 2, alpha: .35 });
  drawInspectIcons(); drawSelectArrow();
}

async function chainsScript(id) {
  await fadeTo(0, 1.2);
  if (id !== run) return;
  card('Cenário I', 'As Correntes e a Fagulha'); setGoal('Observe as sombras no muro');
  await wait(3.5);
  if (id !== run) return;
  if (G.cycle > 1) await say('Code abre os olhos. O muro, as sombras, o frio das correntes. Tudo de novo?', 'narrador');
  else {
    await say('Desde que se lembra, Code vê apenas o muro e as sombras que dançam sobre ele.', 'narrador');
    await say('Para ele e para os outros prisioneiros, aquelas sombras são o mundo inteiro.', 'narrador');
  }
  if (id !== run) return;
  C1.stone = 'ground'; sfx('pick');
  await say('Hm? Algo brilha no chão, ao alcance da minha mão...', 'code', 'awe');
  await say('Use ← e → para escolher com quem ou com o que interagir e aperte E. Converse com os prisioneiros quantas vezes quiser.', 'sistema');
  if (id !== run) return;
  C1.sel = true; C1.focus = 1; setGoal('Converse com os prisioneiros ou pegue a pedra brilhante');
}
function chainsUpdate(dt) {
  updateQTE(dt); updateStrike(dt); C1.jolt = Math.max(0, C1.jolt - dt * 4);
  if (!C1.sel || C1.busy || D.active) { hidePrompt('sel'); return; }
  const T = c1Targets();
  if (hit('left')) { C1.focus = Math.max(0, C1.focus - 1); sfx('tick'); }
  if (hit('right')) { C1.focus = Math.min(2, C1.focus + 1); sfx('tick'); }
  let act = hit('act') || hit('ok');
  if (hit('click')) for (let i = 0; i < 3; i++) if (Math.abs(G.click.x - T[i].x) < 18 && G.click.y > 120) { C1.focus = i; act = true; }
  const t = T[C1.focus];
  setPrompt(`<kbd>E</kbd> ${t.label}`, t.x, t.y - 16, false, 'sel');
  if (act) c1Activate(t.id, run);
}
async function c1Activate(what, id) {
  C1.busy = true; hidePrompt('sel'); sfx('select');
  if (what === 'mistico' || what === 'arrogante') {
    if (C1.stone === 'hand') await talk(TALK_STONE[what], id);
    else { const sets = TALK[what], i = Math.min(C1.talkIdx[what], sets.length - 1); C1.talkIdx[what]++; await talk(sets[i], id); }
  } else if (what === 'stone') {
    sfx('pick'); C1.arm = 'reach'; await wait(.3); C1.stone = 'hand'; C1.arm = 'hold';
    await say('Pesada e áspera. Talvez seja forte o bastante para as algemas.', 'code', 'determined');
    await talk([['arrogante', 'scorn', 'Uma pedra? Vai arranhar a verdade, é?'], ['mistico', 'awe', 'A pedra brilha... é um sinal! Ou um castigo. Dá no mesmo.']], id);
    if (id !== run) return;
    C1.focus = 1; setGoal('Escolha "Libertar-se" e aperte E');
  } else if (what === 'free') {
    C1.sel = false; setGoal('Acerte 3 golpes seguidos nas algemas');
    await say('Golpeie as algemas com a pedra: aperte E quando o marcador passar pela faixa dourada. São 3 acertos seguidos; se errar, a sequência recomeça.', 'sistema');
    if (id !== run) return;
    await runQTE();
    if (id !== run) return;
    C1.broken = true; C1.arm = 'down'; C1.stone = 'used';
    const [r2, r3] = [CH.rings[1], CH.rings[2]];
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      emit(lerp(r2, P.x - 9, t), lerp(148, 176, t), 1, { cols: ['#8d93a0', '#4a4e5a'], sx: 40, sy: 20, vy: -40, g: 500, size: 2, life: 1.2 });
      emit(lerp(r3, P.x + 8, t), lerp(148, 176, t), 1, { cols: ['#8d93a0', '#4a4e5a'], sx: 40, sy: 20, vy: -40, g: 500, size: 2, life: 1.2 });
    }
    emit(P.x, P.y - 8, 30, { cols: ['#fff6c8', '#ffcf4a', '#f57f24'], sx: 100, sy: 70, vy: -40, g: 240, life: .6, add: true });
    G.flash = .7; G.flashCol = '255,240,200'; G.shake = 4; sfx('break'); setGoal('Você está livre');
    await wait(1.1); P.pose = 'kneelBack'; await wait(.5); P.pose = 'standBack'; await wait(.7); P.pose = null; P.face = 1; await wait(.35);
    if (id !== run) return;
    await talk([['arrogante', 'angry', 'Volte aqui! Ninguém sai do lugar. É assim que as coisas são!'], ['mistico', 'ecstatic', 'Vá, Code! Se encontrar os deuses, diga que mandei lembranças!']], id);
    if (id !== run) return;
    go('steps'); return;
  }
  if (id === run) C1.busy = false;
}

// QTE de três rodadas consecutivas (barra de tempo)
const Q = { active: false, round: 0, pos: 0, dir: 1, speed: 1, zone: [.4, .6], lock: 0, state: '', res: null };
function runQTE() { return new Promise(res => { Q.active = true; Q.round = 0; Q.res = res; UI.qte.hidden = false; qteRound(); }); }
function qteRound() {
  const w = [.26, .19, .14][Q.round], c = .25 + Math.random() * .5;
  Q.zone = [clamp(c - w / 2, .05, .95 - w), 0]; Q.zone[1] = Q.zone[0] + w;
  Q.speed = [.85, 1.15, 1.45][Q.round]; Q.pos = 0; Q.dir = 1; Q.lock = 0; Q.state = '';
}
function updateQTE(dt) {
  if (!Q.active) return;
  if (Q.lock > 0) {
    Q.lock -= dt;
    if (Q.lock <= 0) { if (Q.round >= 3) { Q.active = false; UI.qte.hidden = true; const r = Q.res; Q.res = null; r && r(); return; } qteRound(); }
  } else {
    Q.pos += Q.dir * Q.speed * dt;
    if (Q.pos > 1) { Q.pos = 1; Q.dir = -1; } if (Q.pos < 0) { Q.pos = 0; Q.dir = 1; }
    if (hit('act') || hit('jump') || hit('click') || hit('ok')) {
      if (Q.pos >= Q.zone[0] && Q.pos <= Q.zone[1]) { Q.round++; Q.state = 'hit'; Q.lock = .6; C1.strikeT = .5; C1.sparked = false; }
      else { Q.round = 0; Q.state = 'miss'; Q.lock = .8; sfx('miss'); G.shake = 2; C1.jolt = 1.5; }
    }
  }
  UI.qZone.style.left = (Q.zone[0] * 100) + '%'; UI.qZone.style.width = ((Q.zone[1] - Q.zone[0]) * 100) + '%';
  UI.qCursor.style.left = (Q.pos * 100) + '%';
  UI.pips.forEach((p, i) => p.classList.toggle('on', i < Q.round));
  UI.qLabel.textContent = 'Golpe ' + Math.min(3, Q.round + (Q.state === 'hit' ? 0 : 1)) + ' de 3';
  UI.qBar.className = 'qte-bar' + (Q.state ? ' ' + Q.state : '');
  UI.qHint.className = Q.state;
  UI.qHint.innerHTML = Q.state === 'hit' ? (Q.round >= 3 ? 'As algemas cedem!' : 'Acertou! Mais um golpe.') : Q.state === 'miss' ? 'Golpe em falso! A sequência recomeça.' : 'Aperte <kbd>E</kbd> quando o marcador passar pela faixa dourada';
}
function updateStrike(dt) {
  if (C1.strikeT <= 0) return;
  C1.strikeT -= dt; const t = .5 - C1.strikeT;
  C1.arm = t < .12 ? 'up' : t < .34 ? 'strike' : 'hold';
  if (t >= .12 && !C1.sparked) {
    C1.sparked = true; sfx('hit'); G.shake = 2.5; C1.jolt = 2;
    emit(P.x - 9, P.y - 7, 16, { cols: ['#fff6c8', '#ffcf4a', '#ffffff'], sx: 80, sy: 60, vy: -50, g: 320, life: .45, add: true });
  }
  if (C1.strikeT <= 0) C1.arm = 'hold';
}

// ================================ CENÁRIO II · Primeiros Passos e Fogueira
const ST = {};
const statueLines = {
  shield: [['code', 'awe', 'Um homem de pedra com um escudo. É a primeira sombra do muro!']],
  horse: [['code', 'shock', 'O Grande Cavalo do Místico... é só uma estátua. Fria e parada.'], ['code', 'think', 'A sombra parecia viva porque o fogo tremia, não porque o cavalo se mexia.']],
  spear: [['code', 'think', 'O guerreiro da lança. A sombra dele era maior que ele. A luz exagera as coisas.']],
  tree: [['code', 'awe', 'Uma árvore esculpida. Nunca vi uma árvore de verdade... será que existe?']],
  bird: [['code', 'worried', 'O pássaro que "trazia recados do além". É pedra. Ele nunca disse nada.']],
};
const NAMES = { shield: 'O homem do escudo', horse: 'O cavalo', spear: 'O guerreiro', tree: 'A árvore de pedra', bird: 'O pássaro' };
const INSPECT_STEPS = [
  { id: 'npcM', x: PRIS.mistico, iy: 146, r: 18, verb: 'Falar', label: 'O Místico', cond: () => ST.steady, run: () => talk([['mistico', 'awe', 'Você está de pé! Parece mais alto... ou foram as sombras que encolheram?'], ['mistico', 'whisper', 'Se encontrar os deuses, pergunte se eles têm cheiro.']]) },
  { id: 'npcA', x: PRIS.arrogante, iy: 146, r: 18, verb: 'Falar', label: 'O Arrogante', cond: () => ST.steady, run: () => talk([['arrogante', 'scorn', 'Não me olhe assim. Daqui de baixo eu vejo tudo o que importa.']]) },
  { id: 'wall', x: 340, iy: 112, r: 24, label: 'As sombras', cond: () => ST.steady, run: () => talk([['code', 'think', 'De pé, as sombras parecem menores. E tremem... como se dependessem de algo que está atrás de mim.']]) },
  { id: 'amph', x: 532, iy: 148, r: 14, label: 'O jarro', cond: () => ST.revealed, run: () => talk([['code', 'think', 'Um jarro vazio. Alguém trouxe isto até aqui... alguém que anda livre por trás do muro.']]) },
  { id: 'cols', x: 568, iy: 110, r: 14, label: 'As colunas', cond: () => ST.revealed, run: () => talk([['code', 'awe', 'Colunas! Alguém construiu tudo isto para que víssemos apenas sombras.']]) },
  ...STATUES.filter(s => s.k !== 'tree').map(s => ({ id: s.k, x: s.x, iy: 70, r: 22, label: NAMES[s.k], cond: () => ST.revealed, run: () => talk(statueLines[s.k]) })),
  { id: 'tree', x: 822, iy: 74, r: 18, label: NAMES.tree, cond: () => ST.revealed, run: () => talk(statueLines.tree) },
  { id: 'fire', x: CH.fireX, iy: 104, r: 26, label: 'A fogueira', cond: () => ST.revealed, run: () => inspectFire() },
];
async function inspectFire() {
  await say('O fogo... é dele que vêm todas as sombras. O calor chega até o meu rosto.', 'code', 'awe');
  const c = await ask('Deseja tocar na fogueira?', YESNO, 'sistema');
  if (c === 0) {
    P.face = CH.fireX >= P.x ? 1 : -1; P.pose = 'reach'; await wait(.4);
    P.pose = 'hurt'; P.burnT = 2.4; sfx('burn'); G.flash = .65; G.flashCol = '255,90,40'; G.shake = 5;
    emit(P.x + P.face * 10, P.y - 16, 20, { cols: ['#ffcf4a', '#f57f24', '#fff6c8'], sx: 50, sy: 40, vy: -40, life: .5, add: true });
    P.x -= P.face * 14; G.burns++;
    await wait(.8);
    if (G.burns === 1) {
      await say('AAAI! Queima! Queima!', 'code', 'hurt');
      await say('As sombras do muro nunca queimaram ninguém. O fogo de verdade, sim.', 'narrador');
      await say('O real tem efeitos que a aparência não tem.', 'narrador');
    } else await say('De novo?! Tá bom, tá bom... já entendi que é real!', 'code', 'hurt');
    P.pose = null;
  } else await say('Melhor não. Algo me diz que isto não é uma sombra fria.', 'code', 'worried');
}
function stepsUpdate(dt) {
  const floor = [{ x: -20, y: CH.floor, w: CH.W + 40, h: 40 }];
  if (P.burnT > 0) { P.burnT -= dt; if (Math.random() < dt * 12) emit(P.x + P.face * 9, P.y - 14, 1, { cols: ['#8a8088', '#a49aa0'], sx: 4, sy: 2, vy: -16, life: 1, size: 1, alpha: .6 }); }
  const dF = Math.abs(P.x - CH.fireX); if (dF < 170 && Math.random() < dt * 9 * (1 - dF / 170)) sfx('crackle');
  if (!G.control) { if (!ST.steady) { P.y = CH.floor; P.vx = 0; } else { P.vx = 0; physics(dt, floor); } return; }
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), support = keys.act || keys.hold;
  if (ST.fallen > 0) {
    ST.fallen -= dt; P.vx = 0; P.pose = ST.fallen > .55 ? 'lie' : 'kneel';
    if (ST.fallen <= 0) { P.pose = null; if (ST.first) { ST.first = false; afterFirstFall(run); } }
    return;
  }
  if (!ST.steady) {
    if (dir && ST.prompt === 'try') { hidePrompt('step'); ST.prompt = ''; }
    if (dir && support) {
      P.vx = dir * 26; P.face = dir; ST.firm = Math.min(1, ST.firm + dt * .22); ST.wob = Math.max(0, ST.wob - dt * 1.2); P.pose = 'wall';
      if (Math.random() < dt * 6) emit(P.x + dir * 8, P.y - 26, 1, { cols: ['#7a6a70'], sx: 4, sy: 4, vy: 10, g: 60, life: .5 });
      if (ST.prompt === 'hold' && ST.firm > .18) { hidePrompt('step'); ST.prompt = ''; }
      P.stepT += 26 * dt; if (P.stepT > 20) { P.stepT = 0; sfx('stepStone'); }
    } else if (dir) {
      P.vx = dir * 32; P.face = dir; ST.wob += dt * (ST.first ? 1.5 : 1.3 * (1 - ST.firm * .7)); P.pose = 'wob';
      if (ST.wob >= 1) { ST.fallen = 1.4; ST.wob = 0; P.vx = 0; P.pose = 'lie'; sfx('thud'); G.shake = 3; emit(P.x, P.y - 2, 12, { cols: ['#7a6a70', '#5a4a52'], sx: 36, sy: 8, vy: -14, life: .5 }); }
    } else { P.vx = 0; ST.wob = Math.max(0, ST.wob - dt * .9); P.pose = support ? 'wallIdle' : (ST.wob > .35 ? 'wob' : null); }
    P.walkT += Math.abs(P.vx) * dt;
    P.x = clamp(P.x + P.vx * dt, 16, CH.wallEnd - 10); P.y = CH.floor;
    if (!ST.first) meter(true, ST.firm, 1 - ST.wob);
    if (ST.firm >= 1) {
      ST.steady = true; P.pose = null; meter(false); hidePrompt('step'); sfx('reveal');
      toast('Firmeza recuperada! Agora Code anda e pula sozinho.', 3.6); setGoal('Siga em frente pela caverna →');
    }
    if (ST.firm > .5 && !ST.npcTalk) { ST.npcTalk = true; toast('O Arrogante grita: "Volte! As sombras são tudo o que existe!"', 3.6); }
  } else {
    controlPlayer(dt); physics(dt, floor); P.x = clamp(P.x, 16, CH.W - 8);
    if (!ST.revealed && P.x >= 498) reveal(run);
    if (ST.revealed && !ST.leaving && P.x >= CH.exitX) { ST.leaving = true; G.control = false; fadeTo(1, .7).then(() => go('parkour')); }
  }
}
async function afterFirstFall(id) {
  G.control = false;
  await say('As pernas de Code nunca sustentaram o próprio peso. O chão parece girar.', 'narrador');
  await say('Segure E enquanto anda para se apoiar na parede. Encha a barra de Firmeza. Se o Equilíbrio acabar, você cai.', 'sistema');
  if (id !== run) return;
  G.control = true; ST.prompt = 'hold'; setGoal('Segure E e ande apoiado na parede');
  setPrompt('Segure <kbd>E</kbd> + <kbd>→</kbd>', 0, 0, true, 'step');
  meter(true, ST.firm, 1);
}
async function reveal(id) {
  ST.revealed = true; G.control = false; P.vx = 0; P.pose = 'shock'; P.bubble = '!'; sfx('reveal');
  G.camTX = 600;
  await wait(1); P.bubble = '?'; P.jitter = 1; P.sweat = true;
  await wait(1.1); P.jitter = 0; P.bubble = null;
  if (id !== run) return;
  await say('Uma fogueira... e estátuas?', 'code', 'shock');
  await say('O cavalo, o guerreiro, o pássaro... As sombras do muro eram só isso?', 'code', 'awe');
  await say('Tudo o que Code chamava de real era a sombra de cópias, projetada pelo fogo.', 'narrador');
  await say('Chegue perto das coisas marcadas com ? e aperte E para examiná-las.', 'sistema');
  if (id !== run) return;
  P.pose = null; P.sweat = false; G.camTX = null; G.control = true;
  setGoal('Examine as estátuas e a fogueira · saia pela passagem →');
}

// =========================================== CENÁRIO III · Parkour
const INSPECT_PK = [
  { id: 'amph3', x: 62, iy: 118, r: 14, label: 'O jarro', run: () => talk([['code', 'think', 'Outro jarro. Quem carrega as estátuas também passa por aqui.']]) },
  { id: 'beam', x: 246, iy: 76, r: 18, label: 'A luz de cima', run: () => talk([['code', 'awe', 'Luz vindo de cima... não é fogo. É mais branca, mais limpa.'], ['code', 'determined', 'Ela vem de algum lugar lá fora. Preciso subir!']]) },
  { id: 'chain3', x: 778, iy: 60, r: 14, label: 'A corrente', run: () => talk([['code', 'worried', 'Uma corrente pendurada no vazio. Alguém tentou subir por aqui antes de mim?']]) },
  { id: 'torch3', x: 960, iy: 24, r: 16, label: 'A tocha', run: () => talk([['code', 'think', 'Fogo pequeno, sombras pequenas. Mas aquela luz ali na frente... é outra coisa.']]) },
];
function pkSolids() { return [...PK_SOLIDS, ...PK.movers]; }
function pkUpdate(dt) {
  for (const m of PK.movers) {
    const ox = m.x, oy = m.y, k = .5 - .5 * Math.cos(G.time * TAU / m.per);
    if (m.ax === 'x') m.x = Math.round(lerp(m.a, m.b, k)); else m.y = Math.round(lerp(m.a, m.b, k));
    m.dx = m.x - ox; m.dy = m.y - oy;
  }
  if (G.control) {
    const gm = P.ground;
    if (P.onGround && gm && (gm.dx || gm.dy)) {
      P.x += gm.dx; P.y += gm.dy;
      for (const s of PK_SOLIDS) if (overlaps(s)) { P.x -= gm.dx; break; }
    }
    controlPlayer(dt); physics(dt, pkSolids()); P.x = clamp(P.x, 10, PK.W - 6);
    if (P.y > PK.death && !PK.dying) pkDie(run);
    if (!PK.done && P.x > PK.exitX && P.onGround) pkExit(run);
  }
  G.camX += (clamp(P.x - 160, 0, PK.W - W) - G.camX) * Math.min(1, dt * 6);
}
async function pkDie(id) {
  PK.dying = true; G.control = false; P.hidden = true; G.deaths++; hud();
  emit(P.x, P.y - 12, 30, { cols: ['#efe6d0', '#e8b07a', '#b8361b', '#8b7f86'], sx: 80, sy: 70, vy: -90, g: 520, size: 2, life: .8 });
  G.flash = .55; G.flashCol = '200,40,30'; G.shake = 4; sfx('death');
  await wait(.75); await fadeTo(1, .35);
  if (id !== run) return;
  go('parkour');
}
async function pkExit(id) {
  PK.done = true; G.control = false; P.vx = 0;
  await fadeTo(1, .9);
  if (id !== run) return;
  go('light');
}
function drawParkour() {
  const cx = G.camX, t = G.time;
  ctx.drawImage(LAYER.pkbg, -Math.round(cx * .5), 0);
  ctx.drawImage(LAYER.parkour, -Math.round(cx), 0);
  for (const hx of [254, 724]) {
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,196,120,.34)'); gr.addColorStop(1, 'rgba(255,196,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(hx - 12 - cx, 0); ctx.lineTo(hx + 12 - cx, 0); ctx.lineTo(hx + 50 - cx, H); ctx.lineTo(hx - 46 - cx, H); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 26; i++) {
      const y = (i * 53 + t * (5 + i % 4)) % H, x = hx - 10 + (i * 37.7 % 24) + y * .1 + Math.sin(t + i) * 3;
      ctx.fillStyle = `rgba(255,220,160,${.25 + .25 * Math.sin(t * 2 + i)})`; ctx.fillRect(Math.round(x - cx), Math.round(y), 1, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  hangingChain(400, 12, 44); hangingChain(778, 12, 32);
  for (const m of PK.movers) ctx.drawImage(m.spr, Math.round(m.x - 1 - cx), m.y);
  torch(632 - cx, 106); torch(960 - cx, 30);
  drawHero(); drawParts();
  const fl = flicker();
  lighting(.8, [{ x: 254 - cx, y: 60, r: 220, a: .85 }, { x: 724 - cx, y: 60, r: 220, a: .85 }, { x: 632 - cx, y: 104, r: 110 * fl, a: .9 }, { x: 960 - cx, y: 28, r: 110 * fl, a: .9 },
    { x: 1084 - cx, y: 30, r: 190, a: 1 }, { x: P.x - cx, y: P.y - 14, r: 95, a: .6 }, { x: 60 - cx, y: 120, r: 110, a: .45 }]);
  glow(1084 - cx, 30, 70, '255,220,150', .38); glow(632 - cx, 104, 30, '255,150,60', .25 * fl); glow(960 - cx, 28, 30, '255,150,60', .25 * fl);
  drawInspectIcons();
}

// ============================== CENÁRIO IV · Revelação e Ofuscamento
const L4 = {};
const INSPECT_L4 = [
  { id: 'wind', x: 250, iy: 140, r: 20, label: 'O vento', run: () => talk([['code', 'awe', 'Um vento morno... com um cheiro que eu não conheço.']]) },
  { id: 'flower', x: 446, iy: 160, r: 16, label: 'A flor', run: () => talk([['code', 'awe', 'Uma flor crescendo na fenda da rocha. Ela se vira para a luz, como eu.']]) },
];
function lightUpdate(dt) {
  const floor = [{ x: -20, y: CH.floor, w: MOUTH.W + 200, h: 40 }];
  if (G.control) {
    const glare = smooth(300, MOUTH.trig, P.x); L4.glare = glare;
    controlPlayer(dt, { max: 80 * (1 - .55 * glare), jump: false }); physics(dt, floor); P.x = Math.max(P.x, 12);
    P.pose = glare > .5 ? (Math.abs(P.vx) > 4 ? 'coverWalk' : 'coverIdle') : null;
    G.white = glare * .5;
    if (P.x > 330 && !L4.nature) { L4.nature = true; setAmbience('nature', 7); }
    if (P.x >= MOUTH.trig && !L4.trig) blind(run);
    if (glare > .5 && !L4.told) { L4.told = true; toast('A luz cega! Code cobre os olhos e anda mais devagar.', 3.4); }
  } else physics(dt, floor);
  if (L4.whiteUp) G.white = Math.min(1, G.white + dt * .8);
  if (L4.stagger) { L4.st += dt; P.x = L4.bx + Math.sin(L4.st * 4.5) * 8 - L4.st * 6; P.face = Math.cos(L4.st * 4.5) > 0 ? 1 : -1; P.pose = 'wob'; }
  G.camX += (clamp(P.x - 170, 0, MOUTH.W - W) - G.camX) * Math.min(1, dt * 4);
}
async function blind(id) {
  L4.trig = true; G.control = false; P.vx = 0; P.pose = 'coverIdle'; L4.whiteUp = true; sfx('glare'); hidePrompt();
  await wait(.8);
  L4.stagger = true; L4.st = 0; L4.bx = P.x;
  await wait(1.9);
  if (id !== run) return;
  L4.stagger = false; P.pose = 'kneel'; await wait(.45);
  P.pose = 'lie'; sfx('thud'); G.shake = 3;
  await wait(1);
  await fadeTo(1, 1.6, '#000');
  if (id !== run) return;
  G.white = 0; L4.whiteUp = false;
  await say('A luz era demais para olhos que só conheciam sombras.', 'narrador');
  if (id !== run) return;
  go('outside');
}
function drawLight() {
  const t = G.time, cx = G.camX, mx = MOUTH.cx - cx;
  ctx.drawImage(LAYER.mouth, -Math.round(cx), 0);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = .06 + .04 * Math.sin(t * .8 + i * 1.7), y0 = 50 + i * 20, spread = 16 + i * 8;
    ctx.fillStyle = `rgba(255,236,180,${a})`; ctx.beginPath(); ctx.moveTo(mx - 70, y0); ctx.lineTo(mx - 70, y0 + 12); ctx.lineTo(mx - 420, y0 + 50 + spread); ctx.lineTo(mx - 420, y0 + spread); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 30; i++) { const x = (i * 41 + t * 6) % 400 + mx - 420, y = 40 + (i * 29 % 130) + Math.sin(t + i) * 4; ctx.fillStyle = 'rgba(255,240,200,.5)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  drawHero(); drawParts();
  lighting(.85, [{ x: mx, y: MOUTH.cy, r: 360, a: 1 }, { x: mx, y: MOUTH.cy, r: 200, a: 1 }, { x: P.x - cx, y: P.y - 14, r: 80, a: .5 }]);
  glow(mx + 10, MOUTH.cy, 150, '255,240,200', .35 + (L4.glare || 0) * .3);
  drawInspectIcons();
  if (G.white > 0) {
    ctx.fillStyle = `rgba(255,252,240,${G.white * .94})`; ctx.fillRect(0, 0, W, H);
    if (G.white > .4) drawHero('#4a3c46', clamp((G.white - .4) * 1.6, 0, .85));
  }
}

// ===================================== CENÁRIO V · O Mundo Exterior
const O5 = {};
const BIRDS = [0, 1, 2, 3, 4, 5].map(i => ({ x: i * 80 + 20, y: 26 + (i * 23) % 44, v: 10 + i * 2, ph: i }));
const CLOUDS = [{ s: 0, x: 30, y: 18, v: 3 }, { s: 1, x: 170, y: 46, v: 2 }, { s: 2, x: 250, y: 6, v: 4 }, { s: 3, x: 360, y: 60, v: 2.5 }, { s: 4, x: 440, y: 30, v: 3.5 }];
const BUTTER = [[200, 150, '#ffd84a'], [440, 152, '#ff8fc0'], [700, 150, '#ffffff'], [980, 150, '#9fd4ff'], [1230, 148, '#ffd84a']];
const INSPECT_OUT = [
  { id: 'cave5', x: 104, iy: 120, r: 16, label: 'A caverna', run: () => talk([['code', 'worried', 'Lá dentro, os outros ainda olham para o muro. Eles nem imaginam isto aqui.'], ['code', 'think', 'Será que acreditariam se eu voltasse para contar?']]) },
  { id: 'tree5', x: 300, iy: 120, r: 26, label: 'A árvore', run: () => talk([['code', 'awe', 'Uma árvore de verdade! A estátua era só uma cópia pobre disto.'], ['code', 'happy', 'As folhas se mexem sozinhas com o vento. Nenhuma sombra fazia isso.']]) },
  { id: 'flowers', x: 440, iy: 148, r: 16, label: 'As flores', run: () => talk([['code', 'happy', 'Cores! Lá dentro tudo era marrom, preto e laranja.']]) },
  { id: 'sun', x: 560, iy: 120, r: 18, label: 'O sol', run: async () => { G.white = .7; await say('Não consigo olhar direto para ele... dói!', 'code', 'dazzled'); await say('O sol é o que faz tudo ser visto. Por isso não se pode encará-lo de uma vez: os olhos precisam de tempo.', 'narrador'); } },
  { id: 'stag', x: () => O5.stag.state === 'gone' ? 660 : O5.stag.x, iy: 136, r: 24, label: () => O5.stag.state === 'gone' ? 'As pegadas' : 'O cervo',
    run: () => O5.stag.state === 'gone' ? talk([['code', 'think', 'Ele fugiu. Rápido como uma sombra, mas real como eu.']]) : talk([['code', 'awe', 'Um cervo! A sombra do cavalo nunca me olhou de volta.']]) },
  { id: 'stream', x: OUT.streamX + 13, iy: 146, r: 16, label: 'O riacho', run: () => talk([['code', 'shock', 'Meu rosto... na água!'], ['code', 'think', 'Primeiro as sombras, agora um reflexo. Cada vez mais perto das coisas reais.']]) },
  { id: 'villa', x: 1000, iy: 120, r: 18, label: 'As casas ao longe', run: () => talk([['code', 'awe', 'Casas! Colunas como as da caverna, mas aqui ninguém esconde nada.']]) },
  { id: 'fall5', x: 1170, iy: 120, r: 18, label: 'A cachoeira', run: () => talk([['code', 'happy', 'Água caindo do alto, sem parar. Que barulho bonito.']]) },
  { id: 'vista', x: 1320, iy: 128, r: 18, label: 'A vista', run: () => talk([['code', 'awe', 'Que vista... o mundo não acaba nunca?'], ['code', 'happy', 'Preciso ver mais de perto!']]) },
];
function outGoal() { setGoal(`Explore e examine o que brilhar (E) · ${G.seenCount || 0}/${INSPECT_OUT.length}`); }
function outUpdate(dt) {
  const ground = [{ x: -20, y: OUT.ground, w: OUT.edge + 20, h: 300 }], t = G.time;
  if (O5.wake) G.white = Math.max(0, G.white - dt * .28);
  else if (G.white > 0) G.white = Math.max(0, G.white - dt * .6);
  if (G.control) {
    controlPlayer(dt); physics(dt, ground); P.x = Math.max(P.x, 92);
    if (P.x > 160 && PR.tag === 'walk') hidePrompt('walk');
    if (!O5.fall && P.y > OUT.ground + 6) plunge(run);
  } else if (O5.fall) physics(dt, ground);
  // riacho: respingos
  const inS = P.x > OUT.streamX && P.x < OUT.streamX + OUT.streamW && P.onGround;
  if (inS && Math.abs(P.vx) > 5) { O5.splT -= dt; if (O5.splT <= 0) { O5.splT = .28; sfx('splash'); emit(P.x, OUT.ground - 2, 8, { cols: ['#c4e8f8', '#ffffff', '#8ccbe8'], sx: 30, sy: 10, vy: -50, g: 300, life: .5 }); } }
  G.step = inS ? 'stepGrass' : 'stepGrass';
  G.camX += (clamp(P.x - 150, 0, OUT.W - W) - G.camX) * Math.min(1, dt * 4);
  G.camY += ((O5.fall ? clamp(P.y - 130, 0, 150) : 0) - G.camY) * Math.min(1, dt * 3);
  const fsx = VALLEY.fall.x - G.camX * PAR.valley;
  AU.waterNear = Math.max(0, 1 - Math.abs(P.x - OUT.streamX - 13) / 160, 1 - Math.abs(fsx - W / 2) / 260);
  // cervo
  const sg = O5.stag, d = Math.abs(P.x - sg.x);
  if (sg.state === 'graze') { sg.t -= dt; if (sg.t <= 0) { sg.look = !sg.look; sg.t = 1.4 + Math.random() * 2.4; } if (d < 90 && G.control) { sg.state = 'alert'; sg.t = .7; } }
  else if (sg.state === 'alert') { sg.t -= dt; if (sg.t <= 0) { sg.state = 'run'; sg.dir = sg.x >= P.x ? 1 : -1; } }
  else if (sg.state === 'run') { sg.x += sg.dir * 140 * dt; if (sg.x > 1340 || sg.x < 150) sg.state = 'gone'; }
  // coelhos
  for (const rb of O5.rabbits) {
    rb.t -= dt;
    if (rb.air > 0) { rb.air -= dt; rb.x = clamp(rb.x + rb.dir * 44 * dt, rb.a, rb.b); }
    else if (rb.t <= 0 || Math.abs(P.x - rb.x) < 40) {
      rb.dir = Math.abs(P.x - rb.x) < 40 ? (Math.sign(rb.x - P.x) || 1) : (Math.random() < .5 ? -1 : 1);
      if (rb.x + rb.dir * 16 > rb.b || rb.x + rb.dir * 16 < rb.a) rb.dir *= -1;
      rb.air = .35; rb.t = 1.4 + Math.random() * 2;
    }
  }
  // pássaro pousado na árvore
  const pb = O5.perch; if (!pb.fly && P.x > 250) pb.fly = true;
  if (pb.fly) { pb.x += 70 * dt; pb.y -= 46 * dt; }
  // folhas caindo da grande árvore
  O5.leafT -= dt;
  if (O5.leafT <= 0) { O5.leafT = .22; const T = OUT.treeTop, a = Math.random() * TAU; O5.leaves.push({ x: T.cx + Math.cos(a) * T.rx * Math.random(), y: T.cy + Math.sin(a) * T.ry * Math.random() * .8, vy: 12 + Math.random() * 10, ph: Math.random() * TAU, sw: 10 + Math.random() * 14, life: 9, col: ['#78b034', '#b0d44a', '#e2c84a', '#4c8a28'][(Math.random() * 4) | 0] }); }
  for (let i = O5.leaves.length - 1; i >= 0; i--) {
    const L = O5.leaves[i];
    if (L.y < OUT.ground - 2) { L.y += L.vy * dt; L.x += (Math.sin(t * 1.6 + L.ph) * L.sw + 6) * dt; } else L.life -= dt * 3;
    L.life -= dt; if (L.life <= 0) O5.leaves.splice(i, 1);
  }
  O5.fishT -= dt; if (O5.fishT <= 0) { O5.fishT = 2.5 + Math.random() * 3; const r = VALLEY.river, k = 1 + ((Math.random() * (r.length - 3)) | 0); O5.fish = { x: r[k][0], y: r[k][1], t: 0 }; }
  if (O5.fish) { O5.fish.t += dt; if (O5.fish.t > .7) O5.fish = null; }
}
async function plunge(id) {
  O5.fall = true; G.control = false; P.vx = Math.max(P.vx, 30); P.pose = 'fall'; sfx('fall'); hidePrompt(); setGoal('...');
  await wait(.5); await fadeTo(1, 1.5, '#000');
  if (id !== run) return;
  go('ending');
}
function drawOutside() {
  const cx = G.camX, cy = G.camY, t = G.time, S5 = O5;
  ctx.drawImage(LAYER.sky, 0, -Math.round(cy * .05));
  // sol resplandecente com raios girando
  const sx = 168 - cx * .02, sy = 40 - cy * .05;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = t * .05 + i * TAU / 16, len = (i % 2 ? 80 : 120) + Math.sin(t * 1.3 + i) * 10, wa = .045;
    ctx.fillStyle = `rgba(255,240,180,${i % 2 ? .1 : .14})`;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - wa) * len, sy + Math.sin(a - wa) * len); ctx.lineTo(sx + Math.cos(a + wa) * len, sy + Math.sin(a + wa) * len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  glow(sx, sy, 70, '255,244,200', .5);
  ell(ctx, sx, sy, 22, 22, '#fff2c0'); ell(ctx, sx, sy, 19, 19, '#fffae0'); ell(ctx, sx, sy, 15, 15, '#ffffff');
  for (const c of CLOUDS) { const spr = S.clouds[c.s], x = ((c.x + t * c.v - cx * .05) % (W + 160) + W + 160) % (W + 160) - 130; ctx.drawImage(spr, Math.round(x), Math.round(c.y - cy * .05)); }
  for (const b of BIRDS) { const x = ((b.x + t * b.v - cx * .08) % (W + 80) + W + 80) % (W + 80) - 40, y = b.y + Math.sin(t * 1.5 + b.ph) * 4 - cy * .08; ctx.drawImage(S.bird[Math.floor(t * 6 + b.ph) % 2], Math.round(x), Math.round(y)); ctx.drawImage(S.bird[Math.floor(t * 6 + b.ph + 1) % 2], Math.round(x + 9), Math.round(y + 5)); }
  ctx.drawImage(LAYER.far, -Math.round(cx * PAR.far), -Math.round(cy * .1));
  const hx = -Math.round(cx * PAR.hills), hy = -Math.round(cy * .2);
  ctx.drawImage(LAYER.hills, hx, hy);
  for (const [x, y] of OUT.sheep) { const bx = Math.round(x + hx), by = Math.round(y + hy + (Math.floor(t + x) % 3 === 0 ? -1 : 0)); rect(ctx, bx, by, 4, 2, '#f4f0e6'); rect(ctx, bx + 4, by, 1, 1, '#3a2a24'); }
  const vx = -Math.round(cx * PAR.valley), vy = -Math.round(cy * .4), F = VALLEY.fall;
  ctx.drawImage(LAYER.valley, vx, vy);
  ctx.drawImage(O5.fallFrames[Math.floor(t * 12) % O5.fallFrames.length], F.x + vx, F.y + vy);
  for (let i = 0; i < 9; i++) { const r = 4 + ((t * 3 + i) % 5); ell(ctx, F.x + 8 + (i - 4) * 3 + vx, F.y + F.h + vy - ((t * 9 + i * 3) % 6), r, r * .55, `rgba(255,255,255,${.22 + .1 * Math.sin(t * 3 + i)})`); }
  const rv = VALLEY.river;
  for (let i = 0; i < 40; i++) {
    const u = ((i * .025 + t * .015) % 1) * rv[rv.length - 1][0];
    let k = 0; while (k < rv.length - 2 && rv[k + 1][0] < u) k++;
    const y = lerp(rv[k][1], rv[k + 1][1], (u - rv[k][0]) / (rv[k + 1][0] - rv[k][0]));
    ctx.fillStyle = `rgba(232,248,255,${.4 + .4 * Math.sin(t * 4 + i * 2)})`; ctx.fillRect(Math.round(u + vx), Math.round(y - 1 + vy), 2, 1);
  }
  if (S5.fish) { const k = S5.fish.t / .7; rect(ctx, S5.fish.x + vx + k * 6, S5.fish.y + vy - Math.sin(k * Math.PI) * 7 - 2, 2, 1, '#f08a3a'); }
  ctx.drawImage(LAYER.near, -Math.round(cx * PAR.near), -Math.round(cy * .65));
  ctx.drawImage(LAYER.ground, -Math.round(cx), -Math.round(cy));
  // riacho: superfície e cascata
  const stx = OUT.streamX - cx;
  for (let i = 0; i < OUT.streamW; i++) { const v = (i * 3 + Math.floor(t * 10)) % 7; rect(ctx, stx + i, 166 - cy, 1, 8, v < 2 ? '#c4e8f8' : '#5aa8d8'); }
  ctx.drawImage(O5.cascade[Math.floor(t * 12) % O5.cascade.length], Math.round(stx + 2), Math.round(174 - cy));
  // libélula sobre o riacho
  const dfx = OUT.streamX + 13 + Math.sin(t * 1.7) * 30 - cx, dfy = 148 + Math.sin(t * 3.1) * 6 - cy;
  rect(ctx, dfx, dfy, 4, 1, '#2a6ad8'); if (Math.floor(t * 20) % 2) { rect(ctx, dfx + 1, dfy - 2, 1, 2, '#e8f4ff'); rect(ctx, dfx + 2, dfy - 2, 1, 2, '#e8f4ff'); }
  // folhas caindo
  for (const L of S5.leaves) { ctx.globalAlpha = clamp(L.life, 0, 1); rect(ctx, L.x - cx, L.y - cy, Math.floor(t * 4 + L.ph) % 2 ? 2 : 1, Math.floor(t * 4 + L.ph) % 2 ? 1 : 2, L.col); }
  ctx.globalAlpha = 1;
  // borboletas
  BUTTER.forEach(([bx, by, col], i) => { const x = bx + Math.sin(t * 1.1 + i) * 16 - cx, y = by + Math.sin(t * 2.3 + i * 2) * 7 - cy, o = Math.floor(t * 10 + i) % 2; rect(ctx, x, y, 1, 1, '#3a2a24'); rect(ctx, x - 1 - o, y - 1 + o, 2, 2, col); rect(ctx, x + 1 + o, y - 1 + o, 2, 2, col); });
  // pássaro na árvore
  const pb = S5.perch; if (pb.y > -20) { if (pb.fly) ctx.drawImage(S.bird[Math.floor(t * 8) % 2], Math.round(pb.x - cx), Math.round(pb.y - cy)); else ctx.drawImage(S.perch, Math.round(pb.x - cx), Math.round(pb.y - cy)); }
  // cervo
  const sg = S5.stag;
  if (sg.state !== 'gone') {
    const spr = sg.state === 'run' ? S.stag.run[Math.floor(t * 10) % 2] : sg.state === 'alert' || sg.look ? S.stag.alert : S.stag.graze;
    const fl = sg.state === 'run' ? sg.dir < 0 : true, x = Math.round(sg.x - cx), y = Math.round(OUT.ground - cy - spr.height + 1);
    if (fl) { ctx.save(); ctx.translate(x + spr.width / 2, 0); ctx.scale(-1, 1); ctx.drawImage(spr, -spr.width / 2, y); ctx.restore(); } else ctx.drawImage(spr, x - spr.width / 2, y);
  }
  for (const rb of S5.rabbits) {
    const hop = rb.air > 0, ry = hop ? -Math.sin((1 - rb.air / .35) * Math.PI) * 7 : 0, rs = S.rabbit[hop ? 1 : 0];
    const rl = Math.round(rb.x - cx - rs.width / 2), rt = Math.round(OUT.ground + ry - cy - rs.height + 1);
    if (rb.dir < 0) { ctx.save(); ctx.translate(rl + rs.width, 0); ctx.scale(-1, 1); ctx.drawImage(rs, 0, rt); ctx.restore(); } else ctx.drawImage(rs, rl, rt);
  }
  drawHero();
  ctx.drawImage(LAYER.front, -Math.round(cx), -Math.round(cy));
  // capim do primeiro plano balançando com o vento
  for (const gx of OUT.tufts) {
    const x = gx - cx; if (x < -6 || x > W + 6) continue;
    const sw = Math.round(Math.sin(t * 2 + gx * .07) * 1.5);
    for (let k = 0; k < 4; k++) { const h = 4 + ((gx + k * 3) % 4); rect(ctx, x + k * 2, 172 - h - cy, 1, h - 2, k % 2 ? '#4a9a3c' : '#6cc04e'); rect(ctx, x + k * 2 + sw, 172 - h - cy - 1, 1, 2, '#9cd452'); }
  }
  drawParts();
  drawInspectIcons();
  if (G.white > 0) { ctx.fillStyle = `rgba(255,252,240,${G.white})`; ctx.fillRect(0, 0, W, H); }
}

// ================================================= FINAL / LOOP
const ENDING_LINES = [
  'Ninguém sai da caverna de uma só vez.',
  'O olhar precisa de tempo: primeiro as sombras, depois os reflexos, depois as coisas e, só então, o sol.',
  'Code correu em direção à luz e não viu o abismo sob os próprios pés.',
  'Talvez toda verdade alcançada às pressas seja apenas a entrada de outra caverna.',
];
async function endingScript(id) {
  UI.endLines.innerHTML = ''; UI.endCycle.textContent = ''; UI.ending.hidden = false;
  await wait(1.2);
  for (const line of ENDING_LINES) {
    if (id !== run) return;
    const p = document.createElement('p'); p.textContent = line; UI.endLines.appendChild(p);
    await wait(1.7 + line.length * .03);
  }
  const s = document.createElement('p'); s.className = 'small'; s.textContent = 'Inspirado na Alegoria da Caverna · Platão, A República, Livro VII'; UI.endLines.appendChild(s);
  await wait(1.6);
  G.cycle++; try { localStorage.setItem('ilusao-ciclo', String(G.cycle)); } catch (e) {}
  UI.endCycle.textContent = 'O ciclo recomeça · Ciclo ' + roman(G.cycle);
  if (AU.C && !AU.muted) [220, 261.6, 329.6].forEach((f, i) => tone(f, 2.6, 'sine', .05, 0, i * .15));
  await wait(2.8);
  if (id !== run) return;
  UI.ending.hidden = true;
  go('chains');
}

// ========================================================= MÁQUINA DE ESTADOS
let run = 0;
const Scenes = {
  title: {
    enter() { resetPlayer(PRIS.code, CH.floor); P.pose = 'sitCode'; Object.assign(C1, { arm: 'down', stone: 'off', broken: false, sel: false }); G.camX = 0; fade.a = 0; },
    update(dt) {
      G.camX = 50 + Math.sin(G.time * .13) * 50;
      if (Math.random() < dt * 14) emit(G.camX + Math.random() * W, 100 + Math.random() * 100, 1, { cols: ['#c8a080', '#e8c8a0', '#a08070'], sx: 4, sy: 3, vx: 3, vy: -4, life: 4, add: true, alpha: .5 });
      if (Math.random() < dt * 6) emit(G.camX + W * (.5 + Math.random() * .5), 210, 1, { cols: ['#ffcf4a', '#f57f24'], sx: 10, sy: 6, vy: -36, life: 3.5, add: true });
      if (hit('ok') || hit('act') || hit('jump')) startGame();
    },
    draw: drawChamber,
  },
  starting: { enter() {}, update() {}, draw: drawChamber },
  chains: {
    enter(id) {
      resetPlayer(PRIS.code, CH.floor); P.pose = 'sitCode'; G.step = 'stepStone';
      Object.assign(C1, { arm: 'down', stone: 'off', broken: false, jolt: 0, strikeT: 0, sel: false, focus: 1, busy: false, talkIdx: { mistico: 0, arrogante: 0 } });
      G.camX = 0; G.camY = 0; G.camTX = null; G.control = false; G.white = 0; G.deaths = 0; G.burns = 0; G.seenCount = 0; PK.intro = false; fade.a = 1; parts.length = 0;
      setAmbience('cave', 3); chainsScript(id);
    },
    update: chainsUpdate,
    draw: drawChamber,
  },
  steps: {
    enter() {
      Object.assign(ST, { firm: 0, wob: 0, fallen: 0, first: true, steady: false, revealed: false, leaving: false, npcTalk: false, prompt: 'try' });
      G.control = true; P.pose = null; P.face = 1; setInspect(INSPECT_STEPS);
      card('Cenário II', 'Os Primeiros Passos e a Fogueira'); setGoal('Tente andar para a direita →');
      setPrompt('Tente andar <kbd>→</kbd>', 0, 0, true, 'step');
    },
    update(dt) {
      stepsUpdate(dt);
      const tx = G.camTX ?? clamp(P.x - 170, 0, CH.W - W);
      G.camX += (tx - G.camX) * Math.min(1, dt * 3.5);
    },
    draw: drawChamber,
  },
  parkour: {
    enter(id) {
      resetPlayer(30, 150); G.camX = 0; G.camY = 0; G.control = false; fade.a = 1; parts.length = 0; G.step = 'stepStone';
      Object.assign(PK, { dying: false, done: false });
      PK.movers = MOVERS_DEF.map(m => ({ ...m, dx: 0, dy: 0, spr: LAYER['mover' + m.x] }));
      setInspect(INSPECT_PK); setAmbience('cave', 2);
      (async () => {
        await fadeTo(0, .6);
        if (id !== run) return;
        setGoal('Pule até a luz no alto, à direita');
        if (!PK.intro) { PK.intro = true; card('Cenário III', 'O Parkour da Caverna'); toast('Espaço pula (segure para ir mais alto). Plataformas se movem. Estacas reiniciam a fase.', 5); }
        G.control = true;
      })();
    },
    update: pkUpdate,
    draw: drawParkour,
  },
  light: {
    enter(id) {
      resetPlayer(24, CH.floor); G.camX = 0; G.camY = 0; G.control = false; G.white = 0; fade.a = 1; parts.length = 0; G.step = 'stepStone';
      Object.assign(L4, { trig: false, whiteUp: false, stagger: false, glare: 0, nature: false, told: false });
      setInspect(INSPECT_L4); setAmbience('cave', 2);
      (async () => { await fadeTo(0, 1); if (id !== run) return; card('Cenário IV', 'A Revelação e o Ofuscamento'); setGoal('Caminhe em direção à luz →'); G.control = true; })();
    },
    update: lightUpdate,
    draw: drawLight,
  },
  outside: {
    enter(id) {
      resetPlayer(110, OUT.ground); P.pose = 'lie'; G.camX = 0; G.camY = 0; G.control = false; G.white = 1; fade.a = 1; parts.length = 0; G.step = 'stepGrass'; G.seenCount = 0;
      Object.assign(O5, { wake: true, fall: false, splT: 0, leafT: 0, leaves: [], fishT: 2, fish: null,
        stag: { x: 680, state: 'graze', t: 2, dir: -1, look: false },
        rabbits: [{ x: 480, a: 420, b: 560, dir: 1, air: 0, t: 1 }, { x: 1110, a: 1040, b: 1200, dir: -1, air: 0, t: 2 }],
        perch: { x: 344, y: 70, fly: false } });
      setInspect(INSPECT_OUT); setAmbience('nature', 3); G.onInspected = outGoal; setGoal('Recupere os sentidos...');
      (async () => {
        await fadeTo(0, 1.6);
        if (id !== run) return;
        card('Cenário V', 'O Mundo Exterior');
        await wait(2.2); P.pose = 'lieOpen'; await wait(.9); P.pose = 'kneel'; await wait(.7); P.pose = null; O5.wake = false;
        if (id !== run) return;
        await say('...Onde estou?', 'code', 'dazzled');
        await say('Cores. Água que cai. Criaturas vivas. Tudo é tão nítido!', 'code', 'happy');
        await say('Explore à vontade. Tudo que tiver o ícone ? pode ser examinado com E.', 'sistema');
        if (id !== run) return;
        G.control = true; outGoal(); setPrompt('Caminhe e contemple o mundo <kbd>→</kbd>', 0, 0, true, 'walk');
      })();
    },
    update: outUpdate,
    draw: drawOutside,
  },
  ending: {
    enter(id) { G.control = false; fade.a = 1; fade.color = '#000'; parts.length = 0; setAmbience('none', 3); endingScript(id); },
    update() {},
    draw() { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); },
  },
};
function go(name) {
  run++; waits.length = 0;
  if (D.active) { D.active = false; D.res = null; D.choices = null; UI.dialog.classList.remove('open'); }
  hidePrompt(); meter(false); Q.active = false; UI.qte.hidden = true; setInspect([]); G.onInspected = null;
  if (name !== 'ending') UI.ending.hidden = true;
  G.scene = name; Scenes[name].enter(run); hud();
}
function startGame() {
  if (G.scene !== 'title') return;
  audioInit(); sfx('click'); setAmbience('cave', 3);
  UI.title.hidden = true; stage.focus({ preventScroll: true });
  G.scene = 'starting';
  fadeTo(1, .5).then(() => go('chains'));
}
UI.start.addEventListener('click', startGame);
UI.title.addEventListener('pointerdown', () => { audioInit(); setAmbience('cave', 3); });

// ================================================================ LAÇO
function update(dt) {
  G.time += dt;
  const talking = updateDialog(dt);
  Scenes[G.scene].update(talking ? 0 : dt);
  if (!talking) updateInspect();
  updateParts(dt); tickWaits(); updateFade(dt); audioTick(G.time);
  G.shake = Math.max(0, G.shake - dt * 10); G.flash = Math.max(0, G.flash - dt * 2.2);
  placePrompt();
}
function draw() {
  ctx.save();
  if (G.shake > 0 && !REDUCED) ctx.translate(Math.round((Math.random() * 2 - 1) * G.shake), Math.round((Math.random() * 2 - 1) * G.shake));
  Scenes[G.scene].draw();
  ctx.restore();
  if (G.flash > 0) { ctx.fillStyle = `rgba(${G.flashCol},${G.flash})`; ctx.fillRect(0, 0, W, H); }
  if (fade.a > 0) { ctx.globalAlpha = fade.a; ctx.fillStyle = fade.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
  update(dt); draw(); pressed.clear();
  requestAnimationFrame(frame);
}

// ================================================================ INÍCIO
buildSprites();
LAYER.chamber = buildChamber();
LAYER.pkbg = buildParkourBg();
LAYER.parkour = buildParkour();
for (const m of MOVERS_DEF) LAYER['mover' + m.x] = buildMover(m);
LAYER.mouth = buildMouth();
buildOutside();
O5.fallFrames = waterFrames(VALLEY.fall.w, VALLEY.fall.h, 6, 3);
O5.cascade = waterFrames(OUT.streamW - 4, 42, 6, 9);
OUT.tufts = []; { const R = rng(61); for (let x = 130; x < OUT.edge - 30; x += 18 + R() * 40) if (Math.abs(x - OUT.streamX - 13) > 24) OUT.tufts.push(Math.round(x)); }
if (G.cycle > 1) { UI.tCycle.hidden = false; UI.tCycle.textContent = 'Você já passou por ' + (G.cycle - 1) + (G.cycle - 1 === 1 ? ' ciclo.' : ' ciclos.'); }
Scenes.title.enter(); hud();
window.__ilusao = { G, P, go, keys, pressed, ST, PK, O5, C1, D, INSPECT: () => INSPECT };
requestAnimationFrame(frame);
})();
