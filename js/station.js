// La Station : l'écran commun. Toute la logique de la partie vit ici ; les téléphones ne sont que des instruments.
import { lire } from './donnees-lecture.js';
import { Hote, nouveauCode, lienTelephone } from './net.js';
import { Moteur, Descripteur } from './audio.js';
import { CINE } from './cine.js';
import * as atmo from './atmo.js';

const D = lire(window.__D);
const M = window.__M || { sons: [], imgs: [], vids: [] };
const ETUDIANTS = document.body.dataset.version === 'etudiants';
const RACINE = ETUDIANTS ? '' : '../'; // la version de test vit dans un sous-dossier secret
const $ = s => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
const CLE_SAUVE = ETUDIANTS ? 'psp-partie-etu' : 'psp-partie';

// ------------------------------------------------------------------ son ou description
const afficherDescription = d => {
  if (d.type === 'fond') {
    const f = $('#desc-fond'); f.replaceChildren(...d.lignes.map(l => { const p = el('p'); p.append(el('b', null, l.code), ' ', l.texte); return p; }));
  } else {
    const box = $('#desc-evt'); const p = el('p'); p.append(el('b', null, d.code), ' ', d.texte);
    box.prepend(p); while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => p.classList.add('passe'), 4200); setTimeout(() => p.remove(), 5200);
  }
};
const son = ETUDIANTS ? new Descripteur(D.SONS, afficherDescription) : new Moteur(M.sons);

// ------------------------------------------------------------------ état
const BASE_O2 = 100 / (130 * 60);
let S = null;
function nouvelEtat(n) {
  return {
    n, eveilles: D.JOUEURS[n], lieu: 'cryo', ouverts: ['cryo'], cartes: [], defausse: [], vus: [],
    sujets: Object.keys(D.SUJETS).filter(k => D.SUJETS[k].depart), drap: [], o2: 100, temps: 0,
    journaux: [], hist: [], reponses: [], objectif: 'sortir', indices: {}, registre: [], fait: [], minuteurs: [], fin: null,
  };
}
const a = d => S.drap.includes(d);
const poser = d => { if (!a(d)) S.drap.push(d); };
const fait = k => S.fait.includes(k);
const marquer = k => { if (fait(k)) return false; S.fait.push(k); return true; };
function sauver() { try { localStorage.setItem(CLE_SAUVE, JSON.stringify(S)); } catch (_) {} }
function chargerSauvegarde() { try { const s = JSON.parse(localStorage.getItem(CLE_SAUVE)); return s && !s.fin ? s : null; } catch (_) { return null; } }

// ------------------------------------------------------------------ parole (file d'attente : jamais deux voix à la fois)
// dire() se résout sur 'fini', 'coupe' (interrompue en cours) ou 'annule' (retirée de la file avant de commencer)
const file = []; let parle = false, courant = null;
function dire(code, opts = {}) { return new Promise(res => { file.push({ code, opts, res }); majPistes(); if (!parle) suivant(); }); }
async function suivant() {
  const it = file.shift(); if (!it) { parle = false; courant = null; majPistes(); return; }
  parle = true; courant = it;
  it.stop = new Promise(r => { it.arreter = r; });
  const att = ms => Promise.race([attendre(ms), it.stop]);
  majPistes();
  const v = D.VOIX[it.code] || { p: '', t: '' };
  const texte = it.opts.texte || v.t;
  const helios = v.p === 'HÉLIOS';
  if (helios && !it.opts.sansSignature) { await son.jouer('HEL_S1', 'voix', .9); await att(ETUDIANTS ? 500 : 420); }
  if (it.opts.avant) await it.opts.avant();
  if (it.opts.sansSousTitre && !ETUDIANTS) { $('#helios').classList.add('parle'); $('#reponse').classList.add('parle'); } else sousTitre(v.p, texte, it.code);
  const t0 = performance.now();
  if (!it.coupe) await Promise.race([new Promise(r => son.voix(it.code, r)), it.stop]);
  const lu = 900 + texte.length * 62;
  const reste = lu - (performance.now() - t0);
  if (reste > 0 && (ETUDIANTS || !son.existe(it.code))) await att(reste);
  else await att(350);
  if (helios && !it.opts.sansSignature) son.jouer('HEL_S2', 'voix', .9);
  finSousTitre();
  if (it.opts.apres && !it.coupe) await it.opts.apres();
  await attendre(it.coupe ? 150 : it.opts.pause ?? 250);
  it.res(it.coupe ? 'coupe' : 'fini'); suivant();
}
// un journal en cours s'arrête net, ceux qui attendaient leur tour sont retirés
function couperJournaux() {
  for (let i = file.length - 1; i >= 0; i--) if (file[i].opts.journal) { const [x] = file.splice(i, 1); x.res('annule'); }
  if (courant && courant.opts.journal && !courant.coupe) { courant.coupe = true; son.couperVoix(); courant.arreter(); }
  majPistes();
}
let rapide = 1;
const attendre = ms => new Promise(r => setTimeout(r, ms / rapide));
function sousTitre(perso, texte, code) {
  const b = $('#sous-titre');
  b.replaceChildren();
  if (perso) { const n = el('span', 'qui', perso === 'HÉLIOS' ? 'HÉLIOS' : perso === 'ACHARD' ? 'Achard' : perso === 'FERREIRA' ? 'Ferreira' : perso); if (ETUDIANTS) n.append(el('span', 'code', code)); b.append(n); }
  if (texte) b.append(el('span', 'txt', texte)); else b.append(el('span', 'txt nv', '(' + (D.VOIX[code]?.d || '').toLowerCase() + ')'));
  b.classList.add('on');
  $('#helios').classList.toggle('parle', perso === 'HÉLIOS'); $('#reponse').classList.toggle('parle', perso === 'HÉLIOS');
}
function finSousTitre() { $('#sous-titre').classList.remove('on'); $('#helios').classList.remove('parle'); $('#reponse').classList.remove('parle'); }

// HÉLIOS qui affiche sans parler (signature seule)
async function afficheHelios(texte, question) {
  await son.jouer('HEL_S1', 'voix', .9);
  reponseAffichee(question || '', texte);
  setTimeout(() => son.jouer('HEL_S2', 'voix', .9), 700);
}
function reponseAffichee(q, t) {
  const r = $('#reponse');
  r.replaceChildren();
  if (q) r.append(el('p', 'q', q));
  r.append(el('p', 'r', t));
  r.classList.add('on'); document.body.classList.add('rep');
  clearTimeout(r.minuteur); r.minuteur = setTimeout(() => { r.classList.remove('on'); document.body.classList.remove('rep'); }, Math.max(9000, t.length * 95));
  S.reponses.unshift({ q, t }); S.reponses = S.reponses.slice(0, 60);
}

// ------------------------------------------------------------------ décor
const images = {};
function urlImage(nom) { return M.imgs.includes(nom) ? RACINE + 'media/img/' + nom + '.jpg' : null; }
function urlVideo(nom) { return M.vids.includes(nom) ? RACINE + 'media/vid/' + nom + '.mp4' : null; }
function plan(lieu) {
  if (images[lieu]) return images[lieu];
  const p = el('div', 'plan'); p.dataset.lieu = lieu;
  const cadre = el('div', 'cadrage'); p.append(cadre);
  const src = urlImage(lieu);
  if (src) { const i = el('img'); i.src = src; i.alt = ''; i.decoding = 'async'; i.onerror = () => { i.remove(); p.classList.add('vide'); }; cadre.append(i); } else p.classList.add('vide');
  const vsrc = urlVideo(lieu);
  if (vsrc && !ETUDIANTS_SANS_VIDEO) { const v = el('video'); v.src = vsrc; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.addEventListener('canplay', () => v.classList.add('pret')); cadre.append(v); }
  const zones = el('div', 'zones');
  const L = D.LIEUX[lieu];
  for (const z of L.zones) {
    const b = el('button', 'zone' + (z.vers ? ' sortie' : '')); b.type = 'button'; b.dataset.id = z.id;
    Object.assign(b.style, { left: z.x + '%', top: z.y + '%', width: z.l + '%', height: z.h + '%' });
    b.setAttribute('aria-label', z.nom);
    b.addEventListener('click', ev => { ev.stopPropagation(); if ($('#panneau').classList.contains('on')) { fermerPanneau(); return; } dernierPoint = z.x + z.l / 2; zone(z.id); });
    b.addEventListener('pointerenter', ev => etiquette(z.nom, b, ev));
    b.addEventListener('pointermove', ev => etiquette(z.nom, b, ev));
    b.addEventListener('pointerleave', () => etiquette(null));
    zones.append(b);
  }
  for (const n of L.nombres) { const s = el('span', 'nombre', String(n.n)); s.style.left = n.x + '%'; s.style.top = n.y + '%'; s.dataset.n = n.n; zones.append(s); }
  cadre.append(zones);
  $('#decor').append(p);
  images[lieu] = p; return p;
}
const ETUDIANTS_SANS_VIDEO = false;
function etiquette(nom, b, ev) {
  // le nom suit le pointeur, juste sous lui : on voit tout de suite ce qu'on survole
  const e = $('#etiquette');
  if (!nom) { e.classList.remove('on'); return; }
  const r = b.getBoundingClientRect(), ec = $('#ecran').getBoundingClientRect(), k = echelle();
  const x = ev && ev.clientX != null ? ev.clientX : r.left + r.width / 2, y = ev && ev.clientY != null ? ev.clientY : r.top + r.height / 2;
  e.textContent = nom;
  e.style.left = Math.min(1820, Math.max(100, (x - ec.left) / k)) + 'px';
  e.style.top = Math.min(1000, (y - ec.top) / k + 34) + 'px';
  e.classList.add('on');
}
let lieuAffiche = null;
async function aller(lieu, opts = {}) {
  if (!S.ouverts.includes(lieu)) S.ouverts.push(lieu);
  const ancien = lieuAffiche ? images[lieuAffiche] : null;
  const nouveau = plan(lieu);
  fermerPanneau();
  if (ancien && ancien !== nouveau) {
    ancien.classList.add('sort'); ancien.classList.remove('actif');
    const v = ancien.querySelector('video'); setTimeout(() => { v && v.pause(); ancien.classList.remove('sort'); }, 1600);
  }
  nouveau.classList.add('entre'); void nouveau.offsetWidth; nouveau.classList.add('actif'); nouveau.classList.remove('entre');
  const v = nouveau.querySelector('video'); if (v) v.play().catch(() => {});
  lieuAffiche = lieu; S.lieu = lieu;
  $('#lieu-nom').textContent = D.LIEUX[lieu].nom;
  ambiance();
  majNombres();
  sauver();
  if (!opts.silencieux) arrivee(lieu);
}
function ambiance() {
  if (!S) return;
  const L = D.LIEUX[S.lieu];
  const secours = a('panne') && !a('air');
  document.body.classList.toggle('secours', secours);
  atmo.changer(S.lieu, secours);
  son.boucle('amb', secours && L.ambSecours ? L.ambSecours : L.amb, 'amb', 1);
}
function majNombres() {
  document.querySelectorAll('.nombre').forEach(s => s.classList.toggle('pris', S.cartes.includes(+s.dataset.n) || S.defausse.includes(+s.dataset.n)));
}
function echelle() { return +getComputedStyle(document.documentElement).getPropertyValue('--k') || 1; }
function ajuster() {
  const k = Math.min(innerWidth / 1920, innerHeight / 1080);
  document.documentElement.style.setProperty('--k', k);
}
addEventListener('resize', ajuster); ajuster();

