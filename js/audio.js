// Moteur sonore de la Station. Chaque son porte le code du brief (AMB_02, HEL_S3…).
// Les fichiers vivent dans media/son/CODE.mp3 ; les variantes s'appellent CODE_1, CODE_2…
// La version étudiants remplace ce moteur par Descripteur (même interface, aucun son).

const BASE = new URL('../media/' + ((window.__M && window.__M.dossier) || 'son') + '/', import.meta.url).href;

export class Moteur {
  constructor(liste) {
    this.dispo = new Set(liste || []);
    this.cache = new Map();
    this.boucles = {};
    this.ctx = null;
  }
  demarrer() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = new C({ latencyHint: 'playback' });
    const c = this.ctx;
    this.maitre = c.createGain(); this.maitre.connect(c.destination);
    const bus = n => { const g = c.createGain(); g.connect(this.maitre); return g; };
    this.bus = { amb: bus(), tension: bus(), musique: bus(), voix: bus(), ui: bus(), mec: bus(), alarme: bus() };
    this.bus.amb.gain.value = 1; this.bus.tension.gain.value = .9;
  }
  existe(code) { return this.dispo.has(code); }
  variantes(code) { const v = []; for (let i = 1; i < 12; i++) if (this.dispo.has(code + '_' + i)) v.push(code + '_' + i); return v; }
  async charger(code) {
    if (!this.dispo.has(code)) return null;
    if (this.cache.has(code)) return this.cache.get(code);
    const p = fetch(BASE + code + '.mp3').then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).then(buf => { buf.bornes = bornes(buf); return buf; }).catch(() => null);
    this.cache.set(code, p);
    return p;
  }
  precharger(codes) { if (this.ctx) codes.forEach(c => { this.charger(c); this.variantes(c).forEach(v => this.charger(v)); }); }

  // un son ponctuel ; renvoie sa durée (s)
  async jouer(code, bus = 'ui', vol = 1, opts = {}) {
    if (!this.ctx) return 0;
    const v = this.variantes(code); const choisi = v.length ? v[Math.floor(Math.random() * v.length)] : code;
    const buf = await this.charger(choisi); if (!buf) return 0;
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g).connect(this.bus[bus] || this.bus.ui);
    s.start(this.ctx.currentTime + (opts.retard || 0), buf.bornes[0]);
    if (opts.fin) s.onended = opts.fin;
    return buf.duration;
  }
  // une voix : baisse le reste pendant qu'elle parle
  async voix(code, fin) {
    if (!this.ctx) { fin && fin(); return 0; }
    const buf = await this.charger(code);
    if (!buf) { fin && fin(); return 0; }
    const t = this.ctx.currentTime;
    for (const b of ['amb', 'tension', 'musique']) { const g = this.bus[b].gain; g.cancelScheduledValues(t); g.setTargetAtTime(b === 'musique' ? .55 : .5, t, .15); }
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.connect(this.bus.voix); s.start(t + .05, buf.bornes[0]);
    s.onended = () => {
      const t2 = this.ctx.currentTime;
      for (const b of ['amb', 'tension', 'musique']) this.bus[b].gain.setTargetAtTime(b === 'tension' ? .9 : 1, t2, .6);
      fin && fin();
    };
    this.voixEnCours = s;
    return buf.duration;
  }
  couperVoix() { try { this.voixEnCours && this.voixEnCours.stop(); } catch (_) {} }

  // boucle nommée par emplacement (amb, musique, alarme…) avec fondu enchaîné
  async boucle(place, code, bus, vol = 1, fondu = 2.5) {
    if (!this.ctx) return;
    const ancienne = this.boucles[place];
    if (ancienne && ancienne.code === code) { ancienne.g.gain.setTargetAtTime(vol, this.ctx.currentTime, fondu / 3); return; }
    const t = this.ctx.currentTime;
    if (ancienne) { ancienne.g.gain.cancelScheduledValues(t); ancienne.g.gain.setTargetAtTime(0, t, fondu / 3); const s = ancienne.s; setTimeout(() => { try { s && s.stop(); } catch (_) {} }, fondu * 1600); }
    delete this.boucles[place];
    if (!code) return;
    const entree = { code, g: this.ctx.createGain(), s: null };
    entree.g.gain.value = 0; entree.g.connect(this.bus[bus || place] || this.bus.amb);
    this.boucles[place] = entree;
    const buf = await this.charger(code);
    if (!buf || this.boucles[place] !== entree) return;
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    s.loopStart = buf.bornes[0]; s.loopEnd = buf.bornes[1];
    s.connect(entree.g); s.start(this.ctx.currentTime, buf.bornes[0]); entree.s = s;
    entree.g.gain.setTargetAtTime(vol, this.ctx.currentTime, fondu / 3);
  }
  // les quatre couches de tension démarrent ensemble et ne s'arrêtent jamais
  async tension(niveau) {
    if (!this.ctx) return;
    if (!this.couches) {
      this.couches = [];
      const bufs = await Promise.all(['O2_1', 'O2_2', 'O2_3', 'O2_4'].map(c => this.charger(c)));
      const t0 = this.ctx.currentTime + .1;
      bufs.forEach((buf, i) => {
        const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.bus.tension);
        if (buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = buf.bornes[0]; s.loopEnd = buf.bornes[1]; s.connect(g); s.start(t0, buf.bornes[0]); }
        this.couches.push(g);
      });
    }
    const t = this.ctx.currentTime;
    this.couches.forEach((g, i) => g.gain.setTargetAtTime(i < niveau ? 1 : 0, t, 3));
  }
  silence(fondu = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.maitre.gain.setTargetAtTime(0, t, fondu / 3);
  }
  retour(fondu = 1.5) { if (this.ctx) this.maitre.gain.setTargetAtTime(1, this.ctx.currentTime, fondu / 3); }
  // lecture d'un fichier long (cinématique) en même temps qu'une vidéo
  async piste(code) {
    if (!this.ctx) return null;
    const buf = await this.charger(code); if (!buf) return null;
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.connect(this.bus.musique);
    return { duree: buf.duration, lancer: (dec = 0) => s.start(this.ctx.currentTime, buf.bornes[0] + dec), arreter: () => { try { s.stop(); } catch (_) {} } };
  }
  set description(_) {}
}

