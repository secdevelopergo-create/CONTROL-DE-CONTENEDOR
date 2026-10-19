export type ContainerStatus =
  | 'SIN_INICIAR'
  | 'EN_PROCESO'
  | 'FINALIZADO_CORRECTO'
  | 'FINALIZADO_CON_DIFERENCIAS';

export type ReferenceStatus =
  | 'PENDIENTE'
  | 'PARCIAL'
  | 'COMPLETO'
  | 'SOBRANTE';

export type OperationType =
  | 'ADD'
  | 'REMOVE'
  | 'CORRECTION'
  | 'UNIDENTIFIED_ADD'
  | 'UNDO';

export interface Container {
  id: string;
  code: string;
  createdAt: string; // ISO
  startedAt: string | null;
  completedAt: string | null;
  status: ContainerStatus;
  notes?: string;
  fileName?: string;
}

export interface ReferenceItem {
  id: string;
  containerId: string;
  reference: string; // Normalized (uppercase, trimmed, unified hyphens)
  expectedPackages: number;
  registeredPackages: number;
  status: ReferenceStatus;
  lastUpdated: string;
}

export interface UnidentifiedItem {
  id: string;
  containerId: string;
  reference: string;
  registeredPackages: number;
  createdAt: string;
  notes?: string;
}

export interface Movement {
  id: string;
  containerId: string;
  reference: string;
  isUnidentified: boolean;
  quantity: number; // e.g., +1, +4, -1, or change
  previousCount: number;
  newCount: number;
  operationType: OperationType;
  timestamp: string; // ISO
  details?: string;
}

export interface RejectedRow {
  rowNumber: number;
  rawReference: string;
  rawPackages: any;
  reason: string;
}

export interface ImportPreview {
  containerCode: string;
  fileName: string;
  sheetName: string;
  allSheets: string[];
  referenceColumn: string;
  packagesColumn: string;
  columns: string[];
  rawRowsSample: any[];
  groupedReferences: {
    reference: string;
    expectedPackages: number;
    rowCount: number;
  }[];
  totalExpectedPackages: number;
  totalUniqueReferences: number;
  rejectedRows: RejectedRow[];
  declaredTotalInFile?: number;
  totalMatchesDeclared?: boolean;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  containers: Container[];
  references: ReferenceItem[];
  movements: Movement[];
  unidentified: UnidentifiedItem[];
}

export interface ContainerStats {
  totalReferences: number;
  completeReferences: number;
  partialReferences: number;
  pendingReferences: number;
  overageReferences: number;
  expectedPackages: number;
  registeredPackages: number;
  missingPackages: number;
  surplusPackages: number;
  unidentifiedCount: number;
  progressPercentage: number;
}
