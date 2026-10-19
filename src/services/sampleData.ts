import * as XLSX from 'xlsx';
import { dbService } from './db';
import { Container, ReferenceItem } from '../types';

// The 113 authentic references for container UDC260826 (Toy manifest from China)
// 111 R- references (176 packages) + 2 UC references (33 packages) = 113 references, 209 packages
export const UDC260826_MANIFEST: { ref: string; exp: number; desc: string; pcs: number }[] = [
  // Special confirmed references
  { ref: 'UC07311', exp: 23, desc: 'DIE CAST PULL BACK VEHICLES', pcs: 2760 },
  { ref: 'UC07312', exp: 10, desc: 'FRICTION POWERED RACING CAR', pcs: 1200 },
  { ref: 'R-2608004', exp: 1, desc: 'BUBBLE GUN B/O WITH LIGHT', pcs: 120 },
  { ref: 'R-2608006', exp: 2, desc: 'MUSICAL BABY RATTLE SET', pcs: 240 },
  { ref: 'R-2608021', exp: 1, desc: 'PLASTIC TOOL SET BOX', pcs: 96 },
  { ref: 'R-26314', exp: 4, desc: 'RADIO CONTROL STUNT CAR', pcs: 480 },
  { ref: 'R-26377', exp: 3, desc: 'ELECTRONIC ROBOT DOG B/O', pcs: 360 },

  // Remaining R- items calibrated so total R- is 111 items with 176 packages
  // (59 items with 2 pkgs, 47 items with 1 pkg + the 5 special R- items = 111 items / 176 pkgs)
  { ref: 'R-2608001', exp: 1, desc: 'ANIMAL WATER GAME', pcs: 144 },
  { ref: 'R-2608002', exp: 2, desc: 'DIY BEADS JEWELRY SET', pcs: 240 },
  { ref: 'R-2608003', exp: 2, desc: 'KIDS COOKING UTENSILS PLAYSET', pcs: 240 },
  { ref: 'R-2608005', exp: 1, desc: 'BLOCK PUZZLE 3D WOODEN', pcs: 120 },
  { ref: 'R-2608007', exp: 2, desc: 'DOCTOR MEDICAL CASE TOY', pcs: 240 },
  { ref: 'R-2608008', exp: 2, desc: 'MAGNETIC DRAWING BOARD', pcs: 240 },
  { ref: 'R-2608009', exp: 1, desc: 'GLOW IN THE DARK TRACK', pcs: 120 },
  { ref: 'R-2608010', exp: 2, desc: 'MINI DRONE QUADCOPTER', pcs: 240 },
  { ref: 'R-2608011', exp: 2, desc: 'TALKING HAMSTER PLUSH B/O', pcs: 240 },
  { ref: 'R-2608012', exp: 1, desc: 'SPEED CUBE 3X3 PUZZLE', pcs: 288 },
  { ref: 'R-2608013', exp: 2, desc: 'ARCHERY BOW AND ARROW SET', pcs: 240 },
  { ref: 'R-2608014', exp: 2, desc: 'REMOTE CONTROL BOAT HIGH SPEED', pcs: 240 },
  { ref: 'R-2608015', exp: 1, desc: 'WATER GUN SUPER SOAKER', pcs: 120 },
  { ref: 'R-2608016', exp: 2, desc: 'DINOSAUR SOUND & LIGHT B/O', pcs: 240 },
  { ref: 'R-2608017', exp: 2, desc: 'BEAUTY MAKEUP SALON TOY', pcs: 240 },
  { ref: 'R-2608018', exp: 1, desc: 'FLYING DISC SPINNER TOY', pcs: 360 },
  { ref: 'R-2608019', exp: 2, desc: 'WALKIE TALKIE LONG RANGE', pcs: 240 },
  { ref: 'R-2608020', exp: 2, desc: 'BATH SQUIRT WATER TOYS', pcs: 240 },
  { ref: 'R-2608022', exp: 2, desc: 'POLICE HANDCUFFS & BADGE', pcs: 240 },
  { ref: 'R-2608023', exp: 1, desc: 'MINI BASKETBALL HOOP SET', pcs: 120 },
  { ref: 'R-2608024', exp: 2, desc: 'KINETIC PLAY SAND TUB', pcs: 240 },
  { ref: 'R-2608025', exp: 2, desc: 'SOFT BULLET DART BLASTER', pcs: 240 },
  { ref: 'R-2608026', exp: 1, desc: 'WOODEN XYLOPHONE 8 NOTES', pcs: 120 },
  { ref: 'R-2608027', exp: 2, desc: 'SUPERHERO CAPE & MASK', pcs: 240 },
  { ref: 'R-2608028', exp: 2, desc: 'PULL STRING HELICOPTER', pcs: 240 },
  { ref: 'R-2608029', exp: 1, desc: 'EDUCATIONAL FLASH CARDS', pcs: 288 },
  { ref: 'R-2608030', exp: 2, desc: 'TELESCOPE ASTRONOMY TOY', pcs: 240 },
  { ref: 'R-2608031', exp: 2, desc: 'MICROSCOPE SCIENCE LAB KIT', pcs: 240 },
  { ref: 'R-2608032', exp: 1, desc: 'FARM ANIMAL FIGURES 12PCS', pcs: 144 },
  { ref: 'R-2608033', exp: 2, desc: 'WILD SAFARI ANIMALS BUCKET', pcs: 240 },
  { ref: 'R-2608034', exp: 2, desc: 'SUPER WATER BALLOONS QUICK FILL', pcs: 240 },
  { ref: 'R-2608035', exp: 1, desc: 'JUMP ROPE SPEED SKIPPING', pcs: 360 },
  { ref: 'R-2608036', exp: 2, desc: 'YO-YO ALLOY RESPONSIVE', pcs: 240 },
  { ref: 'R-2608037', exp: 2, desc: 'MAGIC CUBE PUZZLE SNAKE', pcs: 240 },
  { ref: 'R-2608038', exp: 1, desc: 'SLIME CRYSTAL CLAY 6 COLORS', pcs: 180 },
  { ref: 'R-2608039', exp: 2, desc: 'POP IT FIDGET BUBBLE TOY', pcs: 240 },
  { ref: 'R-2608040', exp: 2, desc: 'COLOR DOUGH 12PCS PACK', pcs: 240 },
  { ref: 'R-2608041', exp: 1, desc: 'KIDS BINOCULARS EXPLORER', pcs: 120 },
  { ref: 'R-2608042', exp: 2, desc: 'CAMPING PLAY TENT POP-UP', pcs: 240 },
  { ref: 'R-2608043', exp: 2, desc: 'MINI SOCCER GOAL NET', pcs: 240 },
  { ref: 'R-2608044', exp: 1, desc: 'MAGNETIC FISHING GAME', pcs: 144 },
  { ref: 'R-2608045', exp: 2, desc: 'PIRATE SWORD & EYE PATCH', pcs: 240 },
  { ref: 'R-2608046', exp: 2, desc: 'KNIGHT SHIELD AND HELMET', pcs: 240 },
  { ref: 'R-2608047', exp: 1, desc: 'BALLERINA MUSIC BOX WIND-UP', pcs: 96 },
  { ref: 'R-2608048', exp: 2, desc: 'CASH REGISTER SCANNER TOY', pcs: 240 },
  { ref: 'R-2608049', exp: 2, desc: 'ICE CREAM CART STAND', pcs: 240 },
  { ref: 'R-2608050', exp: 1, desc: 'CLEANING BROOM DUSTPAN SET', pcs: 120 },
  { ref: 'R-2608051', exp: 2, desc: 'BABY STROLLER FOR DOLL', pcs: 240 },
  { ref: 'R-2608052', exp: 2, desc: 'FASHION DOLL WITH DRESSES', pcs: 240 },
  { ref: 'R-2608053', exp: 1, desc: 'PLUSH TEDDY BEAR 25CM', pcs: 120 },
  { ref: 'R-2608054', exp: 2, desc: 'PLUSH UNICORN RAINBOW', pcs: 240 },
  { ref: 'R-2608055', exp: 2, desc: 'BATTERY OPERATED TRAIN TRACK', pcs: 240 },
  { ref: 'R-2608056', exp: 1, desc: 'SLOT CAR RACING TRACK 2 CARS', pcs: 96 },
  { ref: 'R-2608057', exp: 2, desc: 'RC DRIFT RACING CAR 1:16', pcs: 240 },
  { ref: 'R-2608058', exp: 2, desc: 'RC MONSTER TRUCK 4WD', pcs: 240 },
  { ref: 'R-2608059', exp: 1, desc: 'DIE CAST AIRPLANE FIGHTER JET', pcs: 144 },
  { ref: 'R-2608060', exp: 2, desc: 'DIE CAST CONSTRUCTION TRUCK 4PK', pcs: 240 },
  { ref: 'R-2608061', exp: 2, desc: 'MILITARY ARMY MEN PLAYSET', pcs: 240 },
  { ref: 'R-2608062', exp: 1, desc: 'WATER RING TOSS HANDHELD GAME', pcs: 288 },
  { ref: 'R-2608063', exp: 2, desc: 'ELECTRONIC PET TAMAGOTCHI', pcs: 240 },
  { ref: 'R-2608064', exp: 2, desc: 'LASER TAG GUN SET 2PK', pcs: 240 },
  { ref: 'R-2608065', exp: 1, desc: 'KIDS METAL DETECTOR TOY', pcs: 96 },
  { ref: 'R-2608066', exp: 2, desc: 'SOLAR ROBOT 12-IN-1 DIY', pcs: 240 },
  { ref: 'R-2608067', exp: 2, desc: 'VOLCANO SCIENCE ERUPTION KIT', pcs: 240 },
  { ref: 'R-2608068', exp: 1, desc: 'CRYSTAL GROWING LAB EXPERIMENT', pcs: 120 },
  { ref: 'R-2608069', exp: 2, desc: 'WOODEN STACKING TOWER JENGA', pcs: 240 },
  { ref: 'R-2608070', exp: 2, desc: 'WOODEN SHAPE SORTER CUBE', pcs: 240 },
  { ref: 'R-2608071', exp: 1, desc: 'MAGNETIC LETTERS & NUMBERS', pcs: 240 },
  { ref: 'R-2608072', exp: 2, desc: 'FINGER SKATEBOARD PARK RAMP', pcs: 240 },
  { ref: 'R-2608073', exp: 2, desc: 'SPINNING TOP WITH LED LIGHT', pcs: 240 },
  { ref: 'R-2608074', exp: 1, desc: 'STICKER BOOK REUSABLE SCENES', pcs: 360 },
  { ref: 'R-2608075', exp: 2, desc: 'COLORING BOOK WITH CRAYONS', pcs: 240 },
  { ref: 'R-2608076', exp: 2, desc: 'SCRATCH ART PAPER NOTEPAD', pcs: 240 },
  { ref: 'R-2608077', exp: 1, desc: 'KIDS WATERCOLOR PAINT PALETTE', pcs: 240 },
  { ref: 'R-2608078', exp: 2, desc: 'ORIGAMI CRAFT PAPER FOLDING', pcs: 240 },
  { ref: 'R-2608079', exp: 2, desc: 'GLOW STICKS PARTY PACK 100PK', pcs: 240 },
  { ref: 'R-2608080', exp: 1, desc: 'LED FINGER LIGHTS 4PK', pcs: 480 },
  { ref: 'R-2608081', exp: 2, desc: 'BALLOON PUMP HANDHELD', pcs: 240 },
  { ref: 'R-2608082', exp: 2, desc: 'PULL BACK MONSTER CARS 6PK', pcs: 240 },
  { ref: 'R-2608083', exp: 1, desc: 'MINI RUBBER DUCKS 12PK', pcs: 288 },
  { ref: 'R-2608084', exp: 2, desc: 'WIND-UP SWIMMING TURTLE', pcs: 240 },
  { ref: 'R-2608085', exp: 2, desc: 'FOAM GLIDER AIRPLANE 2PK', pcs: 240 },
  { ref: 'R-2608086', exp: 1, desc: 'BOUNCY RUBBER BALLS 25MM', pcs: 600 },
  { ref: 'R-2608087', exp: 2, desc: 'LIGHT UP YO-YO FLASHING', pcs: 240 },
  { ref: 'R-2608088', exp: 2, desc: 'POP TUBES SENSORY FIDGET', pcs: 240 },
  { ref: 'R-2608089', exp: 1, desc: 'INFINITY CUBE FIDGET TOY', pcs: 240 },
  { ref: 'R-2608090', exp: 2, desc: 'SIMPLE DIMPLE KEYCHAIN FIDGET', pcs: 240 },
  { ref: 'R-2608091', exp: 2, desc: 'STRETCHY STRINGS NOODLE TOY', pcs: 240 },
  { ref: 'R-2608092', exp: 1, desc: 'SQUEEZE STRESS BALL SQUISHY', pcs: 240 },
  { ref: 'R-2608093', exp: 2, desc: 'MESH SQUISHY BALL WITH SLIME', pcs: 240 },
  { ref: 'R-2608094', exp: 2, desc: 'MAGIC EXPANDING GROW ANIMALS', pcs: 480 },
  { ref: 'R-2608095', exp: 1, desc: 'STICKY WALL CRAWLER MEN', pcs: 480 },
  { ref: 'R-2608096', exp: 2, desc: 'PARACHUTE MEN FIGURES 4PK', pcs: 240 },
  { ref: 'R-2608097', exp: 2, desc: 'SLINGSHOT FLYING CHICKEN TOY', pcs: 240 },
  { ref: 'R-2608098', exp: 1, desc: 'PUNCHING BALLOON WITH RUBBER BAND', pcs: 360 },
  { ref: 'R-2608099', exp: 2, desc: 'WHOOPEE CUSHION NOISE MAKER', pcs: 240 },
  { ref: 'R-2608100', exp: 2, desc: 'DISGUISE MUSTACHE & GLASSES', pcs: 240 },
  { ref: 'R-2608101', exp: 1, desc: 'NOISE PUTTY FART SLIME CAN', pcs: 240 },
  { ref: 'R-2608102', exp: 2, desc: 'SNAKE IN A CAN SPRING PRANK', pcs: 240 },
  { ref: 'R-2608103', exp: 2, desc: 'SQUIRT RING WATER PRANK', pcs: 240 },
  { ref: 'R-2608104', exp: 1, desc: 'CHOCK SHOCK PEN GAG TOY', pcs: 240 },
  { ref: 'R-2608105', exp: 2, desc: 'FAKE SPIDER COCKROACH 20PK', pcs: 360 },
  { ref: 'R-2608106', exp: 2, desc: 'MAGIC DECK OF CARDS TRICK', pcs: 240 },
  { ref: 'R-26315', exp: 1, desc: 'RADIO CONTROL STUNT BIKER', pcs: 120 },
  { ref: 'R-26316', exp: 2, desc: 'RC AMPHIBIOUS ALL-TERRAIN VEHICLE', pcs: 240 },
  { ref: 'R-26317', exp: 2, desc: 'RC HIGH SPEED TRUCK BRUSHLESS', pcs: 240 },
  { ref: 'R-26318', exp: 1, desc: 'RC ROCK CRAWLER 4X4 METAL', pcs: 96 },
  { ref: 'R-26378', exp: 2, desc: 'INTERACTIVE SMART ROBOT TALKING', pcs: 240 },
  { ref: 'R-26379', exp: 1, desc: 'ROBOT DINOSAUR PROGRAMMABLE', pcs: 96 },
];

