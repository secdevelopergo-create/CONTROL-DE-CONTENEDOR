import React from 'react';
import {
  X,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Play,
  RefreshCw,
  Info,
  PackageCheck,
} from 'lucide-react';
import {
  PlannedPreparationSummary,
  ContainerConflictDetail,
  ContainerPrepareResult,
} from '../types';
import { PLANNED_AGGREGATE_TOTALS } from '../services/plannedManifests';

interface PrepareContainersModalProps {
  isOpen: boolean;
  summary: PlannedPreparationSummary | null;
  isPreparing: boolean;
  onClose: () => void;
  onRunPrepare: () => Promise<void>;
  onOpenContainer: (containerId: string) => void;
}

const CONFLICT_TYPE_LABELS: Record<ContainerConflictDetail['type'], string> = {
  DUPLICATE_CONTAINERS: 'Contenedores equivalentes duplicados',
  DUPLICATE_REFERENCE: 'Referencia duplicada',
  MISSING_REFERENCE: 'Referencia faltante en registro guardado',
  EXPECTED_PACKAGES_MISMATCH: 'Diferencia en bultos esperados',
  EXPECTED_UNITS_MISMATCH: 'Diferencia en piezas previstas',
  UNEXPECTED_REFERENCE: 'Referencia no prevista en manifiesto',
};

export const PrepareContainersModal: React.FC<PrepareContainersModalProps> = ({
  isOpen,
  summary,
  isPreparing,
  onClose,
  onRunPrepare,
  onOpenContainer,
}) => {
  if (!isOpen) return null;

  const getOutcomeBadge = (res: ContainerPrepareResult) => {
    if (res.outcome === 'CREATED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <PackageCheck className="w-3.5 h-3.5" />
          Creado en 0 (SIN_INICIAR)
        </span>
      );
    }
    if (res.outcome === 'EXISTING_MATCH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Existente conservado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <ShieldAlert className="w-3.5 h-3.5" />
        CONFLICTO ({res.conflicts.length})
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold shadow-md">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-blue-300">
                  Manifiestos Previstos PACKING LIST
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-900 text-blue-200 border border-blue-800">
                  SIN_INICIAR / PREVISTO
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                Contenedores 3, 4 y 5
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-blue-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Aggregate Summary Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-800">
                Totales de control previstos del conjunto (3, 4 y 5):
              </span>
              <span className="font-mono font-extrabold text-slate-900 text-sm">
                {PLANNED_AGGREGATE_TOTALS.references} referencias ·{' '}
                {PLANNED_AGGREGATE_TOTALS.expectedPackages} bultos ·{' '}
                {PLANNED_AGGREGATE_TOTALS.expectedUnits.toLocaleString('es-ES')} piezas previstas
              </span>
            </div>
            <div className="flex items-start gap-2 text-slate-600 pt-1 border-t border-slate-200">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p>
                Estos datos son únicamente la previsión del PACKING LIST para descarga física. No confirman llegada de mercancía, no borran ni sobrescriben conteos o historiales existentes, y abrir un contenedor no inicia su descarga automáticamente.
              </p>
            </div>
          </div>

          {/* Conflict Alert Banner */}
          {summary?.hasConflicts && (
            <div className="p-4 rounded-xl border-2 border-rose-400 bg-rose-50 text-rose-950 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-extrabold text-sm text-rose-900">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Se detectaron conflictos respecto al manifiesto previsto oficial</span>
              </div>
              <p className="text-rose-900">
                Por seguridad operativa, <strong>ningún contenedor, conteo ni historial existente fue sobrescrito, fusionado ni eliminado</strong>. Revisa el detalle por contenedor y referencia más abajo.
              </p>
            </div>
          )}

          {/* Container Cards */}
          {!summary ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Verificando manifiestos e identidad logística en IndexedDB...
            </div>
          ) : (
            <div className="space-y-4">
              {summary.results.map((res) => (
                <div
                  key={res.specId}
                  className={`rounded-xl border p-4 space-y-3 ${
                    res.outcome === 'CONFLICT'
                      ? 'border-rose-300 bg-rose-50/30'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold font-mono text-slate-900">
                          {res.code}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          Doc: {res.documentCode}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          Físico: {res.physicalContainerCode}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-slate-600">
                        Control: <strong>{res.expectedReferences}</strong> ref ·{' '}
                        <strong>{res.expectedPackages}</strong> bultos ·{' '}
                        <span className="text-slate-500">
                          {res.expectedUnits.toLocaleString('es-ES')} piezas previstas (inf.)
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {getOutcomeBadge(res)}
                      {res.existingContainerId && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenContainer(res.existingContainerId!);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Abrir</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {res.preservedManualReferencesCount > 0 && (
                    <div className="text-[11px] text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 font-medium">
                      Se conservaron {res.preservedManualReferencesCount} referencia(s) agregada(s) manualmente en este dispositivo.
                    </div>
                  )}

                  {res.container && (
                    <div className="text-[11px] text-slate-500 font-mono flex flex-wrap gap-x-4 gap-y-1">
                      <span>ID almacenado: {res.container.id}</span>
                      <span>Estado actual: {res.container.status}</span>
                    </div>
                  )}

                  {/* Conflict details */}
                  {res.conflicts.length > 0 && (
                    <div className="border border-rose-200 rounded-lg bg-white divide-y divide-rose-100 max-h-56 overflow-y-auto">
                      {res.conflicts.map((conflict, cIdx) => (
                        <div key={cIdx} className="p-2.5 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-bold text-rose-800">
                              {CONFLICT_TYPE_LABELS[conflict.type]}
                              {conflict.reference ? ` · ${conflict.reference}` : ''}
                            </span>
                            {conflict.sourceReference &&
                              conflict.sourceReference !== conflict.reference && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700">
                                  Doc: {conflict.sourceReference}
                                </span>
                              )}
                          </div>
                          <p className="text-slate-700">{conflict.message}</p>
                          {(conflict.storedValue !== undefined ||
                            conflict.manifestValue !== undefined) && (
                            <p className="font-mono text-[11px] text-slate-600">
                              Guardado: <strong>{String(conflict.storedValue)}</strong> | Manifiesto:{' '}
                              <strong>{String(conflict.manifestValue)}</strong>
                              {conflict.registeredPackages !== undefined &&
                                conflict.registeredPackages > 0 && (
                                  <span className="text-blue-700 ml-2">
                                    (Contados: {conflict.registeredPackages} bultos)
                                  </span>
                                )}
                            </p>
                          )}
                          {conflict.existingContainerIds &&
                            conflict.existingContainerIds.length > 0 && (
                              <ul className="list-disc list-inside font-mono text-[11px] text-slate-600">
                                {conflict.existingContainerIds.map((idStr, i) => (
                                  <li key={i}>{idStr}</li>
                                ))}
                              </ul>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRunPrepare}
            disabled={isPreparing}
            className="px-4 py-2 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 text-blue-800 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPreparing ? 'animate-spin' : ''}`} />
            <span>{isPreparing ? 'Verificando...' : 'Volver a comprobar'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
