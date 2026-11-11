// ======================================================= ESTADO GLOBAL
const G = { scene: 'title', time: 0, camX: 0, camY: 0, camTX: null, shake: 0, flash: 0, flashCol: '255,255,255', white: 0, control: false,
  outSeen: new Set(), cycle: 1, deaths: 0, burns: 0, click: { x: 0, y: 0 }, focusIt: null, step: 'stepStone' };
try { G.cycle = Math.max(1, parseInt(localStorage.getItem('ilusao-ciclo'), 10) || 1); } catch (e) {}
const P = { x: 0, y: 0, vx: 0, vy: 0, hw: 5, h: 32, face: 1, onGround: false, ground: null, coyote: 0, jumpBuf: 0, cut: false, walkT: 0,
  pose: null, bubble: null, jitter: 0, hidden: false, stepT: 0, sweat: false, burnT: 0, crouch: false, solids: [] };
function resetPlayer(x, y) {
  Object.assign(P, { x, y, vx: 0, vy: 0, face: 1, onGround: true, ground: null, coyote: 0, jumpBuf: 0, cut: false, walkT: 0, pose: null, bubble: null, jitter: 0, hidden: false, sweat: false, burnT: 0, crouch: false, h: 32, solids: [], auto: null });
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
  P.solids = solids;   // guardado para saber se há espaço para Code se levantar
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
// Agachar: segurando ↓ (ou S) no chão, Code fica mais baixo (cabe em passagens de 27 px) e anda devagar.
// Ao soltar, ele só se levanta se houver espaço acima da cabeça; sob um teto baixo continua agachado.
const CROUCH_H = 24, STAND_H = 32;
function setCrouch(on) { if (P.crouch === on) return; P.crouch = on; P.h = on ? CROUCH_H : STAND_H; if (on) sfx('land'); }
function canStand() { const h0 = P.h; P.h = STAND_H; const ok = !P.solids.some(overlaps); P.h = h0; return ok; }
function controlPlayer(dt, opt = {}) {
  if (keys.down && P.onGround && opt.crouch !== false) setCrouch(true);
  else if (P.crouch && canStand()) setCrouch(false);
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), max = P.crouch ? Math.min(40, opt.max ?? PHY.run) : opt.max ?? PHY.run;
  const acc = P.onGround ? (dir ? PHY.accG : PHY.decG) : PHY.accA, target = dir * max;
  if (P.vx < target) P.vx = Math.min(target, P.vx + acc * dt); else if (P.vx > target) P.vx = Math.max(target, P.vx - acc * dt);
  if (dir) P.face = dir;
  if (opt.jump !== false) {
    P.coyote = P.onGround ? .1 : Math.max(0, P.coyote - dt);
    P.jumpBuf = hit('jump') ? .13 : Math.max(0, P.jumpBuf - dt);
    if (P.jumpBuf > 0 && P.coyote > 0 && !P.crouch) { P.vy = -PHY.jump; P.jumpBuf = 0; P.coyote = 0; P.onGround = false; P.cut = true; sfx('jump'); }
    if (P.cut && !keys.jump && P.vy < -80) { P.vy *= .45; P.cut = false; }
    if (P.vy >= 0) P.cut = false;
  }
  if (P.onGround && Math.abs(P.vx) > 5) { P.stepT += Math.abs(P.vx) * dt; if (P.stepT > (P.crouch ? 16 : 26)) { P.stepT = 0; sfx(G.step); } }
  P.walkT += Math.abs(P.vx) * dt;
}

// Entradas e saídas de fase: Code anda sozinho alguns passos (o jogador ainda não tem o controle).
// autoWalk(x) devolve uma promessa que se resolve quando ele chega; o movimento é feito no laço principal,
// depois da cena, e não usa colisão (os trechos de entrada e saída são planos).
function autoWalk(tx, speed = 46, o = {}) {
  if (o.crouch) setCrouch(true);
  return new Promise(res => { P.auto = { tx, speed, res }; });
}
function autoUpdate(dt) {
  const a = P.auto; if (!a) return;
  const d = a.tx - P.x, dir = Math.sign(d), step = a.speed * dt;
  if (Math.abs(d) <= step || !dir) { P.x = a.tx; P.vx = 0; P.auto = null; a.res(); return; }
  P.face = dir; P.vx = dir * a.speed; P.x += dir * step; P.walkT += step;
  P.stepT += step; if (P.stepT > (P.crouch ? 16 : 26)) { P.stepT = 0; sfx(G.step); }
}
// poeirinha nos pés (ao sair de uma passagem ou levantar)
function dustPuff(x, y, n = 8) { emit(x, y - 1, n, { cols: G.step === 'stepGrass' ? ['#9cd452', '#6aae3a'] : ['#8a7a80', '#5a4a52', '#7a6a70'], sx: 26, sy: 6, vy: -12, life: .5 }); }

