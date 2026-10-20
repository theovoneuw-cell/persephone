// Montage des cinématiques : plans (vidéo ou image), répliques, et pour la version étudiants les sons décrits.
// L'audio de chaque cinématique est un seul fichier mixé (livrable du poste 6) : CIN_00_2J, CIN_A…
// Durées exactes du brief : CIN_00 75 s, CIN_A et CIN_B 90 s, CIN_X 20 s.

export const CINE = {
  CIN_00: S => {
    const n = S.n;
    const reveils = n === 4 ? ['HEL_01a', 'HEL_01b', 'HEL_01c', 'HEL_01d'] : n === 3 ? ['HEL_01b', 'HEL_01c', 'HEL_01d'] : ['HEL_01c', 'HEL_01d'];
    const t0 = n === 4 ? 12 : n === 3 ? 14 : 15;
    return {
      duree: 75, audio: 'CIN_00_' + n + 'J',
      plans: [
        { t: 0, src: 'noir', duree: 8 },
        // tous les plans de la baie sont pris dans le décor du jeu : même pièce, mêmes caissons
        { t: 7, src: 'cryo', cadre: { x: 22, y: 60, z: 3.2 }, duree: 16, mvt: 'paupieres' },
        { t: 22, src: 'cryo', cadre: { x: 82, y: 42, z: 2.3 }, duree: 13, mvt: 'leve' },
        { t: 34, src: 'cryo', cadre: { x: 50, y: 55, z: 1.15 }, duree: 15, mvt: 'recule' },
        { t: 48, src: 'station_mars', duree: 13, mvt: 'lent' },
        { t: 60, src: 'cryo', duree: 16, mvt: 'avance' },
      ],
      repliques: [
        ...reveils.map((c, i) => ({ t: t0 + i * 3, code: c, d: 2.4 })),
        { t: 26, code: 'HEL_01e', d: 4.5 },
        { t: 38, code: 'HEL_02', d: 8.5 },
        { t: 50, code: 'HEL_03', d: 7.5 },
      ],
      sons: [
        { t: 0, code: 'CIN_00', texte: 'Noir. Le froid. Un premier souffle, puis la respiration qui revient' },
        { t: 8, code: 'CIN_00', texte: 'Le givre sur le verre du caisson, le cœur qui repart' },
        { t: 22, code: 'CIN_00', texte: 'Le couvercle se déverrouille et se soulève : air comprimé, joints' },
        { t: 34, code: 'CIN_00', texte: 'La baie de cryogénie autour de vous : compresseurs, condensation' },
        { t: 48, code: 'CIN_00', texte: 'La station dans son ensemble, sans aucun son extérieur' },
        { t: 60, code: 'CIN_00', texte: 'Retour dans la baie. La musique laisse la place à la station' },
      ],
    };
  },
  CIN_A: () => ({
    duree: 90, audio: 'CIN_A',
    plans: [
      { t: 0, src: 'sas', duree: 18, mvt: 'avance' },
      { t: 16, src: 'cinA_capsule', duree: 20, mvt: 'lent' },
      { t: 34, src: 'station_mars', cadre: { x: 46, y: 40, z: 1.8 }, duree: 24, mvt: 'recule' },
      { t: 56, src: 'station_mars', duree: 24, mvt: 'recule', filtre: 'sombre' },
      { t: 78, src: 'noir', duree: 12 },
    ],
    repliques: [
      { t: 6, code: 'ACH_I05', d: 5.5 },
      { t: 30, code: 'HEL_31', d: 6.5 },
      { t: 62, code: 'FER_06', d: 8.5 },
    ],
    sons: [
      { t: 0, code: 'CIN_A', texte: 'Le sas, une dernière fois. Achard derrière la vitre' },
      { t: 16, code: 'CIN_A', texte: 'La capsule : sangles, verrouillage, la station qui vous lâche' },
      { t: 34, code: 'CIN_A', texte: 'Désarrimage. Puis le silence de l\'espace' },
      { t: 56, code: 'CIN_A', texte: 'Le long voyage. Rien ne doit sonner comme une victoire' },
    ],
  }),
  CIN_B: () => ({
    duree: 90, audio: 'CIN_B',
    plans: [
      { t: 0, src: 'sas', duree: 12, mvt: 'lent' },
      { t: 11, src: 'sas_vide', duree: 9, mvt: 'lent' },
      { t: 18, src: 'coursive', duree: 22, mvt: 'recule', filtre: 'sombre' },
      { t: 38, src: 'radio', duree: 18, mvt: 'lent' },
      { t: 54, src: 'station_mars', duree: 26, mvt: 'recule', filtre: 'crepuscule' },
      { t: 80, src: 'noir', duree: 10 },
    ],
    repliques: [
      { t: 6, code: 'ACH_I06', d: 6.5 },
      { t: 24, code: 'HEL_32', d: 5.5 },
      { t: 42, code: 'FER_07', d: 8 },
      { t: 80, code: 'HEL_33', d: 3 },
    ],
    sons: [
      { t: 0, code: 'CIN_B', texte: 'Le sas. Achard s\'éloigne de la vitre' },
      { t: 18, code: 'CIN_B', texte: 'La station se referme sur elle-même, la ventilation ralentit' },
      { t: 38, code: 'CIN_B', texte: 'La radio : la Terre, en retard de onze minutes, coupée net' },
      { t: 54, code: 'CIN_B', texte: 'La station seule au-dessus de Mars' },
    ],
  }),
  CIN_X: () => ({
    duree: 20, audio: 'CIN_X',
    plans: [
      { t: 0, src: 'coursive', duree: 12, mvt: 'eteint' },
      { t: 11, src: 'noir', duree: 9 },
    ],
    repliques: [{ t: 12, code: 'HEL_30', d: 3 }],
    sons: [
      { t: 0, code: 'CIN_X', texte: 'Les lumières tombent une à une. Les respirations se font courtes' },
      { t: 11, code: 'CIN_X', texte: 'Plus que la station, puis plus rien' },
    ],
  }),
};
