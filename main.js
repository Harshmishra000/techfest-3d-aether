/* Techfest 2026 — Enter the Aether
   A dependency-free 3D particle engine: perspective projection, scroll-driven
   morphing between five forms, drag-to-rotate with inertia, click shockwaves,
   a warp starfield, and a CSS-3D event carousel. */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = innerWidth < 720;
const N = small ? 1800 : 3200;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- shapes (each returns Float32Array of N*3) ---------------- */
function shuffle(arr) {
  // shuffle point order so morphs swirl instead of sliding
  const n = arr.length / 3, idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const out = new Float32Array(arr.length);
  idx.forEach((s, d) => { out[d * 3] = arr[s * 3]; out[d * 3 + 1] = arr[s * 3 + 1]; out[d * 3 + 2] = arr[s * 3 + 2]; });
  return out;
}
function build(fn) { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const p = fn(i); a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; } return shuffle(a); }

// 0 — Origin: armillary orb (sphere shell + three tilted rings + core)
const orb = build(i => {
  const t = i / N;
  if (t < 0.45) { // fibonacci sphere
    const k = i / (N * 0.45), y = 1 - 2 * k, r = Math.sqrt(1 - y * y), th = i * 2.39996;
    return [Math.cos(th) * r * 0.9, y * 0.9, Math.sin(th) * r * 0.9];
  }
  if (t < 0.9) {
    const ring = Math.floor((t - 0.45) / 0.15), a = rand(0, TAU), R = 1.35 + ring * 0.12;
    let x = Math.cos(a) * R, y = rand(-0.012, 0.012), z = Math.sin(a) * R;
    const tilt = [0.42, -0.9, 1.35][ring], c = Math.cos(tilt), s = Math.sin(tilt);
    const y2 = y * c - z * s, z2 = y * s + z * c;          // rotate about X
    const c2 = Math.cos(ring * 1.1), s2 = Math.sin(ring * 1.1);
    return [x * c2 - z2 * s2, y2, x * s2 + z2 * c2];        // then about Y
  }
  const r = Math.cbrt(Math.random()) * 0.25, a = rand(0, TAU), b = Math.acos(rand(-1, 1));
  return [r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)];
});

// 1 — Arena: torus
const torus = build(() => {
  const u = rand(0, TAU), v = rand(0, TAU), R = 1.15, r = 0.42;
  return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v) * 0.9, (R + r * Math.cos(v)) * Math.sin(u)];
});

// 2 — Ideas: double helix with rungs
const helix = build(i => {
  const t = rand(-1, 1), a = t * 9, R = 0.55;
  if (i % 5 === 0) { const k = Math.random(); const a1 = Math.round(t * 14) / 14 * 9;
    return [Math.cos(a1) * R * (2 * k - 1), Math.round(t * 14) / 14 * 1.7, Math.sin(a1) * R * (2 * k - 1)]; }
  const off = i % 2 ? Math.PI : 0;
  return [Math.cos(a + off) * R + rand(-.03, .03), t * 1.7, Math.sin(a + off) * R + rand(-.03, .03)];
});

// 3 — Expo: spiral galaxy
const galaxy = build(i => {
  const arm = i % 3, d = Math.pow(Math.random(), 0.7) * 1.7, a = arm / 3 * TAU + d * 2.6 + rand(-.25, .25) * (1 - d / 2);
  return [Math.cos(a) * d, rand(-.08, .08) * (1.7 - d), Math.sin(a) * d];
});

// 4 — Thirty: the number "30" sampled from text
function textShape(str) {
  const c = document.createElement('canvas'), W = 420, H = 260; c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 230px Georgia, "Cormorant Garamond", serif'; g.fillText(str, W / 2, H / 2 + 10);
  const d = g.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 128) pts.push([(x - W / 2) / 120, -(y - H / 2) / 120]);
  return build(() => { const p = pts[(Math.random() * pts.length) | 0]; return [p[0] + rand(-.01, .01), p[1] + rand(-.01, .01), rand(-.12, .12)]; });
}
const thirty = textShape('30');