// =========================================================== DESENHO
function flicker(t = G.time) { return .9 + .06 * Math.sin(t * 11) + .04 * Math.sin(t * 23 + 1.3) + .03 * Math.sin(t * 37); }
function glow(x, y, r, rgb, a) {
  if (a <= 0) return;
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
}
// Iluminação: um mapa de escuridão em resolução cheia. As luzes abrem buracos (círculos ou polígonos em
// degradê) e o resultado é quantizado em faixas e pontilhado (Bayer 4×4), pixel a pixel: a penumbra vira
// uma sobreposição de pixels escuros, como em pixel art, em vez de um borrão liso.
const LC = document.createElement('canvas'); LC.width = W; LC.height = H;
const LG = LC.getContext('2d', { willReadFrequently: true });
const LEVELS = 7, LUT = Array.from({ length: LEVELS + 1 }, (_, i) => Math.round(i / LEVELS * 255)), BAYF = BAYER.map(v => (v + .5) / 16);
function lighting(amb, lights, tint = 0x0b0306) {
  LG.globalCompositeOperation = 'source-over'; LG.clearRect(0, 0, W, H);
  LG.fillStyle = `rgba(0,0,0,${amb})`; LG.fillRect(0, 0, W, H);
  LG.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    if (l.poly) {
      const gr = LG.createLinearGradient(l.g[0], l.g[1], l.g[2], l.g[3]); gr.addColorStop(0, `rgba(0,0,0,${l.a})`); gr.addColorStop(1, `rgba(0,0,0,${l.a1 ?? 0})`);
      LG.fillStyle = gr; LG.beginPath(); LG.moveTo(l.poly[0][0], l.poly[0][1]); for (let i = 1; i < l.poly.length; i++) LG.lineTo(l.poly[i][0], l.poly[i][1]); LG.closePath(); LG.fill();
    } else {
      const r = Math.max(1, l.r), gr = LG.createRadialGradient(l.x, l.y, r * (l.core || 0), l.x, l.y, r);
      gr.addColorStop(0, `rgba(0,0,0,${l.a})`); gr.addColorStop(.55, `rgba(0,0,0,${l.a * .55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      LG.fillStyle = gr; LG.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
  }
  const im = LG.getImageData(0, 0, W, H), d = new Uint32Array(im.data.buffer);
  for (let y = 0, i = 0; y < H; y++) {
    const by = (y & 3) << 2;
    for (let x = 0; x < W; x++, i++) {
      const a = d[i] >>> 24; if (!a) { d[i] = 0; continue; }
      const v = a * LEVELS / 255, b = v | 0; let f = v - b; f = f < .28 ? 0 : f > .72 ? 1 : (f - .28) * 2.27;
      d[i] = (LUT[Math.min(LEVELS, b + (f > BAYF[by | x & 3] ? 1 : 0))] << 24 | tint) >>> 0;
    }
  }
  LG.putImageData(im, 0, 0); ctx.drawImage(LC, 0, 0);
}
// vinheta pontilhada: escurece os cantos com pixels soltos (profundidade)
function buildVignette() {
  const [c, g] = mk(W, H);
  veil(g, 0, 0, W, H, '#05030a', (x, y) => { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2); return Math.min(.5, (Math.max(Math.abs(dx), Math.abs(dy)) * .5 + Math.hypot(dx, dy) * .5 - .9) * 1.5); });
  return c;
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
  ctx.fillRect(x + Math.round(Math.sin(t * 3.3 + 2) * 4), y - Math.round(h * 1.08 + Math.sin(t * 5.7) * 3), 1, 1);
}
// lanterna de ferro com a chama tremendo lá dentro
function lantern(x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.drawImage(S.lantern, x - 4, y);
  const f = Math.floor(G.time * 9) % 3; ctx.fillStyle = '#fff3c4'; ctx.fillRect(x - 1 + (f === 1 ? 1 : 0), y + 5 + (f === 2 ? 1 : 0), 2, 2);
}
function lightRays(x0, x1, y0, dx, len, a, n = 4, rgb = '255,214,140') {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const k = i / n, xa = lerp(x0, x1, k), xb = lerp(x0, x1, k + .5 / n), al = a * (.6 + .4 * Math.sin(G.time * .7 + i * 1.7));
    const gr = ctx.createLinearGradient(xa, y0, xa + dx, y0 + len); gr.addColorStop(0, `rgba(${rgb},${al})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(xa, y0); ctx.lineTo(xb, y0); ctx.lineTo(xb + dx * 1.15, y0 + len); ctx.lineTo(xa + dx * .9, y0 + len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
// poeira suspensa: pontinhos que derivam devagar (aparecem só onde há luz, pois são desenhados antes da escuridão)
function motes(n, wWorld, y0, y1, rgb, seed = 0) {
  const t = G.time;
  for (let i = 0; i < n; i++) {
    const x = ((i * 97.3 + seed * 31 + t * (3 + i % 4)) % wWorld) - G.camX; if (x < 0 || x > W) continue;
    const y = y0 + ((i * 53.7 + seed * 17) % (y1 - y0)) + Math.sin(t * .6 + i) * 5 - G.camY;
    ctx.fillStyle = `rgba(${rgb},${.25 + .25 * Math.sin(t * 1.7 + i * 2.3)})`; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}
// Animações do Code: respirar (com piscadas), andar em 6 quadros, subir e cair no pulo, e poses dos roteiros.
const POSE_ANIM = { wall: 1, coverWalk: 1, climb: 1, crouchWalk: 1 };
const POSE_RATE = { wob: 6, shock: 3, hurt: 8, fall: 9 };
const POSE_ONCE = { faint: 5.5 };
function heroFrame() {
  const t = G.time;
  if (P.pose !== P.lastPose) { P.lastPose = P.pose; P.poseT = t; }
  if (P.pose === 'sitCode') return C1.broken ? S.sitFree : S.sit[C1.arm];
  const HS = G.handBurned ? S.burned : S;   // com a mão queimada, as poses de perfil vêm do conjunto "queimado"
  if (P.pose) {
    const v = HS[P.pose] || S[P.pose];
    if (Array.isArray(v)) {
      if (POSE_ONCE[P.pose]) return v[Math.min(v.length - 1, Math.floor((t - P.poseT) * POSE_ONCE[P.pose]))];
      return v[(POSE_ANIM[P.pose] ? Math.floor(P.walkT / 5) : Math.floor(t * (POSE_RATE[P.pose] || 3))) % v.length];
    }
    return v;
  }
  const CS = lampInHand() ? HS.carry : null;   // com a lanterna na mão, o braço da frente fica segurando a alça
  if (P.crouch && P.onGround) { const c = CS || HS; return Math.abs(P.vx) > 5 ? c.crouchWalk[Math.floor(P.walkT / 4) % 4] : c.crouch[Math.floor(t * .9) % 2]; }
  if (!P.onGround) { const c = CS || HS; return P.vy < -110 ? c.jump[0] : P.vy < 70 ? c.jump[1] : c.fall[Math.floor(t * 9) % 2]; }
  if (Math.abs(P.vx) > 5) return (CS || HS).walk[Math.floor(P.walkT / 5) % 6];
  if (CS) return CS.idle[Math.floor(t * .9) % 2];
  return ((t * .31) % 1 > .96 ? HS.idleBlink : HS.idle)[Math.floor(t * .9) % 2];
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
  if (P.sweat) { ctx.fillStyle = '#9fd4ff'; const sy = y - 30 + ((G.time * 20) % 7); ctx.fillRect(x + (flip ? -9 : 8), Math.round(sy), 1, 2); }
}
// clarão branco do ofuscamento, com a silhueta de Code por cima
function whiteout(k = .94) {
  if (G.white <= 0) return;
  ctx.fillStyle = `rgba(255,252,240,${G.white * k})`; ctx.fillRect(0, 0, W, H);
  if (G.white > .4) drawHero('#4a3c46', clamp((G.white - .4) * 1.6, 0, .85));
}


// ======================================================= PONTOS DE INSPEÇÃO
let INSPECT = [];
function setInspect(list) { INSPECT = list || []; for (const it of INSPECT) it.seen = false; G.focusIt = null; }
function updateInspect() {
  if (!G.control || D.active || !INSPECT.length || !P.onGround) { if (PR.tag === 'insp') hidePrompt('insp'); G.focusIt = null; return; }
  let best = null, bd = 1e9;
  for (const it of INSPECT) { if ((it.cond && !it.cond()) || (it.near && !it.near())) continue; const d = Math.abs(P.x - val(it.x)); if (d < (it.r || 18) && d < bd) { bd = d; best = it; } }
  G.focusIt = best;
  if (best) { setPrompt(`<kbd>E</kbd> ${val(best.verb) || 'Examinar'}: ${val(best.label)}`, val(best.px ?? best.x), best.iy - 8, false, 'insp'); if (hit('act')) runInspect(best); }
  else hidePrompt('insp');
}
async function runInspect(it) {
  const id = run; G.control = false; P.vx = 0; hidePrompt('insp'); G.focusIt = null;
  if (!it.seen) { it.seen = true; if (!it.hidden) G.seenCount = (G.seenCount || 0) + 1; }
  P.face = val(it.x) >= P.x ? 1 : -1; sfx('select');
  await it.run();
  if (id !== run) return;
  G.control = true; if (G.onInspected) G.onInspected();
}
function drawInspectIcons() {
  for (const it of INSPECT) {
    if ((it.cond && !it.cond()) || it.hidden) continue;   // pontos secretos não têm ícone: só o aviso de perto
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
// Sombras no paredão: uma silhueta só, limpa, com a penumbra já embutida no sprite (franja pontilhada).
// Ela é redesenhada linha a linha com uma ondulação lenta e larga (sem rasgar pernas e lanças), incha e
// encolhe um pouco com a chama e desliza devagar. Um único desenho por sombra: nada de cópias sobrepostas.
const [SHC, SHG] = mk(130, 120);
function shadowWarp(spr, t, i, sy) {
  const w = spr.width, h = spr.height, h2 = Math.min(SHC.height, Math.ceil(h * sy));
  SHG.clearRect(0, 0, SHC.width, SHC.height);
  for (let y = 0; y < h2; y++) {
    const k = 1 - y / h2, wob = Math.sin(t * 1.5 + y * .055 + i * 1.9) * 1.8 * k;
    SHG.drawImage(spr, 0, Math.min(h - 1, Math.floor(y / sy)), w, 1, Math.round(20 + wob), y, w, 1);
  }
  return h2;
}
function drawShadowsOnWall() {
  const t = G.time, fl = flicker();
  ctx.globalAlpha = clamp(.56 + (fl - .9) * 1.1, .42, .68);
  SHADOWS.forEach((s, i) => {
    const spr = S.shadow[s.k], w = spr.width;
    const sx = s.x + Math.sin(t * .27 + i * 2.1) * 4 + Math.sin(t * .7 + i) * 1.5 - G.camX;
    if (sx < -80 || sx > W + 80) return;
    const by = s.b + 5 + (s.k === 'bird' ? Math.sin(t * 1.3) * 4 - 3 : 0), sy = 1 + .045 * Math.sin(t * .8 + i * 1.7) + (fl - .93) * .35;
    const h2 = shadowWarp(spr, t, i, sy);
    ctx.drawImage(SHC, 0, 0, w + 40, h2, Math.round(sx - (w + 40) / 2), Math.round(by - h2), w + 40, h2);
  });
  ctx.globalAlpha = 1;
}
function drawSelectArrow() {
  if (!C1.sel || C1.busy || D.active || Q.active || G.scene !== 'chains') return;
  const t = c1Targets()[C1.focus];
  ctx.drawImage(S.arrow, Math.round(t.x - 4 - G.camX), Math.round(t.y - 44 + (Math.floor(G.time * 4) % 2)));
}
// fogueira de toras: uma língua grande, duas menores e brasas piscando na base
function bonfire(x, y) {
  flame(x - 7, y + 1, 5, 17); flame(x + 8, y + 1, 5, 15); flame(x, y, 12, 34);
  for (let i = -9; i <= 9; i += 3) if (Math.sin(G.time * 7 + i * 2.1) > -.2) { ctx.fillStyle = i & 1 ? '#ffcf4a' : '#f57f24'; ctx.fillRect(x + i, y + 1, 2, 1); }
}
function drawChamber() {
  const cx = G.camX, fl = flicker(), t = G.time, F = CH.floor;
  ctx.drawImage(LAYER.chamber, -Math.round(cx), 0);
  glow(330 - cx, 134, 200, '255,140,60', .2 * fl);
  drawShadowsOnWall();
  const fx = CH.fireX - cx, fy = CH.fireY, lpx = CH.lampX - cx;
  if (fx > -60 && fx < W + 60) bonfire(Math.round(fx), fy);
  if (lpx > -20 && lpx < W + 20) lantern(lpx, CH.lampY);
  motes(46, CH.W, 60, 176, '255,214,160', 1);
  drawSecretDoor(); drawPrisoners(); drawStone(); drawHero(); drawParts();
  ctx.drawImage(LAYER.chamberFg, -Math.round(cx * 1.25), 0);
  const L = [{ x: fx, y: fy - 26, r: 340 * fl, a: 1 }, { x: 330 - cx, y: 138, r: 300 + (fl - .9) * 90, a: .95 }, { x: 140 - cx, y: 150, r: 190, a: .62 },
    { x: P.x - cx, y: P.y - 16, r: 90, a: .55 }, { x: 965 - cx, y: 2, r: 150, a: .8 }, { x: lpx, y: CH.lampY + 6, r: 74 * fl, a: .85 }];
  for (const [mx, big] of HALL_SHROOMS) L.push({ x: mx - cx, y: F - 4, r: big ? 17 : 12, a: .55 });
  if (C1.stone === 'ground' || C1.stone === 'hand') { const o = C1.stone === 'hand' ? SIT_STONE[C1.arm] || [0, 0] : [0, 0], bx = C1.stone === 'hand' ? P.x + o[0] : STONE.x, by = C1.stone === 'hand' ? P.y + o[1] : STONE.y; L.push({ x: bx - cx, y: by, r: 50 + Math.sin(G.time * 4) * 7, a: .9 }); }
  lighting(.76, L);
  // brilhos por cima do escuro: fogo, lanterna do pórtico, cogumelos e a luz do dia que desce pela fenda
  glow(fx, fy - 30, 140, '255,140,50', .3 * fl); glow(fx, fy - 12, 50, '255,220,150', .2 * fl);
  if (ST.statueGlow) for (const s of STATUES) { const h = S.statue[s.k].height; glow(s.x - cx, s.y - h * .45, h * .55 + 6, '255,214,150', .22 + .1 * Math.sin(t * 4)); }
  glow(lpx, CH.lampY + 6, 38, '255,160,70', .3 * fl);
  for (const [mx, big] of HALL_SHROOMS) glow(mx - cx, F - 4, big ? 12 : 9, '170,120,255', .3 + .08 * Math.sin(t * 2 + mx));
  if (cx > 420) {
    lightRays(940 - cx, 992 - cx, 4, -150, 200, .085, 4);
    for (let i = 0; i < 16; i++) { const u = (i * .171 + t * (.02 + (i % 4) * .006)) % 1; ctx.fillStyle = `rgba(255,232,180,${.3 + .25 * Math.sin(t * 2 + i)})`; ctx.fillRect(Math.round(946 + (i * 23 % 42) - u * 140 + Math.sin(t + i) * 3 - cx), Math.round(8 + u * 172), 1, 1); }
  }
  ctx.drawImage(LAYER.vig, 0, 0);
  if (Math.random() < .35) emit(CH.fireX + (Math.random() * 14 - 7), fy - 20, 1, { cols: ['#ffcf4a', '#f57f24', '#fff6c8'], sx: 9, sy: 6, vy: -32, life: 1.4, add: true });
  if (Math.random() < .1) emit(CH.fireX + (Math.random() * 6 - 3), fy - 36, 1, { cols: ['#5a4a50', '#6a5a62', '#4a3c44'], sx: 3, sy: 2, vx: 8, vy: -24, life: 4.5, size: 2, alpha: .3 });
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
// A cada 3 golpes em falso a fechadura "afrouxa": a faixa dourada cresce e o marcador desacelera (até 4 vezes).
function runQTE() { return new Promise(res => { Q.active = true; Q.round = 0; Q.misses = 0; Q.ease = 0; Q.eased = false; Q.res = res; UI.qte.hidden = false; qteRound(); }); }
function qteRound() {
  const e = Q.ease || 0, w = Math.min(.5, [.26, .19, .14][Q.round] * (1 + .3 * e)), c = .25 + Math.random() * .5;
  Q.zone = [clamp(c - w / 2, .05, .95 - w), 0]; Q.zone[1] = Q.zone[0] + w;
  Q.speed = [.85, 1.15, 1.45][Q.round] * (1 - .12 * e); Q.pos = 0; Q.dir = 1; Q.lock = 0; Q.state = ''; Q.eased = false;
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
      else {
        Q.round = 0; Q.state = 'miss'; Q.lock = .8; sfx('miss'); G.shake = 2; C1.jolt = 1.5;
        Q.misses++; if (Q.misses % 3 === 0 && Q.ease < 4) { Q.ease++; Q.eased = true; Q.lock = 1.3; }
      }
    }
  }
  UI.qZone.style.left = (Q.zone[0] * 100) + '%'; UI.qZone.style.width = ((Q.zone[1] - Q.zone[0]) * 100) + '%';
  UI.qCursor.style.left = (Q.pos * 100) + '%';
  UI.pips.forEach((p, i) => p.classList.toggle('on', i < Q.round));
  UI.qLabel.textContent = 'Golpe ' + Math.min(3, Q.round + (Q.state === 'hit' ? 0 : 1)) + ' de 3';
  UI.qBar.className = 'qte-bar' + (Q.state ? ' ' + Q.state : '');
  UI.qHint.className = Q.state;
  UI.qHint.innerHTML = Q.state === 'hit' ? (Q.round >= 3 ? 'As algemas cedem!' : 'Acertou! Mais um golpe.') : Q.state === 'miss' ? (Q.eased ? 'As algemas estão cedendo: a faixa ficou maior e o marcador, mais lento.' : 'Golpe em falso! A sequência recomeça.') : 'Aperte <kbd>E</kbd> quando o marcador passar pela faixa dourada';
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
// Só as interações que carregam a história: as estátuas (as sombras eram cópias de cópias) e a fogueira (o real queima).
// As estátuas são examinadas juntas: um ponto só, no meio da passarela, e todas brilham ao mesmo tempo durante a fala.
const STATUE_LINES = [
  ['code', 'shock', 'O escudo, o cavalo, o guerreiro, a árvore, o pássaro... Todas as sombras do muro estão aqui, paradas.'],
  ['code', 'think', 'São estátuas de pedra, cópias de coisas que eu nunca vi. As sombras eram cópias dessas cópias.'],
  ['code', 'worried', 'Pareciam vivas só porque o fogo tremia. Nenhuma delas se mexeu de verdade.'],
];
async function inspectStatues() {
  ST.statueGlow = true;
  await talk(STATUE_LINES);
  ST.statueGlow = false;
}
const INSPECT_STEPS = [
  { id: 'statues', x: 760, iy: 56, r: 110, label: 'As estátuas', cond: () => ST.revealed, run: inspectStatues },
  { id: 'fire', x: CH.fireX, iy: 128, r: 24, verb: () => G.handBurned ? 'Examinar' : 'Tocar', label: 'A fogueira', cond: () => ST.revealed, run: () => inspectFire() },
  // a laje secreta, no canto esquerdo do paredão: sem ícone, o aviso só aparece com Code encostado nela
  { id: 'secret', x: SECRET.doorX, px: SECRET.doorX + 46, iy: CH.floor - 34, r: 11, hidden: true, verb: () => G.secretOpen ? 'Entrar' : 'Examinar', label: () => G.secretOpen ? 'A passagem' : 'A parede', cond: () => ST.steady, run: () => secretDoor() },
];
// Tocar o fogo queima na hora, sem pergunta: o real tem efeitos que a sombra não tem.
// No segundo toque a mão fica queimada até o fim do ciclo; depois disso Code se recusa a tocar de novo.
async function inspectFire() {
  P.face = CH.fireX >= P.x ? 1 : -1;
  if (G.handBurned) {
    P.pose = 'reach'; await wait(.25); P.pose = null; P.x -= P.face * 4;
    await say('Nem pensar! Minha mão ainda arde. Essa lição eu já aprendi.', 'code', 'hurt');
    return;
  }
  P.pose = 'reach'; await wait(.35);
  P.pose = 'hurt'; P.burnT = 2.4; sfx('burn'); G.flash = .65; G.flashCol = '255,90,40'; G.shake = 5;
  emit(P.x + P.face * 10, P.y - 16, 20, { cols: ['#ffcf4a', '#f57f24', '#fff6c8'], sx: 50, sy: 40, vy: -40, life: .5, add: true });
  P.x -= P.face * 14; G.burns++;
  await wait(.8);
  if (G.burns === 1) {
    await say('AAAI! Queima! Queima!', 'code', 'hurt');
    await say('As sombras do muro nunca queimaram ninguém. O fogo de verdade, sim.', 'narrador');
    await say('O real tem efeitos que a aparência não tem.', 'narrador');
  } else {
    G.handBurned = true; G.handSmoke = 9;
    await say('AAAAI! De novo, não!', 'code', 'hurt');
    P.pose = null; await wait(.4); P.bubble = '!'; await wait(.7); P.bubble = null;
    await say('Minha mão... ficou vermelha e cheia de bolhas. Isso vai deixar marca.', 'code', 'worried');
    await say('A sombra do fogo nunca deixou cicatriz. O fogo de verdade deixa.', 'narrador');
  }
  P.pose = null;
}
// Primeiros passos. Três medidores:
//   Firmeza    sobe enquanto Code anda, solto ou apoiado na parede. Cheia, ele anda e pula.
//   Equilíbrio cai enquanto ele anda solto; zerado, ele tomba e perde um pouco de firmeza.
//   Apoio      é a força do braço na parede: segurar E recupera o equilíbrio e deixa andar com segurança,
//              mas gasta o apoio (mais devagar parado); ele só volta com o braço solto. Quando o braço
//              cansa, é preciso soltar E antes de agarrar de novo. Apertar E sem parar enquanto o braço
//              ainda se recupera é um escorregão que tira equilíbrio.
function stepsFall() {
  ST.fallen = 1.4; ST.wob = 0; ST.holding = false; ST.tired = false; ST.slip = 0; ST.gripCd = 0; ST.firm = Math.max(0, ST.firm - .07); ST.trip = 0; P.vx = 0; P.pose = 'lie';
  sfx('thud'); G.shake = 3; emit(P.x, P.y - 2, 12, { cols: ['#7a6a70', '#5a4a52'], sx: 36, sy: 8, vy: -14, life: .5 });
}
function stepsUpdate(dt) {
  const floor = [{ x: -20, y: CH.floor, w: CH.W + 40, h: 40 }];
  if (P.burnT > 0) { P.burnT -= dt; if (Math.random() < dt * 12) emit(P.x + P.face * 9, P.y - 14, 1, { cols: ['#8a8088', '#a49aa0'], sx: 4, sy: 2, vy: -16, life: 1, size: 1, alpha: .6 }); }
  else if (G.handSmoke > 0) { G.handSmoke -= dt; if (!P.pose && Math.random() < dt * 4) emit(P.x + P.face * 1, P.y - (P.crouch ? 6 : 9), 1, { cols: ['#8a8088', '#a49aa0'], sx: 3, sy: 2, vy: -12, life: 1.2, size: 1, alpha: .45 }); }
  const dF = Math.abs(P.x - CH.fireX); if (dF < 170 && Math.random() < dt * 9 * (1 - dF / 170)) sfx('crackle');
  if (!G.control) { if (!ST.steady) { P.y = CH.floor; P.vx = 0; } else { P.vx = 0; physics(dt, floor); } return; }
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (ST.fallen > 0) {
    ST.fallen -= dt; P.vx = 0; P.pose = ST.fallen > .55 ? 'lie' : 'kneel';
    if (ST.fallen <= 0) { P.pose = null; if (ST.first) { ST.first = false; afterFirstFall(run); } }
    return;
  }
  if (!ST.steady) {
    if (dir && ST.prompt === 'try') { hidePrompt('step'); ST.prompt = ''; }
    const want = keys.act || keys.hold;
    ST.gripCd = Math.max(0, ST.gripCd - dt); ST.slip = Math.max(0, ST.slip - dt);
    if (!ST.first) {
      if (ST.holding) {
        if (!want) { ST.holding = false; ST.gripCd = .35; }
        else if (ST.grip <= 0) { ST.holding = false; ST.tired = true; ST.gripCd = 1; ST.slip = .5; ST.wob = Math.min(.96, ST.wob + .18); G.shake = 1.5; sfx('miss'); toast('O braço cansou! Solte E e deixe o Apoio voltar.', 2.6); }
      } else if (!want) ST.tired = false;   // soltou E: pode agarrar de novo
      else if (hit('act') || hit('hold')) {
        if (ST.gripCd > 0 || ST.grip < .15) { ST.wob += .16; ST.gripCd = .55; ST.slip = .4; G.shake = 1.5; sfx('miss'); }   // agarrão fora de hora: escorrega
        else ST.holding = true;
      } else if (!ST.tired && ST.gripCd <= 0 && ST.grip >= .25) ST.holding = true;   // E já estava segurado (ex.: desde a queda): agarra assim que puder
    }
    if (ST.holding) {
      ST.grip = Math.max(0, ST.grip - dt * (dir ? .15 : .06)); ST.wob = Math.max(0, ST.wob - dt * 1.5);
      P.vx = dir * 20; if (dir) { P.face = dir; ST.firm = Math.min(1, ST.firm + dt * .12); }
      P.pose = dir ? 'wall' : 'wallIdle';
      if (dir && Math.random() < dt * 6) emit(P.x + dir * 8, P.y - 26, 1, { cols: ['#7a6a70'], sx: 4, sy: 4, vy: 10, g: 60, life: .5 });
    } else {
      ST.grip = Math.min(1, ST.grip + dt * (ST.gripCd > 0 ? .1 : .32));
      if (dir) { P.vx = dir * 28; P.face = dir; ST.wob += dt * (ST.first ? 1.5 : 1.3 - .7 * ST.firm); if (!ST.first) ST.firm = Math.min(1, ST.firm + dt * .15); P.pose = 'wob'; }
      else { P.vx = 0; ST.wob = Math.max(0, ST.wob - dt * .45); P.pose = ST.wob > .35 || ST.slip > 0 ? 'wob' : null; }
    }
    // tropeços: as pernas ainda não obedecem. Andando, de tempos em tempos o pé falha (mais solto do que
    // apoiado, e menos conforme a firmeza cresce): o equilíbrio despenca de uma vez e ele cai com frequência.
    if (!ST.first && dir) {
      ST.tripT = (ST.tripT ?? 1.2) - dt;
      if (ST.tripT <= 0) {
        ST.tripT = 1 + Math.random() * 1.8;
        if (Math.random() < (ST.holding ? .4 : .85) * (1 - ST.firm * .6)) {
          // apoiado, às vezes é a mão que escorrega da parede: ele fica solto, balançando, até conseguir se agarrar de novo
          if (ST.holding && Math.random() < .45) { ST.holding = false; ST.gripCd = .6; ST.slip = .5; ST.wob += .5; emit(P.x + dir * 8, P.y - 26, 4, { cols: ['#7a6a70'], sx: 10, sy: 6, vy: 10, g: 80, life: .5 }); }
          else ST.wob += ST.holding ? .3 : .42;
          ST.trip = .45; G.shake = 1.5; sfx('land');
          emit(P.x + dir * 4, P.y - 1, 4, { cols: ['#8a7a80', '#5a4a52'], sx: 18, sy: 4, vy: -10, life: .4 });
        }
      }
    }
    if (ST.trip > 0) { ST.trip -= dt; if (!ST.holding) P.pose = 'wob'; P.jitter = ST.trip > .2 ? 1 : 0; } else P.jitter = 0;
    if (P.vx) { P.stepT += Math.abs(P.vx) * dt; if (P.stepT > 20) { P.stepT = 0; sfx('stepStone'); } }
    P.walkT += Math.abs(P.vx) * dt;
    P.x = clamp(P.x + P.vx * dt, 16, CH.wallEnd - 10); P.y = CH.floor;
    if (ST.wob >= 1) { P.jitter = 0; stepsFall(); return; }
    if (!ST.first) meter(true, ST.firm, 1 - ST.wob, ST.grip);
    if (ST.prompt === 'hold' && ST.firm > .2) { hidePrompt('step'); ST.prompt = ''; }
    if (ST.firm >= 1) {
      ST.steady = true; P.pose = null; P.jitter = 0; meter(false); hidePrompt('step'); sfx('reveal');
      toast('Firmeza recuperada! Agora Code anda e pula sozinho.', 3.6); setGoal('Siga em frente pela caverna →');
    }
    if (ST.firm > .5 && !ST.npcTalk) { ST.npcTalk = true; toast('O Arrogante grita: "Volte! As sombras são tudo o que existe!"', 3.6); }
  } else {
    controlPlayer(dt); physics(dt, floor); P.x = clamp(P.x, 16, CH.W - 8);
    if (!ST.revealed && P.x >= 498) reveal(run);
    if (ST.revealed && !ST.leaving && P.x >= CH.exitX) { ST.leaving = true; G.control = false; autoWalk(CH.W + 14, 52); fadeTo(1, .8).then(() => go('parkour')); }   // entra andando no arco escuro
  }
}
async function afterFirstFall(id) {
  G.control = false;
  await say('As pernas de Code nunca sustentaram o próprio peso. O chão parece girar.', 'narrador');
  await say('Andar enche a Firmeza, solto ou apoiado. Solto, o Equilíbrio cai; segure E para se apoiar na parede e andar com segurança.', 'sistema');
  await say('O braço cansa: a barra de Apoio só volta com a mão solta. E apertar E sem parar não adianta, Code escorrega.', 'sistema');
  if (id !== run) return;
  G.control = true; ST.prompt = 'hold'; setGoal('Ande para ganhar Firmeza · segure E para se apoiar quando balançar');
  setPrompt('Ande <kbd>→</kbd> · apoio: segure <kbd>E</kbd>', 0, 0, true, 'step');
  meter(true, ST.firm, 1, ST.grip);
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

// ===================================== SALA SECRETA · à esquerda da câmara
// No canto esquerdo do paredão há uma laje encaixada, igual à rocha em volta. Encostado nela, Code pode
// examiná-la: são três discos numerados. O código 984 faz a laje afundar no chão e abre uma passagem baixa,
// que leva por um túnel estreito (é preciso agachar) até uma sala escondida. O que há na sala será decidido depois.
async function secretDoor() {
  const id = run;
  if (G.secretOpen) {   // passagem aberta: Code se abaixa e entra
    P.pose = 'standBack'; await wait(.3); P.pose = 'kneelBack'; await wait(.3);
    await fadeTo(1, .5);
    if (id !== run) return;
    go('secret'); return;
  }
  P.pose = 'standBack';
  if (!ST.slabSeen) {
    ST.slabSeen = true;
    await say('Esta parte do muro é lisa demais... é uma laje encaixada na rocha.', 'code', 'think');
    await say('Tem três discos de pedra com números gravados. Parece uma fechadura.', 'code', 'awe');
  }
  if (id !== run) return;
  const code = await openKeypad(v => v === SECRET.code);
  if (id !== run) return;
  if (code === null) { P.pose = null; return; }
  G.secretOpen = true; sfx('slide'); G.shake = 3; ST.doorAnim = true;
  await until(() => G.secretDoor >= 1);
  ST.doorAnim = false; P.pose = null; P.face = 1;
  if (id !== run) return;
  await say('A laje afundou no chão! Atrás dela tem uma passagem... baixa e apertada.', 'code', 'shock');
  await say('Segure ↓ (ou S) para agachar e passar por lugares baixos. Aperte E na frente da passagem para entrar.', 'sistema');
}
function secretDoorUpdate(dt) {
  if (!ST.doorAnim) return;
  G.secretDoor = Math.min(1, G.secretDoor + dt / 1.6); G.shake = Math.max(G.shake, 1.2);
  if (Math.random() < dt * 30) emit(SECRET.doorX + (Math.random() - .5) * SECRET.doorW, CH.floor - 1, 1, { cols: ['#7a6a70', '#5a4a52', '#8a7a80'], sx: 20, sy: 6, vy: -16, g: 60, life: .7, size: 2, alpha: .7 });
}
// laje no paredão: fechada ela quase some na rocha; aberta, afunda no chão e mostra a boca escura do túnel
function drawSecretDoor() {
  const x0 = Math.round(SECRET.doorX - SECRET.doorW / 2 - G.camX), F = CH.floor, w = SECRET.doorW, h = SECRET.doorH, top = F - h, k = G.secretDoor || 0, WH = RK.wall.hex;
  if (x0 < -w - 4 || x0 > W + 4) return;
  if (k > 0) {
    rect(ctx, x0 - 1, top - 1, w + 2, h + 1, WH[0]); rect(ctx, x0, top, w, h, '#030207');
    rect(ctx, x0 + 3, F - 4, w - 6, 4, '#0c0714'); rect(ctx, x0 + 5, F - 5, w - 10, 1, '#120b1b');   // chão do túnel sumindo no escuro
    rect(ctx, x0 + 2, top + 2, w - 4, 2, '#0a0610');
  }
  const sy = top + Math.round(k * (h + 2));
  if (sy >= F) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 1, top - 1, w + 2, F - top + 1); ctx.clip();
  rect(ctx, x0, sy, w, h, WH[3]); rect(ctx, x0, sy, w, 1, WH[4]); rect(ctx, x0, sy, 1, h, WH[2]); rect(ctx, x0 + w - 1, sy + 1, 1, h - 1, WH[2]);
  for (let i = 0; i < w; i += 2) if (hash2(i, 7, 5) < .55) rect(ctx, x0 + i, sy, 1, 1, WH[1]);   // junta tracejada: só se vê de perto
  for (let j = 2; j < h; j += 3) if (hash2(j, 9, 5) < .5) rect(ctx, x0 + w - 1, sy + j, 1, 1, WH[1]);
  rect(ctx, x0 + 5, sy + 9, 2, 6, WH[2]); rect(ctx, x0 + 14, sy + 4, 6, 1, WH[2]); rect(ctx, x0 + 17, sy + 17, 3, 2, WH[4]);
  for (let i = 0; i < 3; i++) { const dx = x0 + 6 + i * 5, dy = sy + 11; rect(ctx, dx, dy, 3, 3, WH[1]); rect(ctx, dx + 1, dy + 1, 1, 1, WH[4]); }   // os três discos numerados
  ctx.restore();
}

// A cena: um vestíbulo onde se fica de pé, o túnel baixo (agachar) e a sala escondida, mais alta.
const SECR = {};
const INSPECT_SECRET = [
  { id: 'niche', x: SEC.nicheX, iy: 88, r: 22, label: 'O nicho', run: () => talk([
    ['code', 'awe', 'Uma sala inteira escondida atrás do muro... e um nicho vazio bem no meio da parede.'],
    ['code', 'think', 'Quem talhou esta sala? E o que guardavam aqui?'],
  ]) },
];
function secretUpdate(dt) {
  const F = SEC.floor;
  if (G.control) {
    controlPlayer(dt); physics(dt, SEC_SOLIDS); P.x = clamp(P.x, 24, SEC.W - 4);
    // dica na boca do túnel, para quem chega de pé
    const nearB = P.face < 0 && P.x > SEC.tunnelB && P.x < SEC.tunnelB + 30, nearL = P.face > 0 && P.x > SEC.lowX - 30 && P.x < SEC.lowX;
    if (!P.crouch && (nearB || nearL)) setPrompt('Segure <kbd>↓</kbd> para agachar', nearB ? SEC.tunnelB + 6 : SEC.lowX - 50, F - 38, false, 'crouch'); else hidePrompt('crouch');
    if (!SECR.inRoom && P.x < SEC.tunnelA - 10) { SECR.inRoom = true; setGoal('Explore a sala secreta · volte pelo túnel →'); }
    if (!SECR.leaving && P.x >= SEC.W - 14) { SECR.leaving = true; G.control = false; hidePrompt('crouch'); autoWalk(SEC.W + 18, 30, { crouch: true }); fadeTo(1, .7).then(() => go('steps', 'secret')); }
  } else { P.vx = 0; physics(dt, SEC_SOLIDS); }
  G.camX += (clamp(P.x - 200, 0, SEC.W - W) - G.camX) * Math.min(1, dt * 4);
}
function drawSecret() {
  const cx = G.camX, t = G.time, F = SEC.floor, fl = flicker(), nx = SEC.nicheX - cx, ex = SEC.W - cx;
  ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(LAYER.secret, -Math.round(cx), 0);
  motes(22, SEC.W, 50, 178, '214,190,255', 5);
  drawHero(); drawParts();
  const L = [{ x: P.x - cx, y: P.y - 14, r: 92, a: .7 }, { x: nx, y: 112, r: 130, a: .66 + .05 * Math.sin(t * 1.3) }, { x: ex + 8, y: 156, r: 130 * fl, a: .9 }];
  for (const [mx, my, big] of SEC.shrooms) L.push({ x: mx - cx, y: my - 4, r: big ? 17 : 12, a: .6 });
  lighting(.84, L);
  glow(nx, 120, 42, '200,170,255', .14 + .05 * Math.sin(t * 1.3));
  glow(ex + 6, 160, 64, '255,150,60', .22 * fl);
  for (const [mx, my, big] of SEC.shrooms) glow(mx - cx, my - 4, big ? 12 : 9, '170,120,255', .3 + .08 * Math.sin(t * 2 + mx));
  ctx.drawImage(LAYER.vig, 0, 0);
  drawInspectIcons();
}

// =========================================== CENÁRIO III · A Ascensão
// Quase tudo é breu: Code só enxerga um círculo ao redor de si, que cresce um pouco conforme sobe.
// Aqui não entra luz do dia: só a lanterna e os cogumelos. O sol fica guardado para a boca da caverna.
function pkSolids() { return [...PK_SOLIDS, PK_CEIL, ...PK.movers]; }
// Voltar de fase: Code encostado na borda esquerda e o jogador segurando ← por um instante.
function backEdge(dt, atEdge, label, leave, before) {
  if (!atEdge || !G.control) { G.backT = 0; hidePrompt('back'); return; }
  setPrompt(`Segure <kbd>←</kbd> ${label}`, P.x + 74, P.y - 40, false, 'back');   // à direita de Code, para não sair da tela
  G.backT = keys.left ? (G.backT || 0) + dt : 0;
  if (G.backT > .35) {   // sai andando pela borda (antes, se for o caso, deixa o que carrega)
    G.control = false; G.backT = 0; hidePrompt('back');
    const id = run;
    (async () => { if (before) await before(); if (id !== run) return; P.face = -1; autoWalk(P.x - 34, 52); await fadeTo(1, .7); if (id === run) leave(); })();
  }
}
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
    // plataforma que sobe e alcança Code por baixo durante a queda: ele pousa nela (nunca é empurrado de lado)
    for (const m of PK.movers) if (m.dy < 0 && P.vy >= 0 && P.y - m.y <= 6 && overlaps(m)) { P.y = m.y; P.vy = 0; P.onGround = true; P.ground = m; }
    controlPlayer(dt); physics(dt, pkSolids()); P.x = clamp(P.x, 12, PK.W - 10);
    if (P.y > PK.death && !PK.dying) pkDie(run);
    if (!PK.done && !PK.dying && P.x > PK.exitX && P.onGround && P.y <= PK.top) pkExit(run);
    backEdge(dt, P.x <= 13 && P.onGround && P.y >= PK.base - 1, 'Voltar para o salão', () => go('steps', 'exit'), lampInHand() ? () => putLantern(1) : null);
  }
  const k = clamp((PK.base - P.y) / (PK.base - PK.top), 0, 1); PK.k += (k - PK.k) * Math.min(1, dt * 2.5);
  PK.lampK = (PK.lampK || 0) + ((lampInHand() ? 1 : 0) - (PK.lampK || 0)) * Math.min(1, dt * 3);
  PK.rad = 58 + 56 * Math.pow(PK.k, 1.4) + 34 * PK.lampK;   // a lanterna na mão alarga o que Code enxerga
  G.camX += (clamp(P.x - 160, 0, PK.W - W) - G.camX) * Math.min(1, dt * 6);
  G.camY += (clamp(P.y - 126, 0, PK.H - H) - G.camY) * Math.min(1, dt * 5);
}
async function pkDie(id) {
  PK.dying = true; G.control = false; P.hidden = true; G.deaths++; hud();
  emit(P.x, P.y - 12, 30, { cols: ['#efe6d0', '#f1c59c', '#b8361b', '#8b7aa0'], sx: 80, sy: 70, vy: -90, g: 520, size: 2, life: .8 });
  G.flash = .55; G.flashCol = '200,40,30'; G.shake = 4; sfx('death');
  await wait(.75); await fadeTo(1, .35);
  if (id !== run) return;
  go('parkour');
}
async function pkExit(id) {
  PK.done = true; G.control = false; P.vx = 0;
  if (lampInHand()) {   // no alto, antes da passagem: vira, deixa a lanterna no chão e segue sem ela
    await putLantern(-1);
    if (id !== run) return;
    await say('Code deixa a lanterna para trás. Lá na frente, a luz é outra.', 'narrador');
    if (id !== run) return;
    P.face = 1; await wait(.25);
  }
  autoWalk(PK.W + 10, 50);   // segue andando para dentro da passagem
  await fadeTo(1, .9);
  if (id !== run) return;
  go('light');
}
// ---- A lanterna (opcional): fica no poste sobre o pilar. Code pode pegá-la para enxergar mais longe; ao sair
// da subida (pelo alto ou de volta ao salão) ele a deixa no chão, e ela fica lá, acesa, até o ciclo recomeçar.
const lampInHand = () => G.scene === 'parkour' && PK.lamp.state === 'hand';
function lampPos() {   // topo da lanterna (o desenho pendura 12 px para baixo)
  const L = PK.lamp;
  if (L.state === 'post') return [PK.post.x, PK.post.y];
  if (L.state === 'ground') return [L.x, L.y - 12];
  const low = P.pose === 'kneel' || (P.crouch && P.onGround);
  return [Math.round(P.x + P.face * 6), Math.round(low ? P.y - 12 : P.y - 13 + (Math.abs(P.vx) > 5 && Math.floor(P.walkT / 5) % 3 === 1 ? 1 : 0))];
}
async function putLantern(dir) {
  P.vx = 0; P.face = dir; await wait(.15);
  P.pose = 'kneel'; await wait(.3);
  PK.lamp = { state: 'ground', x: Math.round(P.x + dir * 9), y: Math.round(P.y) }; sfx('lamp'); dustPuff(PK.lamp.x, P.y, 4);
  await wait(.5); P.pose = null; await wait(.15);
}
async function takeLantern() {
  const L = PK.lamp; P.face = lampPos()[0] >= P.x ? 1 : -1;
  P.pose = L.state === 'ground' ? 'kneel' : 'reach'; await wait(.3);
  PK.lamp = { state: 'hand' }; sfx('lamp'); P.pose = null;
  toast(L.state === 'ground' ? 'Lanterna de volta na mão.' : 'Você pegou a lanterna: agora enxerga mais longe no escuro.', 3.4);
}
const INSPECT_PK = [
  { id: 'lamp', x: () => lampPos()[0], iy: 0, r: 13, verb: 'Pegar', label: 'A lanterna', run: takeLantern,
    cond() { if (PK.lamp.state === 'hand') return false; this.iy = lampPos()[1] - 4; return true; },
    near: () => Math.abs(P.y - (PK.lamp.state === 'post' ? PK.post.stand : PK.lamp.y)) < 3 },   // só pega estando no mesmo chão dela
];
function drawParkour() {
  const cx = G.camX, cy = G.camY, t = G.time, fl = flicker();
  ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(LAYER.pkbg, -Math.round(cx * .5), -Math.round(cy * .5));
  ctx.drawImage(LAYER.parkour, -Math.round(cx), -Math.round(cy));
  hangingChain(778, 14, 88); hangingChain(412, 14, 60);
  for (const m of PK.movers) ctx.drawImage(m.spr, Math.round(m.x - 2 - cx), Math.round(m.y - 5 - cy));
  const lp = lampPos(), lx = lp[0] - cx, ly = lp[1] - cy;
  if (!lampInHand()) lantern(lx, ly);
  drawHero(); if (lampInHand()) lantern(lx, ly); drawParts();
  const L = [{ x: P.x - cx, y: P.y - 16 - cy, r: PK.rad, a: 1, core: .3 }, { x: lx, y: ly + 7, r: (lampInHand() ? 60 : 50) * fl, a: .9 }];
  for (const s of PK.shrooms) L.push({ x: s[0] - cx, y: s[1] - 4 - cy, r: s[2] ? 15 : 11, a: .6 });
  for (const m of PK.movers) L.push({ x: m.x + m.w - 8 - cx, y: m.y - 3 - cy, r: 12, a: .6 });
  lighting(.985, L);
  // brilhos por cima do breu: o halo do campo de visão, a lanterna e os cogumelos
  glow(P.x - cx, P.y - 16 - cy, PK.rad * .85, '214,196,255', .13);
  glow(lx, ly + 6, 34, '255,160,70', .3 * fl);
  for (const s of PK.shrooms) glow(s[0] - cx, s[1] - 4 - cy, s[2] ? 12 : 9, '170,120,255', .3 + .08 * Math.sin(t * 2 + s[0]));
  for (const m of PK.movers) glow(m.x + m.w - 8 - cx, m.y - 3 - cy, 9, '170,120,255', .3);
  ctx.drawImage(LAYER.vig, 0, 0);
  drawInspectIcons();
}

// ============================== CENÁRIO IV · A Entrada da Caverna
// A única luz do dia de dentro da caverna: quanto mais perto da boca, mais ela cega. Code cobre os olhos,
// perde o rumo, tomba e desmaia.
const L4 = {};
const INSPECT_L4 = [
  { id: 'flower', x: 446, iy: 160, r: 16, label: 'A flor', run: () => talk([['code', 'awe', 'Uma flor crescendo na fenda da rocha. Ela se vira para a luz, como eu.']]) },
];
function lightUpdate(dt) {
  const floor = [{ x: -20, y: CH.floor, w: MOUTH.W + 200, h: 40 }];
  // Depois que Code já esteve lá fora, os olhos se acostumaram: a boca da caverna não ofusca mais e leva de volta ao exterior.
  const glare = L4.adapted ? 0 : smooth(300, MOUTH.trig, P.x); L4.glare = glare;
  if (G.control) {
    // olhos abertos: o jogador anda e pula; perto da borda esquerda ele pode voltar para a subida
    controlPlayer(dt, { max: 80 * (1 - .4 * glare) }); physics(dt, floor); P.x = Math.max(P.x, 12);
    backEdge(dt, P.x <= 13 && P.onGround, 'Voltar para a subida', () => go('parkour', 'top'));
    if (L4.adapted) {
      if (!L4.leaving && P.x >= MOUTH.W - 24) { L4.leaving = true; G.control = false; hidePrompt(); autoWalk(MOUTH.W + 24, 50); fadeTo(1, .8, '#fff4dc').then(() => go('outside', 'cave')); }
    }
    // a luz fica forte demais: Code fecha os olhos e o jogador perde o controle
    else if (glare >= L4.EYES && P.onGround) { G.control = false; L4.auto = true; hidePrompt(); setGoal('...'); toast('A luz cega! Code cobre os olhos e segue sozinho até a saída.', 3.4); }
  } else if (L4.auto && !L4.trig) {
    // de olhos fechados: caminha sozinho, devagar, até a saída (sem pular)
    P.face = 1; P.vx = 34; physics(dt, floor); P.walkT += P.vx * dt;
    P.stepT += P.vx * dt; if (P.stepT > 26) { P.stepT = 0; sfx(G.step); }
    P.pose = 'coverWalk';
    if (P.x >= MOUTH.trig) blind(run);
  } else { P.vx = 0; physics(dt, floor); }
  if (!L4.trig) G.white = glare * .5;
  if (L4.adapted) { const amb = P.x > 330 ? 'nature' : 'cave'; if (L4.amb !== amb) { L4.amb = amb; setAmbience(amb, 4); } }
  else if (P.x > 330 && !L4.nature) { L4.nature = true; setAmbience('nature', 7); }
  if (L4.whiteUp) G.white = Math.min(1, G.white + dt * .8);
  if (L4.stagger) { L4.st += dt; P.x = L4.bx + Math.sin(L4.st * 4.5) * 8 - L4.st * 6; P.face = Math.cos(L4.st * 4.5) > 0 ? 1 : -1; P.pose = 'wob'; }
  G.camX += (clamp(P.x - 170, 0, MOUTH.W - W) - G.camX) * Math.min(1, dt * 4);
}
async function blind(id) {
  L4.trig = true; G.control = false; P.vx = 0; P.face = 1; P.pose = 'coverIdle'; L4.whiteUp = true; sfx('glare'); hidePrompt(); setGoal('...');
  await wait(.8);
  L4.stagger = true; L4.st = 0; L4.bx = P.x;
  await wait(1.9);
  if (id !== run) return;
  L4.stagger = false; P.pose = 'faint';
  await wait(.75); sfx('thud'); G.shake = 3;
  await wait(1.3);
  await fadeTo(1, 1.6, '#000');
  if (id !== run) return;
  G.white = 0; L4.whiteUp = false;
  await say('A luz era demais para olhos que só conheciam sombras.', 'narrador');
  if (id !== run) return;
  go('outside');
}
function drawLight() {
  const t = G.time, cx = G.camX, mx = MOUTH.cx - cx;
  // lá fora, pela abertura: o mesmo céu, o mesmo sol e as mesmas montanhas do Cenário V, estourados de luz
  ctx.drawImage(LAYER.sky, 0, 0);
  // O sol, as montanhas e os raios usam o mesmo deslocamento: o sol fica preso ao ponto da cordilheira
  // para onde as faces claras estão viradas, e todos os raios saem dele.
  const farX = -Math.round(30 + cx * .12), sx = SUN4.x + farX, sy = SUN4.y;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const a = t * .05 + i * TAU / 12, len = (i % 2 ? 70 : 110) + Math.sin(t * 1.3 + i) * 8;
    ctx.fillStyle = `rgba(255,240,190,${i % 2 ? .1 : .15})`;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - .05) * len, sy + Math.sin(a - .05) * len); ctx.lineTo(sx + Math.cos(a + .05) * len, sy + Math.sin(a + .05) * len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ell(ctx, sx, sy, 19, 19, '#ffe9a8'); ell(ctx, sx, sy, 16, 16, '#fff4cc'); ell(ctx, sx, sy, 12, 12, '#fffdf0');
  ctx.drawImage(S.cloudsFar[1], Math.round(mx - 120 + Math.sin(t * .05) * 10), 40); ctx.drawImage(S.clouds[1], Math.round(mx + 14 + t * 1.5 % 60), 22);
  ctx.drawImage(LAYER.farMouth, farX, 8);
  ctx.drawImage(LAYER.hillsMouth, -Math.round(70 + cx * .3), 18);
  ctx.fillStyle = 'rgba(255,240,206,.26)'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(LAYER.mouth, -Math.round(cx), 0);
  // raios entrando pela boca: leque de feixes que nascem no sol e se abrem para dentro da caverna
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = .06 + .035 * Math.sin(t * .8 + i * 1.7), ang = Math.PI * (.93 + i * .028), half = .012 + i * .003, len = 520;
    const gr = ctx.createRadialGradient(sx, sy, 20, sx, sy, len); gr.addColorStop(0, `rgba(255,232,176,${a})`); gr.addColorStop(1, 'rgba(255,232,176,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang - half) * len, sy + Math.sin(ang - half) * len); ctx.lineTo(sx + Math.cos(ang + half) * len, sy + Math.sin(ang + half) * len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 34; i++) { const x = (i * 41 + t * 6) % 420 + mx - 430, y = 40 + (i * 29 % 134) + Math.sin(t + i) * 4; ctx.fillStyle = `rgba(255,240,200,${.3 + .25 * Math.sin(t * 1.4 + i)})`; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
  drawHero(); drawParts();
  ctx.drawImage(LAYER.mouthFg, -Math.round(cx * 1.35), 0);
  lighting(.8, [{ x: mx + 20, y: MOUTH.cy, r: 350, a: 1, core: .52 }, { x: mx - 60, y: 150, r: 600, a: .66 }, { x: P.x - cx, y: P.y - 14, r: 104, a: .72 }]);
  glow(mx + 10, MOUTH.cy, 170, '255,236,190', .26 + (L4.glare || 0) * .26);
  drawInspectIcons();
  whiteout();
}

// ===================================== CENÁRIO V · O Mundo Exterior
// O planalto tem relevo: degraus que se sobem pulando, um riacho para saltar e paredões altos demais
// para o pulo, que se escalam pelos cipós segurando E.
const O5 = {};
const BIRDS = [0, 1, 2, 3, 4, 5].map(i => ({ x: i * 80 + 20, y: 18 + (i * 23) % 36, v: 10 + i * 2, ph: i }));
const FLOCK = [[0, 0], [-8, 4], [8, 5], [-16, 9], [16, 10], [-24, 14], [24, 16]];
const CLOUDS = [{ s: 0, x: 30, y: 12, v: 3 }, { s: 1, x: 190, y: 44, v: 2 }, { s: 2, x: 270, y: 2, v: 4 }, { s: 3, x: 400, y: 52, v: 2.5 }, { s: 4, x: 500, y: 30, v: 3.5 }];
const CLOUDS_FAR = [{ s: 0, x: 60, y: 78, v: 1 }, { s: 1, x: 230, y: 66, v: .7 }, { s: 2, x: 380, y: 88, v: 1.2 }, { s: 3, x: 520, y: 72, v: .9 }];
const BUTTER = [[200, '#ffd84a'], [476, '#ff8fc0'], [640, '#ffffff'], [840, '#9fd4ff'], [1240, '#ffd84a']];
const INSPECT_OUT = [
  { id: 'tree5', x: 300, iy: 120, r: 26, label: 'A árvore', run: () => talk([['code', 'awe', 'Uma árvore de verdade! A estátua era só uma cópia pobre disto.'], ['code', 'happy', 'As folhas se mexem sozinhas com o vento. Nenhuma sombra fazia isso.']]) },
  { id: 'stream', x: OUT.streamX + 13, iy: 128, r: 26, label: 'O riacho', run: () => talk([['code', 'shock', 'Meu rosto... na água!'], ['code', 'think', 'Primeiro as sombras, agora um reflexo. Cada vez mais perto das coisas reais.']]) },
  { id: 'sun', x: 840, iy: 46, r: 20, label: 'O sol', run: async () => { G.white = .7; await say('Não consigo olhar direto para ele... dói!', 'code', 'dazzled'); await say('O sol é o que faz tudo ser visto. Por isso não se pode encará-lo de uma vez: os olhos precisam de tempo.', 'narrador'); } },
  { id: 'paper', x: PAPER.x, iy: PAPER.y - 4, r: 9, hidden: true, label: 'Um papel', cond: () => G.paperOk && !G.paperTaken, run: readPaper },
  { id: 'vista', x: 1320, iy: 76, r: 18, label: 'A vista', run: () => talk([['code', 'awe', 'Que vista... o mundo não acaba nunca?'], ['code', 'happy', 'Preciso ver mais de perto!']]) },
];
function outGoal() {
  for (const it of INSPECT_OUT) if (it.seen) G.outSeen.add(it.id);   // o que já foi visto continua visto ao voltar da caverna
  setGoal(`Atravesse o planalto e examine o que brilhar · ${G.seenCount || 0}/${INSPECT_OUT.filter(it => !it.hidden).length}`);
}
// Easter egg: um papel amassado na margem do riacho. Ele está sempre lá, pequeno e sem ícone, mas só dá para
// examiná-lo depois que Code chega perto do precipício e decide, por conta própria, voltar.
async function readPaper() {
  P.pose = 'kneel'; await wait(.45); sfx('pick'); G.paperTaken = true; await wait(.25); P.pose = null;
  await talk([
    ['code', 'think', 'Um papel amassado, meio úmido, jogado na grama...'],
    ['code', 'awe', 'Só tem três números escritos à mão: 9, 8, 4.'],
    ['code', 'think', 'Alguém esteve aqui antes de mim?'],
  ]);
}
// Easter egg do papel: depois que Code volta por conta própria de perto do precipício, o papel cintila de vez em quando.
function drawPaper(x, y) {
  if (G.paperTaken) return;
  x = Math.round(x); y = Math.round(y);
  if (x < -8 || x > W + 8) return;
  rect(ctx, x - 3, y - 2, 6, 2, '#e6dcc4'); rect(ctx, x - 2, y - 3, 3, 1, '#f4ecd8'); rect(ctx, x, y - 2, 1, 2, '#b8ac92'); rect(ctx, x - 2, y - 1, 2, 1, '#9a8e78');
  if (Math.sin(G.time * .9) > .93) rect(ctx, x + 3, y - 3, 1, 1, '#f4ecd8');   // o vento levanta a pontinha de vez em quando
  if (G.paperOk && G.time % 3.6 < .28) { rect(ctx, x, y - 7, 1, 3, '#fffbe8'); rect(ctx, x - 1, y - 6, 3, 1, '#fffbe8'); }   // liberado: um brilho rápido de vez em quando
}
function outUpdate(dt) {
  const t = G.time;
  if (O5.wake) G.white = Math.max(0, G.white - dt * .28);
  else if (G.white > 0) G.white = Math.max(0, G.white - dt * .6);
  if (G.control) {
    const cl = O5.climb;
    if (cl) {
      // escalada: segurando E ele sobe pelos cipós; soltando, escorrega devagar
      P.vx = 0; P.vy = 0; P.onGround = false; P.face = 1; P.x = cl.x - P.hw - 1; P.pose = 'climb';
      if (keys.act || keys.hold) { P.y -= 42 * dt; P.walkT += 42 * dt; O5.rustle -= dt; if (O5.rustle <= 0) { O5.rustle = .22; sfx('stepGrass'); emit(cl.x - 1, P.y - 20, 1, { cols: ['#7aae36', '#488a2e'], sx: 8, sy: 4, vy: 14, g: 120, life: .6 }); } }
      else P.y += 30 * dt;
      if (P.y <= cl.top + 1) { P.x = cl.x + 7; P.y = cl.top; P.onGround = true; P.pose = null; O5.climb = null; sfx('land'); }
      else if (P.y >= cl.bot) { P.y = cl.bot; P.onGround = true; P.pose = null; O5.climb = null; }
    } else {
      controlPlayer(dt); physics(dt, OUT_SOLIDS); P.x = Math.max(P.x, 92);
      backEdge(dt, P.x <= 93 && P.onGround, 'Entrar na caverna', () => go('light', 'outside'));
      if (P.x > OUT.edge - 64) G.edgeNear = true;                        // chegou perto do precipício...
      if (G.edgeNear && !G.paperOk && P.x < OUT.edge - 190) G.paperOk = true;   // ...e voltou por conta própria
      const c = CLIMBS.find(c => Math.abs(P.x - (c.x - 6)) < 9 && P.y > c.top + 4 && P.y <= c.bot + 1);
      if (c && !G.focusIt) {
        if (keys.act || keys.hold) { O5.climb = c; O5.rustle = 0; P.vx = 0; P.vy = 0; hidePrompt('climb'); }
        else if (P.onGround) setPrompt('Segure <kbd>E</kbd> para escalar', c.x - 6, P.y - 42, false, 'climb');
      } else hidePrompt('climb');
    }
    if (P.x > 170 && PR.tag === 'walk') hidePrompt('walk');
    if (!O5.crumb && P.x > OUT.edge - 8) { O5.crumb = true; emit(OUT.edge - 3, OUT.edgeY + 2, 12, { cols: RK.earth.hex.slice(2), sx: 14, sy: 6, vy: 20, g: 420, size: 2, life: 1.2 }); }
    if (!O5.fall && P.x > OUT.edge && P.y > OUT.edgeY + 6) plunge(run);
  } else if (O5.fall) physics(dt, OUT_SOLIDS);
  // riacho: respingos
  const inS = P.x > OUT.streamX && P.x < OUT.streamX + OUT.streamW && P.onGround && P.y > 170; O5.inS = inS;
  if (inS && Math.abs(P.vx) > 5) { O5.splT -= dt; if (O5.splT <= 0) { O5.splT = .28; sfx('splash'); emit(P.x, P.y - 4, 8, { cols: ['#c4e0f8', '#ffffff', '#8cb4e8'], sx: 30, sy: 10, vy: -50, g: 300, life: .5 }); } }
  G.step = 'stepGrass';
  G.camX += (clamp(P.x - 150, 0, OUT.W - W) - G.camX) * Math.min(1, dt * 4);
  G.camY += ((O5.fall ? clamp(P.y - 110, 0, 150) : 0) - G.camY) * Math.min(1, dt * 3);
  const fsx = VALLEY.fall.x - G.camX * PAR.valley;
  AU.waterNear = Math.max(0, 1 - Math.abs(P.x - OUT.streamX - 13) / 160, 1 - Math.abs(fsx - W / 2) / 260);
  // cervo: pasta e ergue a cabeça quando Code chega perto
  const sg = O5.stag; sg.t -= dt; if (sg.t <= 0) { sg.look = !sg.look; sg.t = 1.4 + Math.random() * 2.4; }
  sg.alert = Math.abs(P.x - sg.x) < 70 && Math.abs(P.y - outTop(sg.x)) < 30;
  // coelhos e esquilo
  for (const rb of O5.rabbits) {
    rb.t -= dt; const close = Math.abs(P.x - rb.x) < 40 && Math.abs(P.y - outTop(rb.x)) < 30;
    if (rb.air > 0) { rb.air -= dt; rb.x = clamp(rb.x + rb.dir * 44 * dt, rb.a, rb.b); }
    else if (rb.t <= 0 || close) {
      rb.dir = close ? (Math.sign(rb.x - P.x) || 1) : (Math.random() < .5 ? -1 : 1);
      if (rb.x + rb.dir * 16 > rb.b || rb.x + rb.dir * 16 < rb.a) rb.dir *= -1;
      rb.air = .35; rb.t = 1.4 + Math.random() * 2;
    }
  }
  // pássaro pousado na árvore
  const pb = O5.perch; if (!pb.fly && P.x > 250) pb.fly = true;
  if (pb.fly) { pb.x += 70 * dt; pb.y -= 46 * dt; }
  // folhas caindo da grande árvore, poucas
  O5.leafT -= dt;
  if (O5.leafT <= 0) { O5.leafT = .7; const T = OUT.treeTop, a = Math.random() * TAU; O5.leaves.push({ x: T.cx + Math.cos(a) * T.rx * Math.random(), y: T.cy + Math.sin(a) * T.ry * Math.random() * .8, vy: 12 + Math.random() * 10, ph: Math.random() * TAU, sw: 10 + Math.random() * 14, life: 9, col: ['#7aae36', '#b8d24a', '#e2c84a', '#488a2e'][(Math.random() * 4) | 0] }); }
  for (let i = O5.leaves.length - 1; i >= 0; i--) {
    const L = O5.leaves[i];
    if (L.y < outTop(L.x) - 2) { L.y += L.vy * dt; L.x += (Math.sin(t * 1.6 + L.ph) * L.sw + 6) * dt; } else L.life -= dt * 3;
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
  const cx = G.camX, cy = G.camY, t = G.time, S5 = O5, wrap = (x, span) => ((x % span) + span) % span;
  ctx.drawImage(LAYER.sky, 0, -Math.round(cy * .05));
  // sol baixo: raios girando devagar, halo e disco em degraus
  const sx = 176 - cx * .02, sy = 70 - cy * .05;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = t * .05 + i * TAU / 16, len = (i % 2 ? 84 : 128) + Math.sin(t * 1.3 + i) * 10, wa = .045;
    ctx.fillStyle = `rgba(255,224,160,${i % 2 ? .1 : .15})`;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - wa) * len, sy + Math.sin(a - wa) * len); ctx.lineTo(sx + Math.cos(a + wa) * len, sy + Math.sin(a + wa) * len); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  glow(sx, sy, 84, '255,214,140', .5);
  ell(ctx, sx, sy, 21, 21, '#ffe9a8'); ell(ctx, sx, sy, 18, 18, '#fff4cc'); ell(ctx, sx, sy, 14, 14, '#fffdf0');
  // nuvens em três camadas: estrias do céu (no fundo), nuvens distantes e nuvens próximas, cada uma em seu ritmo
  for (const c of CLOUDS_FAR) { const spr = S.cloudsFar[c.s], span = W + 260; ctx.drawImage(spr, Math.round(wrap(c.x + t * c.v - cx * .03, span) - 130), Math.round(c.y - cy * .05)); }
  ctx.drawImage(LAYER.far, -Math.round(cx * PAR.far), -Math.round(cy * .1));
  for (const c of CLOUDS) { const spr = S.clouds[c.s], span = W + 300; ctx.drawImage(spr, Math.round(wrap(c.x + t * c.v - cx * .06, span) - 150), Math.round(c.y - cy * .06)); }
  // pássaros: soltos e um bando em V cruzando o céu
  for (const b of BIRDS) { const x = wrap(b.x + t * b.v - cx * .08, W + 80) - 40, y = b.y + Math.sin(t * 1.5 + b.ph) * 4 - cy * .08; ctx.drawImage(S.bird[Math.floor(t * 7 + b.ph) % 3], Math.round(x), Math.round(y)); }
  { const fx = wrap(t * 14 - cx * .08, W + 240) - 120; FLOCK.forEach(([dx, dy], i) => ctx.drawImage(S.bird[Math.floor(t * 6 + i * .7) % 3], Math.round(fx - dx * .2 - Math.abs(dx)), Math.round(48 + dy + Math.sin(t * 1.1 + i) * 2 - cy * .08))); }
  const hx = -Math.round(cx * PAR.hills), hy = -Math.round(cy * .2);
  ctx.drawImage(LAYER.hills, hx, hy);
  for (const [x, y] of OUT.sheep) { const bx = Math.round(x + hx), by = Math.round(y + hy + (Math.floor(t + x) % 3 === 0 ? -1 : 0)); rect(ctx, bx, by, 4, 2, '#f4ead8'); rect(ctx, bx + 4, by, 1, 1, '#3a2a24'); }
  const vx = -Math.round(cx * PAR.valley), vy = -Math.round(cy * .4), F = VALLEY.fall;
  ctx.drawImage(LAYER.valley, vx, vy);
  // cachoeira: lâminas de água descendo e espuma em pixels soltos na base
  ctx.drawImage(O5.fallFrames[Math.floor(t * 12) % O5.fallFrames.length], F.x + vx, F.y + vy);
  for (let i = 0; i < 16; i++) { const k = (t * 1.4 + i * .19) % 1, fx = F.x + 8 + (i - 7.5) * 2.6 * (1 + k) + vx, fy = F.y + F.h - k * 9 + vy; rect(ctx, fx, fy, k < .5 ? 2 : 1, 1, k < .6 ? '#ffffff' : '#c4e0f8'); }
  const rv = VALLEY.river;
  for (let i = 0; i < 40; i++) {
    const u = ((i * .025 + t * .015) % 1) * rv[rv.length - 1][0];
    let k = 0; while (k < rv.length - 2 && rv[k + 1][0] < u) k++;
    const y = lerp(rv[k][1], rv[k + 1][1], (u - rv[k][0]) / (rv[k + 1][0] - rv[k][0]));
    ctx.fillStyle = `rgba(255,240,214,${.4 + .4 * Math.sin(t * 4 + i * 2)})`; ctx.fillRect(Math.round(u + vx), Math.round(y - 1 + (i % 3) * 2 + vy), 2, 1);
  }
  for (let i = 0; i < 2; i++) { const dx = 300 + i * 46 + Math.sin(t * .2 + i) * 14 + vx, dy = 155 + i * 2 + vy; rect(ctx, dx, dy, 3, 2, '#f4ead8'); rect(ctx, dx + (Math.sin(t * .2 + i) > 0 ? 3 : -1), dy - 1, 1, 2, '#f4ead8'); }   // patos no lago
  if (S5.fish) { const k = S5.fish.t / .7; rect(ctx, S5.fish.x + vx + k * 6, S5.fish.y + vy - Math.sin(k * Math.PI) * 7 - 2, 2, 1, '#f08a3a'); }
  // aves planando dentro do abismo, abaixo da borda: dão a medida da altura
  for (let i = 0; i < 4; i++) { const bx = OUT.edge + 34 + i * 24 + Math.sin(t * .45 + i * 1.9) * 22 - cx, by = 160 + i * 14 + Math.sin(t * .8 + i) * 5 - cy * .6; ctx.drawImage(S.bird[Math.floor(t * 5 + i) % 3], Math.round(bx), Math.round(by)); }
  ctx.drawImage(LAYER.ground, -Math.round(cx), -Math.round(cy));
  drawPaper(PAPER.x - cx, PAPER.y - cy);
  // riacho: a água corre entre as duas margens de pedra e despenca pelo paredão
  const stx = Math.round(OUT.streamX - cx), wy = 170 - cy;
  if (stx > -40 && stx < W + 10) {
    rect(ctx, stx, wy, OUT.streamW, 5, '#4a78c8'); rect(ctx, stx, wy, OUT.streamW, 1, '#c4e0f8');
    for (let i = 0; i < 5; i++) { const xx = (i * 11 + Math.floor(t * 5)) % (OUT.streamW - 4); rect(ctx, stx + xx, wy + 1 + (i % 3), 3 + i % 2, 1, i % 2 ? '#8cb4e8' : '#e4f0ff'); }
    ctx.drawImage(O5.cascade[Math.floor(t * 12) % O5.cascade.length], stx + 2, Math.round(wy + 5));
  }
  // libélula sobre o riacho
  const dfx = OUT.streamX + 13 + Math.sin(t * 1.7) * 26 - cx, dfy = 140 + Math.sin(t * 3.1) * 6 - cy;
  rect(ctx, dfx, dfy, 4, 1, '#2a6ad8'); if (Math.floor(t * 20) % 2) { rect(ctx, dfx + 1, dfy - 2, 1, 2, '#e8f4ff'); rect(ctx, dfx + 2, dfy - 2, 1, 2, '#e8f4ff'); }
  // folhas caindo
  for (const L of S5.leaves) { ctx.globalAlpha = clamp(L.life, 0, 1); rect(ctx, L.x - cx, L.y - cy, Math.floor(t * 4 + L.ph) % 2 ? 2 : 1, Math.floor(t * 4 + L.ph) % 2 ? 1 : 2, L.col); }
  ctx.globalAlpha = 1;
  // borboletas
  BUTTER.forEach(([bx, col], i) => { const x = bx + Math.sin(t * 1.1 + i) * 16 - cx, y = outTop(bx) - 18 + Math.sin(t * 2.3 + i * 2) * 7 - cy, o = Math.floor(t * 10 + i) % 2; rect(ctx, x, y, 1, 1, '#3a2a24'); rect(ctx, x - 1 - o, y - 1 + o, 2, 2, col); rect(ctx, x + 1 + o, y - 1 + o, 2, 2, col); });
  // pássaro na árvore
  const pb = S5.perch; if (pb.y > -20) { if (pb.fly) ctx.drawImage(S.bird[Math.floor(t * 9) % 3], Math.round(pb.x - cx), Math.round(pb.y - cy)); else ctx.drawImage(S.perch, Math.round(pb.x - cx), Math.round(pb.y - cy)); }
  // cervo
  const sg = S5.stag, sspr = sg.alert || sg.look ? S.stag.alert : S.stag.graze, sgx = Math.round(sg.x - cx), sgy = Math.round(outTop(sg.x) - cy - sspr.height + 1);
  ctx.save(); ctx.translate(sgx + sspr.width / 2, 0); ctx.scale(-1, 1); ctx.drawImage(sspr, -sspr.width / 2, sgy); ctx.restore();
  for (const rb of S5.rabbits) {
    const hop = rb.air > 0, ry = hop ? -Math.sin((1 - rb.air / .35) * Math.PI) * 7 : 0, rs = S[rb.k || 'rabbit'][hop ? 1 : 0];
    const rl = Math.round(rb.x - cx - rs.width / 2), rt = Math.round(outTop(rb.x) + ry - cy - rs.height + 1);
    if (rb.dir < 0) { ctx.save(); ctx.translate(rl + rs.width, 0); ctx.scale(-1, 1); ctx.drawImage(rs, 0, rt); ctx.restore(); } else ctx.drawImage(rs, rl, rt);
  }
  drawHero();
  if (S5.inS) { ctx.globalAlpha = .8; rect(ctx, P.x - cx - 7, wy, 14, 4, '#4a78c8'); rect(ctx, P.x - cx - 7, wy, 14, 1, '#e4f0ff'); ctx.globalAlpha = 1; }
  // capim balançando com o vento (sempre plantado no chão; para antes da borda)
  for (const [gx, gy] of OUT.tufts) {
    const x = gx - cx; if (x < -6 || x > W + 6) continue;
    const sw = Math.round(Math.sin(t * 2 + gx * .07) * 1.5);
    for (let k = 0; k < 4; k++) { const h = 4 + ((gx + k * 3) % 4); rect(ctx, x + k * 2, gy + 4 - h - cy, 1, h - 2, k % 2 ? '#427c2c' : '#74ae38'); rect(ctx, x + k * 2 + sw, gy + 3 - h - cy, 1, 2, '#c2d84e'); }
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
  { voice: '— Da próxima vez, não vou correr. Ainda havia tanto para olhar lá fora...' },   // a voz de Code: explorar antes do fim
  'Talvez toda verdade alcançada às pressas seja apenas a entrada de outra caverna.',
];
async function endingScript(id) {
  UI.endLines.innerHTML = ''; UI.endCycle.textContent = ''; UI.ending.hidden = false;
  await wait(1.2);
  for (const line of ENDING_LINES) {
    if (id !== run) return;
    const p = document.createElement('p'), text = line.voice || line; p.textContent = text; if (line.voice) p.className = 'voice'; UI.endLines.appendChild(p);
    await wait(1.7 + text.length * .03);
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
  // Menu inicial: só o nome do jogo e o botão, sobre a boca da caverna ao entardecer (a câmera deriva devagar).
  title: {
    enter() { resetPlayer(-300, CH.floor); P.hidden = true; G.camX = 206; G.camY = 0; G.white = 0; L4.glare = 0; fade.a = 0; },
    update() { G.camX = 206 + Math.sin(G.time * .11) * 40; if (hit('ok') || hit('act') || hit('jump')) startGame(); },
    draw: drawLight,
  },
  starting: { enter() {}, update() {}, draw: drawLight },
  chains: {
    enter(id) {
      resetPlayer(PRIS.code, CH.floor); P.pose = 'sitCode'; G.step = 'stepStone';
      Object.assign(C1, { arm: 'down', stone: 'off', broken: false, jolt: 0, strikeT: 0, sel: false, focus: 1, busy: false, talkIdx: { mistico: 0, arrogante: 0 } });
      G.camX = 0; G.camY = 0; G.camTX = null; G.control = false; G.white = 0; G.deaths = 0; G.burns = 0; G.handBurned = false; G.handSmoke = 0; G.secretOpen = false; G.secretDoor = 0; G.wentOut = false; G.edgeNear = false; G.paperOk = false; G.paperTaken = false; G.outSeen = new Set(); G.seenCount = 0; PK.intro = false; PK.lamp = { state: 'post' }; fade.a = 1; parts.length = 0;
      setAmbience('cave', 3); chainsScript(id);
    },
    update: chainsUpdate,
    draw: drawChamber,
  },
  steps: {
    enter(id, from) {
      if (from === 'exit' || from === 'secret') {   // voltando da subida (já firme, já viu as estátuas) ou da sala secreta
        const sec = from === 'secret';
        // da subida: sai andando do arco escuro; da sala secreta: sai engatinhando da passagem, levanta, vira e dá uns passos
        resetPlayer(sec ? SECRET.doorX : CH.exitX + 14, CH.floor); P.face = sec ? 1 : -1; ST.leaving = false; ST.steady = true; ST.first = false; ST.doorAnim = false;
        if (!sec) ST.revealed = true;
        if (sec) P.pose = 'kneelBack';
        G.camTX = null; G.camX = clamp((sec ? P.x : CH.exitX - 24) - 170, 0, CH.W - W); G.camY = 0; G.control = false; fade.a = 1; parts.length = 0; G.step = 'stepStone';   // camY zerado: a subida deixa a câmera rolada para baixo
        setInspect(INSPECT_STEPS); setAmbience('cave', 2);
        setGoal(ST.revealed ? 'Examine o salão · saia pela passagem →' : 'Siga em frente pela caverna →');
        (async () => {
          if (sec) {
            await fadeTo(0, .5); if (id !== run) return;
            await wait(.25); P.pose = 'standBack'; dustPuff(P.x, CH.floor); sfx('land');
            await wait(.4); P.pose = null; P.face = 1; await wait(.15);
            await autoWalk(SECRET.doorX + 22, 40);
          } else { fadeTo(0, .6); await autoWalk(CH.exitX - 24, 50); }
          if (id !== run) return;
          G.control = true;
        })();
        return;
      }
      Object.assign(ST, { firm: 0, wob: 0, grip: 1, gripCd: 0, holding: false, tired: false, slip: 0, fallen: 0, first: true, steady: false, revealed: false, leaving: false, npcTalk: false, prompt: 'try' });
      G.control = true; P.pose = null; P.face = 1; setInspect(INSPECT_STEPS);
      card('Cenário II', 'Os Primeiros Passos e a Fogueira'); setGoal('Tente andar para a direita →');
      setPrompt('Tente andar <kbd>→</kbd>', 0, 0, true, 'step');
    },
    update(dt) {
      stepsUpdate(dt); secretDoorUpdate(dt);
      const tx = G.camTX ?? clamp(P.x - 170, 0, CH.W - W);
      G.camX += (tx - G.camX) * Math.min(1, dt * 3.5);
    },
    draw: drawChamber,
  },
  secret: {
    enter(id) {
      resetPlayer(SEC.W + 8, SEC.floor); P.face = -1; P.solids = SEC_SOLIDS; G.camX = SEC.W - W; G.camY = 0; G.control = false; fade.a = 1; parts.length = 0; G.step = 'stepStone';
      Object.assign(SECR, { leaving: false, inRoom: false });
      setInspect(INSPECT_SECRET); setAmbience('cave', 2);
      setGoal('Agache e atravesse o túnel ←');
      (async () => {
        // sai agachado da passagem baixa, levanta no vestíbulo e olha em volta
        fadeTo(0, .7); await autoWalk(SEC.W - 34, 30, { crouch: true });
        if (id !== run) return;
        setCrouch(false); dustPuff(P.x, SEC.floor, 5); await wait(.3);
        P.bubble = '?'; P.face = 1; await wait(.45); P.face = -1; await wait(.45); P.bubble = null;
        if (id !== run) return;
        if (!G.secretSeen) { G.secretSeen = true; card('???', 'A Sala Secreta'); }
        G.control = true;
      })();
    },
    update: secretUpdate,
    draw: drawSecret,
  },
  parkour: {
    enter(id, from) {
      G.control = false; G.white = 0; fade.a = 1; parts.length = 0; G.step = 'stepStone';
      Object.assign(PK, { dying: false, done: false, k: 0, rad: 58 });
      const top = from === 'top';
      if (top) {   // voltando da entrada da caverna: sai da passagem do alto, andando para a esquerda
        resetPlayer(PK.exitX + 22, PK.top); P.face = -1; PK.k = 1; PK.rad = 114;
      } else resetPlayer(-10, PK.base);   // vindo do salão: entra pela borda esquerda
      G.camX = clamp(P.x - 160, 0, PK.W - W); G.camY = clamp(P.y - 126, 0, PK.H - H);
      PK.movers = MOVERS_DEF.map(m => ({ ...m, dx: 0, dy: 0, spr: LAYER['mover' + m.x] }));
      if (PK.lamp.state === 'hand') PK.lamp = { state: 'post' };   // caiu nas estacas com ela: a fase recomeça e a lanterna volta ao poste
      PK.lampK = 0; setInspect(INSPECT_PK); setAmbience('cave', 2);
      setGoal('Suba no escuro até a passagem, no alto à direita');
      (async () => {
        fadeTo(0, .7); await autoWalk(top ? PK.exitX - 34 : 30, 46);
        if (id !== run) return;
        if (!top && !PK.intro) { P.bubble = '?'; await wait(.7); P.bubble = null; }   // primeira vez no escuro: hesita
        if (id !== run) return;
        if (!PK.intro) { PK.intro = true; card('Cenário III', 'A Ascensão'); toast('Você só enxerga o que está perto. Espaço pula (segure para ir mais alto). Estacas reiniciam a fase.', 5.5); }
        G.control = true;
      })();
    },
    update: pkUpdate,
    draw: drawParkour,
  },
  light: {
    enter(id, from) {
      Object.assign(L4, { trig: false, whiteUp: false, stagger: false, glare: 0, nature: false, auto: false, EYES: .7, adapted: !!G.wentOut, leaving: false, amb: '' });
      setInspect(INSPECT_L4);
      if (from === 'outside') {   // voltando do mundo exterior: entra pela boca, vindo da claridade
        resetPlayer(MOUTH.W + 14, CH.floor); P.face = -1; G.camX = MOUTH.W - W; G.camY = 0; G.control = false; G.white = 0; fade.a = 1; fade.color = '#fff4dc'; parts.length = 0; G.step = 'stepStone';
        setGoal('Explore a caverna de novo · a saída para fora fica à direita →');
        (async () => {
          fadeTo(0, .9).then(() => { fade.color = '#000'; }); await autoWalk(MOUTH.trig - 30, 46);
          if (id !== run) return;
          G.control = true;
        })();
        return;
      }
      resetPlayer(-12, CH.floor); G.camX = 0; G.camY = 0; G.control = false; G.white = 0; fade.a = 1; parts.length = 0; G.step = 'stepStone';
      setAmbience('cave', 2);
      setGoal(L4.adapted ? 'Volte para o mundo exterior →' : 'Caminhe em direção à luz →');
      (async () => {
        // sai da subida andando e para, espantado com a claridade lá na frente
        fadeTo(0, 1); await autoWalk(34, 42);
        if (id !== run) return;
        card('Cenário IV', 'A Entrada da Caverna');
        P.pose = 'awe'; P.bubble = '!'; await wait(.9); P.pose = null; P.bubble = null;
        if (id !== run) return;
        G.control = true;
      })();
    },
    update: lightUpdate,
    draw: drawLight,
  },
  outside: {
    enter(id, from) {
      const back = from === 'cave';   // voltando de dentro da caverna: sai pela boca andando, sem desmaio
      resetPlayer(back ? 66 : 118, OUT.ground); P.pose = back ? null : 'lie'; G.camX = 0; G.camY = 0; G.control = false; G.white = back ? 0 : 1; fade.a = 1; parts.length = 0; G.step = 'stepGrass';
      G.wentOut = true;
      Object.assign(O5, { wake: !back, fall: false, crumb: false, inS: false, climb: null, rustle: 0, splT: 0, leafT: 0, leaves: [], fishT: 2, fish: null,
        stag: { x: 640, t: 2, look: false, alert: false },
        rabbits: [{ x: 370, a: 334, b: 412, dir: 1, air: 0, t: 1 }, { x: 800, a: 760, b: 900, dir: -1, air: 0, t: 2 }, { k: 'squirrel', x: 1196, a: 1150, b: 1262, dir: 1, air: 0, t: 1.5 }],
        perch: { x: 287, y: 36, fly: false } });
      setInspect(INSPECT_OUT); setAmbience('nature', 3); G.onInspected = outGoal;
      for (const it of INSPECT_OUT) it.seen = G.outSeen.has(it.id);
      G.seenCount = INSPECT_OUT.filter(it => it.seen && !it.hidden).length;
      if (back) {
        outGoal();
        (async () => {
          fadeTo(0, .8).then(() => { fade.color = '#000'; }); await autoWalk(126, 46);
          if (id !== run) return;
          G.control = true;
        })();
        return;
      }
      setGoal('Recupere os sentidos...');
      (async () => {
        await fadeTo(0, 1.6);
        if (id !== run) return;
        card('Cenário V', 'O Mundo Exterior');
        await wait(2.2); P.pose = 'lieOpen'; await wait(.9); P.pose = 'kneel'; await wait(.7); P.pose = null; dustPuff(P.x, OUT.ground, 6); O5.wake = false;
        await wait(.4); await autoWalk(P.x + 22, 30);   // primeiros passos na grama, ainda devagar
        if (id !== run) return;
        await say('...Onde estou?', 'code', 'dazzled');
        await say('Cores. Água que cai. Criaturas vivas. Tudo é tão nítido!', 'code', 'happy');
        await say('O caminho aqui fora não é plano: pule os degraus e o riacho, e segure E junto aos cipós para escalar os paredões.', 'sistema');
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
// from: de onde Code chega ('top' = volta do Cenário IV para o alto da subida; 'exit' = volta da subida para o salão)
function go(name, from) {
  run++; waits.length = 0; G.backT = 0; P.auto = null;
  if (D.active) { D.active = false; D.res = null; D.choices = null; UI.dialog.classList.remove('open'); }
  hidePrompt(); meter(false); Q.active = false; UI.qte.hidden = true; setInspect([]); G.onInspected = null;
  UI.toast.hidden = true; UI.toast.classList.remove('show');   // aviso da fase anterior não atravessa para a próxima
  if (name !== 'ending') UI.ending.hidden = true;
  G.scene = name; Scenes[name].enter(run, from); hud();
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
  if (!talking) autoUpdate(dt);
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
const BOOT0 = performance.now();
buildSprites();
LAYER.chamber = buildChamber();
LAYER.chamberFg = buildChamberFg();
LAYER.pkbg = buildParkourBg();
LAYER.parkour = buildParkour();
for (const m of MOVERS_DEF) LAYER['mover' + m.x] = buildMover(m);
LAYER.mouth = buildMouth();
LAYER.mouthFg = buildMouthFg();
LAYER.secret = buildSecret();
LAYER.vig = buildVignette();
buildOutside();
O5.fallFrames = waterFrames(VALLEY.fall.w, VALLEY.fall.h, 6, 3);
O5.cascade = waterFrames(OUT.streamW - 4, 44, 6, 9);
OUT.tufts = []; { const R = rng(61); for (let x = 130; x < OUT.edge - 70; x += 18 + R() * 40) { const gx = Math.round(x), gy = outTop(gx); if (gy <= 170 && gy === outTop(gx - 3) && gy === outTop(gx + 10)) OUT.tufts.push([gx, gy]); } }
if (G.cycle > 1) { UI.tCycle.hidden = false; UI.tCycle.textContent = 'Você já passou por ' + (G.cycle - 1) + (G.cycle - 1 === 1 ? ' ciclo.' : ' ciclos.'); }
Scenes.title.enter(); hud();
// ganchos de depuração: tick(n, dt) avança n quadros à mão (útil quando a aba está em segundo plano)
window.__ilusao = { G, P, go, keys, pressed, ST, PK, Q, runQTE, O5, C1, D, L4, S, LAYER, KP, SEC, SECR, SECRET, kpPress, fade, portrait, PK_SOLIDS, OUT, CLIMBS, outTop, bootMs: Math.round(performance.now() - BOOT0), INSPECT: () => INSPECT, tick(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { update(dt); pressed.clear(); } draw(); } };
requestAnimationFrame(frame);
})();
