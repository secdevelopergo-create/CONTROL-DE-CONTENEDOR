import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  AlertTriangle,
  X,
  Package,
  Layers,
  FileSpreadsheet,
  AlertOctagon,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Container, ReferenceItem, UnidentifiedItem, ContainerStats } from '../types';

interface FinalizeModalProps {
  isOpen: boolean;
  container: Container;
  stats: ContainerStats;
  references: ReferenceItem[];
  unidentified: UnidentifiedItem[];
  onClose: () => void;
  onConfirmFinalize: (status: Container['status'], notes?: string) => Promise<void>;
  onReopenContainer?: () => Promise<void>;
}

export const FinalizeModal: React.FC<FinalizeModalProps> = ({
  isOpen,
  container,
  stats,
  references,
  unidentified,
  onClose,
  onConfirmFinalize,
  onReopenContainer,
}) => {
  const [finalNotes, setFinalNotes] = React.useState(container.notes || '');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Analyze differences
  const missingRefs = references.filter((r) => r.registeredPackages < r.expectedPackages);
  const overageRefs = references.filter((r) => r.registeredPackages > r.expectedPackages);
  const hasDifferences =
    missingRefs.length > 0 || overageRefs.length > 0 || unidentified.length > 0;

  useEffect(() => {
    if (isOpen && !hasDifferences) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe if canvas unavailable
      }
    }
  }, [isOpen, hasDifferences]);

  if (!isOpen) return null;

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      const finalStatus = hasDifferences
        ? 'FINALIZADO_CON_DIFERENCIAS'
        : 'FINALIZADO_CORRECTO';
      await onConfirmFinalize(finalStatus, finalNotes.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyFinalized =
    container.status === 'FINALIZADO_CORRECTO' ||
    container.status === 'FINALIZADO_CON_DIFERENCIAS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div
          className={`px-6 py-4 text-white flex items-center justify-between ${
            hasDifferences ? 'bg-amber-600' : 'bg-emerald-600'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {hasDifferences ? (
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            )}
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight">
                {hasDifferences
                  ? 'DESCARGA FINALIZADA CON DIFERENCIAS'
                  : 'DESCARGA COMPLETADA CORRECTAMENTE'}
              </h2>
              <p className="text-xs text-white/80">
                Contenedor: <span className="font-mono font-bold">{container.code}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* CASO A: TODO CORRECTO */}
          {!hasDifferences ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-emerald-900">
                  ¡Coincidencia Exacta al 100%!
                </h3>
                <p className="text-xs text-emerald-800">
                  Todas las referencias y bultos descargados coinciden exactamente con el manifiesto Excel original. No se detectaron faltantes, sobrantes ni mercancía desconocida.
                </p>
              </div>

              {/* Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Referencias</p>
                  <p className="text-lg font-mono font-bold text-emerald-700">
                    {stats.completeReferences} / {stats.totalReferences}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Bultos Esperados</p>
                  <p className="text-lg font-mono font-bold text-slate-800">
                    {stats.expectedPackages}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Bultos Recibidos</p>
                  <p className="text-lg font-mono font-bold text-emerald-700">
                    {stats.registeredPackages}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Diferencia</p>
                  <p className="text-lg font-mono font-bold text-emerald-600">
                    0
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* CASO B: HAY DIFERENCIAS */
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <AlertOctagon className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">El conteo no coincide exactamente con el manifiesto.</p>
                  <p className="text-amber-800 mt-0.5">
                    En la operativa real de contenedores pueden existir faltantes o sobrantes físicos. Puedes dar por concluida la descarga con estas discrepancias para formalizar el informe de auditoría.
                  </p>
                </div>
              </div>

              {/* SECTION: FALTANTES */}
              {missingRefs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase">
                    <span className="flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      REFERENCIAS FALTANTES ({missingRefs.length} ref, {stats.missingPackages} bultos)
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-slate-100 text-xs font-mono">
                    {missingRefs.map((r) => {
                      const faltan = r.expectedPackages - r.registeredPackages;
                      return (
                        <div
                          key={r.id}
                          className="p-2.5 flex items-center justify-between bg-amber-50/40 hover:bg-amber-50/80"
                        >
                          <span className="font-bold text-slate-900">{r.reference}</span>
                          <div className="text-right text-slate-700">
                            <span>Esperados {r.expectedPackages}</span> —{' '}
                            <span>Recibidos {r.registeredPackages}</span> —{' '}
                            <span className="text-amber-800 font-bold">Faltan {faltan}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: SOBRANTES */}
              {overageRefs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-800 uppercase">
                    <span className="flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                      REFERENCIAS CON SOBRANTES ({overageRefs.length})
                    </span>
                  </div>
                  <div className="border border-rose-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto divide-y divide-rose-100 text-xs font-mono">
                    {overageRefs.map((r) => {
                      const sobran = r.registeredPackages - r.expectedPackages;
                      return (
                        <div
                          key={r.id}
                          className="p-2.5 flex items-center justify-between bg-rose-50/40"
                        >
                          <span className="font-bold text-slate-900">{r.reference}</span>
                          <div className="text-right text-rose-800">
                            <span>Esperados {r.expectedPackages}</span> —{' '}
                            <span>Recibidos {r.registeredPackages}</span> —{' '}
                            <span className="font-bold">Sobran +{sobran}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: MERCANCÍA NO IDENTIFICADA */}
              {unidentified.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-900 uppercase">
                    <span>MERCANCÍA NO IDENTIFICADA ({unidentified.length})</span>
                  </div>
                  <div className="border border-purple-200 rounded-xl overflow-hidden max-h-36 overflow-y-auto divide-y divide-purple-100 text-xs font-mono">
                    {unidentified.map((u) => (
                      <div
                        key={u.id}
                        className="p-2.5 flex items-center justify-between bg-purple-50/40"
                      >
                        <span className="font-bold text-slate-900">{u.reference}</span>
                        <div className="text-right text-purple-800">
                          <span className="font-bold">{u.registeredPackages} bultos</span>
                          {u.notes && <span className="text-[11px] block text-slate-500 font-sans">{u.notes}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observations / Final Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Observaciones Finales de la Descarga:
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre el precinto, estado de la mercancía, incidencias..."
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Reopen option if already finalized */}
          {isAlreadyFinalized && onReopenContainer ? (
            <button
              type="button"
              onClick={async () => {
                if (confirm('¿Deseas reabrir esta descarga para registrar o corregir bultos? Se conservará todo el historial.')) {
                  await onReopenContainer();
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reabrir Descarga</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
            >
              Continuar Contando
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleFinish}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-2 active:scale-95 transition-all ${
                hasDifferences
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <span>
                {hasDifferences
                  ? 'Confirmar Finalización Con Diferencias'
                  : 'Confirmar Finalización Correcta'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
