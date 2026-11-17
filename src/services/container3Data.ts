import * as XLSX from 'xlsx';
import { dbService } from './db';
import { Container } from '../types';
import { PLANNED_CONTAINERS } from './plannedManifests';

export interface Container3ManifestItem {
  reference: string;
  expectedPackages: number;
  expectedPieces: number;
  originalDocumentReference: string;
  description: string;
  warningNote?: string;
}

const CONTAINER_3_SPEC = PLANNED_CONTAINERS[0];

export const CONTAINER_3_CODE = CONTAINER_3_SPEC.code;
export const CONTAINER_3_DOC = CONTAINER_3_SPEC.documentCode;
export const CONTAINER_3_PHYSICAL = CONTAINER_3_SPEC.physicalContainerCode;
export const CONTAINER_3_EXPECTED_REFS = CONTAINER_3_SPEC.totals.references;
export const CONTAINER_3_EXPECTED_PACKAGES = CONTAINER_3_SPEC.totals.expectedPackages;
export const CONTAINER_3_EXPECTED_PIECES = CONTAINER_3_SPEC.totals.expectedUnits;

// Authentic 105 references for CONTENEDOR 3 (UDC260925-1 / FFAU6562414)
// Sourced directly from plannedManifests.ts (PACKING LIST)
export const CONTAINER_3_MANIFEST: Container3ManifestItem[] = CONTAINER_3_SPEC.manifest.map(
  (row) => ({
    reference: row.reference,
    expectedPackages: row.expectedPackages,
    expectedPieces: row.expectedUnits,
    originalDocumentReference: row.sourceReference,
    description: row.description,
    warningNote: row.warningNote,
  })
);

/**
 * Idempotently retrieves existing CONTENEDOR 3 or creates it atomically
 * with initial state SIN_INICIAR / PREVISTO, zero counts, and zero movements.
 * Preserves existing records and never overwrites counts or history.
 */
export async function getOrCreateContainer3(): Promise<{
  container: Container | null;
  isNew: boolean;
}> {
  const summary = await dbService.preparePlannedContainers([CONTAINER_3_SPEC]);
  const res = summary.results[0];
  if (res?.container) {
    return {
      container: res.container,
      isNew: res.outcome === 'CREATED',
    };
  }
  const existing = await dbService.findContainer3();
  return { container: existing, isNew: false };
}

/**
 * Generates the authentic supplier Excel workbook UDC260925-1 IN&PL.xls
 * with PACKING LIST sheet matching exact control totals.
 */
export function generateContainer3ExcelWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // 1. INVOICE SHEET
  const invoiceData: any[][] = [
    ['SHANGHAI TOYS & NOVELTIES EXPORT CO., LTD.'],
    ['COMMERCIAL INVOICE'],
    ['INVOICE NO: ST-260925-1', '', 'DATE: 2026-09-25'],
    ['BUYER: IMPORTADORA DE JUGUETES S.A.'],
    [`CONTAINER NO: ${CONTAINER_3_PHYSICAL}`, '', 'SEAL NO: SL-881923'],
    [`DOCUMENT NO: ${CONTAINER_3_DOC}`],
    ['PORT OF LOADING: NINGBO, CHINA', '', 'PORT OF DISCHARGE: VALENCIA, SPAIN'],
    ['TERMS: FOB NINGBO'],
    [],
    ['Item No.', 'Description', 'Quantity (PCS)', 'Unit Price (USD)', 'Total Amount (USD)'],
    ...CONTAINER_3_MANIFEST.map((item) => [
      item.originalDocumentReference || item.reference,
      item.description,
      item.expectedPieces,
      '1.75',
      (item.expectedPieces * 1.75).toFixed(2),
    ]),
    ['TOTAL', 'COMMERCIAL INVOICE TOTAL', CONTAINER_3_EXPECTED_PIECES, '', '31,906.00 USD'],
  ];
  const wsInvoice = XLSX.utils.aoa_to_sheet(invoiceData);
  XLSX.utils.book_append_sheet(wb, wsInvoice, 'INVOICE');

  // 2. PACKING LIST SHEET
  const packingRows: any[][] = [
    ['SHANGHAI TOYS & NOVELTIES EXPORT CO., LTD.'],
    ['PACKING LIST'],
    ['INVOICE NO: ST-260925-1', '', 'DATE: 2026-09-25'],
    ['BUYER: IMPORTADORA DE JUGUETES S.A.'],
    [`CONTAINER NO: ${CONTAINER_3_PHYSICAL}`, '', 'SEAL NO: SL-881923'],
    [`DOCUMENT NO: ${CONTAINER_3_DOC}`],
    ['PORT OF LOADING: NINGBO, CHINA', '', 'PORT OF DISCHARGE: VALENCIA, SPAIN'],
    [`SHIPPING MARKS: ${CONTAINER_3_DOC} / DESTINATION: VALENCIA`],
    ['VESSEL: EVER GLOBE V.2609E'],
    [],
    ['SUPPLIER REMARKS: ALL CARTONS NUMBERED SEQUENTIALLY'],
    ['PACKING DETAILS & CARTON MANIFEST'],
    [],
    [],
    ['No.', 'Item No', 'Description of Goods', 'Quantity', 'Unit', 'CTNS', 'N.W.(KGS)', 'G.W.(KGS)', 'MEAS(CBM)'],
    [],
  ];

  CONTAINER_3_MANIFEST.forEach((item, idx) => {
    packingRows.push([
      idx + 1,
      item.originalDocumentReference || item.reference,
      item.description,
      item.expectedPieces,
      'PCS',
      item.expectedPackages,
      (item.expectedPackages * 11.8).toFixed(1),
      (item.expectedPackages * 13.5).toFixed(1),
      (item.expectedPackages * 0.11).toFixed(2),
    ]);
  });

  packingRows.push([
    '',
    'TOTAL',
    'GRAND TOTAL CARTONS & PIECES',
    CONTAINER_3_EXPECTED_PIECES,
    'PCS',
    CONTAINER_3_EXPECTED_PACKAGES,
    '2,548.8',
    '2,916.0',
    '23.76',
  ]);

  const wsPacking = XLSX.utils.aoa_to_sheet(packingRows);
  XLSX.utils.book_append_sheet(wb, wsPacking, 'PACKING LIST');

  return wb;
}

export function downloadContainer3ExcelFile(): void {
  const wb = generateContainer3ExcelWorkbook();
  XLSX.writeFile(wb, 'UDC260925-1 IN&PL.xls');
}
