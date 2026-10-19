// Ce qui fait vivre une image fixe : poussière dans la lumière, brume qui dérive, lumières qui respirent ou vacillent.
// Une seule toile au-dessus du décor, qui ne capte aucun clic. Réglages par lieu (positions en % de l'image).

export const ATMO = {
  cryo: { poussiere: 34, brume: { mode: 'sol', opacite: .5, teinte: [190, 215, 240], vitesse: .5 },
    lueurs: [{ x: 15, y: 60, r: 13, c: [160, 205, 255], pouls: 7 }, { x: 29, y: 57, r: 8, c: [160, 205, 255], pouls: 8.5 }, { x: 71, y: 57, r: 9, c: [160, 205, 255], pouls: 9.5 }, { x: 84, y: 61, r: 13, c: [160, 205, 255], pouls: 7.5 }] },
  coursive: { poussiere: 46, brume: { mode: 'air', opacite: .16, teinte: [255, 236, 205], vitesse: .35 }, vacille: [{ x: 47, y: 12, l: 4.5, h: 7 }], lueurs: [{ x: 92, y: 45, r: 16, c: [255, 150, 110], pouls: 14 }] },
  infirmerie: { poussiere: 28, brume: { mode: 'air', opacite: .1, teinte: [255, 230, 190], vitesse: .25 }, lueurs: [{ x: 76, y: 46, r: 10, c: [170, 210, 255], pouls: 11 }] },
  machines: { poussiere: 70, brume: { mode: 'air', opacite: .24, teinte: [255, 205, 150], vitesse: .6 }, vacille: [{ x: 60, y: 8, l: 30, h: 20 }] },
  radio: { poussiere: 30, brume: { mode: 'air', opacite: .08, teinte: [255, 230, 200], vitesse: .2 }, lueurs: [{ x: 48, y: 46, r: 14, c: [255, 210, 150], pouls: 5 }] },
  sas: { poussiere: 18, brume: { mode: 'vitre', opacite: .3, teinte: [205, 225, 220], vitesse: .18, x: 50, y: 38, r: 18 } },
};

let voile = null, toile = null, ctx = null, lieu = null, parts = [], brumes = [], t0 = performance.now(), actif = true, secours = false;
const L = 1920, H = 1080;

function texture(taille, graine) {
  // bruit doux en plusieurs octaves, une fois pour toutes
  const c = document.createElement('canvas'); c.width = c.height = taille;
  const g = c.getContext('2d'); const img = g.createImageData(taille, taille);
  const champ = (n) => { const a = new Float32Array(n * n); let s = graine; for (let i = 0; i < a.length; i++) { s = (s * 16807) % 2147483647; a[i] = s / 2147483647; } return a; };
  const oct = [[4, .55], [8, .3], [16, .15]].map(([n, p]) => [n, p, champ(n)]);
  for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
    let v = 0;
    for (const [n, p, a] of oct) {
      const fx = x / taille * n, fy = y / taille * n, ix = Math.floor(fx), iy = Math.floor(fy), dx = fx - ix, dy = fy - iy;
      const q = (i, j) => a[((iy + j) % n) * n + ((ix + i) % n)];
      const sx = dx * dx * (3 - 2 * dx), sy = dy * dy * (3 - 2 * dy);
      v += p * ((q(0, 0) * (1 - sx) + q(1, 0) * sx) * (1 - sy) + (q(0, 1) * (1 - sx) + q(1, 1) * sx) * sy);
    }
    const k = (y * taille + x) * 4; const a8 = Math.max(0, Math.min(255, (v - .3) * 1.6 * 255));
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = a8;
  }
  g.putImageData(img, 0, 0); return c;
}

