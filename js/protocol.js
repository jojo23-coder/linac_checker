// The yearly TrueBeam check as the app runs it: which checks exist, in what order, with which
// instruction text and which pass/fail rule. No DOM (CLAUDE.md › Architecture).
//
// Instruction text is verbatim from the instruction below (CLAUDE.md › Source documents); a
// "\n" is a line break in the original. Tolerances that are the same for every linac are set
// here and cite the Linac 4 workbook's sheet Referensvärden; per-beam reference values come
// from the linac's data file in js/linacs/.

import { derive } from "./checks.js";

export const INSTRUCTION = {
  title: "Årskontroll Varian TrueBeam",
  number: "100549",
  edition: "3.0",
  validFrom: "2026-03-30",
  validTo: "2028-03-30",
};

export const DOSE_APP_URL = "https://jojo23-coder.github.io/absolute_dose_calibration/";

// "Beskrivning/Genomförande"
export const DESCRIPTION = [
  "Årskontrollen utförs en gång per år av sjukhusfysiker på Strålbehandlingen (Strålningsfysik). Kontrollen är indelad i två huvuddelar: (2) Allmänt, och (3) fotoner. Del 3 ska alltså repeteras för alla aktuella energier.",
  "Där inte annat anges; försök utföra kontrollerna i den ordning de är listade här. Använd exceldokumentet ”Årskontroll ÅÅÅÅ LinacX (Varian True beam) Resultat.xlsx” (finns i mappen ”Årskontroll” under resp linacmapp) för att fylla i resultat och för jämförelser mot referensvärden. Även toleranser återfinns inne i exceldokumentet.",
  "Vid frågor rörande placeringen för mätutrustningen kan man titta i denna förteckning.",
];

// "1. Utrustning". The id is the storage key of the checkbox, so never rename one.
export const EQUIPMENT = [
  { id: "bluephantom", text: "Blue phantom (IBA) – mätutrustning för djupdoser (DD), dosprofiler och stjärnmätning\nMjukvara: MyQA Accept." },
  { id: "matrixx", text: "MatriXX eller StarTrack och MultiCube fantom (IBA) – mätutrustning för dynamisk kil\nMjukvara MyQA." },
  { id: "chamber", text: "Cylindrisk jonkammare för absolutdos – använd aktuell brukskammare" },
  { id: "electrometer", text: "Elektrometer UNIDOS 10001 (PTW)" },
  { id: "cc13", text: "Cylindrisk jonkammare CC13 (IBA) - Djupdoser" },
  { id: "diode", text: "Fotondiod skärmad (Scanditronix) - Djupdoser, dosprofiler och stjärna." },
  { id: "thermometer", text: "Termometer" },
  { id: "barometer", text: "Barometer" },
  { id: "level", text: "Digitalt vattenpass" },
  { id: "pin", text: "Isocenterpinne (finns i resp behandlingsrum)" },
  { id: "ruler", text: "Stålskala" },
  { id: "mlcplate", text: "Kalibreringsplatta MLC" },
  { id: "paper", text: "Millimeter-papper" },
  { id: "wlcube", text: "Winston-Lutz QA cube, 60×60×60 mm³" },
  { id: "workbook", text: "Exceldokument ”Årskontroll ÅÅÅÅ LinacX (Varian True beam) Resultat.xls” som innehåller både referensvärden och toleranser för kontrollerna. Referenskurvor finns i mappen ”Referensmätningar” under mappen ”Årskontroll”." },
];

// "4. Resultat"
export const RESULT_NOTE =
  "Efter att acceleratorn kontrollerats skall resultaten loggas i Medusa, se instruktion nedan. Beskrivning saknas tills vidare.";

const max = (limit) => ({ type: "max", max: limit });
const diff = (ref, tol) => ({ type: "diff", ref, tol });
const rel = (ref, tol) => ({ type: "rel", ref, tol });
const OK_RULE = { type: "ok" };

// A check whose value is the one number typed into it. `signed` adds a ± key, because a
// phone's decimal keypad has no minus.
function measured(id, label, unit, rule, { signed = false, step, optional = false } = {}) {
  return { id, label, unit, rule, step, optional, fields: [{ key: id, kind: "number", signed }] };
}

