import * as XLSX from 'xlsx';
import {
  ReferenceItem,
  RejectedRow,
  ImportPreview,
  Container,
  Movement,
  UnidentifiedItem,
  ContainerStats,
} from '../types';
import { normalizeReference, calculateReferenceStatus } from './db';

export interface ParsedWorkbook {
  sheetNames: string[];
  workbook: XLSX.WorkBook;
  rawSheetsData: Record<string, any[][]>;
}

export function readExcelFile(file: File): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, {
          type: 'array',
          cellDates: true,
          cellText: true,
        });

        const rawSheetsData: Record<string, any[][]> = {};
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (sheet) {
            // raw 2D array
            const data = XLSX.utils.sheet_to_json<any[]>(sheet, {
              header: 1,
              defval: '',
              blankrows: false,
            });
            rawSheetsData[sheetName] = data;
          }
        }

        const sheetNames = [...workbook.SheetNames];
        // If workbook contains PACKING LIST sheet, prioritize it as the default sheet
        const plIdx = sheetNames.findIndex(
          (s) =>
            s.trim().toUpperCase() === 'PACKING LIST' ||
            s.trim().toUpperCase() === 'PACKINGLIST' ||
            s.trim().toUpperCase().includes('PACKING')
        );
        if (plIdx > 0) {
          const pl = sheetNames.splice(plIdx, 1)[0];
          sheetNames.unshift(pl);
        }

        resolve({
          sheetNames,
          workbook,
          rawSheetsData,
        });
      } catch (err: any) {
        reject(new Error('No se pudo leer el archivo Excel/CSV: ' + (err?.message || err)));
      }
    };

    reader.onerror = () => reject(new Error('Error al cargar el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// Auto-detect columns from raw sheet rows (scans up to row 35 for supplier templates like row 14)
export function detectColumnsAndHeaderRow(rows: any[][]): {
  headerRowIndex: number;
  columns: string[];
  suggestedRefCol: string;
  suggestedPkgCol: string;
} {
  // Reference keywords
  const refKeywords = [
    'item no',
    'item no.',
    'item #',
    'item_no',
    'item-no',
    'item number',
    'item',
    'referencia',
    'referencias',
    'ref',
    'ref.',
    'código',
    'codigo',
    'sku',
    'part number',
    'part_number',
    'part no',
    'part no.',
    'art no',
    'art. no',
    'model no',
    'model',
    'articulo',
    'artículo',
    'producto',
    'reference',
  ];

  // Packages keywords
  const pkgKeywords = [
    'ctns',
    'ctn',
    'ctns.',
    'cartons',
    'carton',
    'bulto',
    'bultos',
    'cant. bultos',
    'cant bultos',
    'cajas',
    'caja',
    'packages',
    'package',
    'pkg',
    'pkgs',
    'total ctns',
    'nro bultos',
    'bultos esperados',
    'cantidad bultos',
  ];

  // Negative keywords for packages (never select units/pieces by mistake)
  const pieceKeywords = [
    'quantity',
    'qty',
    'qty (pcs)',
    'qty(pcs)',
    'pieces',
    'piece',
    'piezas',
    'piezas/caja',
    'piezas por caja',
    'unidades',
    'unidad',
    'pcs',
    'pc',
    'unid',
    'uds',
    'unit',
    'units',
    'pzas',
    'pz',
    'und',
    'cant piezas',
    'cant. piezas',
    'cant unidades',
    'total piezas',
    'qty pcs',
    'amount',
    'price',
    'unit price',
    'cbm',
    'n.w.',
    'g.w.',
    'nw',
    'gw',
    'meas',
    'measurement',
  ];

  let bestHeaderRowIndex = 0;
  let highestScore = -1;
  let bestColumns: string[] = [];

  // Scan up to 35 rows to find the authentic header row (e.g. Row 14 in China supplier Packing Lists)
  const maxScanRows = Math.min(35, rows.length);
  for (let r = 0; r < maxScanRows; r++) {
    const row = rows[r] || [];
    const nonEmptyCells = row
      .map((c) => String(c || '').trim())
      .filter((c) => c.length > 0 && c.length < 50);

    if (nonEmptyCells.length < 2) continue;

    let score = 0;
    let hasRef = false;
    let hasPkg = false;

    for (const cell of nonEmptyCells) {
      const lower = cell.toLowerCase().trim();

      // Check if matches ref
      if (refKeywords.some((kw) => lower === kw || lower.startsWith(kw + ' ') || lower.includes(kw))) {
        hasRef = true;
        score += 15;
      }

      // Check if matches pkg (and not piece)
      const isPiece = pieceKeywords.some((pk) => lower === pk || lower.startsWith(pk + ' ') || lower.includes(pk));
      if (!isPiece && pkgKeywords.some((kw) => lower === kw || lower.includes(kw))) {
        hasPkg = true;
        score += 15;
      }

      // Add points for standard column header length
      if (cell.length <= 25) score += 1;
    }

    if (hasRef && hasPkg) score += 30; // Big bonus for matching both

    if (score > highestScore) {
      highestScore = score;
      bestHeaderRowIndex = r;
      bestColumns = row.map((cell, idx) => {
        const str = String(cell || '').trim();
        return str || `Columna ${idx + 1}`;
      });
    }
  }

  // Fallback if no scored row found
  if (bestColumns.length === 0 && rows.length > 0) {
    bestColumns = (rows[0] || []).map((cell, idx) => {
      const str = String(cell || '').trim();
      return str || `Columna ${idx + 1}`;
    });
  }

  let suggestedRefCol = '';
  let suggestedPkgCol = '';

  for (const col of bestColumns) {
    const lower = col.toLowerCase().trim();

    // Check ref
    if (!suggestedRefCol) {
      if (refKeywords.some((kw) => lower === kw || lower.startsWith(kw + ' ') || lower.includes(kw))) {
        suggestedRefCol = col;
      }
    }

    // Check pkg
    if (!suggestedPkgCol) {
      const isPiece = pieceKeywords.some((pk) => lower === pk || lower.startsWith(pk + ' ') || lower.includes(pk));
      if (!isPiece && pkgKeywords.some((kw) => lower === kw || lower.includes(kw))) {
        suggestedPkgCol = col;
      }
    }
  }

  // Safe fallback: never auto-pick piece column
  if (!suggestedRefCol && bestColumns.length > 0) {
    suggestedRefCol = bestColumns[0];
  }
  if (!suggestedPkgCol && bestColumns.length > 1) {
    const safeCol = bestColumns.find((c) => {
      if (c === suggestedRefCol) return false;
      const l = c.toLowerCase().trim();
      return !pieceKeywords.some((pk) => l === pk || l.includes(pk));
    });
    suggestedPkgCol = safeCol || '';
  }

  return {
    headerRowIndex: bestHeaderRowIndex,
    columns: bestColumns,
    suggestedRefCol,
    suggestedPkgCol,
  };
}

export function isPieceOrUnitColumn(columnName: string): boolean {
  if (!columnName) return false;
  const lower = columnName.toLowerCase().trim();
  const pieceKeywords = [
    'quantity',
    'qty',
    'piece',
    'pieces',
    'pieza',
    'piezas',
    'unidades',
    'unidad',
    'pcs',
    'unid',
    'uds',
    'unit',
    'units',
    'pzas',
    'pz',
    'und',
    'cant piezas',
    'cant unidades',
    'total piezas',
    'amount',
    'price',
  ];
  return pieceKeywords.some((pk) => lower === pk || lower.startsWith(pk + ' ') || lower.includes(pk));
}

// Parse and aggregate references
export function processImportRows(
  rows: any[][],
  headerRowIndex: number,
  refColumnName: string,
  pkgColumnName: string
): {
  grouped: { reference: string; expectedPackages: number; rowCount: number }[];
  rejectedRows: RejectedRow[];
  totalExpectedPackages: number;
  declaredTotalInFile?: number;
  totalMatchesDeclared?: boolean;
} {
  const headerRow = rows[headerRowIndex] || [];
  const refIndex = headerRow.findIndex((cell) => String(cell || '').trim() === refColumnName);
  const pkgIndex = headerRow.findIndex((cell) => String(cell || '').trim() === pkgColumnName);

  if (refIndex === -1 || pkgIndex === -1) {
    throw new Error('No se encontraron las columnas seleccionadas en los datos del archivo.');
  }

  const map = new Map<string, { expectedPackages: number; rowCount: number }>();
  const rejectedRows: RejectedRow[] = [];
  let declaredTotalInFile: number | undefined = undefined;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const rawRef = row[refIndex];
    const rawPkg = row[pkgIndex];

    const refString = rawRef != null ? String(rawRef).trim() : '';

    // Ignore completely blank lines
    if (!refString && (rawPkg === '' || rawPkg == null)) {
      continue;
    }

    // Clean reference
    const normalizedRef = normalizeReference(refString);

    // Check if this row is the TOTAL row (e.g. Row 132: TOTAL 209 CTNS)
    const upperRef = normalizedRef.toUpperCase();
    const isTotalRow =
      upperRef === 'TOTAL' ||
      upperRef === 'TOTALS' ||
      upperRef.startsWith('TOTAL ') ||
      upperRef.startsWith('TOTAL:') ||
      upperRef === 'GRAND TOTAL' ||
      upperRef === 'SUM' ||
      upperRef === 'TOTAL CTNS';

    if (isTotalRow) {
      let parsedTotal: number | null = null;
      if (typeof rawPkg === 'number') {
        parsedTotal = rawPkg;
      } else {
        const cleaned = String(rawPkg || '').trim().replace(/\s+/g, '').replace(',', '.');
        const num = Number(cleaned);
        if (!isNaN(num) && num > 0) parsedTotal = num;
      }
      if (parsedTotal !== null) {
        declaredTotalInFile = parsedTotal;
      }
      continue; // DO NOT import TOTAL as a product reference!
    }

    // Check if this row is supplier metadata/footer (e.g. notes, remarks, container number, signatures)
    const isSupplierMetaRow = [
      'NOTE:',
      'REMARK:',
      'CONTAINER NO',
      'SEAL NO',
      'PORT OF',
      'VESSEL',
      'SHIPPER',
      'CONSIGNEE',
      'BANK DETAILS',
      'PAYMENT TERM',
      'SIGNATURE',
    ].some((kw) => upperRef.includes(kw));

    if (isSupplierMetaRow && (rawPkg === '' || rawPkg == null || isNaN(Number(String(rawPkg).trim())))) {
      continue; // Skip non-product metadata
    }

    if (!refString) {
      rejectedRows.push({
        rowNumber: i + 1,
        rawReference: '(Vacía)',
        rawPackages: rawPkg,
        reason: 'Referencia vacía o en blanco.',
      });
      continue;
    }

    if (!normalizedRef) {
      rejectedRows.push({
        rowNumber: i + 1,
        rawReference: refString,
        rawPackages: rawPkg,
        reason: 'Referencia inválida tras normalizar.',
      });
      continue;
    }

    // Parse package quantity
    let pkgNumber: number;
    if (typeof rawPkg === 'number') {
      pkgNumber = rawPkg;
    } else {
      const cleaned = String(rawPkg || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(',', '.');
      pkgNumber = Number(cleaned);
    }

    if (isNaN(pkgNumber)) {
      rejectedRows.push({
        rowNumber: i + 1,
        rawReference: normalizedRef,
        rawPackages: rawPkg,
        reason: 'La cantidad de bultos no es un número válido.',
      });
      continue;
    }

    if (pkgNumber <= 0) {
      rejectedRows.push({
        rowNumber: i + 1,
        rawReference: normalizedRef,
        rawPackages: rawPkg,
        reason: 'La cantidad de bultos debe ser mayor a 0 (recibido: ' + pkgNumber + ').',
      });
      continue;
    }

    if (!Number.isInteger(pkgNumber)) {
      rejectedRows.push({
        rowNumber: i + 1,
        rawReference: normalizedRef,
        rawPackages: rawPkg,
        reason: 'Los bultos deben ser enteros exactos, no decimales (recibido: ' + pkgNumber + ').',
      });
      continue;
    }

    // Group and sum packages for identical references
    const existing = map.get(normalizedRef);
    if (existing) {
      existing.expectedPackages += pkgNumber;
      existing.rowCount += 1;
    } else {
      map.set(normalizedRef, {
        expectedPackages: pkgNumber,
        rowCount: 1,
      });
    }
  }

  const grouped: { reference: string; expectedPackages: number; rowCount: number }[] = [];
  let totalExpectedPackages = 0;

  map.forEach((val, ref) => {
    grouped.push({
      reference: ref,
      expectedPackages: val.expectedPackages,
      rowCount: val.rowCount,
    });
    totalExpectedPackages += val.expectedPackages;
  });

  // Sort alphabetically/numerically
  grouped.sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  const totalMatchesDeclared =
    declaredTotalInFile !== undefined ? totalExpectedPackages === declaredTotalInFile : undefined;

  return {
    grouped,
    rejectedRows,
    totalExpectedPackages,
    declaredTotalInFile,
    totalMatchesDeclared,
  };
}

// Convert grouped into ReferenceItem records ready to save
export function createReferenceItems(
  containerId: string,
  grouped: { reference: string; expectedPackages: number }[]
): ReferenceItem[] {
  const now = new Date().toISOString();
  return grouped.map((item, idx) => ({
    id: `ref_${containerId}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    containerId,
    reference: item.reference,
    expectedPackages: item.expectedPackages,
    registeredPackages: 0,
    status: 'PENDIENTE',
    lastUpdated: now,
  }));
}

// --- EXPORT COMPREHENSIVE REPORT TO EXCEL (.xlsx) ---
export function exportContainerReport(
  container: Container,
  stats: ContainerStats,
  references: ReferenceItem[],
  unidentified: UnidentifiedItem[],
  movements: Movement[]
): void {
  const wb = XLSX.utils.book_new();

  const formatDate = (iso?: string | null) => {
    if (!iso) return 'No registrado';
    return new Date(iso).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'SIN_INICIAR':
        return 'Sin Iniciar';
      case 'EN_PROCESO':
        return 'En Proceso';
      case 'FINALIZADO_CORRECTO':
        return 'DESCARGA FINALIZADA CORRECTAMENTE (100% Coincidente)';
      case 'FINALIZADO_CON_DIFERENCIAS':
        return 'DESCARGA FINALIZADA CON DIFERENCIAS';
      default:
        return s;
    }
  };

  // 1. SHEET: RESUMEN
  const summaryData = [
    ['INFORME DE CONTROL DE DESCARGA DE CONTENEDOR'],
    ['Generado el', formatDate(new Date().toISOString())],
    [],
    ['DATOS DEL CONTENEDOR'],
    ['Código / Nombre:', container.code],
    ['Archivo Original:', container.fileName || 'N/A'],
    ['Fecha de Importación:', formatDate(container.createdAt)],
    ['Fecha de Inicio:', formatDate(container.startedAt)],
    ['Fecha de Finalización:', formatDate(container.completedAt)],
    ['Estado de la Descarga:', getStatusLabel(container.status)],
    [],
    ['INDICADORES CLAVE DE BULTOS'],
    ['Bultos Esperados:', stats.expectedPackages],
    ['Bultos Registrados:', stats.registeredPackages],
    ['Bultos Faltantes:', stats.missingPackages],
    ['Bultos Sobrantes:', stats.surplusPackages],
    ['Porcentaje de Descarga:', `${stats.progressPercentage}%`],
    [],
    ['INDICADORES DE REFERENCIAS'],
    ['Total de Referencias:', stats.totalReferences],
    ['Referencias Completas:', stats.completeReferences],
    ['Referencias Parciales:', stats.partialReferences],
    ['Referencias Pendientes:', stats.pendingReferences],
    ['Referencias con Sobrante:', stats.overageReferences],
    ['Mercancía No Identificada:', stats.unidentifiedCount],
    [],
    ['NOTAS / OBSERVACIONES:', container.notes || 'Sin observaciones registradas.'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'RESUMEN');

  // 2. SHEET: TODAS LAS REFERENCIAS
  const allRefsData = [
    [
      'REFERENCIA',
      'BULTOS ESPERADOS',
      'BULTOS REGISTRADOS',
      'FALTANTES',
      'SOBRANTES',
      'ESTADO',
      'ÚLTIMA ACTUALIZACIÓN',
    ],
    ...references.map((r) => [
      r.reference,
      r.expectedPackages,
      r.registeredPackages,
      Math.max(0, r.expectedPackages - r.registeredPackages),
      Math.max(0, r.registeredPackages - r.expectedPackages),
      r.status,
      formatDate(r.lastUpdated),
    ]),
  ];
  const wsAll = XLSX.utils.aoa_to_sheet(allRefsData);
  XLSX.utils.book_append_sheet(wb, wsAll, 'TODAS LAS REFERENCIAS');

  // 3. SHEET: FALTANTES
  const missingRefs = references.filter((r) => r.registeredPackages < r.expectedPackages);
  const missingData = [
    ['REFERENCIA', 'BULTOS ESPERADOS', 'BULTOS REGISTRADOS', 'FALTAN', 'ESTADO'],
    ...missingRefs.map((r) => [
      r.reference,
      r.expectedPackages,
      r.registeredPackages,
      r.expectedPackages - r.registeredPackages,
      r.status,
    ]),
  ];
  const wsMissing = XLSX.utils.aoa_to_sheet(missingData);
  XLSX.utils.book_append_sheet(wb, wsMissing, 'FALTANTES');

  // 4. SHEET: SOBRANTES
  const overageRefs = references.filter((r) => r.registeredPackages > r.expectedPackages);
  if (overageRefs.length > 0) {
    const overageData = [
      ['REFERENCIA', 'BULTOS ESPERADOS', 'BULTOS REGISTRADOS', 'SOBRANTE', 'ESTADO'],
      ...overageRefs.map((r) => [
        r.reference,
        r.expectedPackages,
        r.registeredPackages,
        r.registeredPackages - r.expectedPackages,
        'SOBRANTE',
      ]),
    ];
    const wsOverage = XLSX.utils.aoa_to_sheet(overageData);
    XLSX.utils.book_append_sheet(wb, wsOverage, 'SOBRANTES');
  }

  // 5. SHEET: NO IDENTIFICADAS
  if (unidentified.length > 0) {
    const unData = [
      ['REFERENCIA NO IDENTIFICADA', 'BULTOS REGISTRADOS', 'FECHA REGISTRO', 'OBSERVACIONES'],
      ...unidentified.map((u) => [
        u.reference,
        u.registeredPackages,
        formatDate(u.createdAt),
        u.notes || '',
      ]),
    ];
    const wsUn = XLSX.utils.aoa_to_sheet(unData);
    XLSX.utils.book_append_sheet(wb, wsUn, 'NO IDENTIFICADAS');
  }

  // 6. SHEET: HISTORIAL DE MOVIMIENTOS
  if (movements.length > 0) {
    const movData = [
      [
        'FECHA Y HORA',
        'REFERENCIA',
        'CANTIDAD',
        'CONTEO PREVIO',
        'CONTEO RESULTANTE',
        'TIPO OPERACIÓN',
        'DETALLE',
      ],
      ...movements.map((m) => [
        formatDate(m.timestamp),
        m.reference,
        m.quantity,
        m.previousCount,
        m.newCount,
        m.operationType,
        m.details || '',
      ]),
    ];
    const wsMov = XLSX.utils.aoa_to_sheet(movData);
    XLSX.utils.book_append_sheet(wb, wsMov, 'HISTORIAL');
  }

  // Auto-adjust column widths for readability
  [wsSummary, wsAll, wsMissing].forEach((ws) => {
    ws['!cols'] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
    ];
  });

  const fileNameClean = container.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Informe_Descarga_${fileNameClean}_${Date.now()}.xlsx`);
}

// Export as CSV
export function exportContainerCSV(
  container: Container,
  references: ReferenceItem[]
): void {
  const headers = [
    'REFERENCIA',
    'BULTOS_ESPERADOS',
    'BULTOS_REGISTRADOS',
    'BULTOS_FALTANTES',
    'BULTOS_SOBRANTES',
    'ESTADO',
  ];

  const rows = references.map((r) => [
    `"${r.reference.replace(/"/g, '""')}"`,
    r.expectedPackages,
    r.registeredPackages,
    Math.max(0, r.expectedPackages - r.registeredPackages),
    Math.max(0, r.registeredPackages - r.expectedPackages),
    r.status,
  ]);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM for Spanish accents and Excel compatibility
    [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileNameClean = container.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `Descarga_${fileNameClean}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