// ------------------------------------------------------------------ panneaux (la caméra fait le point sur l'objet)
let dernierPoint = null;
function ouvrirPanneau(contenu, cls = '') {
  const p = $('#panneau');
  // la plaque s'ouvre du côté opposé à l'objet examiné, pour qu'il reste visible à côté
  const cote = cls.includes('large') ? '' : dernierPoint != null && dernierPoint > 55 ? ' a-gauche' : '';
  p.className = 'panneau ' + cls + cote;
  p.replaceChildren(contenu);
  const f = el('button', 'fermer', 'Fermer'); f.type = 'button'; f.addEventListener('click', fermerPanneau);
  contenu.append(f);
  document.body.classList.add('point');
  if (!cls.includes('carte-detail')) $('#plateau').classList.remove('ouvert');
  p.classList.add('on');
  son.jouer('UI_05_1', 'ui', .8);
}
function fermerPanneau() {
  const p = $('#panneau'); if (!p.classList.contains('on')) return;
  p.classList.remove('on'); document.body.classList.remove('point');
  son.jouer('UI_05_2', 'ui', .8);
  if (p.surFermer) { const f = p.surFermer; p.surFermer = null; f(); }
}
// un clic dans le décor, hors de la plaque, la referme aussi
document.addEventListener('click', e => { if (e.target.closest('#decor') && !e.target.closest('.zone')) fermerPanneau(); });
addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#cine').classList.contains('on')) passerCine(); else fermerPanneau(); } });
function plaque(titre, lignes, opts = {}) {
  const d = el('article', 'plaque' + (opts.manuscrit ? ' manuscrit' : ''));
  d.append(el('h2', null, titre));
  for (const l of lignes || []) {
    const p = el('p');
    l.split(/(\*\*[^*]+\*\*)/).forEach(m => { if (m.startsWith('**')) p.append(el('strong', null, m.slice(2, -2))); else if (m) p.append(m); });
    d.append(p);
  }
  if (opts.nombre != null) { const n = el('span', 'nombre grave', String(opts.nombre)); d.append(n); }
  return d;
}
function doc(id, extra) {
  const x = D.DOCS[id];
  const d = plaque(x.titre, x.corps, { manuscrit: x.manuscrit, nombre: extra && extra.nombre });
  if (x.suite) { const b = el('button', 'suite', 'Regarder sous la lampe'); b.type = 'button'; b.addEventListener('click', () => doc(x.suite)); d.append(b); }
  ouvrirPanneau(d);
}
function toast(t) {
  const e = $('#toast'); e.textContent = t; e.classList.add('on');
  clearTimeout(e.m); e.m = setTimeout(() => e.classList.remove('on'), 4200);
}

// ------------------------------------------------------------------ clavier à code
function clavier(titre, sous, longueur, valider, opts = {}) {
  const d = el('article', 'plaque clavier');
  d.append(el('h2', null, titre)); if (sous) d.append(el('p', 'sous', sous));
  const aff = el('output', 'affiche'); let saisie = '';
  const maj = () => { aff.textContent = saisie.padEnd(longueur, '·').split('').join(' '); };
  maj(); d.append(aff);
  const g = el('div', 'touches');
  const presser = k => {
    if (k === '⌫') saisie = saisie.slice(0, -1);
    else if (k === 'OK') { if (!saisie) return; const s = saisie; saisie = ''; maj(); valider(s, aff); return; }
    else if (saisie.length < longueur) saisie += k;
    son.jouer('UI_06', 'ui', .7); maj();
  };
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK']) {
    const b = el('button', 'touche' + (k === 'OK' ? ' ok' : ''), k === '⌫' ? 'Effacer' : k === 'OK' ? 'Valider' : k); b.type = 'button';
    b.addEventListener('click', () => presser(k)); g.append(b);
  }
  d.append(g);
  d.tabIndex = -1;
  d.addEventListener('keydown', e => { if (/^\d$/.test(e.key)) presser(e.key); else if (e.key === 'Backspace') presser('⌫'); else if (e.key === 'Enter') presser('OK'); });
  ouvrirPanneau(d, 'etroit'); setTimeout(() => d.focus(), 50);
  return d;
}
function codeFaux(aff) { son.jouer('UI_08', 'ui'); perte(.5); if (aff) { aff.classList.add('faux'); setTimeout(() => aff.classList.remove('faux'), 700); } }

// ------------------------------------------------------------------ oxygène
function perte(p) { S.o2 = Math.max(0, S.o2 - p); majO2(); }
let derniereCase = 20;
function majO2() {
  const cases = Math.ceil(S.o2 / 5);
  const col = $('#o2-cases');
  [...col.children].forEach((c, i) => { c.classList.toggle('eteinte', 19 - i >= cases); });
  $('#o2-val').textContent = Math.floor(S.o2) + '\u202f%';
  document.body.classList.toggle('o2-bas', S.o2 < 25);
  if (cases < derniereCase && S.temps > 2) son.jouer('UI_12', 'ui', .8);
  derniereCase = cases;
  const niveau = S.o2 > 75 ? 1 : S.o2 > 50 ? 2 : S.o2 > 25 ? 3 : 4;
  if (S.lieu && !S.fin) son.tension(niveau);
  for (const [seuil, code] of [[75, 'HEL_13'], [50, 'HEL_14'], [25, 'HEL_15']]) {
    if (S.o2 <= seuil && marquer('palier' + seuil)) { son.jouer('ALR_01', 'alarme', .9); eclair(); dire(code); }
  }
  majAlerte();
  if (S.o2 < 10 && marquer('critique')) { dire('HEL_16'); son.boucle('alarme', 'ALR_02', 'alarme', .45, .5); }
  if (S.o2 <= 0 && !S.fin) finPartie('X');
  envoyerTelephones();
}
// tant que l'air est en panne ou bas, l'écran le dit : bandeau, halo rouge, perte par minute
function majAlerte() {
  const panne = a('panne') && !a('air') && !S.fin, bas = S.o2 < 25 && !S.fin;
  const b = $('#alerte');
  b.classList.toggle('on', panne || bas);
  $('#alerte-txt').textContent = panne ? 'Alerte · recyclage d\'air en panne · salle des machines' : bas ? 'Alerte · réserve d\'oxygène critique' : '';
  $('#o2-debit').textContent = panne ? '−' + (BASE_O2 * 120).toFixed(1).replace('.', ',') + '\u202f%/min' : '';
}
function eclair() { document.body.classList.remove('eclair'); void document.body.offsetWidth; document.body.classList.add('eclair'); setTimeout(() => document.body.classList.remove('eclair'), 1700); }
let horloge = null, enPause = false, vitesse = 1;
function demarrerHorloge() {
  clearInterval(horloge);
  horloge = setInterval(() => {
    if (enPause || S.fin || $('#cine').classList.contains('on')) return;
    for (let i = 0; i < vitesse; i++) {
      S.temps++;
      S.o2 = Math.max(0, S.o2 - BASE_O2 * (a('panne') && !a('air') ? 2 : 1));
      minuteurs();
    }
    majO2();
    if (S.temps % 5 === 0) sauver();
    if (S.temps % 47 === 0 && Math.random() < .55) son.jouer('AMB_09', 'amb', .8);
    // la panne ne se fait pas oublier : l'alarme revient tant que l'air n'est pas réparé
    if (a('panne') && !a('air') && S.temps % 40 === 0) { son.jouer('ALR_01', 'alarme', .75); eclair(); }
  }, 1000);
}
// événements différés, survivant au rechargement
function plus(sec, quoi) { S.minuteurs.push({ t: S.temps + sec, quoi }); }
function minuteurs() {
  const dus = S.minuteurs.filter(m => m.t <= S.temps);
  if (!dus.length) return;
  S.minuteurs = S.minuteurs.filter(m => m.t > S.temps);
  dus.forEach(m => evenement(m.quoi));
}
function evenement(q) {
  if (q === 'FER_01' || q === 'FER_02' || q === 'FER_03' || q === 'FER_04') return transmission(q);
  if (q === 'panne') return panne();
  if (q === 'secours40' && !a('panne') && S.ouverts.includes('infirmerie')) return panne();
}

// ------------------------------------------------------------------ objectifs, indices
function objectif(id) { S.objectif = id; $('#objectif-txt').textContent = D.OBJECTIFS[id].t; $('#objectif').classList.add('neuf'); setTimeout(() => $('#objectif').classList.remove('neuf'), 2400); sauver(); }
function indice() {
  const o = D.OBJECTIFS[S.objectif]; const n = S.indices[S.objectif] || 0;
  const deja = o.indices.slice(0, n);
  const d = el('article', 'plaque indices');
  d.append(el('h2', null, o.t));
  deja.forEach((t, i) => d.append(el('p', null, t)));
  if (n < o.indices.length) {
    const b = el('button', 'suite', n ? 'Un indice de plus' : 'Demander un indice'); b.type = 'button';
    b.append(el('small', null, ' · −2 % d\'oxygène'));
    b.addEventListener('click', () => { S.indices[S.objectif] = n + 1; perte(2); son.jouer('UI_04', 'ui'); dire('HEL_28'); sauver(); indice(); });
    d.append(b);
  } else d.append(el('p', 'sous', 'HÉLIOS n\'a rien de plus à vous dire sur ce point.'));
  ouvrirPanneau(d, 'etroit');
}