const SHAPES = [orb, torus, helix, galaxy, thirty];
const SPIN = [0.0025, 0.004, 0.006, 0.003, 0.0012];   // auto-rotation per form
const CAM  = [4.2, 4.0, 4.4, 4.1, 5.0];
const SZ   = [1, 1, 1, 1, 0.7];                        // per-form zoom               // camera distance per form

/* ---------------- canvas ---------------- */
const cv = document.getElementById('scene'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); }
addEventListener('resize', resize); resize();

const pos = new Float32Array(N * 3);          // current blended position
const off = new Float32Array(N * 3);          // shockwave displacement
const vel = new Float32Array(N * 3);
const seed = new Float32Array(N).map(() => Math.random());

const stars = Array.from({ length: small ? 260 : 520 }, () => ({ x: rand(-1, 1), y: rand(-1, 1), z: rand(0.05, 1) }));

/* ---------------- interaction state ---------------- */
let rotY = 0, rotX = -0.25, vRotY = 0, vRotX = 0, dragging = false, lx = 0, ly = 0;
let mx = 0, my = 0;                  // mouse in -1..1 for parallax
let k = 0, kTarget = 0, lastScroll = scrollY, warp = 0, dim = 1;

cv.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); downAt = performance.now(); downX = e.clientX; downY = e.clientY; });
let downAt = 0, downX = 0, downY = 0;
cv.addEventListener('pointermove', e => {
  mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1;
  if (!dragging) return;
  vRotY = (e.clientX - lx) * 0.006; vRotX = (e.clientY - ly) * 0.004;
  rotY += vRotY; rotX = Math.max(-1.2, Math.min(1.2, rotX + vRotX)); lx = e.clientX; ly = e.clientY;
});
cv.addEventListener('pointerup', e => {
  dragging = false;
  if (performance.now() - downAt < 250 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) pulse(e.clientX, e.clientY);
});
addEventListener('pointermove', e => { mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1; }, { passive: true });

const rings = [];
function pulse(x, y) {
  // radial impulse from the click point, in screen space
  for (let i = 0; i < N; i++) {
    const sx = proj[i * 3], sy = proj[i * 3 + 1];
    const dx = sx - x, dy = sy - y, d = Math.hypot(dx, dy) + 1;
    const f = Math.max(0, 1 - d / 420) * 0.09;
    const p = i * 3;
    vel[p] += pos[p] * f * 1.6; vel[p + 1] += pos[p + 1] * f * 1.6; vel[p + 2] += pos[p + 2] * f * 1.6;
  }
  rings.push({ x, y, t: 0 });
}