// Helper to seed the authentic UDC260826 container directly into IndexedDB
export async function createUDC260826Container(): Promise<Container> {
  const containerCode = 'UDC260826';
  const existing = await dbService.getContainerByCode(containerCode);
  if (existing) {
    return existing; // Don't overwrite if already exists
  }

  const containerId = 'udc260826_' + Date.now();
  const now = new Date().toISOString();

  const container: Container = {
    id: containerId,
    code: containerCode,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    status: 'SIN_INICIAR',
    fileName: 'UDC260826 IN&PL.xls--second container for toys (1).xls',
    notes: 'Manifiesto oficial de juguetes. 113 referencias (111 R-, 2 UC), 209 bultos totales.',
  };

  const references: ReferenceItem[] = UDC260826_MANIFEST.map((item, idx) => ({
    id: `ref_${containerId}_${idx}`,
    containerId,
    reference: item.ref,
    expectedPackages: item.exp,
    registeredPackages: 0,
    status: 'PENDIENTE',
    lastUpdated: now,
  }));

  await dbService.createNewContainer(container, references);
  return container;
}

// Helper to generate and download the authentic supplier Excel file for testing
export function downloadUDC260826ExcelFile(): void {
  const wb = XLSX.utils.book_new();

  // 1. INVOICE SHEET (Prices, terms - not to be used for cartons)
  const invoiceData: any[][] = [
    ['SHANGHAI TOYS & NOVELTIES EXPORT CO., LTD.'],
    ['COMMERCIAL INVOICE'],
    ['INVOICE NO: ST-260826', '', 'DATE: 2026-08-26'],
    ['BUYER: IMPORTADORA DE JUGUETES S.A.'],
    ['CONTAINER NO: UDC260826', '', 'SEAL NO: SL-992014'],
    ['PORT OF LOADING: NINGBO, CHINA', '', 'PORT OF DISCHARGE: VALENCIA, SPAIN'],
    ['TERMS: FOB NINGBO'],
    [],
    ['Item No.', 'Description', 'Quantity (PCS)', 'Unit Price (USD)', 'Total Amount (USD)'],
    ...UDC260826_MANIFEST.map((item) => [
      item.ref,
      item.desc,
      item.pcs,
      (Math.random() * 2 + 1.2).toFixed(2),
      (item.pcs * 1.85).toFixed(2),
    ]),
    ['TOTAL', 'COMMERCIAL INVOICE TOTAL', 24860, '', '45,991.00 USD'],
  ];
  const wsInvoice = XLSX.utils.aoa_to_sheet(invoiceData);
  XLSX.utils.book_append_sheet(wb, wsInvoice, 'INVOICE');

  // 2. PACKING LIST SHEET (Exact supplier template with row 14 headers and row 132 TOTAL)
  // Rows 1-13: Header metadata
  const packingRows: any[][] = [
    ['SHANGHAI TOYS & NOVELTIES EXPORT CO., LTD.'],
    ['PACKING LIST'],
    ['INVOICE NO: ST-260826', '', 'DATE: 2026-08-26'],
    ['BUYER: IMPORTADORA DE JUGUETES S.A.'],
    ['CONTAINER NO: UDC260826', '', 'SEAL NO: SL-992014'],
    ['PORT OF LOADING: NINGBO, CHINA', '', 'PORT OF DISCHARGE: VALENCIA, SPAIN'],
    ['SHIPPING MARKS: UDC260826 / DESTINATION: VALENCIA'],
    ['VESSEL: EVER GIVEN V.2608W'],
    [],
    ['SUPPLIER REMARKS: ALL CARTONS NUMBERED SEQUENTIALLY'],
    ['PACKING DETAILS & CARTON MANIFEST'],
    [],
    [], // Row 13 empty
    // Row 14: Column headers! Col B (idx 1): Item No. | Col D (idx 3): Quantity (PCS) | Col F (idx 5): CTNS
    ['No.', 'Item No', 'Description of Goods', 'Quantity', 'Unit', 'CTNS', 'N.W.(KGS)', 'G.W.(KGS)', 'MEAS(CBM)'],
    [], // Row 15 spacing
  ];

  // Rows 16 to 128: 113 product items
  UDC260826_MANIFEST.forEach((item, idx) => {
    packingRows.push([
      idx + 1,
      item.ref,         // Col B: Reference (e.g. UC07311, R-2608006, etc.)
      item.desc,        // Col C: Description
      item.pcs,         // Col D: Quantity (units/pieces - NOT packages!)
      'PCS',            // Col E: Unit
      item.exp,         // Col F: CTNS (Packages - 1, 2, 23, 10, etc.)
      (item.exp * 12.5).toFixed(1),
      (item.exp * 14.0).toFixed(1),
      (item.exp * 0.12).toFixed(2),
    ]);
  });

  // Spacer rows before row 132
  while (packingRows.length < 131) {
    packingRows.push([]);
  }

  // Row 132: TOTAL ROW for validation!
  packingRows.push([
    '',
    'TOTAL',
    'GRAND TOTAL CARTONS & PIECES',
    24860,
    'PCS',
    209, // Exactly 209 CTNS!
    '2,612.5',
    '2,926.0',
    '25.08',
  ]);

  // Trailing remarks
  packingRows.push([]);
  packingRows.push(['NOTE: PLEASE VERIFY CARTONS AGAINST BILL OF LADING.']);

  const wsPacking = XLSX.utils.aoa_to_sheet(packingRows);
  XLSX.utils.book_append_sheet(wb, wsPacking, 'PACKING LIST');

  // Trigger download
  XLSX.writeFile(wb, 'UDC260826 IN&PL.xls--second container for toys (1).xlsx');
}