// ------------------------------------------------------------------ cartes
function majPlateau() {
  const r = $('#cartes'); r.replaceChildren();
  for (const n of S.cartes) {
    const c = D.CARTES[n];
    const b = el('button', 'carte'); b.type = 'button'; b.dataset.n = n;
    const im = urlImage('carte-' + n); if (im) { const i = el('img'); i.src = im; i.alt = ''; b.append(i); }
    b.append(el('span', 'num', String(n)), el('span', 'nom', c.nom));
    b.addEventListener('click', () => choisirCarte(n));
    r.append(b);
  }
  $('#plateau-compte').textContent = S.cartes.length ? S.cartes.length + (S.cartes.length > 1 ? ' cartes' : ' carte') : 'Aucune carte';
  majSelection();
}
let selection = [];
function choisirCarte(n) {
  if (selection.includes(n)) selection = selection.filter(x => x !== n);
  else { selection.push(n); if (selection.length > 2) selection.shift(); }
  majSelection();
  if (selection.length === 1 && n === 30) { lecteur(); $('#panneau').surFermer = () => { selection = []; majSelection(); }; return; }
  if (selection.length === 1) {
    const c = D.CARTES[n];
    const d = plaque(n + ' · ' + c.nom, [c.texte]);
    const im = urlImage('carte-' + n); if (im) { const i = el('img', 'illus'); i.src = im; i.alt = ''; d.prepend(i); }
    ouvrirPanneau(d, 'carte-detail');
    $('#panneau').surFermer = () => { selection = []; majSelection(); };
    if (c.sujet) debloquer(c.sujet);
  }
}
function majSelection() {
  document.querySelectorAll('.carte').forEach(b => b.classList.toggle('choisie', selection.includes(+b.dataset.n)));
  const b = $('#assembler');
  b.hidden = selection.length !== 2;
  if (selection.length === 2) b.textContent = 'Assembler ' + selection[0] + ' et ' + selection[1];
}
function piocher(n) {
  n = +n;
  if (S.cartes.includes(n)) { toast('Cette carte est déjà sur la table.'); return; }
  if (S.defausse.includes(n)) { toast('Cette carte a déjà servi.'); return; }
  const visible = [...document.querySelectorAll('.plan.actif .nombre')].some(s => +s.dataset.n === n) || S.vus.includes(n);
  if (!D.CARTES[n] || !visible || D.ASSEMBLAGES[n]) { son.jouer('UI_03', 'ui'); perte(.5); toast('Aucune carte ne porte ce numéro ici.'); return; }
  donnerCarte(n);
}
function donnerCarte(n) {
  if (S.cartes.includes(n) || S.defausse.includes(n)) return;
  S.cartes.push(n); son.jouer('UI_01', 'ui');
  majPlateau(); majNombres(); sauver();
  const b = document.querySelector(`.carte[data-n="${n}"]`); if (b) { b.classList.add('arrive'); setTimeout(() => b.classList.remove('arrive'), 900); }
  $('#plateau').classList.add('ouvert');
  if (D.CARTES[n].sujet) debloquer(D.CARTES[n].sujet);
}
function assembler(x, y) {
  const somme = x + y, r = D.ASSEMBLAGES[somme];
  selection = []; majSelection(); fermerPanneau();
  if (!r || !(r.de.includes(x) && r.de.includes(y))) { son.jouer('UI_03', 'ui'); perte(.5); toast('Ces deux cartes ne vont pas ensemble.'); return; }
  son.jouer('UI_02', 'ui');
  S.cartes = S.cartes.filter(c => c !== x && c !== y); S.defausse.push(x, y);
  majPlateau();
  if (r.ouvre === 'infirmerie') {
    S.ouverts.push('infirmerie'); sauver();
    const d = plaque(D.CARTES[somme].nom, [D.CARTES[somme].texte]); ouvrirPanneau(d, 'etroit');
    son.jouer('MEC_05_1', 'mec');
    if (S.objectif === 'infirmerie') objectif('frigo');
  }
}

// ------------------------------------------------------------------ Terminal : questions à HÉLIOS
function debloquer(id) {
  if (!D.SUJETS[id] || S.sujets.includes(id)) return;
  S.sujets.push(id); sauver();
  telephones('terminal', { t: 'notif', texte: 'Nouveau sujet : ' + D.SUJETS[id].nom });
  envoyerTelephones();
}
function gabarit(t) {
  const n = S.eveilles.length;
  return t.replace('@oxygene', 'Réserve d\'oxygène : ' + Math.floor(S.o2) + ' pour cent.')
    .replace('@eveilles', `${NOMBRES[n][0].toUpperCase() + NOMBRES[n].slice(1)} avec vous : les membres ${S.eveilles.map(m => NOMBRES[m]).join(', ').replace(/, ([^,]*)$/, ' et $1')}. Le docteur Achard, membre cinq, a été réveillé avant vous.`)
    .replace('@minutes', String(Math.max(1, Math.round(S.temps / 60))));
}
let attenteAuto = false;
async function question(sujet, inter) {
  if (S.fin || !S.sujets.includes(sujet)) return;
  const def = D.SUJETS[sujet].q[inter];
  const cle = sujet + '|' + inter;
  const libelle = def ? def.q : `${inter}… ${D.SUJETS[sujet].nom.toLowerCase()} ?`;
  const deja = S.hist.find(h => h.cle === cle);
  telephones('terminal', { t: 'envoye' });
  if (!def) {
    if (!deja) { S.hist.push({ cle, q: libelle, mauvaise: true }); perte(1); }
    sauver(); envoyerTelephones();
    await dire('HEL_08', { avant: () => reponseAffichee(libelle, D.VOIX.HEL_08.t) });
    return;
  }
  const r = def.r.find(x => !x.si || a(x.si));
  if (!deja || deja.variante !== def.r.indexOf(r)) { S.hist = S.hist.filter(h => h.cle !== cle); S.hist.push({ cle, q: libelle, variante: def.r.indexOf(r) }); }
  sauver(); envoyerTelephones();
  if (r.s && !r.t) {
    // le silence d'HÉLIOS
    reponseAffichee(libelle, '…');
    await son.jouer('HEL_S3', 'voix', 1); await attendre(ETUDIANTS ? 1600 : 2000);
    if (marquer('regle')) { dire(r.s); await dire('HEL_07'); }
    else if (Math.random() < .5) await dire(r.s);
    return;
  }
  const texte = gabarit(r.t);
  if (r.v) await dire(r.v, { avant: () => reponseAffichee(libelle, texte), texte: D.VOIX[r.v].t, sansSousTitre: true });
  else await dire('HEL_09', { avant: () => reponseAffichee(libelle, texte) });
  (r.sujets || []).forEach(debloquer);
  if (r.drap) poser(r.drap);
  if (r.autorisation) { attenteAuto = true; telephones('terminal', { t: 'autorisation' }); if (sansTel) terminalLocal(); }
  if (sujet === 'dossier' && a('dossier')) doc('dossier17');
  sauver();
}
async function autorisation(code) {
  if (code === D.AUTORISATION_DOSSIER && S.sujets.includes('dossier')) {
    attenteAuto = false;
    son.jouer('UI_07', 'ui');
    poser('dossier'); sauver();
    await dire('HEL_29');
    doc('dossier17'); son.jouer('STG_03', 'musique');
    await attendre(5000);
    await dire('HEL_21');
    S.ouverts.push('sas'); objectif('sas'); envoyerTelephones();
  } else { son.jouer('UI_08', 'ui'); perte(.5); afficheHelios('Autorisation refusée.'); }
}

// ------------------------------------------------------------------ messages de la Terre
async function transmission(code) {
  if (fait(code)) return; marquer(code);
  await dire('HEL_19');
  son.jouer('RAD_07_1', 'voix');
  son.boucle('controle', 'RAD_08', 'voix', .5, .4);
  await attendre(700);
  await dire(code, { pause: 100 });
  son.boucle('controle', null);
  son.jouer('RAD_07_2', 'voix');
  S.registre.push({ code, t: S.temps }); sauver();
  if (code === 'FER_01') debloquer('ferreira');
  if (code === 'FER_02') debloquer('capsule');
}

