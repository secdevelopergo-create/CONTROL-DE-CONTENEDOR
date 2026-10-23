import React, { useState, useEffect } from 'react';
import { AlertCircle, PackagePlus, X, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';

interface UnidentifiedModalProps {
  isOpen: boolean;
  referenceCode: string;
  initialQuantity: number;
  onClose: () => void;
  onConfirm: (reference: string, packages: number, notes?: string) => Promise<void>;
  onAddAsReference?: (
    reference: string,
    expectedPackages: number,
    registeredPackages: number,
    notes?: string
  ) => Promise<boolean>;
}

export const UnidentifiedModal: React.FC<UnidentifiedModalProps> = ({
  isOpen,
  referenceCode,
  initialQuantity,
  onClose,
  onConfirm,
  onAddAsReference,
}) => {
  const [mode, setMode] = useState<'OFFICIAL_REF' | 'UNIDENTIFIED'>('OFFICIAL_REF');
  const [packages, setPackages] = useState(initialQuantity || 1);
  const [expectedPackages, setExpectedPackages] = useState(initialQuantity || 1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPackages(initialQuantity || 1);
      setExpectedPackages(initialQuantity || 1);
      setNotes('');
      setMode('OFFICIAL_REF');
    }
  }, [isOpen, initialQuantity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (packages <= 0) return;

    setIsSubmitting(true);
    try {
      if (mode === 'OFFICIAL_REF' && onAddAsReference) {
        const success = await onAddAsReference(
          referenceCode,
          expectedPackages,
          packages,
          notes.trim() || undefined
        );
        if (success) onClose();
      } else {
        await onConfirm(referenceCode, packages, notes.trim() || undefined);
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-400 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Warning */}
        <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-6 h-6 stroke-[2.5]" />
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight">
                REFERENCIA NO ENCONTRADA EN EXCEL
              </h2>
              <p className="text-[11px] text-amber-100 font-medium">
                No estaba en el archivo original del contenedor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-100 hover:text-white hover:bg-amber-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-center">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              REFERENCIA ANUNCIADA / REGISTRADA
            </p>
            <p className="font-mono text-2xl font-extrabold text-amber-950">
              {referenceCode}
            </p>
            <p className="text-xs text-amber-700">
              Esta mercancía acaba de llegar pero no figuraba en el manifiesto importado.
            </p>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('OFFICIAL_REF')}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'OFFICIAL_REF'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>Agregar al Contenedor</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('UNIDENTIFIED')}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'UNIDENTIFIED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              <span>Mercancía Inesperada</span>
            </button>
          </div>

          {/* Explanation Banner */}
          {mode === 'OFFICIAL_REF' ? (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Se agregará a la lista oficial de referencias del contenedor.</p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Podrás seguir sumándole bultos normalmente durante la descarga y saldrá en los informes de descarga.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Se registrará en la sección aislada &quot;Mercancía No Identificada&quot;.</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  No alterará el manifiesto original del contenedor ni sumará a las referencias del Excel.
                </p>
              </div>
            </div>
          )}

          {/* Quantities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'OFFICIAL_REF' && (
              <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Bultos Esperados:
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setExpectedPackages((prev) => Math.max(0, prev - 1))}
                    className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-l-lg font-bold text-slate-700 text-base active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={expectedPackages}
                    onChange={(e) => setExpectedPackages(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 h-10 border-y border-slate-300 bg-white text-center font-mono font-bold text-base text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setExpectedPackages((prev) => prev + 1)}
                    className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-r-lg font-bold text-slate-700 text-base active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className={`space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 ${mode === 'UNIDENTIFIED' ? 'sm:col-span-2' : ''}`}>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Bultos Recibidos Ahora:
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setPackages((prev) => Math.max(1, prev - 1))}
                  className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-l-lg font-bold text-slate-700 text-base active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={packages}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setPackages(val);
                    if (mode === 'OFFICIAL_REF' && expectedPackages === packages) {
                      setExpectedPackages(val);
                    }
                  }}
                  className="flex-1 h-10 border-y border-slate-300 bg-white text-center font-mono font-bold text-base text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = packages + 1;
                    setPackages(next);
                    if (mode === 'OFFICIAL_REF' && expectedPackages === packages) {
                      setExpectedPackages(next);
                    }
                  }}
                  className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-r-lg font-bold text-slate-700 text-base active:scale-95"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Observaciones (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej. Mercancía adicional, producto no registrado en lista..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-95 ${
                mode === 'OFFICIAL_REF'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Guardando...'
                  : mode === 'OFFICIAL_REF'
                  ? '+ AGREGAR REFERENCIA Y BULTOS'
                  : '+ REGISTRAR COMO INESPERADA'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