function choice(id, label, step) {
  return { id, label, unit: "", rule: OK_RULE, step, fields: [{ key: id, kind: "choice", options: ["OK", "Ej OK"] }] };
}

/** The whole check for one linac: groups (2. Allmänt, then one per beam) of sections of checks. */
export function buildProtocol(linac) {
  return {
    linac,
    groups: [generalGroup(linac), ...linac.beams.map((beam, index) => beamGroup(beam, index + 3))],
  };
}

function generalGroup(linac) {
  return {
    id: "general",
    number: "2",
    title: "Allmänt",
    short: "Allmänt",
    intro: [
      "Skapa en ny mapp under OneDrive - Region Västerbotten\\Strålningsfysik (SP)\\Strålterapi\\Utrustning\\Behandling\\Varian TrueBeam\\Linac X\\Årskontroll\\ (byt ut ”ÅÅÅÅ” till det aktuella året).",
      "Öppna exceldokument ”Årskontroll ÅÅÅÅ LinacX (Varian True Beam) Resultat.xls” i kvalitetshandboken. Döp om dokumentet genom att byta ut ”ÅÅÅÅ” till det aktuella året och spara det i katalogen som nyss skapats. Spara även övriga mätfiler från årskontrollen i samma mapp.",
    ],
    sections: [
      {
        id: "2.1",
        number: "2.1",
        title: "Fältljus, laser och kollimatorer",
        intro: [
          "Använd maskinspecifik isocenterpinne. Börja med att sätta fast och låsa isocenterpinnen i blockhållaren. Tejpa upp ett mm-papper på bordet. Kör upp bordet till ett par mm under pinnen.",
        ],
        blocks: [
          {
            heading: "Maximal avvikelse",
            items: [
              measured("2.1.pin", "Isoc.pinne rotation (radie)", "mm", max(0.5), { // E6
                step: "Rotera behandlingshuvudet och kontrollera att pinnen inte rör sig på pappret. Tolerans: radie 0.5 mm.",
              }),
              measured("2.1.lasers", "Lasrar (fyra gantryvinklar)", "mm", max(1), { // E7
                signed: true,
                step: "Kontrollera att alla sidolasrar, sagitallaser samt eventuell taklaser är centrerade på pinnen i gantryvinklarna 0, 90, 180 och 270°. Tolerans: ±1 mm.",
              }),
              measured("2.1.crosshair", "Hårkors centrering (radie)", "mm", max(1), { // E8
                step: "Därefter kan centrering hos hårkors/frontfolie kontrolleras genom rotation av beh.huvudet. Studera skuggan på isocenteravstånd på mm-pappret och bedöm hur bra centreringen är relativt pinnens position. Tolerans: radie 1 mm.",
              }),
              measured("2.1.jawY", "Kollimatorposition ljusfält Y", "mm", max(1), { // E12
                signed: true,
                step: "Ljusfältet kontrolleras enskilt för Y-blocken. Detta sker med hjälp av avsedd kontrollplatta eller mm-papper på isocenteravstånd. Kontrollera blocken i positionerna -10, 0, 10 och 20 cm. Tolerans: ±1 mm (om möjligt med tanke på ljuspenumbran).",
              }),
              measured("2.1.jawX", "Kollimatorposition ljusfält X", "mm", max(1), { // E10
                signed: true,
                step: "Ljusfältet kontrolleras enskilt för X-blocken. Detta sker med hjälp av avsedd kontrollplatta eller mm-papper på isocenteravstånd. Kontrollera blocken i positionerna 0, 10 och 20 cm. Tolerans: ±1 mm (om möjligt med tanke på ljuspenumbran).",
              }),
              measured("2.1.play", "Kollimatorglapp", "mm", max(2), { // E14
                signed: true,
                step: "Kontrollera mekaniskt kollimatorglapp genom att först ställa in ett kvadratiskt fält, helst 40×40 cm², i gantryvinkeln 0° med hjälp av kontrollplattan. Ställ sedan kontrollplattan på högkant (förslagsvis fasttejpad på t.ex. ett plexiblock) och centrera den med hjälp av lasrarna. Vrid sedan gantryt så att ljusfältet träffar kontrollplattan från gantryvinkeln 90 alt. 270°. Kontrollera att ljusfältet fortfarande följer linjerna för den inställda fältstorleken. Vrid huvudet 90° för att kolla det andra kollimatorparet. Repetera gärna för den motstående gantryvinkeln (efter att kontrollplattan har vänts åt andra hållet). Tolerans: ±2 mm.",
              }),
            ],
          },
        ],
      },
      {
        id: "2.2",
        number: "2.2",
        title: "Skalor - gantry",
        intro: [
          "Gantry- och huvudvinkel kontrolleras med hjälp av det digitala vattenpasset. Placera vattenpasset på blockhållaren. Kör gantryt till 0° och justera till dess att vattenpasset visar 0.0°. Läs av gantryvinkeln på konsolskärmen. Upprepa för gantryvinkel 0, 90, 180 och 270° och huvudvinkel 0, 90 och 270°. Tolerans: ±0.5°.",
        ],
        blocks: [
          {
            title: "Gantryvinkel",
            heading: "Avvikelse",
            items: [0, 90, 180, 270].map((angle) =>
              measured(`2.2.gantry${angle}`, `${angle}°`, "°", max(0.5), { signed: true }), // E20:E23
            ),
          },
          {
            title: "Huvudvinkel",
            heading: "Avvikelse",
            items: [0, 90, 270].map((angle) =>
              measured(`2.2.collimator${angle}`, `${angle}°`, "°", max(0.5), { signed: true }), // E27, E28, E30
            ),
          },
        ],
      },
      {
        id: "2.3",
        number: "2.3",
        title: "Strålningsisocenter vs. mekaniska isocenter (Winston-Lutz)",
        intro: [
          "Testen utförs för 6 MV (alt. FFF) samt 10 MV (alt. FFF) fotoner med hjälp av EPID-bildplatta, Winston-Lutz QA cube och mjukvaran SNC Machine, se separat instruktion. Kontrollen för 6 MV (även 6-FFF) inkluderar också isocenterrotation av beh.bordet. Toleranser: ±1-2 mm, se excelformulär.",
        ],
        blocks: linac.winstonLutz.map((group) => winstonLutzBlock(group)),
      },
      {
        id: "2.4",
        number: "2.4",
        title: "Behandlingsbord",
        intro: [
          "Kan utföras oberoende av övriga kontroller. Belasta bordet med ca 50 kg ungefär 1 m från bordstoppens huvudände.",
        ],
        blocks: [
          {
            heading: "Maximal avvikelse",
            items: [
              measured("2.4.lift", "Isocenterprecision vid höjning/sänkning", "mm", max(2), { // E47
                signed: true,
                step: "Isocenterprecision vid höjning/sänkning. Tejpa upp ett mm-papper på bordet. Kontrollera att hårkorsets skugga inte rör sig vid höjning och sänkning av bordet med ±20 cm. Tolerans: ±2 mm.",
              }),
              measured("2.4.rotation", "Isocenterrotation skala", "mm", max(2), { // E48
                signed: true,
                step: "Isocenterrotation skala. Ställ bordsvinkeln (isocenterrot.) till 0°. Markera en punkt på bordet som träffas av en sidolaser. Förflytta bordet lateralt 20 cm och kontrollera att markeringen inte avviker från laserlinjen. Upprepa för bordsvinklarna 90 och 270°, men flytta då bordet 20 cm longitudinellt istället. Tolerans: ±2 mm.",
              }),
              measured("2.4.vertical", "Vertikal skala", "mm", max(2), { // E49
                signed: true,
                step: "Höjdskala. Ställ in bordets ovansida vid isocenterhöjd enligt laser. Nolla bordet. Kör ned det 20 cm enligt display. Kontrollera linjal mot laser. Tolerans: ±2 mm.",
              }),
              measured("2.4.longitudinal", "Longitudinell skala", "mm", max(2), { // E50
                signed: true,
                step: "Longitudinell skala. Behåll mm-pappret. Nolla bordet. Kör fram bordet 20 cm mot gantryt enligt display. Kontrollera med mm-pappret mot hårkorset. Backa bordet till – 20 cm och kontrollera. Tolerans: ±2 mm.",
              }),
              measured("2.4.lateral", "Lateral skala", "mm", max(2), { // E51
                signed: true,
                step: "Lateral skala. Behåll mm-pappret. Nolla bordet i miten. Kör bordet 20 cm åt vänster enligt display. Kontrollera med mm-pappret mot hårkorset. Kör bordet till 20 cm åt höger och kontrollera. Tolerans: ±2 mm.",
              }),
              measured("2.4.play", "Onormala glapp", "mm", max(2), { // E52
                signed: true,
                step: "Glapp. Kontrollera att bordet efter påverkan (knuff) återtar ursprungligt läge. Notera dessutom onormala glapp osv. Tolerans: ±2 mm.",
              }),
            ],
          },
        ],
      },
      {
        id: "2.5",
        number: "2.5",
        title: "Avståndsskala",
        intro: [
          "Slå på avståndsskalan och lasrarna. Placera ett ca 20 cm högt föremål på bordet (t.ex. MultiCube fantomet) och ställ in höjden så att sidolasern tangerar dess ovansida. Kontrollera att avståndsskalan visar 100 cm. Kör upp bordet till dess att avståndsskalan visar 80 cm på föremålet. Läs av bordshöjden på bordets display eller mät med linjal från laser. Upprepa för 120 cm. Tolerans: ±3 mm.",
        ],
        blocks: [
          {
            heading: "Avstånd enligt bordsskala/linjal",
            // The workbook compares |measured − scale| with 0.30000001 cm (E58:E60); see EPSILON in checks.js.
            items: [80, 100, 120].map((distance) =>
              measured(`2.5.d${distance}`, `Avståndsskala ${distance} cm`, "cm", diff(distance, 0.3)),
            ),
          },
        ],
      },
      {
        id: "2.6",
        number: "2.6",
        title: "Strålskydd",
        intro: ["Kontrollera"],
        stepList: "bullets",
        blocks: [
          {
            items: [
              choice("2.6.sign", "Skyltning ”Kontrollerat område”",
                "att skylten som aviserar ”Kontrollerat område” sitter på plats utanför bunkeringången."),
              choice("2.6.instruction", "Utskrift strålskyddsinstruktion",
                "att det finns en utskriven kopia av den aktuella strålskyddsinstruktionen för behandlingsrummet upphängd utanför bunkeringången."),
              choice("2.6.door", "Strålskyddsdörr spärrad",
                "att strålskyddsdörren inte går att stänga ifall någon av dörrarna, inkl. skjutdörrarna, bakom gantryt är öppen eller om takbelysningen bakom gantryt är påslagen."),
              choice("2.6.doserate", "Dosmätning strålskyddsdörr",
                "med ett strålskyddsinstrument att den uppmätta dosraten utanför strålskyddsdörren, inkl. längs med kanter och golvspringa, är jämförbar med mätningar från acceleratorns installation (tolerans: 5 µSv/h), se strålskyddsrapport för resp beh.rum i RADIUM."),
            ],
          },
        ],
      },
    ],
  };
}