// ------------------------------------------------------------------ panne et tuyauterie
async function panne() {
  if (a('panne')) return; poser('panne');
  son.jouer('ALR_01', 'alarme', .9); eclair();
  ambiance();
  await dire('HEL_18');
  debloquer('recyclage');
  objectif('air'); envoyerTelephones(); sauver();
}
function grilleInitiale() {
  return D.TUYAUX.cases.map(c => ({ ...c, r: c.r ?? 0, posee: c.t === 'x' ? null : undefined }));
}
const OUV = { d: [3, 1], c: [3, 2], t: [3, 1, 2], s: [1], o: [3], m: [2] };
function ouvertures(c) {
  const type = c.t === 'x' ? (c.posee ? c.type : null) : c.t === 'v' ? null : c.t;
  if (!type) return [];
  const r = (type === 's' || type === 'o' || type === 'm') ? 0 : c.r;
  return OUV[type].map(d => (d + r) % 4);
}
function verifierCircuit(g) {
  const at = (x, y) => g.find(c => c.x === x && c.y === y);
  const pas = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const src = g.find(c => c.t === 's');
  const vus = new Set([src]), pile = [src]; let fuite = false, sortie = false, mc = false;
  while (pile.length) {
    const c = pile.pop();
    for (const d of ouvertures(c)) {
      const v = at(c.x + pas[d][0], c.y + pas[d][1]);
      if (!v || !ouvertures(v).includes((d + 2) % 4)) { fuite = true; continue; }
      if (v.t === 'o') sortie = true;
      if (v.t === 'm') { if (S.v2 !== false) mc = true; continue; }
      if (!vus.has(v)) { vus.add(v); pile.push(v); }
    }
  }
  return { ok: sortie && !fuite && !mc, sortie, fuite, mc };
}
function tuyauterie() {
  // hors panne, le pupitre dit simplement l'état du circuit : rien à régler, et rien à confondre avec le plan
  if (!a('panne')) return ouvrirPanneau(plaque('Pupitre du recyclage', ['Circuit en service. Pression nominale, aucune alarme.', 'Les sections de tuyauterie sont verrouillées tant que le circuit fonctionne.']), 'etroit');
  if (a('air')) return ouvrirPanneau(plaque('Pupitre du recyclage', ['Circuit rétabli. Débit nominal.', 'Vanne V2 : ' + (S.v2 ? 'ouverte, l\'air part aussi vers le module central.' : 'fermée, module central isolé.')]), 'etroit');
  if (!S.grille) S.grille = grilleInitiale();
  if (S.v2 === undefined) S.v2 = true;
  const d = el('article', 'plaque tuyaux');
  d.append(el('h2', null, 'Pupitre du recyclage'));
  d.append(el('p', 'sous', 'Faites pivoter les sections. Posez les pièces manquantes depuis vos cartes. Puis mettez en pression.'));
  const G = el('div', 'grille'); G.style.setProperty('--l', D.TUYAUX.l); G.style.setProperty('--h', D.TUYAUX.h);
  const dessiner = () => {
    G.replaceChildren();
    for (let y = 0; y < D.TUYAUX.h; y++) for (let x = 0; x < D.TUYAUX.l; x++) {
      const c = S.grille.find(k => k.x === x && k.y === y);
      const b = el('button', 'case'); b.type = 'button';
      if (!c) { b.classList.add('nue'); b.disabled = true; G.append(b); continue; }
      b.classList.add('t-' + (c.t === 'x' ? (c.posee ? c.type : 'x') : c.t));
      if (c.t === 'm') { b.classList.add(S.v2 ? 'v-ouverte' : 'v-fermee'); b.title = 'Vanne V2 · module central'; }
      b.style.setProperty('--r', (c.t === 'x' && !c.posee) ? 0 : c.r);
      b.innerHTML = svgTuyau(c);
      // les trois points fixes portent leur nom dans la grille, flèche dans le sens de l'air
      const nom = { s: 'Réservoir →', o: '→ Distribution', m: 'V2 · module central' }[c.t];
      if (nom) b.append(el('span', 'etiq', nom));
      b.addEventListener('click', () => {
        if (c.t === 'm') { S.v2 = !S.v2; son.jouer(S.v2 ? 'MEC_03_1' : 'MEC_03_2', 'mec'); dessiner(); sauver(); return; }
        if (c.t === 's' || c.t === 'o') return;
        if (c.t === 'x' && !c.posee) {
          if (S.cartes.includes(c.piece)) {
            c.posee = true; c.r = Math.floor(Math.random() * 4);
            S.cartes = S.cartes.filter(n => n !== c.piece); S.defausse.push(c.piece); selection = [];
            majPlateau(); son.jouer('MEC_02', 'mec'); dessiner(); sauver();
          } else { son.jouer('MEC_06', 'mec'); toast(S.cartes.some(n => n === 14 || n === 22) ? 'Cette pièce ne s\'emboîte pas ici.' : 'Il manque une pièce à cet endroit.'); }
          return;
        }
        c.r = (c.r + 1) % 4; son.jouer('MEC_01', 'mec', .8);
        b.style.setProperty('--r', c.r); sauver();
      });
      G.append(b);
    }
  };
  dessiner();
  d.append(G);
  const leg = el('p', 'legende'); leg.append(el('span', 'l-src', 'Réservoir'), el('span', 'l-mc', 'V2 · module central'), el('span', 'l-out', 'Distribution'));
  d.append(leg);
  const go = el('button', 'suite', 'Mettre en pression'); go.type = 'button';
  go.addEventListener('click', async () => {
    const v = verifierCircuit(S.grille);
    if (v.ok) {
      poser('air'); sauver();
      son.jouer('MEC_04', 'mec');
      fermerPanneau();
      await attendre(2500);
      ambiance();
      await dire('HEL_17');
      envoyerTelephones();
      objectif('radio');
      plus(25, 'FER_03');
    } else { son.jouer('UI_08', 'ui'); perte(1); dire('HEL_18'); if (v.mc) toast('L\'air part vers le module central.'); }
  });
  d.append(go);
  ouvrirPanneau(d, 'large');
}
function svgTuyau(c) {
  const type = c.t === 'x' ? (c.posee ? c.type : 'x') : c.t;
  const tube = 'class="tube"';
  const bras = { 0: 'M50 50 V0', 1: 'M50 50 H100', 2: 'M50 50 V100', 3: 'M50 50 H0' };
  const dirs = { d: [3, 1], c: [3, 2], t: [3, 1, 2], s: [1], o: [3], m: [2] }[type];
  if (type === 'x') return '<svg viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="6" class="manque"/></svg>';
  const chemins = dirs.map(d => `<path d="${bras[d]}" ${tube}/>`).join('');
  const centre = type === 's' ? '<circle cx="50" cy="50" r="24" class="bout"/>' : type === 'o' ? '<rect x="26" y="26" width="48" height="48" rx="4" class="bout"/>' : type === 'm' ? '<circle cx="50" cy="50" r="22" class="vanne"/><path d="M34 50 H66" class="volant"/>' : '<circle cx="50" cy="50" r="9" class="joint"/>';
  return `<svg viewBox="0 0 100 100" class="${type === 's' || type === 'o' || type === 'm' ? 'fixe' : 'rotatif'}">${chemins}${centre}</svg>`;
}

// ------------------------------------------------------------------ lecteur de journaux
const JOURNAUX = [['ACH_J01', 1], ['ACH_J03', 3], ['ACH_J06', 6], ['ACH_J09', 9], ['ACH_J12', 12], ['ACH_J15', 15], ['ACH_J18', 18], ['ACH_J21', 21]];
function lecteur() {
  debloquer('journaux');
  const d = el('article', 'plaque lecteur');
  d.append(el('h2', null, 'Journaux médicaux · Dr S. Achard'));
  if (S.lieu !== 'infirmerie') d.append(el('p', 'sous', 'Sur la tablette du docteur.'));
  const l = el('ol', 'pistes');
  for (const [code, jour] of JOURNAUX) {
    const dispo = jour <= 9 || S.cartes.includes(30) || S.defausse.includes(30) || a('tablette');
    const li = el('li'); const b = el('button', 'piste'); b.type = 'button'; b.disabled = !dispo; b.dataset.code = code;
    b.append(el('span', 'jour', 'Jour ' + jour), el('span', 'etat', !dispo ? 'non synchronisé' : ''));
    // un clic lance ce jour et coupe celui qui passe ; un clic sur le jour en cours l'arrête
    b.addEventListener('click', async () => {
      const enCours = courant && courant.opts.journal && !courant.coupe && courant.code === code;
      couperJournaux();
      son.jouer(enCours ? 'MEC_10_2' : 'MEC_10_1', 'mec');
      if (enCours) return;
      const r = await dire(code, { journal: true });
      if (r === 'annule') return;
      if (r === 'fini') son.jouer('MEC_10_2', 'mec');
      if (!S.journaux.includes(code)) S.journaux.push(code);
      majPistes();
      if (code === 'ACH_J01') { debloquer('labo'); debloquer('carotte'); }
      if (code === 'ACH_J03') debloquer('six');
      if (S.journaux.length >= 2) plusUneFois('FER_02', 8);
      sauver();
    });
    li.append(b); l.append(li);
  }
  d.append(l);
  d.append(el('p', 'sous', 'Touchez un jour pour l\'écouter. Un autre jour coupe celui en cours ; le même jour l\'arrête.'));
  ouvrirPanneau(d, 'etroit');
  majPistes();
}
// l'état de chaque piste suit la file de parole : en lecture, en attente d'une autre voix, écoutée
function majPistes() {
  if (!S) return;
  document.querySelectorAll('.piste[data-code]').forEach(b => {
    const c = b.dataset.code, e = b.querySelector('.etat');
    const lit = !!(courant && courant.opts.journal && !courant.coupe && courant.code === c);
    const attend = file.some(x => x.opts.journal && x.code === c);
    b.classList.toggle('lit', lit);
    if (!b.disabled) e.textContent = lit ? 'en lecture' : attend ? 'en attente' : S.journaux.includes(c) ? 'écouté' : '';
  });
}
function plusUneFois(quoi, sec) { if (!fait('prog-' + quoi)) { marquer('prog-' + quoi); plus(sec, quoi); } }