// Bornes utiles d'un tampon : les décodeurs MP3 ajoutent des zéros au début et à la fin,
// qui feraient claquer les boucles. On les saute.
function bornes(buf) {
  const d = buf.getChannelData(0), n = d.length; let a = 0, b = n - 1;
  while (a < Math.min(n, 6000) && Math.abs(d[a]) < 1e-6) a++;
  while (b > n - 6000 && b > a && Math.abs(d[b]) < 1e-6) b--;
  if (a >= 6000) a = 0; if (b <= n - 6000) b = n - 1;
  return [a / buf.sampleRate, (b + 1) / buf.sampleRate];
}

// ------------------------------------------------------------------ version étudiants
// Même interface que Moteur. Rien ne sonne : chaque son devient une ligne écrite.
export class Descripteur {
  constructor(sons, afficher) { this.sons = sons; this.afficher = afficher; this.boucles = {}; this.niveau = 0; }
  demarrer() {}
  existe() { return true; }
  precharger() {}
  libelle(code) { const base = code.replace(/_\d+$/, ''); return this.sons[code] || this.sons[base] || ''; }
  async jouer(code, bus, vol, opts = {}) { this.afficher({ type: 'evt', code: code.replace(/_\d+$/, ''), texte: opts.texte || this.libelle(code) }); return 0.6; }
  async voix(code, fin) { const d = 0; setTimeout(() => fin && fin(), 50); return d; }
  couperVoix() {}
  async boucle(place, code) {
    if (code) this.boucles[place] = code; else delete this.boucles[place];
    this.majFond();
  }
  async tension(niveau) { this.niveau = niveau; this.majFond(); }
  majFond() {
    const l = [];
    for (const [place, code] of Object.entries(this.boucles)) l.push({ code, texte: this.libelle(code) });
    for (let i = 1; i <= this.niveau; i++) l.push({ code: 'O2_' + i, texte: this.libelle('O2_' + i) });
    this.afficher({ type: 'fond', lignes: l });
  }
  silence() { this.afficher({ type: 'fond', lignes: [] }); }
  retour() { this.majFond(); }
  async piste() { return null; }
}
