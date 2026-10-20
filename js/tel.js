// Les téléphones : Terminal (questions à HÉLIOS) et Radio (récepteur au gyroscope).
import { Client } from './net.js';

const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const q = new URLSearchParams(location.search);
const CODE = q.get('s');
const ROLE = q.get('r') || 'les-deux';
let M = { sons: [], dossier: null }; // la Station dit au téléphone où sont les sons (version de test seulement)
let E = null; // dernier état reçu de la Station
let vue = ROLE === 'radio' ? 'radio' : 'terminal';

$('#debut-role').textContent = ROLE === 'radio' ? 'Vous tenez la radio.' : ROLE === 'terminal' ? 'Vous tenez le terminal.' : 'Vous tenez le terminal et la radio.';
$('#role-nom').textContent = ROLE === 'radio' ? 'Radio' : ROLE === 'terminal' ? 'Terminal' : 'Terminal et radio';
if (!CODE) { $('#debut-err').textContent = 'Ouvrez cette page en scannant le code affiché sur la station.'; $('#activer').disabled = true; }

// ------------------------------------------------------------------ son du téléphone
let ctx = null; const tampons = new Map();
const etudiants = () => E && E.etudiants;
function audio() {
  if (ctx) return; const C = window.AudioContext || window.webkitAudioContext; ctx = new C();
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start();
}
async function tampon(code) {
  if (!M.sons.includes(code)) return null;
  if (!tampons.has(code)) tampons.set(code, fetch('media/' + M.dossier + '/' + code + '.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null));
  return tampons.get(code);
}
function variante(code) { const v = []; for (let i = 1; i < 10; i++) if (M.sons.includes(code + '_' + i)) v.push(code + '_' + i); return v.length ? v[Math.floor(Math.random() * v.length)] : code; }
async function bip(code, vol = .8) {
  if (etudiants()) { legende(code); return; }
  if (!ctx) return; const b = await tampon(variante(code)); if (!b) return;
  const s = ctx.createBufferSource(); s.buffer = b; const g = ctx.createGain(); g.gain.value = vol; s.connect(g).connect(ctx.destination); s.start();
}
const boucles = {};
async function boucle(code, vol) {
  if (!ctx || etudiants()) return;
  let b = boucles[code];
  if (!b) {
    b = boucles[code] = { g: ctx.createGain(), pret: false }; b.g.gain.value = 0; b.g.connect(ctx.destination);
    const buf = await tampon(code); if (buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(b.g); s.start(); b.pret = true; }
  }
  b.g.gain.setTargetAtTime(vol, ctx.currentTime, .06);
}
function legende(code, texte) {
  const l = $('#lecture'); const p = el('p', 'leg'); p.append(el('b', null, code), ' ', texte || (E && E.radio && E.radio.sons[code]) || '');
  l.prepend(p); while (l.children.length > 3) l.lastChild.remove();
}

// ------------------------------------------------------------------ liaison
const client = CODE ? new Client(CODE, {
  presentation: () => ({ role: ROLE }),
  connecte: () => { $('#liaison .txt').textContent = 'relié à la station'; document.body.classList.add('relie'); },
  coupure: () => { $('#liaison .txt').textContent = 'liaison perdue, reconnexion…'; document.body.classList.remove('relie'); },
  message: m => {
    if (m.t === 'etat') { E = m; if (m.sons) M = m.sons; rendre(); }
    else if (m.t === 'notif') notif(m.texte);
    else if (m.t === 'envoye') bip('UI_11');
    else if (m.t === 'autorisation') { $('#auto').hidden = false; notif('HÉLIOS demande une autorisation.'); }
  },
}) : null;
function notif(t) { const n = $('#notif'); n.textContent = t; n.classList.add('on'); bip('UI_10'); if (navigator.vibrate) navigator.vibrate(40); clearTimeout(n.m); n.m = setTimeout(() => n.classList.remove('on'), 3800); }

// ------------------------------------------------------------------ démarrage
$('#activer').addEventListener('click', async () => {
  audio();
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') auDoigt(); } catch (_) { auDoigt(); }
  }
  addEventListener('deviceorientation', orientation, true);
  try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch (_) {}
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible') { try { await navigator.wakeLock.request('screen'); } catch (_) {} if (ctx) ctx.resume(); } });
  $('#debut').classList.remove('on');
  document.body.classList.add('actif');
  if (ROLE === 'les-deux') $('#onglets').hidden = false;
  montrer(vue);
  bip('UI_13');
  setTimeout(() => { if (!gyroVu) auDoigt(); }, 3000);
});
document.querySelectorAll('#onglets button').forEach(b => b.addEventListener('click', () => { montrer(b.dataset.vue); bip('UI_09', .6); }));
function montrer(v) {
  vue = v;
  $('#terminal').classList.toggle('on', v === 'terminal');
  $('#radio').classList.toggle('on', v === 'radio');
  document.querySelectorAll('#onglets button').forEach(b => b.setAttribute('aria-pressed', b.dataset.vue === v));
  document.body.dataset.vue = v;
  if (v !== 'radio') Object.values(boucles).forEach(b => b.g.gain.setTargetAtTime(0, ctx.currentTime, .1));
  else accorder();
  if (v === 'radio') dessinerEchelle();
}

// ------------------------------------------------------------------ rendu de l'état
let inter = null, sujet = null;
function rendre() {
  if (!E) return;
  const cases = $('#t-o2 .cases'); if (!cases.children.length) for (let i = 0; i < 10; i++) cases.append(el('i'));
  [...cases.children].forEach((c, i) => c.classList.toggle('eteinte', i >= Math.ceil(E.o2 / 10)));
  $('#t-o2 output').textContent = E.o2 + '\u202f%';
  document.body.classList.toggle('o2-bas', E.o2 < 25);
  if (E.fin) { document.querySelectorAll('.vue').forEach(v => v.classList.remove('on')); $('#fini').classList.add('on'); $('#onglets').hidden = true; $('#envoi').hidden = true; return; }
  // terminal
  const I = $('#inters');
  if (!I.children.length) E.inter.forEach(x => { const b = el('button', null, x); b.type = 'button'; b.setAttribute('role', 'radio'); b.addEventListener('click', () => { inter = x; bip('UI_09', .5); majChoix(); }); I.append(b); });
  const Su = $('#sujets'); const avant = new Set([...Su.querySelectorAll('button')].map(b => b.dataset.id)); const premier = !avant.size; Su.replaceChildren();
  E.sujets.forEach(s => { const b = el('button', null, s.nom); b.type = 'button'; b.dataset.id = s.id; b.setAttribute('role', 'radio'); b.addEventListener('click', () => { sujet = s.id; bip('UI_09', .5); majChoix(); }); if (!premier && !avant.has(s.id)) b.classList.add('neuf'); Su.append(b); });
  const H = $('#hist'); H.replaceChildren();
  [...E.hist].reverse().forEach(h => {
    const li = el('li', h.mauvaise ? 'mauvaise' : ''); const b = el('button', null, h.q); b.type = 'button';
    if (h.mauvaise) b.append(el('small', null, 'question inutile, oxygène perdu'));
    b.addEventListener('click', () => client && client.envoyer({ t: 'revoir', cle: h.cle }));
    li.append(b); H.append(li);
  });
  $('#auto').hidden = !E.attenteAuto;
  majChoix();
  accorder();
}
function majChoix() {
  document.querySelectorAll('#inters button').forEach(b => b.setAttribute('aria-checked', b.textContent === inter));
  document.querySelectorAll('#sujets button').forEach(b => b.setAttribute('aria-checked', b.dataset.id === sujet));
  const s = E && E.sujets.find(x => x.id === sujet);
  const deja = E && E.hist.find(h => h.cle === sujet + '|' + inter);
  const ap = $('#apercu');
  ap.textContent = inter && s ? (deja ? deja.q + ' (déjà posée, sans frais)' : inter + '… ' + s.nom.toLowerCase().replace('hélios', 'HÉLIOS') + ' ?') : inter ? inter + '… ?' : 'Choisissez un mot, puis un sujet.';
  ap.classList.toggle('vide', !inter);
  $('#envoyer').disabled = !(inter && s && E.enJeu);
}
$('#envoyer').addEventListener('click', () => {
  if (!inter || !sujet || !client) return;
  client.envoyer({ t: 'q', sujet, inter });
  document.body.classList.remove('envoi-en-cours'); void document.body.offsetWidth; document.body.classList.add('envoi-en-cours');
  inter = null; sujet = null; majChoix();
});
$('#auto').addEventListener('submit', e => { e.preventDefault(); const v = $('#auto-code').value.trim(); if (!v) return; client.envoyer({ t: 'auto', code: v }); $('#auto-code').value = ''; $('#auto').hidden = true; });

// ------------------------------------------------------------------ radio
let f = 126.0, gyroVu = false, dernierAlpha = null, doigt = false, dernierCran = Math.round(f * 10), accroche = null;
function orientation(e) {
  if (e.alpha == null || doigt) return;
  gyroVu = true;
  if (dernierAlpha == null) { dernierAlpha = e.alpha; return; }
  let d = e.alpha - dernierAlpha; if (d > 180) d -= 360; if (d < -180) d += 360;
  dernierAlpha = e.alpha;
  if (Math.abs(d) < .05) return;
  regler(f - d / 12);
}
function regler(nf) {
  if (!E || !E.radio) return;
  const R = E.radio;
  f = Math.min(R.max, Math.max(R.min, nf));
  const cran = Math.round(f * 10);
  if (cran !== dernierCran && vue === 'radio') { if (!etudiants()) bip('MEC_11', .35); dernierCran = cran; }
  accorder();
}
function auDoigt() {
  doigt = true; document.body.classList.add('doigt');
  $('#consigne').textContent = 'Faites glisser l\'échelle du bout du doigt, lentement.';
  $('#glisser').hidden = true;
}
$('#glisser').addEventListener('click', auDoigt);
(() => {
  const e = $('#echelle'); let x0 = null, f0 = 0;
  e.addEventListener('pointerdown', ev => { if (!doigt) return; x0 = ev.clientX; f0 = f; e.setPointerCapture(ev.pointerId); });
  e.addEventListener('pointermove', ev => { if (x0 == null) return; regler(f0 - (ev.clientX - x0) / 40); });
  e.addEventListener('pointerup', () => { x0 = null; });
})();

let derniereLegende = '';
function accorder() {
  if (!E || !E.radio) return;
  const R = E.radio;
  $('#freq').textContent = f.toFixed(1).replace('.', ',');
  dessinerEchelle();
  const dispo = R.canaux.filter(c => !c.prive || R.ampli);
  let proche = null, ecart = 99;
  for (const c of dispo) { const d = Math.abs(c.f - f); if (d < ecart) { ecart = d; proche = c; } }
  const force = proche ? Math.max(0, 1 - ecart / R.largeur) : 0;
  const vu = $('#vu-aiguille'); const ang = -58 + force * 116 + (Math.random() - .5) * 6 * (1 - force);
  vu.setAttribute('transform', `rotate(${ang} 100 100)`);
  const tient = proche && ecart <= R.accroche;
  if (tient && accroche !== proche.id) { accroche = proche.id; bip('RAD_06', .7); if (navigator.vibrate) navigator.vibrate(25); }
  if (!tient) accroche = null;
  // sons
  if (vue === 'radio' && ctx && !etudiants()) {
    for (const c of R.canaux) if (!c.prive) boucle(c.son, c === proche ? force * .9 : 0);
    const prive = R.canaux.find(c => c.prive);
    const sur = proche === prive;
    boucle('RAD_01', .55 * (1 - force));
    boucle('RAD_05', sur ? force * .35 : 0);
    boucle('FER_05_TEL_VOIX', sur && !R.trouve ? Math.pow(force, 1.6) : 0);
    boucle('FER_05_TEL_PARASITES', sur && !R.trouve ? .9 * (1 - force * .7) : 0);
  }
  // affichage
  const lec = $('#lecture');
  let titre = 'Bruit entre les canaux', corps = '';
  if (tient) {
    titre = 'Canal ' + proche.id + ' · ' + proche.nom;
    if (proche.telemetrie) corps = R.telemetrie[R.phase].join('\n');
    else if (proche.prive) corps = R.trouve ? 'Porteuse privée. Plus rien.' : '';
    else corps = proche.texte || '';
  } else if (proche && force > .2) titre = 'Signal faible';
  $('#canal').textContent = titre;
  if (!etudiants()) { lec.dataset.mode = 'texte'; lec.textContent = corps; }
  else {
    // version étudiants : ce que le téléphone ferait entendre, écrit
    const code = !proche || force < .2 ? 'RAD_01' : proche.son;
    const cle = code + (tient ? '+' : '');
    if (cle !== derniereLegende) { derniereLegende = cle; lec.replaceChildren(); legende(code); if (tient) legende('RAD_06'); if (corps) lec.append(el('pre', 'tele', corps)); }
    const prive = R.canaux.find(c => c.prive);
    if (proche === prive && force > .05 && !R.trouve) brouiller(force);
  }
  $('#diffuser').hidden = !(tient && proche.prive && !R.trouve);
}
// le message caché, écrit, aussi abîmé que le signal
function brouiller(force) {
  let p = $('#lecture .cache');
  if (!p) { p = el('p', 'cache'); $('#lecture').append(el('p', 'leg', 'FER_05_TEL · le message caché, voix et parasites dosés par l\'angle du téléphone'), p); }
  const t = E.radio.prive;
  p.textContent = [...t].map((ch, i) => ch === ' ' ? ' ' : (hash(i) < force * 1.1 ? ch : '·')).join('');
}
function hash(i) { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
$('#diffuser').addEventListener('click', () => { if (client) client.envoyer({ t: 'diffuser' }); $('#diffuser').hidden = true; Object.values(boucles).forEach(b => b.g.gain.setTargetAtTime(0, ctx.currentTime, .3)); });

// échelle de fréquences : graduée comme un vrai récepteur
function dessinerEchelle() {
  const c = $('#echelle-c'); if (!c || !E || !E.radio) return;
  const w = c.clientWidth, h = c.clientHeight, dpr = devicePixelRatio || 1;
  if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const px = 46; // pixels par MHz
  const cs = getComputedStyle(document.body);
  g.strokeStyle = cs.getPropertyValue('--graduation'); g.fillStyle = cs.getPropertyValue('--chiffre'); g.font = '500 15px "Atkinson Mono", monospace'; g.textAlign = 'center';
  const debut = Math.floor((f - w / 2 / px) * 10), fin = Math.ceil((f + w / 2 / px) * 10);
  for (let k = debut; k <= fin; k++) {
    const v = k / 10; if (v < E.radio.min || v > E.radio.max) continue;
    const x = w / 2 + (v - f) * px;
    const L = k % 10 === 0 ? 26 : k % 5 === 0 ? 17 : 9;
    g.lineWidth = k % 10 === 0 ? 1.4 : 1;
    g.beginPath(); g.moveTo(x, h - 8); g.lineTo(x, h - 8 - L); g.stroke();
    if (k % 10 === 0) g.fillText(String(v), x, h - 44);
  }
  // repères des canaux connus (affichés sur la console)
  g.fillStyle = cs.getPropertyValue('--laiton');
  for (const ch of E.radio.canaux) { if (ch.prive) continue; const x = w / 2 + (ch.f - f) * px; g.fillRect(x - 3, 6, 6, 6); }
}
addEventListener('resize', dessinerEchelle);
(() => { const G = $('#graduations'); for (let i = 0; i <= 10; i++) { const a = (-58 + i * 11.6) * Math.PI / 180; const x1 = 100 + Math.sin(a) * 74, y1 = 100 - Math.cos(a) * 74, x2 = 100 + Math.sin(a) * (i % 5 ? 66 : 60), y2 = 100 - Math.cos(a) * (i % 5 ? 66 : 60); const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); G.append(l); } })();

// interface de test
window.TEL = { regler: v => regler(v), etat: () => E, f: () => f, auDoigt };