// ------------------------------------------------------------------ zones
async function zone(id) {
  if (S.fin) return;
  etiquette(null);
  const L = D.LIEUX[S.lieu]; const z = L.zones.find(k => k.id === id);
  if (z && z.vers) { son.jouer('MEC_05_1', 'mec', .7); return aller(z.vers); }
  const n = id.match(/^caisson(\d)$/);
  if (n) return caisson(+n[1]);
  switch (id) {
    case 'protocole': case 'protocole_droite': return doc('protocole');
    case 'registre_caissons': return registreCaissons();
    case 'porte_cryo':
      if (S.ouverts.includes('coursive')) { son.jouer('MEC_05_1', 'mec'); return aller('coursive'); }
      return clavier('Sortie du module de cryogénie', 'Protocole de réveil anticipé : saisissez les numéros de tous les caissons ouverts, dans l\'ordre croissant.', 6, async (v, aff) => {
        if (v === D.CODES.porte_cryo[S.n]) {
          son.jouer('UI_07', 'ui'); fermerPanneau(); debloquer('achard');
          await attendre(500); son.jouer('MEC_05_1', 'mec');
          aller('coursive');
          afficheHelios('Caisson cinq ouvert. Membre cinq absent.');
          objectif('infirmerie'); plus(30, 'FER_01');
        } else codeFaux(aff);
      });
    case 'porte_infirmerie':
      if (S.ouverts.includes('infirmerie')) { son.jouer('MEC_05_1', 'mec'); return aller('infirmerie'); }
      son.jouer('MEC_06', 'mec'); return toast('Lecteur de badge. Accès réservé au personnel médical.');
    case 'porte_machines': son.jouer('MEC_05_1', 'mec'); return aller('machines');
    case 'porte_radio':
      if (a('air')) { son.jouer('MEC_05_1', 'mec'); return aller('radio'); }
      son.jouer('MEC_06', 'mec'); return toast('Module radio hors tension. L\'énergie de secours est réservée au recyclage d\'air.');
    case 'porte_sas':
      if (a('dossier')) { son.jouer('MEC_05_1', 'mec'); return aller('sas'); }
      son.jouer('MEC_06', 'mec');
      if (marquer('refus-sas')) return dire('HEL_04');
      return son.jouer('HEL_S3', 'voix');
    case 'casier': S.vus.includes(22) || S.vus.push(22); sauver(); return ouvrirPanneau(plaque('Casier de maintenance', ['Des chiffons, un rouleau d\'adhésif, une lampe sans pile. Au fond, une pièce de tuyauterie rayée, étiquetée.'], { nombre: S.cartes.includes(22) || S.defausse.includes(22) ? null : 22 }), 'etroit');
    case 'hublot': return doc('hublot');
    case 'lecteur': return lecteur();
    case 'tableau': debloquer('quarantaine'); return tableauQuarantaine();
    case 'frigo':
      if (a('frigo')) return frigoOuvert();
      return clavier('Réfrigérateur à échantillons', 'Code de sécurité modifié par S. Achard, jour 3', 4, async (v, aff) => {
        if (v === D.CODES.frigo) {
          son.jouer('UI_07', 'ui'); poser('frigo'); fermerPanneau();
          son.jouer('MEC_08', 'mec'); await attendre(900);
          frigoOuvert(); son.jouer('STG_01', 'musique');
          debloquer('carotte');
          if (!a('panne')) plus(28, 'panne');
          sauver();
        } else codeFaux(aff);
      });
    case 'bureau': return doc('bureau');
    case 'photo': return doc('photo');
    case 'scanner': return doc('scanner');
    case 'pupitre': return tuyauterie();
    case 'plan': return doc('plan');
    case 'cuve': return reservoir();
    case 'console': return doc('console');
    case 'ampli':
      if (!a('ampli')) { poser('ampli'); son.jouer('MEC_03_1', 'mec'); sauver(); envoyerTelephones(); debloquer('canal'); }
      return ouvrirPanneau(plaque('Amplificateur de bande', ['En service. La radio portative capte désormais toute la bande, de 118 à 148 MHz, y compris les canaux réservés.']), 'etroit');
    case 'registre': return registre();
    case 'tiroir': S.vus.includes(25) || S.vus.push(25); sauver(); return ouvrirPanneau(plaque('Tiroir de la console', ['Des écouteurs de rechange, un câble. Une note de service pliée, au papier épais, numérotée.'], { nombre: S.cartes.includes(25) || S.defausse.includes(25) ? null : 25 }), 'etroit');
    case 'vitre': son.jouer('ACH_NV08', 'voix'); return ouvrirPanneau(plaque('La vitre', [a('tablette') ? 'Le docteur Achard s\'est assis contre la paroi. Il garde les yeux ouverts.' : 'La vitre est froide. Derrière la buée, un homme est assis, la tête basse. Il respire.']), 'etroit');
    case 'interphone': return interphone();
    case 'passe': return a('tablette') ? ouvrirPanneau(plaque('Passe-échantillons', ['Vide. Le docteur y a glissé sa tablette.']), 'etroit') : ouvrirPanneau(plaque('Passe-échantillons', ['Une trappe à double porte sous la vitre. Elle ne s\'ouvre que de l\'intérieur.']), 'etroit');
    case 'scanner_sas': return controleBio();
    case 'autorisation': return pupitreAutorisation();
  }
}
function caisson(i) {
  const eveille = S.eveilles.includes(i), role = D.ROLES[i];
  let lignes;
  if (i === 1) { lignes = ['Occupé. Commandante Irène Vasseur.', 'Sommeil stable. Réveil impossible : défaut du circuit de réanimation.']; debloquer('commandante'); }
  else if (i === 5) { lignes = ['Ouvert de l\'intérieur. Vide.', 'Dr Samuel Achard, médecine.', 'Réveil : il y a 21 jours, à 03 h 10. Aucun retour enregistré.']; if (S.ouverts.includes('coursive')) debloquer('achard'); }
  else if (eveille) {
    lignes = ['Ouvert. Membre d\'équipage ' + NOMBRES[i] + ', ' + role.toLowerCase() + '.', D.FICHES[i], 'Réveil : il y a ' + Math.max(1, Math.round(S.temps / 60)) + ' min.', '**Code d\'autorisation individuel : ' + D.CODES_PERSO[i] + '**'];
    if (i === 6) { lignes.push('Journal des capteurs · jour 3, 02 h 51 · taux anormaux · alerte acquittée par S. Achard.'); debloquer('six'); }
  } else lignes = ['Occupé. Membre d\'équipage ' + NOMBRES[i] + ', ' + role.toLowerCase() + '.', ...(D.FICHES[i] ? [D.FICHES[i]] : []), 'Sommeil normal. Réveil prévu dans 21 jours.'];
  ouvrirPanneau(plaque('Caisson ' + i, lignes), 'etroit caisson');
}
// le réservoir : une jauge à aiguille, et ce qui fait baisser l'air
function reservoir() {
  const d = el('article', 'plaque reservoir');
  d.append(el('h2', null, 'Réservoir d\'oxygène'));
  const angle = -120 + 240 * S.o2 / 100;
  const g = el('div', 'jauge-o2');
  g.innerHTML = `<svg viewBox="0 0 200 130" aria-hidden="true"><path d="M27 115 A82 82 0 1 1 173 115" class="arc"/><path d="M27 115 A82 82 0 0 1 36 72" class="arc rouge"/><g transform="rotate(${angle} 100 90)"><path d="M100 90 L100 22" class="aiguille"/><path d="M93 30 L100 14 L107 30 Z" class="pointe"/></g><circle cx="100" cy="90" r="7" class="axe"/></svg>`;
  g.append(el('output', null, Math.floor(S.o2) + ' %'));
  d.append(g);
  const panne = a('panne') && !a('air');
  const parMin = (BASE_O2 * 60 * (panne ? 2 : 1)).toFixed(1).replace('.', ',');
  const reste = Math.floor(S.o2 / (BASE_O2 * (panne ? 2 : 1)) / 60);
  d.append(el('p', panne ? 'alerte' : null, 'Consommation : ' + parMin + ' % par minute' + (panne ? ', le double de la normale : le recyclage est en panne.' : '.') + ' À ce rythme, il reste environ ' + reste + ' minutes d\'air.'));
  d.append(el('p', 'sous', 'Ce qui coûte de l\'air en plus : une question inutile à HÉLIOS (−1 %), un code ou un assemblage faux (−0,5 %), un indice (−2 %).'));
  d.append(el('p', 'sous', 'Sur la cuve, une plaque gravée : « Perséphone, mise en service 2071 ».'));
  ouvrirPanneau(d, 'etroit');
}
function registreCaissons() {
  const d = el('article', 'plaque plan-station');
  d.append(el('h2', null, 'Borne de la sortie'));
  D.DOCS.protocole.corps.forEach(t => { const p = el('p'); t.split(/(\*\*[^*]+\*\*)/).forEach(m => { if (m.startsWith('**')) p.append(el('strong', null, m.slice(2, -2))); else if (m) p.append(m); }); d.append(p); });
  d.append(el('h3', null, 'État des caissons'));
  const l = el('div', 'lieux');
  for (let i = 1; i <= 6; i++) {
    const ouvert = i === 5 || S.eveilles.includes(i);
    const b = el('button', null, 'Caisson ' + i + ' · ' + (ouvert ? 'ouvert' : 'occupé')); b.type = 'button';
    b.addEventListener('click', () => caisson(i)); l.append(b);
  }
  d.append(l);
  ouvrirPanneau(d, 'etroit');
}
function tableauQuarantaine() {
  const d = el('article', 'plaque tableau');
  d.append(el('h2', null, 'Tableau de quarantaine'));
  const t = el('table');
  const lignes = [['Membre', 'État', 'Marqueurs']];
  for (let i = 1; i <= 6; i++) {
    const etat = i === 1 ? 'Sommeil · réveil impossible' : i === 5 ? 'Hors caisson · isolé MC' : S.eveilles.includes(i) ? 'Réveillé' : 'Sommeil';
    const mq = i === 5 ? 'Positifs · J+12 : aggravation' : i === 6 ? (a('revelation') ? 'Positifs · stade précoce' : 'Analyse en attente') : '—';
    lignes.push([String(i), etat, mq]);
  }
  lignes.forEach((r, k) => { const tr = el('tr'); r.forEach(c => tr.append(el(k ? 'td' : 'th', null, c))); t.append(tr); });
  d.append(t);
  const e = el('table', 'echantillons');
  [['Échantillon', 'Statut'], ['C-15', 'Réfrigérateur'], ['C-16', 'Réfrigérateur'], ['C-17', 'Confinement rompu · J1 03:02 · laboratoire MC'], ['C-18', 'Réfrigérateur']].forEach((r, k) => { const tr = el('tr'); r.forEach(c => tr.append(el(k ? 'td' : 'th', null, c))); e.append(tr); });
  d.append(e);
  ouvrirPanneau(d, 'large');
}
function frigoOuvert() {
  S.vus.includes(17) || S.vus.push(17);
  ouvrirPanneau(plaque('Réfrigérateur à échantillons', ['Des rangées de tubes dans leurs supports de laiton, givrés. Un emplacement est vide, son étiquette encore en place.'], { nombre: S.cartes.includes(17) || S.defausse.includes(17) ? null : 17 }), 'etroit');
}
function registre() {
  const d = el('article', 'plaque registre');
  d.append(el('h2', null, 'Registre des messages reçus'));
  if (!S.registre.length) d.append(el('p', 'sous', 'Aucun message.'));
  for (const m of S.registre) {
    const p = el('div', 'msg'); p.append(el('p', 'quand', 'Reçu il y a ' + Math.max(1, Math.round((S.temps - m.t) / 60)) + ' min · délai 11 min'), el('p', null, D.VOIX[m.code].t));
    d.append(p);
  }
  ouvrirPanneau(d);
}

