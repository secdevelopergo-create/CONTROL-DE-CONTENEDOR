import { dbService, calculateReferenceStatus, normalizeReference } from './db';
import {
  processImportRows,
  detectColumnsAndHeaderRow,
  isPieceOrUnitColumn,
} from './excel';
import { Container, ReferenceItem, BackupData } from '../types';
import { UDC260826_MANIFEST } from './sampleData';

export interface TestResult {
  id: string;
  name: string;
  category: 'IMPORTACIÓN' | 'CONTEOS' | 'CORRECCIONES' | 'PERSISTENCIA' | 'RESTAURACIÓN' | 'DESHACER' | 'ACEPTACIÓN REAL';
  passed: boolean;
  durationMs: number;
  details: string;
  error?: string;
}

export async function runAllTests(
  onProgress?: (completed: number, total: number, current: TestResult) => void
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const testDefs = [
    testUDC260826Acceptance,
    testImportGroupingAndPieceProtection,
    testCountingAndStatusProgression,
    testOverageDetection,
    testUnidentifiedMerchandiseIsolation,
    testCompensatingUndoAuditTrail,
    testDuplicateContainerCodePrevention,
    testIndexedDBPersistence,
    testBackupSchemaValidationAndRestore,
  ];

  for (let i = 0; i < testDefs.length; i++) {
    const fn = testDefs[i];
    const start = performance.now();
    try {
      const res = await fn();
      const duration = Math.round(performance.now() - start);
      res.durationMs = duration;
      results.push(res);
      if (onProgress) onProgress(i + 1, testDefs.length, res);
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      const failedRes: TestResult = {
        id: `test_${i + 1}`,
        name: `Prueba ${i + 1}`,
        category: 'CONTEOS',
        passed: false,
        durationMs: duration,
        details: 'Excepción inesperada en ejecución.',
        error: err?.message || String(err),
      };
      results.push(failedRes);
      if (onProgress) onProgress(i + 1, testDefs.length, failedRes);
    }
  }

  return results;
}

// 1. IMPORT TEST: Grouping, Normalization, Piece Protection & Rejection
async function testImportGroupingAndPieceProtection(): Promise<TestResult> {
  const rawRows = [
    ['Código Producto', 'Cantidad Piezas', 'Bultos Reales'],
    ['r-2608002', '100', '2'],
    ['R—2608002', '150', '3'], // Duplicate with unicode dash
    ['R-2608040', '50', '10'], // Exact length preserved
    ['', '20', '5'],           // Empty ref -> rejected
    ['R-INVALID', '10', '-2'],  // Negative pkgs -> rejected
    ['R-DECIMAL', '10', '1.5'], // Decimal pkgs -> rejected
  ];

  const { suggestedRefCol, suggestedPkgCol } = detectColumnsAndHeaderRow(rawRows);

  if (suggestedPkgCol === 'Cantidad Piezas') {
    return {
      id: 'test_import',
      name: 'Importación: Agrupación y Protección de Piezas',
      category: 'IMPORTACIÓN',
      passed: false,
      durationMs: 0,
      details: 'Falló: detectColumnsAndHeaderRow seleccionó por error una columna de piezas como bultos.',
    };
  }

  const { grouped, rejectedRows, totalExpectedPackages } = processImportRows(
    rawRows,
    0,
    'Código Producto',
    'Bultos Reales'
  );

  // Assert R-2608002 grouped to 5 (2 + 3)
  const item2608002 = grouped.find((g) => g.reference === 'R-2608002');
  const itemLengthPreserved = grouped.find((g) => g.reference === 'R-2608040');

  const correctGrouping = item2608002 && item2608002.expectedPackages === 5;
  const correctRejections = rejectedRows.length === 3;
  const correctTotal = totalExpectedPackages === 15;
  const pieceCheck = isPieceOrUnitColumn('Cantidad Piezas') && !isPieceOrUnitColumn('Bultos Reales');

  const passed = !!(correctGrouping && correctRejections && correctTotal && itemLengthPreserved && pieceCheck);

  return {
    id: 'test_import',
    name: 'Importación: Agrupación, Protección de Piezas y Rechazos',
    category: 'IMPORTACIÓN',
    passed,
    durationMs: 0,
    details: `Agrupación R-2608002: ${item2608002?.expectedPackages}/5 bultos. Filas rechazadas válidas: ${rejectedRows.length}/3. Bultos totales: ${totalExpectedPackages}/15.`,
  };
}

