// Décode les données du jeu (les solutions ne se lisent pas en clair dans le dépôt).
const CLE = 'carotte-dix-sept-quatre-quatre-un';
export function lire(b64) {
  const bin = atob(b64), k = new TextEncoder().encode(CLE), o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i) ^ k[i % k.length] ^ ((i * 7) & 255);
  return JSON.parse(new TextDecoder().decode(o));
}