// ------------------------------------------------------------------ le sas
function interphone() {
  if (a('tablette')) {
    son.jouer('MEC_09_1', 'mec');
    if (a('revelation')) dire('ACH_I04'); else son.jouer('ACH_NV0' + (1 + Math.floor(Math.random() * 5)), 'voix');
    return;
  }
  const premier = marquer('interphone');
  son.jouer('MEC_09_1', 'mec');
  const ouvrir = () => clavier('Interphone', 'Répondre au docteur', 1, async (v, aff) => {
    if (+v === S.eveilles.length) {
      fermerPanneau();
      await dire('ACH_NV01');
      await dire('ACH_I02');
      await dire('ACH_I03', { pause: 900 });
      son.jouer('MEC_08', 'mec'); await attendre(1400);
      poser('tablette'); donnerCarte(30);
      toast('Le docteur glisse sa tablette par le passe-échantillons.');
      son.jouer('MEC_09_2', 'mec');
      sauver();
    } else { son.jouer('UI_08', 'ui'); dire('ACH_NV06'); }
  });
  if (premier) { dire('HEL_23').then(() => dire('ACH_I01')).then(ouvrir); }
  else dire('ACH_I01').then(ouvrir);
}
function controleBio() {
  if (a('revelation')) return ouvrirPanneau(plaque('Contrôle biologique', ['Analyse terminée.', 'Membre six : marqueurs de la contamination, stade précoce.']), 'etroit');
  const nouveaux = ['ACH_J12', 'ACH_J15', 'ACH_J18', 'ACH_J21'].filter(j => S.journaux.includes(j)).length;
  if (!a('tablette') || nouveaux < 2) return ouvrirPanneau(plaque('Contrôle biologique', ['Analyse transférée ici par le Dr Achard. En attente.', a('tablette') ? 'Les journaux du médecin, sur la tablette, précèdent l\'analyse.' : 'Le médecin de bord doit d\'abord la demander.']), 'etroit');
  // avec un téléphone, chaque membre pose le pouce sur le Terminal ; sans téléphone, sur la plaque de la station
  const auTel = !sansTel && [...roles.entries()].some(([id, r]) => r !== 'radio' && hote.liens.has(id));
  if (!bio) { bio = new Set(); envoyerTelephones(); }
  const d = el('article', 'plaque bio');
  d.append(el('h2', null, 'Contrôle biologique'), el('p', 'sous', auTel ? 'L\'analyse se fait sur le Terminal : chaque membre, à son tour, pose le pouce sur l\'écran du téléphone et le garde.' : 'Chaque membre présent pose la main sur la plaque.'));
  const r = el('div', 'mains');
  for (const m of S.eveilles) {
    const b = el('button', 'main' + (bio.has(m) ? ' posee' : '')); b.type = 'button'; b.dataset.m = m; b.disabled = auTel;
    b.append(el('span', 'num', String(m)), el('span', null, 'Membre ' + NOMBRES[m]));
    b.addEventListener('click', () => mainPosee(m));
    r.append(b);
  }
  d.append(r);
  ouvrirPanneau(d, 'etroit');
  if (auTel) telephones('terminal', { t: 'notif', texte: 'Contrôle biologique : posez le pouce, chacun votre tour.' });
}
let bio = null; // membres déjà passés au contrôle biologique, tant que l'analyse est ouverte
async function mainPosee(m) {
  if (!bio || bio.has(m) || !S.eveilles.includes(m) || a('revelation')) return;
  bio.add(m); son.jouer('UI_02', 'ui', .7);
  document.querySelectorAll(`.main[data-m="${m}"]`).forEach(b => b.classList.add('posee'));
  envoyerTelephones();
  if (bio.size < S.eveilles.length) return;
  if (!$('.plaque.bio')) controleBio();
  $('.plaque.bio').append(el('p', 'analyse', 'Analyse en cours…'));
  await attendre(5000);
  fermerPanneau();
  bio = null;
  poser('revelation'); sauver(); envoyerTelephones();
  son.jouer('ALR_03', 'alarme'); eclair();
  await attendre(1200);
  await dire('HEL_22');
  debloquer('contamination');
  await attendre(1800);
  await dire('ACH_NV02');
  await dire('ACH_I07', { pause: 900 });
  await dire('ACH_I04', { pause: 1200 });
  await dire('HEL_24');
  await dire('HEL_25');
  son.boucle('musique', 'MUS_01', 'musique', .9, 4);
  objectif('choix'); envoyerTelephones();
}
function pupitreAutorisation() {
  if (!a('revelation')) { son.jouer('HEL_S3', 'voix'); return ouvrirPanneau(plaque('Pupitre d\'autorisation', ['Aucune décision en attente.']), 'etroit'); }
  const d = el('article', 'plaque autorisation');
  d.append(el('h2', null, 'Deux autorisations'));
  d.append(el('p', 'sous', 'Deux membres, chacun avec son code individuel. Les deux choix doivent concorder.'));
  const fentes = [{}, {}];
  const zoneF = el('div', 'fentes');
  const dessiner = () => {
    zoneF.replaceChildren();
    fentes.forEach((f, k) => {
      const c = el('section', 'fente' + (f.ok ? ' ok' : ''));
      c.append(el('h3', null, 'Autorisation ' + (k + 1)));
      if (f.ok) { c.append(el('p', null, 'Membre ' + NOMBRES[f.m] + ' · ' + (f.choix === 'A' ? 'Évacuer la station' : 'Maintenir la quarantaine'))); zoneF.append(c); return; }
      const ms = el('div', 'choix-membre');
      S.eveilles.forEach(m => { if (fentes[1 - k].m === m && fentes[1 - k].ok) return; const b = el('button', f.m === m ? 'on' : '', 'Membre ' + m); b.type = 'button'; b.addEventListener('click', () => { f.m = m; dessiner(); }); ms.append(b); });
      c.append(ms);
      const inp = el('input'); inp.inputMode = 'numeric'; inp.maxLength = 4; inp.placeholder = 'Code'; inp.value = f.code || ''; inp.autocomplete = 'off';
      inp.addEventListener('input', () => { f.code = inp.value.replace(/\D/g, ''); inp.value = f.code; });
      c.append(inp);
      const cx = el('div', 'choix-fin');
      [['A', 'Évacuer la station'], ['B', 'Maintenir la quarantaine']].forEach(([v, t]) => { const b = el('button', f.choix === v ? 'on' : '', t); b.type = 'button'; b.addEventListener('click', () => { f.choix = v; dessiner(); }); cx.append(b); });
      c.append(cx);
      const ok = el('button', 'suite', 'Autoriser'); ok.type = 'button';
      ok.addEventListener('click', async () => {
        if (!f.m || !f.choix || f.code !== D.CODES_PERSO[f.m]) { codeFaux(); return; }
        f.ok = true; son.jouer('UI_07', 'ui'); dessiner();
        await dire('HEL_26');
        if (fentes.every(x => x.ok)) {
          if (fentes[0].choix === fentes[1].choix) { fermerPanneau(); finPartie(fentes[0].choix); }
          else { await dire('HEL_27'); fentes[0] = {}; fentes[1] = {}; dessiner(); }
        }
      });
      c.append(ok);
      zoneF.append(c);
    });
  };
  dessiner(); d.append(zoneF);
  ouvrirPanneau(d, 'large');
}

// ------------------------------------------------------------------ arrivée dans un lieu
function arrivee(lieu) {
  if (lieu === 'radio' && marquer('entree-radio')) plus(240, 'FER_04');
  if (lieu === 'sas' && marquer('entree-sas')) { son.jouer('MEC_07', 'mec'); }
  if (lieu === 'infirmerie' && marquer('entree-inf')) plus(40 * 60 - Math.min(S.temps, 40 * 60) + 60, 'secours40');
}

// ------------------------------------------------------------------ radio (messages venant du téléphone)
async function diffusion() {
  if (!a('ampli') || a('fer05')) return;
  poser('fer05'); sauver();
  son.jouer('RAD_09', 'voix');
  await attendre(1500);
  await dire('FER_05', { pause: 1500 });
  S.registre.push({ code: 'FER_05', t: S.temps });
  await dire('HEL_20');
  son.jouer('STG_02', 'musique');
  debloquer('dossier'); debloquer('tellus');
  objectif('dossier'); envoyerTelephones();
}

// ------------------------------------------------------------------ téléphones
let hote = null, sansTel = false;
const roles = new Map(); // id → 'terminal' | 'radio' | 'les-deux'
function etatPour(role) {
  return {
    t: 'etat', role, etudiants: ETUDIANTS, o2: Math.floor(S ? S.o2 : 100), enJeu: !!(S && S.lieu && !S.fin && demarre),
    sujets: S ? S.sujets.map(k => ({ id: k, nom: D.SUJETS[k].nom })) : [], inter: D.INTERROGATIFS,
    hist: S ? S.hist.map(h => ({ cle: h.cle, q: h.q, mauvaise: !!h.mauvaise })) : [],
    // la radio capte dès qu'elle est reliée, avant même le départ : sans état de partie, rien d'amplifié, phase « avant »
    radio: { ampli: !!S && a('ampli'), phase: S && a('air') ? 'apres' : S && a('panne') ? 'panne' : 'avant', trouve: !!S && a('fer05'), canaux: D.RADIO.canaux, min: D.RADIO.min, max: D.RADIO.max, largeur: D.RADIO.largeur, accroche: D.RADIO.accroche, telemetrie: D.TELEMETRIE, sons: D.SONS, prive: D.VOIX.FER_05.t },
    attenteAuto, fin: S && S.fin,
    bio: role !== 'radio' && S && bio ? { membres: S.eveilles, poses: [...bio] } : null, sons: ETUDIANTS ? null : { sons: M.sons.filter(c => /^(UI_09|UI_10|UI_11|UI_13|MEC_11|RAD_|FER_05_TEL)/.test(c)), dossier: M.dossier },
  };
}
function envoyerTelephones() { if (!hote) return; for (const [id, role] of roles) hote.envoyer(id, etatPour(role)); majLobby(); }
function telephones(role, m) { if (!hote) return; for (const [id, r] of roles) if (r === role || r === 'les-deux') hote.envoyer(id, m); }
function brancher() {
  const code = (() => { try { return sessionStorage.getItem('psp-code') || nouveauCode(); } catch (_) { return nouveauCode(); } })();
  try { sessionStorage.setItem('psp-code', code); } catch (_) {}
  hote = new Hote(code, {
    ouvert: () => majLobby(),
    arrivee: (id, d) => { roles.set(id, d.role || 'les-deux'); son.jouer('UI_13', 'ui'); hote.envoyer(id, etatPour(roles.get(id))); majLobby(); },
    depart: id => { majLobby(); },
    message: (id, m) => {
      if (!S) return;
      if (m.t === 'q') question(m.sujet, m.inter);
      else if (m.t === 'auto') autorisation(m.code);
      else if (m.t === 'diffuser') diffusion();
      else if (m.t === 'main') mainPosee(+m.m);
      else if (m.t === 'revoir') { const h = S.hist.find(x => x.cle === m.cle); if (h) { const [s, i] = h.cle.split('|'); question(s, i); } }
    },
  });
  hote.code = code;
}