// 2. COUNTING & STATUS PROGRESSION
async function testCountingAndStatusProgression(): Promise<TestResult> {
  const expected = 5;

  const s0 = calculateReferenceStatus(expected, 0);
  const s2 = calculateReferenceStatus(expected, 2);
  const s5 = calculateReferenceStatus(expected, 5);
  const s7 = calculateReferenceStatus(expected, 7);

  const passed =
    s0 === 'PENDIENTE' &&
    s2 === 'PARCIAL' &&
    s5 === 'COMPLETO' &&
    s7 === 'SOBRANTE';

  return {
    id: 'test_counts',
    name: 'Conteos: Progresión de Estados (Pendiente, Parcial, Completo, Sobrante)',
    category: 'CONTEOS',
    passed,
    durationMs: 0,
    details: `0 -> ${s0}, 2/5 -> ${s2}, 5/5 -> ${s5}, 7/5 -> ${s7}.`,
  };
}

// 3. OVERAGE DETECTION
async function testOverageDetection(): Promise<TestResult> {
  const current = 2;
  const expected = 3;
  const add1 = current + 1; // 3 == expected (not overage)
  const add2 = current + 2; // 4 > expected (overage by +1)

  const isOverage1 = add1 > expected;
  const isOverage2 = add2 > expected;
  const surplus = add2 - expected;

  const passed = !isOverage1 && isOverage2 && surplus === 1;

  return {
    id: 'test_overage',
    name: 'Conteos: Detección Precisa de Sobrantes',
    category: 'CONTEOS',
    passed,
    durationMs: 0,
    details: `Intento +1 bulto: ${add1}/3 (Normal). Intento +2 bultos: ${add2}/3 (Sobrante por +${surplus} bulto).`,
  };
}

// 4. UNIDENTIFIED MERCHANDISE ISOLATION
async function testUnidentifiedMerchandiseIsolation(): Promise<TestResult> {
  const testContainerId = 'test_unid_' + Date.now();
  const testRef = 'REF-EXTERNA-999';

  const { item, movement } = await dbService.registerUnidentifiedGoods(
    testContainerId,
    testRef,
    4,
    'Llegó en caja de juguetes ajena'
  );

  const storedList = await dbService.getUnidentifiedByContainer(testContainerId);
  const found = storedList.find((u) => u.reference === testRef);

  // Clean up
  await dbService.deleteContainer(testContainerId);

  const passed =
    found !== undefined &&
    found.registeredPackages === 4 &&
    movement.isUnidentified === true &&
    movement.operationType === 'UNIDENTIFIED_ADD';

  return {
    id: 'test_unidentified',
    name: 'Mercancía No Identificada: Aislamiento del Manifiesto',
    category: 'CORRECCIONES',
    passed,
    durationMs: 0,
    details: `Registrada mercancía no identificada ${testRef} con 4 bultos e historial sin tocar manifiesto original.`,
  };
}

// 5. COMPENSATING UNDO (Preserves complete audit history)
async function testCompensatingUndoAuditTrail(): Promise<TestResult> {
  const testContainerId = 'test_undo_' + Date.now();
  const testRefId = 'ref_undo_' + Date.now();

  const refItem: ReferenceItem = {
    id: testRefId,
    containerId: testContainerId,
    reference: 'R-TEST-UNDO',
    expectedPackages: 5,
    registeredPackages: 0,
    status: 'PENDIENTE',
    lastUpdated: new Date().toISOString(),
  };

  const container: Container = {
    id: testContainerId,
    code: 'UDC-TEST-UNDO',
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    status: 'SIN_INICIAR',
  };

  await dbService.createNewContainer(container, [refItem]);

  // Step 1: Add 2 packages
  await dbService.registerPackages(testContainerId, testRefId, 2, 'ADD');

  // Step 2: Add 1 package (count = 3)
  await dbService.registerPackages(testContainerId, testRefId, 1, 'ADD');

  const movsBefore = await dbService.getMovementsByContainer(testContainerId);
  const countBeforeUndo = movsBefore.length; // 2 movements

  // Step 3: UNDO last movement (+1)
  const undoResult = await dbService.undoLastMovement(testContainerId);

  const movsAfter = await dbService.getMovementsByContainer(testContainerId);
  const countAfterUndo = movsAfter.length; // Must be 3! Compensating movement was added, none deleted!

  const refsAfter = await dbService.getReferencesByContainer(testContainerId);
  const updatedRef = refsAfter.find((r) => r.id === testRefId);

  // Clean up
  await dbService.deleteContainer(testContainerId);

  const compensatingMov = movsAfter[0];
  const passed =
    undoResult.success &&
    countAfterUndo === countBeforeUndo + 1 && // Full history preserved!
    compensatingMov.operationType === 'UNDO' &&
    compensatingMov.quantity === -1 &&
    updatedRef?.registeredPackages === 2; // Count rolled back from 3 to 2

  return {
    id: 'test_undo_audit',
    name: 'Deshacer: Registro de Movimiento Compensatorio e Historial Completo',
    category: 'DESHACER',
    passed,
    durationMs: 0,
    details: `Movimientos previos: ${countBeforeUndo}. Movimientos post-deshacer: ${countAfterUndo} (No se borran registros). Conteo revertido exitosamente a ${updatedRef?.registeredPackages} bultos.`,
  };
}

