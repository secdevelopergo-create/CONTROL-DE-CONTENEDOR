import React, { useState, useEffect, useMemo } from 'react';
import { PackagePlus, X, AlertCircle, Check, HelpCircle, Layers, Info } from 'lucide-react';
import { ReferenceItem } from '../types';
import { normalizeReference } from '../services/db';

interface AddReferenceModalProps {
  isOpen: boolean;
  initialReference?: string;
  initialQuantity?: number;
  existingReferences: ReferenceItem[];
  onClose: () => void;
  onAddReference: (
    refCode: string,
    expectedPackages: number,
    registeredPackages: number,
    notes?: string
  ) => Promise<boolean>;
}

export const AddReferenceModal: React.FC<AddReferenceModalProps> = ({
  isOpen,
  initialReference = '',
  initialQuantity = 1,
  existingReferences,
  onClose,
  onAddReference,
}) => {
  const [refCode, setRefCode] = useState(initialReference);
  const [expectedPkgs, setExpectedPkgs] = useState<number>(initialQuantity);
  const [registeredPkgs, setRegisteredPkgs] = useState<number>(initialQuantity);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRefCode(initialReference);
      setExpectedPkgs(initialQuantity || 1);
      setRegisteredPkgs(initialQuantity || 1);
      setNotes('');
      setErrorMsg(null);
    }
  }, [isOpen, initialReference, initialQuantity]);

  // Check if reference already exists in this container
  const normalizedInput = useMemo(() => normalizeReference(refCode), [refCode]);
  const duplicateItem = useMemo(() => {
    if (!normalizedInput) return null;
    return existingReferences.find((r) => normalizeReference(r.reference) === normalizedInput) || null;
  }, [normalizedInput, existingReferences]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!normalizedInput) {
      setErrorMsg('Debes ingresar un código de referencia válido.');
      return;
    }

    if (duplicateItem) {
      setErrorMsg(
        `La referencia "${normalizedInput}" ya existe en el contenedor (${duplicateItem.registeredPackages}/${duplicateItem.expectedPackages} bultos). No se pueden crear referencias duplicadas.`
      );
      return;
    }

    if (expectedPkgs < 0 || registeredPkgs < 0) {
      setErrorMsg('Las cantidades de bultos no pueden ser negativas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onAddReference(
        normalizedInput,
        expectedPkgs,
        registeredPkgs,
        notes.trim() || undefined
      );
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error agregando la referencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight">
                AGREGAR NUEVA REFERENCIA
              </h2>
              <p className="text-[11px] text-slate-400">
                Incorpora productos no registrados en el archivo Excel original
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reference input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Código de Referencia:</span>
              <span className="text-[10px] text-slate-400 font-normal">Cualquier formato alfanumérico</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Ej. R-26415, UC07315, R-2609001..."
              value={refCode}
              onChange={(e) => {
                setRefCode(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-300 font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase"
            />

            {/* Live Duplicate Warning */}
            {duplicateItem && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Esta referencia ya existe en el contenedor.</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Actualmente tiene <b>{duplicateItem.registeredPackages}</b> de{' '}
                    <b>{duplicateItem.expectedPackages}</b> bultos registrados ({duplicateItem.status}).
                    Para registrar más bultos, búscala en la pantalla de descarga o selecciónala en el listado.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Packages configuration grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Expected Packages */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Bultos Esperados:
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setExpectedPkgs((prev) => Math.max(0, prev - 1))}
                  className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-l-lg font-bold text-slate-700 active:scale-95 text-base"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={expectedPkgs}
                  onChange={(e) => setExpectedPkgs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 h-10 border-y border-slate-300 bg-white text-center font-mono font-bold text-base text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setExpectedPkgs((prev) => prev + 1)}
                  className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-r-lg font-bold text-slate-700 active:scale-95 text-base"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Total de bultos previstos de esta referencia (puede ser igual a los recibidos o 0 si no estaba prevista).
              </p>
            </div>

            {/* Registered Packages Now */}
            <div className="space-y-1.5 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
              <label className="text-xs font-bold uppercase tracking-wider text-blue-900 block">
                Bultos Recibidos Ahora:
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setRegisteredPkgs((prev) => Math.max(0, prev - 1))}
                  className="w-10 h-10 bg-white hover:bg-blue-50 border border-blue-300 rounded-l-lg font-bold text-blue-800 active:scale-95 text-base"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={registeredPkgs}
                  onChange={(e) => setRegisteredPkgs(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flex-1 h-10 border-y border-blue-300 bg-white text-center font-mono font-bold text-base text-blue-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRegisteredPkgs((prev) => prev + 1)}
                  className="w-10 h-10 bg-white hover:bg-blue-50 border border-blue-300 rounded-r-lg font-bold text-blue-800 active:scale-95 text-base"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-blue-700 mt-1">
                Bultos físicos que se están bajando y confirmando en este momento.
              </p>
            </div>
          </div>

          {/* Quick Match button */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <span>¿Recibiendo el lote completo?</span>
            <button
              type="button"
              onClick={() => setExpectedPkgs(registeredPkgs)}
              className="font-bold text-blue-600 hover:text-blue-800 underline active:scale-95"
            >
              Igualar Esperados a Recibidos ({registeredPkgs})
            </button>
          </div>

          {/* Optional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Observaciones (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej. Mercancía adicional de fábrica, no listada en packing list, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              La referencia se sumará inmediatamente a las estadísticas del contenedor y al informe de descarga.
              Podrás seguir sumándole bultos en cualquier momento durante la descarga.
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!duplicateItem || !normalizedInput}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <PackagePlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Guardando...' : 'GUARDAR REFERENCIA EN CONTENEDOR'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