function winstonLutzBlock(group) {
  const id = (name) => `2.3.${group.id}.${name}`;
  const items = [
    measured(id("total"), "Maximum total delta (2D)", "mm", max(2)), // E35
    measured(id("x"), "Deviation from gantry isocenter (X)", "mm", max(1), { signed: true }), // E36
    measured(id("y"), "Deviation from gantry isocenter (Y)", "mm", max(1), { signed: true }), // E37
    measured(id("z"), "Deviation from gantry isocenter (Z)", "mm", max(1), { signed: true }), // E38
    measured(id("r"), "Deviation from gantry isocenter (R)", "mm", max(1.5)), // E39
  ];
  if (group.table) {
    items.push(
      measured(id("tableX"), "Table Misalignment (X)", "mm", max(1), { signed: true }), // E40
      measured(id("tableY"), "Table Misalignment (Y)", "mm", max(1), { signed: true }), // E41
      {
        // Computed like 2. Allmänt!E41: SQRT(E39^2+E40^2).
        id: id("tableR"),
        label: "Table Misalignment (R)",
        unit: "mm",
        rule: max(1.5), // E42
        fields: [],
        valueLabel: "Beräknad √(X² + Y²)",
        digits: 2,
        waitingFor: "X och Y",
        derive: (read) => derive([read(id("tableX")), read(id("tableY"))], (x, y) => Math.hypot(x, y)),
      },
    );
  }
  return { title: group.title, heading: "SNC Measurement", items };
}