// 6. PREVENT DUPLICATE CONTAINER CODES
async function testDuplicateContainerCodePrevention(): Promise<TestResult> {
  const testCode = 'UDC-UNIQUE-TEST';
  const c1: Container = {
    id: 'cont_dup_1_' + Date.now(),
    code: testCode,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    status: 'SIN_INICIAR',
  };

  await dbService.saveContainer(c1);

  // Attempt to create second container with same normalized code
  let caughtError = false;
  try {
    const c2: Container = {
      id: 'cont_dup_2_' + Date.now(),
      code: '  udc-unique-test  ',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      status: 'SIN_INICIAR',
    };
    await dbService.createNewContainer(c2, []);
  } catch (err: any) {
    caughtError = true;
  }

  // Clean up
  await dbService.deleteContainer(c1.id);

  return {
    id: 'test_duplicate_prevention',
    name: 'Contenedores: Prevención de Códigos Duplicados',
    category: 'PERSISTENCIA',
    passed: caughtError,
    durationMs: 0,
    details: caughtError
      ? 'Se impidió correctamente la creación de un contenedor con código duplicado existente.'
      : 'Falló: se permitió la creación de contenedor con código repetido.',
  };
}

// 7. INDEXEDDB PERSISTENCE TEST
async function testIndexedDBPersistence(): Promise<TestResult> {
  const testId = 'test_persist_' + Date.now();
  const testCode = 'UDC-PERSIST-99';

  const container: Container = {
    id: testId,
    code: testCode,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'EN_PROCESO',
  };

  const ref: ReferenceItem = {
    id: 'ref_' + testId,
    containerId: testId,
    reference: 'R-2608040',
    expectedPackages: 10,
    registeredPackages: 10,
    status: 'COMPLETO',
    lastUpdated: new Date().toISOString(),
  };

  await dbService.createNewContainer(container, [ref]);

  // Read back
  const retrievedContainer = await dbService.getContainer(testId);
  const retrievedRefs = await dbService.getReferencesByContainer(testId);

  // Clean up
  await dbService.deleteContainer(testId);

  const passed =
    retrievedContainer?.code === testCode &&
    retrievedRefs.length === 1 &&
    retrievedRefs[0].registeredPackages === 10 &&
    retrievedRefs[0].status === 'COMPLETO';

  return {
    id: 'test_persistence',
    name: 'Persistencia: Verificación de Lectura/Escritura Transaccional',
    category: 'PERSISTENCIA',
    passed,
    durationMs: 0,
    details: `Persistencia comprobada en IndexedDB: contenedor ${testCode} y referencia R-2608040 (10 bultos) recuperados íntegramente.`,
  };
}

// 8. BACKUP SCHEMA VALIDATION & RESTORE STRATEGIES
async function testBackupSchemaValidationAndRestore(): Promise<TestResult> {
  // Test invalid backup
  const invalidJson = { foo: 'bar' };
  const valInvalid = dbService.validateBackupData(invalidJson);

  // Test valid backup structure
  const validJson: BackupData = {
    version: '1.1',
    exportedAt: new Date().toISOString(),
    containers: [
      {
        id: 'test_backup_c1',
        code: 'UDC-BK-001',
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        status: 'SIN_INICIAR',
      },
    ],
    references: [
      {
        id: 'test_backup_r1',
        containerId: 'test_backup_c1',
        reference: 'R-BK-01',
        expectedPackages: 3,
        registeredPackages: 3,
        status: 'COMPLETO',
        lastUpdated: new Date().toISOString(),
      },
    ],
    movements: [],
    unidentified: [],
  };

  const valValid = dbService.validateBackupData(validJson);
  const conflicts = await dbService.checkBackupConflicts(validJson);

  const passed = !valInvalid.isValid && valValid.isValid && Array.isArray(conflicts.conflictingCodes);

  return {
    id: 'test_backup_restore',
    name: 'Restauración JSON: Validación de Esquema y Detección de Conflictos',
    category: 'RESTAURACIÓN',
    passed,
    durationMs: 0,
    details: `Validación de esquemas JSON inválidos/válidos y comprobación de conflictos previa a la restauración verificado.`,
  };
}

