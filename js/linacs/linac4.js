// Linac 4 (Varian TrueBeam). Numbers only (CLAUDE.md › Architecture). Every value is copied
// from the sheet Referensvärden of "Årskontroll 2026 Linac4 (Varian TrueBeam) Resultat.xlsx";
// the cell it came from is named beside it.

export default {
  id: "linac4",
  name: "Linac 4",
  model: "Varian TrueBeam",

  // 2.3 Winston-Lutz is measured once per beam group. Only the first group includes the
  // treatment-table rotation (2. Allmänt rows 34–41 vs 44–48).
  winstonLutz: [
    { id: "wl6", title: "6 MV / 6-FFF fotoner", table: true },
    { id: "wl10", title: "10 MV / 15 MV fotoner", table: false },
  ],

  // In the order of the workbook's sheets: 3. 6 MV, 4. 10 MV, 5. 15 MV, 6. 6 MV FFF.
  beams: [
    {
      id: "6x",
      title: "6 MV fotoner",
      short: "6 MV",
      fff: false,
      depthDose: { dmax10: 1.545, d2010: 0.559 }, // J9, K9
      penumbra: { x: 4.4, y: 4.6 }, // J16:K16, L16:M16
      flatness: 105, // L30:M30
      outputMu: 130, // J37
      wedgeFactor: { 15: 0.823, 60: 0.422 }, // K49:K50, K51:K52
      gradientY2: { 15: 1.1445, 60: 2.356 }, // K57, K59 (Y1-0° is the inverse: K56 = 1/K57)
    },
    {
      id: "10x",
      title: "10 MV fotoner",
      short: "10 MV",
      fff: false,
      depthDose: { dmax10: 1.392, d2010: 0.617 }, // AH9, AI9
      penumbra: { x: 4.8, y: 5.2 }, // AH16:AI16, AJ16:AK16
      flatness: 103.4, // AJ30:AK30
      outputMu: 110, // AH37
      wedgeFactor: { 15: 0.854, 60: 0.478 }, // AI49:AI50, AI51:AI52
      gradientY2: { 15: 1.126, 60: 2.117 }, // AI57, AI59
    },
    {
      id: "15x",
      title: "15 MV fotoner",
      short: "15 MV",
      fff: false,
      depthDose: { dmax10: 1.329, d2010: 0.635 }, // R9, S9
      penumbra: { x: 5, y: 5.4 }, // R16:S16, T16:U16
      flatness: 104.4, // T30:U30
      outputMu: 100, // R37
      wedgeFactor: { 15: 0.864, 60: 0.5 }, // S49:S50, S51:S52
      gradientY2: { 15: 1.118, 60: 2.038 }, // S57, S59
    },
    {
      id: "6fff",
      title: "6 MV FFF fotoner",
      short: "6 FFF",
      fff: true,
      depthDose: { dmax10: 1.616, d2010: 0.532 }, // Z9, AA9
      penumbra: { x: 5, y: 5.4 }, // Z16:AA16, AB16:AC16
      flatness: 156, // AB30:AC30 (off-axis ratio at 160 mm for FFF)
      outputMu: 130, // Z37
      wedgeFactor: null, // 3.3 Dynamiska kilar: gäller ej FFF
      gradientY2: null,
    },
  ],
};