function beamGroup(beam, number) {
  const sections = [fieldSection(beam, number), outputSection(beam, number)];
  if (beam.wedgeFactor) sections.push(wedgeSection(beam, number));
  return { id: beam.id, number: String(number), title: beam.title, short: beam.short, sections };
}

// Tolerances below are the same for every beam of Linac 4 (Referensvärden rows 10, 17, 21, 28, 31, 43).
function fieldSection(beam, number) {
  const id = (name) => `${beam.id}.${name}`;
  const flat = beam.fff ? "OAR" : "Flat";
  return {
    id: id("field"),
    number: `${number}.1`,
    title: "Strålfält",
    subtitle: "GV = HV = 0°",
    intro: [
      "Använd Blue phantom systemet tillsammans med tillhörande programvara MyQA Accept. Rigga upp Blue phantom-systemet på SSD = 90 cm och se till att gantryt och baljan är orienterade korrekt i förhållande till horisontalplanet (se instruktioner Blue phantom).",
      "Beräknade parametrar, såsom symmetri och flatness/OAR, skall göras i enlighet med IEC:s definitioner (använd analysprotokollen ”NUS X” resp. ”NUS FFF” i Accept).",
    ],
    blocks: [
      {
        title: "1. Djupdoser",
        detector: "CC13 (jonkammare)",
        step: "Djupdoser (SSD=90 cm, 10×10 cm² fält). Scanna med jonkammare CC13, djup 0-30 cm. För djupdoser ska Dmax/10 och D20/10 kontrolleras. Jämför med referensvärden. Tolerans: ±1%. Jämför också med referensdata (kurva mot kurva) i programvaran.",
        items: [
          measured(id("dd.dmax10"), "Dmax/10", "", rel(beam.depthDose.dmax10, 0.01)),
          measured(id("dd.d2010"), "D20/10", "", rel(beam.depthDose.d2010, 0.01)),
        ],
      },
      {
        title: "2. Dosprofiler",
        detector: "Skärmad diod",
        note: "Fältstorlek 100 mm",
        step: "Dosprofiler (SSD=90 cm, 10×10 cm² fält, djup 10 cm). Scanna med (skärmad) fotondiod. För dosprofilerna ska penumbrabredden 80/20% (Tolerans: ±1 mm) samt de individuella blockens position kontrolleras (Tolerans: ±1 mm). För FFF används beräknade s.k. inflection points (ist. för 50% dosnivå). Jämför också med referensdata (kurva mot kurva) i programvaran.",
        items: [
          measured(id("pen.minusX"), "Pen −X", "mm", diff(beam.penumbra.x, 1)),
          measured(id("pen.plusX"), "Pen +X", "mm", diff(beam.penumbra.x, 1)),
          measured(id("pen.minusY"), "Pen −Y", "mm", diff(beam.penumbra.y, 1)),
          measured(id("pen.plusY"), "Pen +Y", "mm", diff(beam.penumbra.y, 1)),
          measured(id("pos.minusX"), "Pos −X", "mm", diff(-50, 1), { signed: true }),
          measured(id("pos.plusX"), "Pos +X", "mm", diff(50, 1), { signed: true }),
          measured(id("pos.minusY"), "Pos −Y", "mm", diff(-50, 1), { signed: true }),
          measured(id("pos.plusY"), "Pos +Y", "mm", diff(50, 1), { signed: true }),
        ],
      },
      {
        title: "3. Stjärnmätning",
        detector: "Skärmad diod",
        step: "Stjärnmätning (SSD=90 cm, 40×40 cm², profiler¹ på 10 cm djup i 0, 45, 90 och 135° vinkel). Skanna med (skärmad) fotondiod. Använd programvaran för att bestämma symmetri i de båda diagonalerna. Gör därefter profilerna symmetriska och bestäm deras flatness resp off-axis ratio (OAR) vid 160 mm för FFF. Tolerans: symmetri max 103%, flatness/OAR ±2% från referensvärde. Jämför också med referensdata (kurva mot kurva) i programvaran.",
        footnote: "¹Sätt upp scannen som diagonaler i MyQA Accept eftersom beräkningen av symmetri och flatness inte fungerar för ”Star pattern”.",
        items: [
          measured(id("star.symXY"), "Sym X=Y", "%", diff(100, 3)),
          measured(id("star.symXnegY"), "Sym X=−Y", "%", diff(100, 3)),
          measured(id("star.flatXY"), `${flat} X=Y`, "%", diff(beam.flatness, 2)),
          measured(id("star.flatXnegY"), `${flat} X=−Y`, "%", diff(beam.flatness, 2)),
        ],
      },
    ],
  };
}