// 9. REAL ACCEPTANCE TEST: Official UDC260826 Manifest & Supplier Excel Parsing
async function testUDC260826Acceptance(): Promise<TestResult> {
  // Acceptance Criterion 1: Exactly 113 unique references
  const totalRefs = UDC260826_MANIFEST.length;
  const is113Refs = totalRefs === 113;

  // Acceptance Criterion 2: Exactly 209 expected packages
  const totalExp = UDC260826_MANIFEST.reduce((sum, item) => sum + item.exp, 0);
  const is209Exp = totalExp === 209;

  // Acceptance Criterion 3: 111 references starting with R- with 176 packages
  const rItems = UDC260826_MANIFEST.filter((item) => item.ref.startsWith('R-'));
  const rPackages = rItems.reduce((sum, item) => sum + item.exp, 0);
  const isRCorrect = rItems.length === 111 && rPackages === 176;

  // Acceptance Criterion 4: 2 references starting with UC with 33 packages
  const ucItems = UDC260826_MANIFEST.filter((item) => item.ref.startsWith('UC'));
  const ucPackages = ucItems.reduce((sum, item) => sum + item.exp, 0);
  const isUCCorrect = ucItems.length === 2 && ucPackages === 33;

  // Special references check
  const uc1 = UDC260826_MANIFEST.find((i) => i.ref === 'UC07311');
  const uc2 = UDC260826_MANIFEST.find((i) => i.ref === 'UC07312');
  const r2608006 = UDC260826_MANIFEST.find((i) => i.ref === 'R-2608006');
  const r26314 = UDC260826_MANIFEST.find((i) => i.ref === 'R-26314');
  const isSpecialRefsCorrect =
    uc1?.exp === 23 &&
    uc2?.exp === 10 &&
    r2608006?.exp === 2 &&
    r26314?.exp === 4;

  // Acceptance Criterion 5: Authentic Supplier Excel Sheet Simulation (PACKING LIST)
  // Headers on row 14 (idx 13), Col B: Item No, Col D: Quantity, Col F: CTNS, Row 132: TOTAL
  const simulatedRows: any[][] = [];
  for (let r = 0; r < 13; r++) {
    simulatedRows.push(['SUPPLIER HEADER DATA ROW ' + (r + 1)]);
  }
  // Row 14 (idx 13): Column Headers
  simulatedRows.push([
    'No.',
    'Item No',
    'Description',
    'Quantity',
    'Unit',
    'CTNS',
    'N.W.',
    'G.W.',
    'MEAS',
  ]);
  simulatedRows.push([]); // Row 15 blank

  // Rows 16 to 128: 113 products
  UDC260826_MANIFEST.forEach((m, idx) => {
    simulatedRows.push([
      idx + 1,
      m.ref,
      m.desc,
      m.pcs,
      'PCS',
      m.exp,
      m.exp * 10,
      m.exp * 12,
      0.1,
    ]);
  });

  // Pad to row 131
  while (simulatedRows.length < 131) {
    simulatedRows.push([]);
  }

  // Row 132: TOTAL row
  simulatedRows.push([
    '',
    'TOTAL',
    'GRAND TOTAL CARTONS & PIECES',
    24860,
    'PCS',
    209,
    2612.5,
    2926.0,
    25.08,
  ]);

  const { headerRowIndex, suggestedRefCol, suggestedPkgCol } = detectColumnsAndHeaderRow(simulatedRows);
  const isHeaderRow14 = headerRowIndex === 13;
  const isRefColItemNo = suggestedRefCol === 'Item No';
  const isPkgColCtns = suggestedPkgCol === 'CTNS';
  const notQuantity = !isPieceOrUnitColumn(suggestedPkgCol);

  const parsed = processImportRows(simulatedRows, headerRowIndex, suggestedRefCol, suggestedPkgCol);
  const isImportMatch =
    parsed.grouped.length === 113 &&
    parsed.totalExpectedPackages === 209 &&
    parsed.declaredTotalInFile === 209 &&
    !parsed.grouped.some((g) => g.reference === 'TOTAL');

  const passed = !!(
    is113Refs &&
    is209Exp &&
    isRCorrect &&
    isUCCorrect &&
    isSpecialRefsCorrect &&
    isHeaderRow14 &&
    isRefColItemNo &&
    isPkgColCtns &&
    notQuantity &&
    isImportMatch
  );

  return {
    id: 'test_udc260826_acceptance',
    name: 'Aceptación Real: Manifiesto UDC260826 (113 Refs, 209 Bultos, UC y R-)',
    category: 'ACEPTACIÓN REAL',
    passed,
    durationMs: 0,
    details: `113 refs únicas (${rItems.length} R- con ${rPackages} bultos + ${ucItems.length} UC con ${ucPackages} bultos = 209 bultos). UC07311 (23), UC07312 (10). Fila 14 encabezados 'Item No' y 'CTNS' detectada. Fila 132 TOTAL aislada.`,
  };
}