/* ---------------- scroll → chapter ---------------- */
const story = document.getElementById('story');
const panels = [...document.querySelectorAll('.panel')];
const navLinks = [...document.querySelectorAll('.hud__nav a')];
let chapter = 0;
function onScroll() {
  const max = story.offsetHeight - innerHeight;
  kTarget = Math.max(0, Math.min(1, scrollY / max)) * (SHAPES.length - 1);
  const ch = Math.min(SHAPES.length - 1, Math.round(kTarget));
  if (ch !== chapter) {
    chapter = ch;
    panels.forEach((p, i) => { p.classList.toggle('is-active', i === ch); p.classList.toggle('is-past', i < ch); });
  }
  navLinks.forEach((a, i) => a.classList.toggle('is-active', i === ch && scrollY < max + innerHeight * 0.5));
  const arena = document.getElementById('arena').getBoundingClientRect().top;
  dim = Math.max(0.28, Math.min(1, arena / innerHeight));
  warp += Math.min(0.25, Math.abs(scrollY - lastScroll) * 0.0009); lastScroll = scrollY;
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* ---------------- render loop ---------------- */
const proj = new Float32Array(N * 3);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const GOLD = [217, 179, 106], CYAN = [159, 245, 234], IVORY = [242, 237, 224];

function frame(time) {
  const t = time * 0.001;
  k += (kTarget - k) * (reduce ? 1 : 0.07);
  const i0 = Math.min(SHAPES.length - 2, Math.floor(k)), local = k - i0;
  const f = ease(Math.max(0, Math.min(1, (local - 0.2) / 0.6)));
  const A = SHAPES[i0], B = SHAPES[i0 + 1];
  const burst = Math.sin(Math.PI * f) * 0.55;             // particles scatter mid-morph
  const spin = SPIN[i0] * (1 - f) + SPIN[i0 + 1] * f;
  const camD = CAM[i0] * (1 - f) + CAM[i0 + 1] * f;

  const facing = k > 3.55;                                 // "30" must face the viewer
  if (!dragging) {
    if (facing) { const tgt = Math.round(rotY / TAU) * TAU; rotY += (tgt - rotY) * 0.06 + vRotY; rotX += (0 - rotX) * 0.06; }
    else { rotY += (reduce ? 0 : spin) + vRotY; rotX += vRotX; rotX += (-0.25 - rotX) * 0.01; }
    vRotY *= 0.94; vRotX *= 0.9;
  }
  const ry = rotY + mx * (facing ? 0.12 : 0.25), rx = rotX + my * 0.15;
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
  const scale = Math.min(W, H) * (small ? 0.9 : 0.64) * (SZ[i0] * (1 - f) + SZ[i0 + 1] * f);
  const ox = W * (W > 860 ? (chapter === 2 ? 0.34 : chapter === 4 ? 0.5 : 0.68) : 0.5);
  const oyT = H * (W > 860 ? (chapter === 4 ? 0.29 : 0.5) : (chapter === 4 ? 0.3 : 0.36));
  centerY += (oyT - centerY) * 0.05; const oy = centerY;
  centerX += (ox - centerX) * 0.05;

  // background
  ctx.fillStyle = 'rgba(7, 9, 26, 0.38)';
  ctx.fillRect(0, 0, W, H);

  // warp starfield
  warp *= 0.92;
  const sp = 0.0016 + warp * 0.06;
  ctx.strokeStyle = 'rgba(242,237,224,0.55)';
  for (const s of stars) {
    const pz = s.z; s.z -= sp; if (s.z <= 0.03) { s.z = 1; s.x = rand(-1, 1); s.y = rand(-1, 1); }
    const X = W / 2 + s.x / s.z * W * 0.3, Y = H / 2 + s.y / s.z * H * 0.3;
    const X0 = W / 2 + s.x / pz * W * 0.3, Y0 = H / 2 + s.y / pz * H * 0.3;
    const a = Math.min(1, (1 - s.z) * 1.4) * dim;
    ctx.globalAlpha = a; ctx.lineWidth = (1 - s.z) * 2;
    ctx.beginPath(); ctx.moveTo(X0, Y0); ctx.lineTo(X + (X - X0) * warp * 6, Y + (Y - Y0) * warp * 6); ctx.stroke();
  }

  // particles
  for (let i = 0; i < N; i++) {
    const p = i * 3;
    // spring the shockwave offset back
    vel[p] -= off[p] * 0.05; vel[p + 1] -= off[p + 1] * 0.05; vel[p + 2] -= off[p + 2] * 0.05;
    vel[p] *= 0.9; vel[p + 1] *= 0.9; vel[p + 2] *= 0.9;
    off[p] += vel[p]; off[p + 1] += vel[p + 1]; off[p + 2] += vel[p + 2];

    const sd = seed[i], wob = burst * (sd - 0.5) * 2;
    let x = A[p] + (B[p] - A[p]) * f, y = A[p + 1] + (B[p + 1] - A[p + 1]) * f, z = A[p + 2] + (B[p + 2] - A[p + 2]) * f;
    x += x * burst * sd + Math.sin(t + sd * 9) * 0.01; y += wob * 0.6; z += z * burst * (1 - sd);
    x += off[p]; y += off[p + 1]; z += off[p + 2];
    pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;

    // rotate (Y then X)
    const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
    const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
    const persp = camD / (camD + z2);
    const X = centerX + x1 * scale * persp * 0.5, Y = oy - y2 * scale * persp * 0.5;
    proj[p] = X; proj[p + 1] = Y; proj[p + 2] = z2;
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const p = i * 3, z = proj[p + 2];
    const depth = Math.max(0, Math.min(1, (z + 1.8) / 3.6));     // 0 near, 1 far
    const c = seed[i] < 0.62 ? GOLD : seed[i] < 0.9 ? CYAN : IVORY;
    const size = (1 - depth) * 2.4 + 0.6;
    ctx.globalAlpha = (0.95 - depth * 0.7) * dim;
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(proj[p] - size / 2, proj[p + 1] - size / 2, size, size);
  }
  ctx.globalCompositeOperation = 'source-over';

  // pulse rings
  for (let r = rings.length - 1; r >= 0; r--) {
    const o = rings[r]; o.t += 0.025;
    if (o.t >= 1) { rings.splice(r, 1); continue; }
    ctx.globalAlpha = (1 - o.t) * 0.8; ctx.strokeStyle = '#9ff5ea'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.t * 260, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}
let centerX = innerWidth * 0.66, centerY = innerHeight * 0.5;
requestAnimationFrame(frame);

/* ---------------- loader ---------------- */
addEventListener('load', () => setTimeout(() => document.getElementById('loader').classList.add('is-done'), 600));

/* ---------------- 3D carousel ---------------- */
const ring = document.getElementById('ring'), spin = document.getElementById('ringSpin');
const tiles = [...spin.children], count = document.getElementById('ringCount');
const step = 360 / tiles.length;
tiles.forEach((el, i) => el.style.setProperty('--a', i * step + 'deg'));
let angle = 0, target = 0, rdrag = false, rx0 = 0, a0 = 0;
function renderRing() {
  angle += (target - angle) * 0.12;
  spin.style.transform = `translateZ(-${parseFloat(getComputedStyle(tiles[0]).getPropertyValue('--z')) || 420}px) rotateX(-8deg) rotateY(${angle}deg)`;
  const front = ((Math.round(-angle / step) % tiles.length) + tiles.length) % tiles.length;
  tiles.forEach((el, i) => el.classList.toggle('is-front', i === front));
  count.textContent = String(front + 1).padStart(2, '0') + ' / ' + String(tiles.length).padStart(2, '0');
  requestAnimationFrame(renderRing);
}
renderRing();
const snap = () => { target = Math.round(target / step) * step; };
document.getElementById('next').onclick = () => { target -= step; snap(); };
document.getElementById('prev').onclick = () => { target += step; snap(); };
ring.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { target -= step; snap(); } if (e.key === 'ArrowLeft') { target += step; snap(); } });
ring.addEventListener('pointerdown', e => { rdrag = true; rx0 = e.clientX; a0 = target; ring.setPointerCapture(e.pointerId); });
ring.addEventListener('pointermove', e => { if (rdrag) target = a0 + (e.clientX - rx0) * 0.35; });
ring.addEventListener('pointerup', () => { rdrag = false; snap(); });

// per-tile 3D tilt toward the cursor
tiles.forEach(el => {
  el.addEventListener('pointermove', e => {
    if (rdrag) return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ty', px * 18 + 'deg'); el.style.setProperty('--tx', -py * 18 + 'deg');
  });
  el.addEventListener('pointerleave', () => { el.style.setProperty('--ty', '0deg'); el.style.setProperty('--tx', '0deg'); });
});