function outputSection(beam, number) {
  const id = (name) => `${beam.id}.output.${name}`;
  const doseLabel = `Dos per ${beam.outputMu} MU`;
  return {
    id: `${beam.id}.output`,
    number: `${number}.2`,
    title: "Dosmonitor/output",
    optional: "Denna del behöver inte utföras om absolutdosen har kontrollerats under det senaste halvåret.",
    intro: [
      "Denna del behöver inte utföras om absolutdosen har kontrollerats under det senaste halvåret (se loggen under resp flik ”LXA” och ”LXB” i V:\\Samarbetsytor\\Strålbehandlingen (00465)\\CIMT\\Strålningsfysik\\Utrustningskontroller\\Veckokontroller\\References Linac QA.xlsm).",
      "Dos i referensgeometrin (se dokumentet Referensvärden Dosimetri Strålbehandling). Använd den cylindriska jonkammare som ska användas vid doskontroller tillsammans med den ”lilla vattenbaljan”. Bestråla med det antal MU som ska ge 1 Gy. Beräkna dosen enligt TRS 398 rev1 (IAEA, 2024). Tolerans: ±2%. OBS! Jämför också med senast körda veckokontroll.",
    ],
    link: { href: DOSE_APP_URL, text: "Beräkna dosen i Absolute Dose Calibration" },
    blocks: [
      {
        heading: "Dos i referensgeometrin",
        items: [
          { id: id("detector"), label: "Detektor no.", unit: "", rule: null, fields: [{ key: id("detector"), kind: "text" }] },
          measured(id("nd"), "ND (mGy/nC)", "", null),
          // Reference 1 Gy and tolerance 2 %: Referensvärden J38, J42, J43.
          measured(id("dose1"), `${doseLabel}, mätning 1`, "Gy", rel(1, 0.02)),
          measured(id("dose2"), `${doseLabel}, mätning 2`, "Gy", rel(1, 0.02), { optional: true }),
        ],
      },
    ],
  };
}