// ------------------------------------------------------------------ accueil
let demarre = false;
function majLobby() {
  if (!hote) return;
  const n = S ? S.n : choixJoueurs;
  const deux = n === 2;
  const voulus = deux ? ['les-deux'] : ['terminal', 'radio'];
  const mb = $('#membres'); if (mb) { const e = D.JOUEURS[n]; mb.textContent = 'Membres ' + e.slice(0, -1).join(', ') + ' et ' + e[e.length - 1] + ' · un joueur par membre'; }
  const box = $('#qr'); box.replaceChildren();
  for (const r of voulus) {
    const c = el('figure', 'qr-role');
    const lien = lienTelephone(hote.code) + '&r=' + r;
    const z = el('div', 'qr-code'); c.append(z);
    try { new QRCode(z, { text: lien, width: 150, height: 150, colorDark: '#1c2230', colorLight: '#eee8de', correctLevel: QRCode.CorrectLevel.M }); } catch (_) {}
    const connecte = [...roles.entries()].some(([id, ro]) => ro === r && hote.liens.has(id));
    c.append(el('figcaption', connecte ? 'connecte' : '', (r === 'les-deux' ? 'Terminal et radio' : r === 'terminal' ? 'Terminal' : 'Radio') + (connecte ? ' · connecté' : '')));
    box.append(c);
  }
  $('#code-station').textContent = hote.code;
  if (!demarre) consigneTel();
}
const telRelies = () => hote ? [...roles.keys()].filter(id => hote.liens.has(id)).length : 0;
// avant le réveil : dire quoi faire du QR code, et prévenir si personne ne l'a scanné
let avertiSansTel = false;
function consigneTel() {
  const c = $('#consigne-tel'); if (!c) return;
  const n = S ? S.n : choixJoueurs, relies = telRelies();
  c.classList.toggle('alerte', avertiSansTel && !relies);
  if (sansTel) { c.textContent = 'Essai sans téléphone : le Terminal et la Radio s\'ouvrent sur la station.'; return; }
  if (avertiSansTel && !relies) { c.textContent = 'Aucun téléphone n\'est relié. Scannez le code, ou touchez « Réveiller l\'équipage » une seconde fois pour jouer sans téléphone.'; return; }
  c.replaceChildren();
  const deux = n !== 2;
  if (relies >= (deux ? 2 : 1)) { c.append(el('b', null, deux ? 'Les deux téléphones sont reliés.' : 'Le téléphone est relié.'), ' Vous pouvez réveiller l\'équipage.'); return; }
  c.append(el('b', null, 'Avant de commencer : '), deux
    ? 'scannez chaque code avec l\'appareil photo d\'un téléphone, un pour le Terminal et un pour la Radio, puis touchez « Activer l\'instrument » sur chacun.'
    : 'scannez ce code avec l\'appareil photo d\'un téléphone, puis touchez « Activer l\'instrument ».');
}
let choixJoueurs = 2;
function lobby() {
  const ancien = chargerSauvegarde();
  $('#reprendre').hidden = !ancien;
  document.querySelectorAll('#nb-joueurs button').forEach(b => {
    b.addEventListener('click', () => { choixJoueurs = +b.dataset.n; document.querySelectorAll('#nb-joueurs button').forEach(x => x.setAttribute('aria-pressed', x === b)); majLobby(); });
  });
  $('#commencer').addEventListener('click', () => {
    if (!sansTel && hote && !telRelies()) {
      if (!avertiSansTel) { avertiSansTel = true; consigneTel(); return; }
      sansTel = true; $('#sans-tel').checked = true; document.body.classList.add('sans-tel');
    }
    commencer(nouvelEtat(choixJoueurs));
  });
  $('#reprendre').addEventListener('click', () => commencer(ancien, true));
  $('#sans-tel').addEventListener('change', e => { sansTel = e.target.checked; document.body.classList.toggle('sans-tel', sansTel); consigneTel(); });
  consigneTel();
  try { brancher(); } catch (e) { $('#qr').textContent = 'Liaison téléphone indisponible.'; }
  const img = urlImage('coursive') || urlImage('station_mars'); if (img) $('#accueil').style.setProperty('--fond', `url("${new URL(img, location.href).href}")`);
}
async function commencer(etat, reprise) {
  son.demarrer();
  son.precharger(['HEL_S1', 'HEL_S2', 'HEL_S3', 'UI_05_1', 'UI_05_2', 'UI_06', 'UI_01', 'MEC_05_1', 'O2_1', 'O2_2', 'O2_3', 'O2_4', 'AMB_01', 'AMB_02']);
  S = etat; demarre = true;
  $('#accueil').classList.add('parti');
  setTimeout(() => $('#accueil').hidden = true, 1500);
  majPlateau(); majO2();
  $('#objectif-txt').textContent = D.OBJECTIFS[S.objectif].t;
  envoyerTelephones();
  if (!reprise) {
    await cinematique('CIN_00');
    aller('cryo', { silencieux: true });
    setTimeout(() => { if (!S.fin && marquer('aide')) aide(); }, 1800);
  } else { aller(S.lieu, { silencieux: true }); if (a('revelation') && !S.fin) son.boucle('musique', 'MUS_01', 'musique', .9, 4); }
  demarrerHorloge();
}

// ------------------------------------------------------------------ préchargement : la station dérive au-dessus de Mars
function etoiles(canvas) {
  // des étoiles fixes qui scintillent doucement
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  let graine = 17; const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const plans = [[.06, 160, .9], [.16, 70, 1.4], [.4, 22, 2.2]].map(([v, n, taille]) => ({ v, taille, pts: Array.from({ length: n }, () => ({ x: alea() * W, y: alea() * H, b: .3 + alea() * .7, ph: alea() * 6 })) }));
  let vite = 1, actif = true, t0 = performance.now();
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const image = now => {
    if (!actif) return;
    const t = (now - t0) / 1000; g.clearRect(0, 0, W, H);
    for (const p of plans) for (const e of p.pts) {
      g.fillStyle = `rgba(240,236,228,${e.b * (.75 + .25 * Math.sin(t * 1.3 + e.ph))})`;
      if (vite > 2) { g.fillRect(e.x, e.y, p.taille * vite * 1.5, p.taille * .8); } else { g.beginPath(); g.arc(e.x, e.y, p.taille * .55, 0, 6.283); g.fill(); }
    }
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
  return { accelerer: () => { const a = performance.now(); const f = () => { vite = 1 + ((performance.now() - a) / 1000) ** 2 * 14; if (vite < 60 && actif) requestAnimationFrame(f); }; f(); }, arreter: () => { actif = false; } };
}
async function prelude() {
  const pr = $('#prelude'), ligne = $('#prelude-ligne');
  const ext = urlImage('station_mars'); if (ext) pr.style.setProperty('--fond-prelude', `url("${new URL(ext, location.href).href}")`);
  const ciel = etoiles($('#etoiles'));
  const fonds = M.imgs.map(urlImage).filter(Boolean);
  const sons = ETUDIANTS ? [] : ['AMB_00', 'AMB_01', 'HEL_S1', 'HEL_S2', 'O2_1', 'MUS_01', 'CIN_00_2J', 'CIN_00_3J', 'CIN_00_4J'].filter(c => M.sons.includes(c)).map(c => RACINE + 'media/' + M.dossier + '/' + c + '.mp3');
  const tout = [...fonds, ...sons];
  let fait = 0;
  const maj = () => pr.style.setProperty('--p', tout.length ? fait / tout.length : 1);
  const charger = u => (/\.(jpg|webp)$/.test(u) ? new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = u; }) : fetch(u).then(r => r.arrayBuffer()).catch(() => {})).then(() => { fait++; maj(); });
  const debut = performance.now(); maj();
  await Promise.all(tout.map(charger));
  await new Promise(r => setTimeout(r, Math.max(0, 5200 - (performance.now() - debut))));
  pr.classList.add('pret');
  $('#note-son').textContent = ETUDIANTS ? 'Version sans son : chaque son est décrit à l\'écran, avec son code de livrable.' : 'Le son fait partie du jeu. Montez le volume, de préférence sur des enceintes.';
  const e = pr.querySelector('.entrer'); e.hidden = false; requestAnimationFrame(() => e.classList.add('on'));
  $('#entrer').addEventListener('click', () => {
    son.demarrer();
    son.boucle('amb', 'AMB_00', 'amb', .8, 5);
    pr.classList.add('rejoint');
    setTimeout(() => { pr.classList.add('fini'); document.body.classList.add('ouvert'); }, 1900);
    setTimeout(() => { pr.hidden = true; ciel.arreter(); }, 3800);
  }, { once: true });
}

// ------------------------------------------------------------------ cinématiques
let cineEnCours = null;
function cinematique(nom) {
  return new Promise(async fin => {
    const c = CINE[nom](S);
    const cine = $('#cine'); cine.classList.add('on'); cine.replaceChildren();
    const cadre = el('div', 'cadre'); cine.append(cadre);
    const st = el('p', 'st'); cine.append(st);
    const passer = el('button', 'passer', 'Passer'); passer.type = 'button'; passer.addEventListener('click', () => passerCine()); cine.append(passer);
    son.silence(1.2); son.boucle('amb', null); son.boucle('musique', null); son.boucle('alarme', null);
    if (son.couches) son.couches.forEach(g => g.gain.value = 0);
    await attendre(1300);
    son.retour(.2);
    const piste = await son.piste(c.audio);
    const t0 = performance.now();
    const minuteurs = [];
    // plans
    c.plans.forEach((p, i) => minuteurs.push(setTimeout(() => {
      const f = el('div', 'plan-cine ' + (p.mvt || 'lent'));
      const v = urlVideo(p.src), im = urlImage(p.src);
      if (v) { const x = el('video'); x.src = v; x.muted = true; x.playsInline = true; x.autoplay = true; f.append(x); x.play().catch(() => {}); }
      else if (im) { const x = el('img'); x.src = im; x.alt = ''; if (p.cadre) { const r = el('div', 'recadre'); r.style.setProperty('--ox', p.cadre.x + '%'); r.style.setProperty('--oy', p.cadre.y + '%'); r.style.setProperty('--z', p.cadre.z); r.append(x); f.append(r); } else f.append(x); }
      else f.classList.add('noir');
      f.style.setProperty('--d', p.duree + 's'); if (p.filtre) f.classList.add(p.filtre);
      cadre.append(f); requestAnimationFrame(() => f.classList.add('on'));
      setTimeout(() => { [...cadre.children].slice(0, -2).forEach(x => x.remove()); }, 3000);
    }, p.t * 1000)));
    // sous-titres et descriptions
    (c.repliques || []).forEach(r => minuteurs.push(setTimeout(() => {
      const v = D.VOIX[r.code]; if (!v) return;
      st.replaceChildren();
      const qui = el('span', 'qui', v.p === 'HÉLIOS' ? 'HÉLIOS' : v.p === 'ACHARD' ? 'Achard' : 'Ferreira'); if (ETUDIANTS) qui.append(el('span', 'code', r.code));
      st.append(qui, el('span', 'txt', v.t)); st.classList.add('on');
      minuteurs.push(setTimeout(() => st.classList.remove('on'), (r.d || (1 + v.t.length * .065)) * 1000));
    }, r.t * 1000)));
    if (ETUDIANTS) {
      son.boucle('cine', c.audio);
      (c.sons || []).forEach(s => minuteurs.push(setTimeout(() => son.jouer(s.code, 'musique', 1, { texte: s.texte }), s.t * 1000)));
    } else if (piste) piste.lancer();
    else (c.repliques || []).forEach(r => minuteurs.push(setTimeout(() => son.voix(r.code), r.t * 1000)));
    const finir = () => {
      minuteurs.forEach(clearTimeout); if (piste) piste.arreter(); if (ETUDIANTS) son.boucle('cine', null);
      cine.classList.add('sortie');
      setTimeout(() => { cine.classList.remove('on', 'sortie'); cine.replaceChildren(); cineEnCours = null; son.retour(1); fin(); }, 1400);
    };
    cineEnCours = finir;
    minuteurs.push(setTimeout(finir, c.duree * 1000));
  });
}
function passerCine() { if (cineEnCours) cineEnCours(); }

