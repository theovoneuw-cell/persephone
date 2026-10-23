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
document.title = 'Perséphone · ' + (ROLE === 'radio' ? 'radio' : ROLE === 'terminal' ? 'terminal' : 'terminal et radio');
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
  connecte: () => { $('#liaison .txt').textContent = 'relié à la station'; document.body.classList.add('relie'); if (sansLiaison) { clearTimeout(sansLiaison); sansLiaison = null; $('#notif').classList.remove('on'); } },
  coupure: () => { $('#liaison .txt').textContent = 'liaison perdue, reconnexion…'; document.body.classList.remove('relie'); },
  message: m => {
    if (m.t === 'etat') { E = m; if (m.sons) M = m.sons; rendre(); }
    else if (m.t === 'notif') notif(m.texte);
    else if (m.t === 'envoye') bip('UI_11');
    else if (m.t === 'autorisation') { montrerAuto(true); bip('UI_10'); if (navigator.vibrate) navigator.vibrate(40); } // la feuille se suffit : pas de notification en double
  },
}) : null;
// jamais relié au bout de vingt secondes : le réseau bloque sans doute le lien direct (Wi-Fi d'école, d'hôtel…)
let sansLiaison = client ? setTimeout(() => {
  const n = $('#notif'); n.textContent = 'Pas de liaison avec la station. Coupez le Wi-Fi du téléphone pour passer en 4G et rechargez la page. Sinon, la station se joue aussi sans téléphone.'; n.classList.add('on');
}, 20000) : null;
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
  // la plaque s'allume, puis l'instrument prend tout l'écran
  $('#debut').classList.add('allume'); await new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000));
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
  $('#t-o2 output').textContent = E.o2 + ' %';
  document.body.classList.toggle('o2-bas', E.o2 < 25);
  if (E.fin) { document.querySelectorAll('.vue').forEach(v => v.classList.remove('on')); $('#fini').classList.add('on'); $('#onglets').hidden = true; $('#envoi').hidden = true; return; }
  // terminal : les deux tambours ne se reconstruisent que si leur contenu change, pour garder leur position
  const I = $('#inters');
  if (!I.children.length) { E.inter.forEach(x => I.append(rang(x, x, () => { inter = x; }))); installerTambour(I, b => { inter = b.dataset.id; }); }
  const Su = $('#sujets'); const avant = [...Su.querySelectorAll('button')].map(b => b.dataset.id);
  if (avant.join() !== E.sujets.map(x => x.id).join()) {
    const premier = !avant.length; Su.replaceChildren();
    E.sujets.forEach(x => { const b = rang(x.id, x.nom, () => { sujet = x.id; }); if (!premier && !avant.includes(x.id)) b.classList.add('neuf'); Su.append(b); });
    if (!Su.dataset.pret) { installerTambour(Su, b => { sujet = b.dataset.id; }); Su.dataset.pret = 1; }
    if (sujet) { const b = Su.querySelector(`[data-id="${sujet}"]`); if (b) Su.scrollTop = b.offsetTop - Su.clientHeight / 2 + b.offsetHeight / 2; else sujet = null; }
  }
  const H = $('#hist'); H.replaceChildren();
  [...E.hist].reverse().forEach(h => {
    const li = el('li', h.mauvaise ? 'mauvaise' : ''); const b = el('button', null, h.q); b.type = 'button';
    b.append(el('small', null, h.mauvaise ? 'inutile · O₂' : 'revoir'));
    b.addEventListener('click', () => client && client.envoyer({ t: 'revoir', cle: h.cle }));
    li.append(b); H.append(li);
  });
  montrerAuto(!!E.attenteAuto);
  majChoix();
  accorder();
}
// une ligne de tambour : un bouton qui se choisit au toucher, ou quand on l'amène sous la bande
function rang(id, texte, choisir) {
  const b = el('button', null, texte); b.type = 'button'; b.dataset.id = id; b.setAttribute('role', 'radio');
  b.addEventListener('click', () => { choisir(); verrou = performance.now(); centrer(b); bip('UI_09', .5); vibrer(); majChoix(); });
  return b;
}
let verrou = 0;
function centrer(b) { const t = b.parentElement; t.scrollTo({ top: b.offsetTop - t.clientHeight / 2 + b.offsetHeight / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
function auCentre(t) { const m = t.scrollTop + t.clientHeight / 2; let best = null, d = 1e9; for (const b of t.children) { const e = Math.abs(b.offsetTop + b.offsetHeight / 2 - m); if (e < d) { d = e; best = b; } } return best; }
function installerTambour(t, choisir) {
  let minuterie = null, touche = false;
  const marquer = () => { const c = auCentre(t); t.querySelectorAll('.centre').forEach(x => x !== c && x.classList.remove('centre')); c && c.classList.add('centre'); return c; };
  const poser = () => { if (performance.now() - verrou < 700 || !touche) return; const c = marquer(); if (!c) return; const avant = t.querySelector('[aria-checked=true]'); choisir(c); if (c !== avant) { bip('UI_09', .4); vibrer(); } majChoix(); };
  t.addEventListener('pointerdown', () => { touche = true; }, { passive: true });
  t.addEventListener('touchstart', () => { touche = true; }, { passive: true });
  t.addEventListener('wheel', () => { touche = true; }, { passive: true });
  t.addEventListener('scroll', () => { marquer(); clearTimeout(minuterie); minuterie = setTimeout(poser, 140); }, { passive: true });
  requestAnimationFrame(marquer);
}
function vibrer() { if (navigator.vibrate) navigator.vibrate(8); }
// la question se lit comme une phrase : chaque mot interrogatif a sa tournure, chaque sujet son article
const ARTICLES = { helios: ['', 'HÉLIOS'], reveil: ['le', 'réveil'], equipage: ['l\'', 'équipage'], module: ['le', 'module central'], oxygene: ['l\'', 'oxygène'], achard: ['le', 'docteur Achard'], commandante: ['la', 'commandante'], labo: ['le', 'laboratoire'], carotte: ['la', 'carotte 17'], journaux: ['les', 'journaux'], quarantaine: ['la', 'quarantaine'], six: ['le', 'membre six'], ferreira: ['', 'Ferreira'], capsule: ['la', 'capsule'], recyclage: ['le', 'recyclage'], canal: ['le', 'canal privé'], tellus: ['', 'Tellus'], dossier: ['le', 'dossier 17'], contamination: ['la', 'contamination'] };
const sep = a => a === '' ? '' : a === 'l\'' ? a : a + ' ';
const avecA = a => ({ le: 'au ', les: 'aux ', la: 'à la ', 'l\'': 'à l\'', '': 'à ' })[a];
// [début souligné, liaison avant le sujet, fin] ; p : sujet au pluriel
const TOURNURES = {
  Qui: (a, p) => ['Qui', ' est lié' + (p ? 's ' : ' ') + avecA(a), ' ?'],
  Quoi: (a, p) => ['Que', (p ? ' cachent ' : ' cache ') + sep(a), ' ?'],
  'Où': (a, p) => ['Où', (p ? ' en sont ' : ' en est ') + sep(a), ' ?'],
  Quand: (a, p) => ['À quand', (p ? ' remontent ' : ' remonte ') + sep(a), ' ?'],
  Pourquoi: a => ['Pourquoi', ' ' + sep(a), ' ?'],
  Comment: (a, p) => ['Comment', (p ? ' vont ' : ' va ') + sep(a), ' ?'],
  Combien: a => ['Combien de temps', ' pour ' + sep(a), ' ?'],
};
let rendu = { inter: null, sujet: null };
function phrase(ap, s) {
  const art = s ? (ARTICLES[s.id] || ['', s.nom.toLowerCase()]) : ['le', ''];
  const t = (TOURNURES[inter] || (() => [inter, ' ', ' ?']))(art[0], art[0] === 'les');
  const mot = (txt, change) => el('span', 'mot' + (change ? ' anim' : ''), txt);
  const ci = inter !== rendu.inter, cs = (s && s.id) !== rendu.sujet;
  ap.replaceChildren();
  if (inter) ap.append(mot(t[0], ci), s ? t[1] : t[1].replace(/\s*(au|aux|à la|à l'|à|le|la|les|l')\s*$/, ' ').replace(/\s+$/, ' '));
  if (s) { if (!inter) ap.append(el('span', 'trou'), ' … ' + sep(art[0])); ap.append(mot(art[1], cs)); }
  else ap.append(el('span', 'trou'));
  ap.append(inter ? t[2] : ' ?');
  rendu = { inter, sujet: s && s.id };
}
function majChoix() {
  document.querySelectorAll('#inters button').forEach(b => b.setAttribute('aria-checked', b.dataset.id === inter));
  document.querySelectorAll('#sujets button').forEach(b => {
    b.setAttribute('aria-checked', b.dataset.id === sujet);
    const pose = inter && E && E.hist.some(h => h.cle === b.dataset.id + '|' + inter);
    let m = b.querySelector('.marque'); if (pose && !m) b.append(el('span', 'marque', 'posée')); else if (!pose && m) m.remove();
  });
  $('#tambours').classList.toggle('choisi', !!(inter && sujet));
  $('#inters').classList.toggle('choisi', !!inter); $('#sujets').classList.toggle('choisi', !!sujet);
  const s = E && E.sujets.find(x => x.id === sujet);
  const deja = E && E.hist.find(h => h.cle === sujet + '|' + inter);
  const ap = $('#apercu'), note = $('#apercu-note');
  if (!inter && !s) { ap.replaceChildren('Choisissez un mot, puis un sujet.'); rendu = { inter: null, sujet: null }; }
  else phrase(ap, s);
  ap.classList.toggle('vide', !inter && !s);
  ap.classList.toggle('long', ap.textContent.length > 30);
  if (!document.body.classList.contains('transmise')) note.textContent = deja ? 'Déjà posée : sans frais, la réponse revient sur la station.' : '';
  $('#envoyer').textContent = deja ? 'Revoir la réponse' : 'Transmettre';
  $('#envoyer').disabled = !(inter && s && E.enJeu);
}
$('#envoyer').addEventListener('click', () => {
  if (!inter || !sujet || !client) return;
  client.envoyer({ t: 'q', sujet, inter });
  const b = document.body; b.classList.remove('transmise'); void b.offsetWidth; b.classList.add('transmise');
  $('#apercu-note').textContent = 'Transmise. HÉLIOS répond sur la station.';
  clearTimeout(b.tr); b.tr = setTimeout(() => { b.classList.remove('transmise'); majChoix(); }, 4200);
});
function montrerAuto(oui) { $('#auto').hidden = !oui; document.body.classList.toggle('auto-ouvert', oui); }
$('#auto').addEventListener('submit', e => { e.preventDefault(); const v = $('#auto-code').value.trim(); if (!v) return; client.envoyer({ t: 'auto', code: v }); $('#auto-code').value = ''; montrerAuto(false); });

// ------------------------------------------------------------------ radio
let f = 126.0, gyroVu = false, doigt = false, dernierCran = Math.round(f * 10), accroche = null;
let fr = f, penche = null, plat = true, dernierTick = null; // fr : l'accord brut, avant l'aimant des canaux
// le téléphone posé à plat dans la main : on le penche à gauche ou à droite, comme un niveau à bulle.
// Gamma (inclinaison gauche-droite) vient de la gravité : même sens partout, sans boussole.
function orientation(e) {
  if (e.gamma == null || doigt) return;
  gyroVu = true;
  const p = Math.abs(e.beta) < 50;
  if (p !== plat) { plat = p; $('#consigne').textContent = p ? CONSIGNE : 'Posez le téléphone à plat dans la main.'; }
  const g = plat ? e.gamma : 0;
  penche = penche == null ? g : penche * .7 + g * .3;
}
// à plat = immobile ; un peu penché = l'aiguille avance lentement ; très penché = elle file
function piloter(t) {
  requestAnimationFrame(piloter);
  const dt = dernierTick == null ? 0 : Math.min(.1, (t - dernierTick) / 1000); dernierTick = t;
  if (penche == null || doigt || vue !== 'radio' || !dt) return;
  const x = Math.max(0, Math.abs(penche) - 4); if (!x) return;
  regler(fr + Math.sign(penche) * (.03 * x + .0035 * x * x) * dt);
}
requestAnimationFrame(piloter);
const CONSIGNE = $('#consigne').textContent;
// les canaux attirent l'aiguille : à l'approche, l'accord ralentit puis se pose dessus
const AIMANT = .45;
function aimant(v) {
  const R = E.radio;
  for (const c of R.canaux) { if (c.prive && !R.ampli) continue; const o = v - c.f; if (Math.abs(o) < AIMANT) return c.f + o * (o / AIMANT) ** 2; }
  return v;
}
function regler(nf) {
  if (!E || !E.radio) return;
  const R = E.radio;
  fr = Math.min(R.max, Math.max(R.min, nf));
  f = aimant(fr);
  const cran = Math.round(f * 10);
  if (cran !== dernierCran && vue === 'radio') { if (!etudiants()) bip('MEC_11', .35); dernierCran = cran; }
  accorder();
}
function auDoigt() {
  doigt = true; document.body.classList.add('doigt');
  $('#consigne').textContent = 'Faites glisser le spectre du bout du doigt, lentement.';
  $('#glisser').hidden = true;
}
$('#glisser').addEventListener('click', auDoigt);
(() => {
  const e = $('#echelle'); let x0 = null, f0 = 0;
  e.addEventListener('pointerdown', ev => { if (!doigt) return; x0 = ev.clientX; f0 = fr; e.setPointerCapture(ev.pointerId); });
  e.addEventListener('pointermove', ev => { if (x0 == null) return; regler(f0 - (ev.clientX - x0) / PX); });
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
  niveau(force);
  const tient = proche && ecart <= R.accroche;
  document.body.classList.toggle('tient', !!tient);
  if (tient) { const a = $('#echelle .accroche'), w = $('#spectre').clientWidth; a.style.left = (w / 2 + (proche.f - f) * PX - R.accroche * PX) + 'px'; a.style.width = (2 * R.accroche * PX) + 'px'; }
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

// le récepteur : un spectre qui défile (le passé descend), une échelle en dessous, un niveau en cases
const PX = 52; // pixels par MHz
function niveau(force) {
  const N = $('#niveau'); if (!N.children.length) for (let i = 0; i < 24; i++) N.append(el('i'));
  const n = Math.round(force * 24 + (force < .98 ? Math.random() * 1.6 : 0));
  [...N.children].forEach((c, i) => c.classList.toggle('on', i < n));
}
let spF = null, spT = 0;
function dessinerEchelle() {
  const c = $('#echelle-c'); if (!c || !E || !E.radio) return;
  const w = c.clientWidth, h = c.clientHeight, dpr = devicePixelRatio || 1;
  if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(241, 231, 211, .42)'; g.fillStyle = 'rgba(241, 231, 211, .7)'; g.font = '500 12px "Atkinson Mono", monospace'; g.textAlign = 'center';
  const debut = Math.floor((f - w / 2 / PX) * 10), fin = Math.ceil((f + w / 2 / PX) * 10);
  for (let k = debut; k <= fin; k++) {
    const v = k / 10; if (v < E.radio.min || v > E.radio.max) continue;
    const x = Math.round(w / 2 + (v - f) * PX) + .5;
    const L = k % 10 === 0 ? 9 : k % 5 === 0 ? 6 : 3;
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, L); g.stroke();
    if (k % 10 === 0 && x > 16 && x < w - 16) g.fillText(String(v), x, 27);
  }
}
function boucleSpectre(t) {
  function texBruit(w, h, pas) {
  // le même bruit de fond que les lignes du spectre (mêmes bandes de temps), pour remplir ce qui n'a pas encore défilé
  let t = texBruit.c; if (t && t.width >= w && t.height >= h && t.pas === pas) return t;
  t = texBruit.c = document.createElement('canvas'); t.width = w; t.height = h; t.pas = pas;
  const g = t.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y0 = 0; y0 < h; y0 += pas) {
    let n = Math.random() * .1; const ligne = new Float32Array(w);
    for (let x = 0; x < w; x++) { n = n * .82 + Math.random() * Math.random() * .18; ligne[x] = n * .55 + .03; }
    for (let y = y0; y < Math.min(h, y0 + pas); y++) for (let x = 0; x < w; x++) { const a = ligne[x], i = (y * w + x) * 4; d[i] = 13 + 226 * a; d[i + 1] = 15 + 212 * a; d[i + 2] = 19 + 181 * a; d[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0); return t;
}
requestAnimationFrame(boucleSpectre);
  if (vue !== 'radio' || !E || !E.radio || t - spT < 33) return;
  spT = t;
  const c = $('#spectre'), w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (!w) return;
  const g = c.getContext('2d');
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.drawImage(texBruit(c.width, c.height, Math.round(2 * dpr)), 0, 0); spF = f; }
  // l'historique glisse avec l'accord, puis descend d'une ligne
  const dx = Math.round((spF - f) * PX * dpr); spF = f;
  const pas = Math.round(2 * dpr);
  g.globalCompositeOperation = 'copy'; g.drawImage(c, dx, pas); g.globalCompositeOperation = 'source-over';
  // les colonnes découvertes par l'accord se remplissent de bruit, pas d'un aplat
  if (dx) { const bruit = texBruit(c.width, c.height, Math.round(2 * dpr)), l = Math.min(Math.abs(dx), c.width), sx = Math.floor(Math.random() * (c.width - l + 1)); g.drawImage(bruit, sx, 0, l, c.height, dx > 0 ? 0 : c.width - l, 0, l, c.height); }
  // la ligne du présent, en haut
  const R = E.radio, img = g.createImageData(c.width, pas), d = img.data;
  const ligne = boucleSpectre.l && boucleSpectre.l.length === c.width ? boucleSpectre.l : (boucleSpectre.l = new Float32Array(c.width));
  let n = Math.random() * .1;
  for (let x = 0; x < c.width; x++) {
    const v = f + (x / dpr - w / 2) / PX;
    // bruit de fond corrélé en fréquence : des lignes de temps texturées, pas de la neige
    n = n * .82 + Math.random() * Math.random() * .18;
    let a = n * .55 + .03;
    for (const ch of R.canaux) {
      if (ch.prive && !R.ampli) continue;
      const e = (v - ch.f) / (ch.prive ? .07 : .11);
      const fort = ch.prive ? (Math.abs(f - ch.f) < .8 ? .55 : .12) : .85;
      a += fort * Math.exp(-e * e) * (.75 + .25 * Math.random());
    }
    a = Math.min(1, a); ligne[x] = a;
    for (let y = 0; y < pas; y++) { const k = (y * c.width + x) * 4; d[k] = 239; d[k + 1] = 227; d[k + 2] = 200; d[k + 3] = a * 255; }
  }
  // le fond nuit sous la ligne, puis la ligne
  g.fillStyle = '#0d0f13'; g.fillRect(0, 0, c.width, pas);
  const tmp = boucleSpectre.t || (boucleSpectre.t = document.createElement('canvas')); tmp.width = c.width; tmp.height = pas; tmp.getContext('2d').putImageData(img, 0, 0);
  g.drawImage(tmp, 0, 0);
  // la trace du spectre, au-dessus : plancher de bruit et pics
  const tr = $('#trace'), tw = tr.clientWidth, th = tr.clientHeight;
  if (tr.width !== Math.round(tw * dpr)) { tr.width = Math.round(tw * dpr); tr.height = Math.round(th * dpr); }
  const q = tr.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, tr.width, tr.height);
  const lis = boucleSpectre.lis && boucleSpectre.lis.length === c.width ? boucleSpectre.lis : (boucleSpectre.lis = Float32Array.from(ligne));
  q.beginPath();
  for (let x = 0; x < c.width; x += 2) { lis[x] = lis[x] * .7 + ligne[x] * .3; const y = tr.height - 3 * dpr - lis[x] * (tr.height - 8 * dpr); x ? q.lineTo(x, y) : q.moveTo(x, y); }
  q.strokeStyle = 'rgba(239, 227, 200, .9)'; q.lineWidth = 1.2 * dpr; q.stroke();
  q.lineTo(tr.width, tr.height); q.lineTo(0, tr.height); q.closePath(); q.fillStyle = 'rgba(239, 227, 200, .07)'; q.fill();
}
requestAnimationFrame(boucleSpectre);
addEventListener('resize', dessinerEchelle);

// interface de test
window.TEL = { regler: v => regler(v), etat: () => E, f: () => f, auDoigt };