const WEDGES = [
  { key: "y1_15", label: "Y1-0°, 15° kil", angle: 15, y1: true },
  { key: "y2_15", label: "Y2-180°, 15° kil", angle: 15, y1: false },
  { key: "y1_60", label: "Y1-0°, 60° kil", angle: 60, y1: true },
  { key: "y2_60", label: "Y2-180°, 60° kil", angle: 60, y1: false },
];
const WEDGE_TOLERANCE = { 15: 0.01, 60: 0.02 }; // Referensvärden L49:L52 and L56:L59

function wedgeSection(beam, number) {
  const id = (name) => `${beam.id}.${name}`;
  const openReading = id("wedge.open");
  const openMinus = id("gradient.open.minus");
  const openPlus = id("gradient.open.plus");
  const openRatio = (read) => derive([read(openMinus), read(openPlus)], (minus, plus) => minus / plus);
  const gradientFields = (prefix) => [
    { key: `${prefix}.minus`, kind: "number", label: "Y = −50 mm" },
    { key: `${prefix}.plus`, kind: "number", label: "Y = +50 mm" },
  ];

  return {
    id: id("wedges"),
    number: `${number}.3`,
    title: "Dynamiska kilar",
    optional: "Ska utföras ifall Y-blocken har kalibrerats, annars i mån av tid.",
    intro: [
      "Ska utföras ifall Y-blocken har kalibrerats, annars i mån av tid.",
      "Mätningarna utförs med StarTrack-systemet (IBA) som placeras inuti fantomet MatriXX MultiCube och linjeras upp med laserlinjer och markeringar på fantomet. StartTrack skall vridas så att elektroniken är riktade mot bordets fotände. Förbestråla 300 MU med ett 20×20 cm² fält. Mät sedan upp dosfördelningen för 100 MU med ett öppet 20×20 cm² fält. Använd patient 0000-101 (HD-MLC) resp 105 (Millenium MLC).",
    ],
    blocks: [
      {
        title: "1. Kilfaktorer",
        detector: "MatriXX",
        step: "Kilfaktorer. Kontrollera kilfaktorerna på centralaxeln för 15 och 60° kil i båda riktningarna, dvs Y1-0° och Y2-180°, för 20×20 cm² fält. Bestråla med 100 MU och spara mätningarna. Dividera mätvärdet* på centralaxeln med dosen från 20×20 cm² öppet fält. Jämför med referensvärden. Tolerans: ±1% (15°) resp. ±2% (60°).",
        footnote: "*För samtliga mätningar med MatriXX/StarTrack måste upplösningen ökas till 1 mm (genom linjär interpolering med funktionen ”Convert Grid”) innan tillförlitliga mätvärden kan tas fram.",
        heading: "Mätvärde (CAX)",
        items: [
          measured(openReading, "Öppet fält", "", null),
          // Wedge factor = reading ÷ open-field reading, like E53 = D53/D$52 on the beam's sheet.
          ...WEDGES.map((wedge) => ({
            id: id(`wedge.${wedge.key}`),
            label: wedge.label,
            unit: "",
            rule: rel(beam.wedgeFactor[wedge.angle], WEDGE_TOLERANCE[wedge.angle]),
            fields: [{ key: id(`wedge.${wedge.key}`), kind: "number" }],
            valueLabel: "Kilfaktor",
            digits: 4,
            waitingFor: "öppet fält",
            derive: (read) => derive([read(id(`wedge.${wedge.key}`)), read(openReading)], (reading, open) => reading / open),
          })),
        ],
      },
      {
        title: "2. Dosgradienter",
        detector: "MatriXX",
        step: "Dosgradienter. Använd de ovan sparade mätningarna och ta fram kvoten mellan dosen vid Y=-5.0 cm och Y=+5.0 cm (på centralaxeln i x-led). Jämför med referensdata. Tolerans: ±1% (15°) resp. ±2% (60°).",
        items: [
          {
            id: id("gradient.open"),
            label: "Öppet fält",
            unit: "",
            rule: null,
            fields: gradientFields(id("gradient.open")),
            valueLabel: "Kvot",
            digits: 4,
            derive: openRatio,
          },
          // Ratio normalised to the open field, like F62 = D62/E62/$F$61. The Y1-0° reference is
          // the inverse of the Y2-180° one, like Referensvärden!K56 = 1/K57.
          ...WEDGES.map((wedge) => {
            const prefix = id(`gradient.${wedge.key}`);
            const y2 = beam.gradientY2[wedge.angle];
            return {
              id: prefix,
              label: wedge.label,
              unit: "",
              rule: rel(wedge.y1 ? 1 / y2 : y2, WEDGE_TOLERANCE[wedge.angle]),
              fields: gradientFields(prefix),
              valueLabel: "Kvot",
              digits: 4,
              waitingFor: "öppet fält",
              derive: (read) =>
                derive([read(`${prefix}.minus`), read(`${prefix}.plus`), openRatio(read)], (minus, plus, open) => minus / plus / open),
            };
          }),
        ],
      },
    ],
  };
}