const cacheTeinte = new Map();
function teintee(k, rgb) {
  const cle = k + ':' + rgb; if (cacheTeinte.has(cle)) return cacheTeinte.get(cle);
  const src = brumes[k], c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, c.width, c.height);
  cacheTeinte.set(cle, c); return c;
}
export function installer(parent) {
  toile = document.createElement('canvas'); toile.id = 'atmo'; toile.width = L / 2; toile.height = H / 2; // demi-résolution : la brume n'a pas besoin de plus
  parent.append(toile); ctx = toile.getContext('2d');
  brumes = [texture(128, 41), texture(128, 977)];
  voile = document.createElement('canvas'); voile.width = 240; voile.height = 135; // très basse définition : la brume reste floue
  requestAnimationFrame(boucle);
  document.addEventListener('visibilitychange', () => { actif = document.visibilityState === 'visible'; if (actif) requestAnimationFrame(boucle); });
}
export function changer(nouveau, enSecours) {
  lieu = ATMO[nouveau] || null; secours = !!enSecours;
  parts = [];
  if (!lieu) return;
  for (let i = 0; i < lieu.poussiere; i++) parts.push(nouvellePart(true));
}
function nouvellePart(partout) {
  return { x: Math.random() * L, y: partout ? Math.random() * H : H + 10, z: .3 + Math.random() * .9, vx: (Math.random() - .5) * 4, vy: -(1 + Math.random() * 4), ph: Math.random() * 6.28 };
}
const reduit = matchMedia('(prefers-reduced-motion: reduce)');
function boucle(now) {
  if (!actif || !ctx) return;
  const t = (now - t0) / 1000;
  ctx.setTransform(.5, 0, 0, .5, 0, 0);
  ctx.clearRect(0, 0, L, H);
  if (lieu && !reduit.matches) {
    // brume : dessinée à part, adoucie par un masque en dégradé, puis posée en mode écran
    const b = lieu.brume;
    if (b) {
      const W = voile.width, Hh = voile.height, v = voile.getContext('2d');
      v.globalCompositeOperation = 'source-over'; v.clearRect(0, 0, W, Hh);
      for (let k = 0; k < 2; k++) {
        const img = teintee(k, b.teinte), s = (k ? 1.6 : 2.2) * W / 4, dx = (t * b.vitesse * (k ? -6 : 9)) % s;
        v.globalAlpha = k ? .55 : .8;
        for (let ox = -s; ox < W + s; ox += s) for (let oy = -s; oy < Hh + s; oy += s) v.drawImage(img, ox + dx, oy + Math.sin(t * .05 + k) * 6, s, s);
      }
      v.globalAlpha = 1; v.globalCompositeOperation = 'destination-in';
      let m;
      if (b.mode === 'sol') { m = v.createLinearGradient(0, Hh * .5, 0, Hh); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(.45, 'rgba(0,0,0,.7)'); m.addColorStop(1, 'rgba(0,0,0,1)'); }
      else if (b.mode === 'vitre') { const x = b.x / 100 * W, y = b.y / 100 * Hh, r = b.r / 100 * W; m = v.createRadialGradient(x, y, 0, x, y, r); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); }
      else { m = v.createLinearGradient(0, 0, 0, Hh); m.addColorStop(0, 'rgba(0,0,0,.6)'); m.addColorStop(.5, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,.5)'); }
      v.fillStyle = m; v.fillRect(0, 0, W, Hh);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = b.opacite * (secours ? .7 : 1);
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(voile, 0, 0, L, H); ctx.restore();
    }
    // lueurs qui respirent (caissons, cadrans)
    for (const g of lieu.lueurs || []) {
      const p = .55 + .45 * Math.sin(t * 2 * Math.PI / g.pouls + g.x);
      const r = g.r / 100 * L; const x = g.x / 100 * L, y = g.y / 100 * H;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${g.c},${.16 * p})`); gr.addColorStop(1, `rgba(${g.c},0)`);
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
    }
    // tubes qui vacillent
    for (const v of lieu.vacille || []) {
      const s = Math.sin(t * 13.7 + v.x) * Math.sin(t * 7.3) > .55 || (t % 6.1 < .12);
      if (s) { ctx.fillStyle = 'rgba(8,8,10,.55)'; ctx.fillRect(v.x / 100 * L, v.y / 100 * H, v.l / 100 * L, v.h / 100 * H); }
    }
    // poussière dans la lumière
    ctx.globalCompositeOperation = 'screen';
    for (const p of parts) {
      p.x += (p.vx * .016 + Math.sin(t * .4 + p.ph) * .25) * p.z; p.y += p.vy * .016 * p.z;
      if (p.y < -10 || p.x < -10 || p.x > L + 10) Object.assign(p, nouvellePart(false));
      const a = (.18 + .5 * (.5 + .5 * Math.sin(t * .8 + p.ph))) * p.z;
      ctx.fillStyle = `rgba(255,240,215,${a * .5})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.1 + p.z * 1.6, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(boucle);
}
