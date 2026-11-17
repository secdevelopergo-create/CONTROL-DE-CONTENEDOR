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
  | 'MANUAL_ADD_REF'
  | 'UNDO'
  | 'COMPENSATING_UNDO';

export interface Container {
  id: string;
  code: string;
  createdAt: string; // ISO
  startedAt: string | null;
  completedAt: string | null;
  status: ContainerStatus;
  notes?: string;
  fileName?: string;
  physicalContainer?: string;
  documentNumber?: string;
  sourceSha256?: string;
  lookupAliases?: string[];
}

export interface ReferenceItem {
  id: string;
  containerId: string;
  reference: string; // Normalized (uppercase, trimmed, unified hyphens)
  expectedPackages: number;
  registeredPackages: number;
  status: ReferenceStatus;
  lastUpdated: string;
  canonicalReference?: string;
  originalDocumentReference?: string;
  sourceReference?: string;
  warningNote?: string;
  expectedPieces?: number;
  expectedUnits?: number;
  description?: string;
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
  undoneMovementId?: string;
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

export interface PlannedManifestRow {
  reference: string;
  sourceReference: string;
  expectedPackages: number;
  expectedUnits: number;
  description: string;
  warningNote?: string;
}

export interface PlannedContainerSpec {
  id: string;
  code: string;
  documentCode: string;
  physicalContainerCode: string;
  lookupAliases: string[];
  totals: {
    references: number;
    expectedPackages: number;
    expectedUnits: number;
  };
  sourceFile: string;
  sourceSha256: string;
  manifest: PlannedManifestRow[];
}

export type ContainerConflictType =
  | 'DUPLICATE_CONTAINERS'
  | 'DUPLICATE_REFERENCE'
  | 'MISSING_REFERENCE'
  | 'EXPECTED_PACKAGES_MISMATCH'
  | 'EXPECTED_UNITS_MISMATCH'
  | 'UNEXPECTED_REFERENCE';

export interface ContainerConflictDetail {
  type: ContainerConflictType;
  reference?: string;
  sourceReference?: string;
  message: string;
  storedValue?: string | number;
  manifestValue?: string | number;
  registeredPackages?: number;
  existingContainerIds?: string[];
}

export interface ContainerPrepareResult {
  specId: string;
  code: string;
  documentCode: string;
  physicalContainerCode: string;
  outcome: 'CREATED' | 'EXISTING_MATCH' | 'CONFLICT';
  existingContainerId?: string;
  container?: Container;
  expectedReferences: number;
  expectedPackages: number;
  expectedUnits: number;
  preservedManualReferencesCount: number;
  conflicts: ContainerConflictDetail[];
}

export interface PlannedPreparationSummary {
  preparedAt: string;
  results: ContainerPrepareResult[];
  hasConflicts: boolean;
  totalCreated: number;
  totalExistingMatch: number;
  totalWithConflicts: number;
}