// ------------------------------------------------------------------ fins
async function finPartie(f) {
  if (S.fin) return;
  S.fin = f; sauver();
  file.length = 0; son.couperVoix();
  envoyerTelephones();
  await attendre(f === 'X' ? 400 : 2500);
  await cinematique(f === 'A' ? 'CIN_A' : f === 'B' ? 'CIN_B' : 'CIN_X');
  generique(f);
}
function generique(f) {
  const g = $('#generique'); g.hidden = false;
  g.querySelector('.fin-nom').textContent = f === 'A' ? 'La capsule est partie.' : f === 'B' ? 'La quarantaine tient.' : 'L\'oxygène s\'est épuisé.';
  g.querySelector('.fin-temps').textContent = 'Partie de ' + Math.round(S.temps / 60) + ' minutes · oxygène restant ' + Math.floor(S.o2) + ' %';
  requestAnimationFrame(() => g.classList.add('on'));
  try { localStorage.removeItem(CLE_SAUVE); } catch (_) {}
}

// ------------------------------------------------------------------ Terminal et radio sur la Station (essai sans téléphone)
function terminalLocal() {
  const d = el('article', 'plaque terminal-local');
  d.append(el('h2', null, 'Terminal'));
  const inter = el('div', 'inter'); let choixI = null;
  D.INTERROGATIFS.forEach(i => { const b = el('button', null, i); b.type = 'button'; b.addEventListener('click', () => { choixI = i; inter.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }); inter.append(b); });
  const suj = el('div', 'suj');
  S.sujets.forEach(s => { const b = el('button', null, D.SUJETS[s].nom); b.type = 'button'; b.addEventListener('click', () => { if (choixI) { fermerPanneau(); question(s, choixI); } }); suj.append(b); });
  d.append(inter, suj);
  if (attenteAuto) {
    const f = el('form', 'auto'); const i = el('input'); i.inputMode = 'numeric'; i.placeholder = 'Autorisation'; f.append(i, el('button', null, 'Envoyer'));
    f.addEventListener('submit', e => { e.preventDefault(); fermerPanneau(); autorisation(i.value); }); d.append(f);
  }
  ouvrirPanneau(d, 'large');
}
function radioLocale() {
  const d = el('article', 'plaque radio-locale');
  d.append(el('h2', null, 'Radio portative'));
  const r = el('input'); r.type = 'range'; r.min = D.RADIO.min; r.max = D.RADIO.max; r.step = .1; r.value = 130;
  const f = el('output', 'affiche'); const info = el('p', 'sous');
  const maj = () => {
    const v = +r.value; f.textContent = v.toFixed(1) + ' MHz';
    const c = D.RADIO.canaux.find(k => Math.abs(k.f - v) <= D.RADIO.accroche && (!k.prive || a('ampli')));
    info.textContent = c ? c.nom + (c.telemetrie ? ' · ' + D.TELEMETRIE[a('air') ? 'apres' : a('panne') ? 'panne' : 'avant'].join(' · ') : c.texte ? ' · ' + c.texte : '') : 'Bruit entre les canaux';
    btn.hidden = !(c && c.prive && !a('fer05'));
  };
  const btn = el('button', 'suite', 'Diffuser sur la station'); btn.type = 'button'; btn.addEventListener('click', () => { fermerPanneau(); diffusion(); });
  r.addEventListener('input', () => { son.jouer('MEC_11', 'ui', .4); maj(); });
  d.append(f, r, info, btn); maj();
  ouvrirPanneau(d, 'etroit');
}

// ------------------------------------------------------------------ branchements de l'interface
$('#assembler').addEventListener('click', () => { if (selection.length === 2) assembler(selection[0], selection[1]); });
$('#piocher').addEventListener('submit', e => { e.preventDefault(); const i = $('#piocher input'); if (i.value) piocher(i.value); i.value = ''; i.blur(); });
$('#plateau-poignee').addEventListener('click', () => $('#plateau').classList.toggle('ouvert'));
$('#indice').addEventListener('click', indice);
$('#lieu-nom').addEventListener('click', () => planStation());
$('#btn-terminal').addEventListener('click', terminalLocal);
$('#btn-radio').addEventListener('click', radioLocale);
$('#rejouer').addEventListener('click', () => { try { localStorage.removeItem(CLE_SAUVE); } catch (_) {} location.reload(); });
$('#aide').addEventListener('click', aide);
$('#journal-helios').addEventListener('click', () => {
  const d = el('article', 'plaque'); d.append(el('h2', null, 'Ce qu\'HÉLIOS a affiché'));
  if (!S.reponses.length) d.append(el('p', 'sous', 'Rien pour l\'instant.'));
  S.reponses.forEach(r => { const b = el('div', 'msg'); if (r.q) b.append(el('p', 'quand', r.q)); b.append(el('p', null, r.t)); d.append(b); });
  ouvrirPanneau(d);
});
// comment jouer : ouvert une fois après le réveil, puis par le bouton Aide
function aide() {
  const d = el('article', 'plaque aide');
  d.append(el('h2', null, 'Comment jouer'));
  const tel = !sansTel;
  const l = el('ul', 'regles');
  [
    ['Explorez.', 'Touchez ce qui vous intrigue dans le décor. « Repérer » (touche R) montre tout ce qui se touche.'],
    ['Piochez.', 'Des numéros sont cachés dans le décor et sur les objets. Tapez-les dans « Piocher la carte », en bas, pour prendre la carte.'],
    ['Assemblez.', 'Choisissez deux cartes qui vont ensemble : leurs numéros s\'additionnent et donnent une nouvelle carte.'],
    ['Interrogez HÉLIOS.', tel ? 'Sur le téléphone, onglet Terminal : un mot, un sujet, « Transmettre ». La réponse s\'affiche et s\'entend ici.' : 'Bouton Terminal : un mot, puis un sujet. La réponse s\'affiche ici.'],
    ['Écoutez la radio.', tel ? 'Sur le téléphone, onglet Radio : penchez-le pour parcourir les canaux.' : 'Bouton Radio : glissez le curseur pour parcourir les canaux.'],
    ['Surveillez l\'air.', 'L\'oxygène, à droite, baisse avec le temps. Une question inutile, un code faux ou un indice en coûtent davantage. À zéro, la partie est perdue.'],
    ['Bloqués ?', 'Votre objectif est en haut à gauche. « Indice » vous aide, contre 2 % d\'oxygène.'],
  ].forEach(([t, x]) => { const li = el('li'); li.append(el('b', null, t), ' ' + x); l.append(li); });
  d.append(l);
  ouvrirPanneau(d);
}
function planStation() {
  const d = el('article', 'plaque plan-station');
  d.append(el('h2', null, 'Perséphone'));
  const lieux = ['cryo', 'coursive', 'infirmerie', 'machines', 'radio', 'sas'];
  const l = el('div', 'lieux');
  lieux.forEach(k => {
    const ok = S.ouverts.includes(k) && (k !== 'radio' || a('air')) && (k !== 'sas' || a('dossier'));
    const b = el('button', k === S.lieu ? 'ici' : '', D.LIEUX[k].nom); b.type = 'button'; b.disabled = !ok;
    b.addEventListener('click', () => { son.jouer('MEC_05_1', 'mec', .7); aller(k); });
    l.append(b);
  });
  d.append(l);
  ouvrirPanneau(d, 'etroit');
}
// clic dans le vide : rien (on ne punit pas l'exploration)

// ------------------------------------------------------------------ interface de test (utilisée par tests/partie.mjs)
window.PSP = {
  etat: () => S, zone, question, piocher, assembler, autorisation, diffusion, aller,
  vitesse: v => { vitesse = v; }, rapide: v => { rapide = v; }, pause: p => { enPause = p; }, passerCine, panne,
  circuit: () => verifierCircuit(S.grille || []), D,
  parle: () => parle || file.length > 0,
};

for (let i = 0; i < 20; i++) $('#o2-cases').append(el('i'));
function reperer() { document.body.classList.add('reperer'); clearTimeout(reperer.t); reperer.t = setTimeout(() => document.body.classList.remove('reperer'), 2600); }
$('#reperer').addEventListener('click', reperer);
addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !$('#panneau').classList.contains('on')) reperer(); });
// l'interface secondaire s'efface quand personne ne touche à rien
{ let t = null; const reveil = () => { document.body.classList.remove('repos'); clearTimeout(t); t = setTimeout(() => document.body.classList.add('repos'), 4500); };
  ['pointermove', 'pointerdown', 'keydown'].forEach(e => addEventListener(e, reveil, { passive: true })); reveil(); }
atmo.installer($('#decor'));
lobby();
prelude();
if (new URLSearchParams(location.search).has('test')) document.body.classList.add('test');
