import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import { ReferenceItem } from '../types';

interface OverageWarningModalProps {
  isOpen: boolean;
  item: ReferenceItem | null;
  attemptedQuantity: number;
  onClose: () => void;
  onConfirm: () => void;
}

export const OverageWarningModal: React.FC<OverageWarningModalProps> = ({
  isOpen,
  item,
  attemptedQuantity,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !item) return null;

  const currentCount = item.registeredPackages;
  const expected = item.expectedPackages;
  const futureCount = currentCount + attemptedQuantity;
  const surplus = futureCount - expected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-rose-500 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            <h2 className="text-base font-extrabold uppercase tracking-tight">
              ¡ADVERTENCIA DE SOBRANTE!
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-center">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              REFERENCIA
            </p>
            <p className="font-mono text-2xl font-extrabold text-slate-900">
              {item.reference}
            </p>
            <p className="text-xs text-rose-700 font-medium">
              Esta referencia ya cuenta con{' '}
              <b>
                {currentCount} de {expected}
              </b>{' '}
              bultos esperados.
            </p>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <div className="flex justify-between">
              <span>Bultos esperados en Excel:</span>
              <span className="font-mono font-bold">{expected}</span>
            </div>
            <div className="flex justify-between">
              <span>Registrados actualmente:</span>
              <span className="font-mono font-bold">{currentCount}</span>
            </div>
            <div className="flex justify-between text-blue-600">
              <span>Intentando registrar:</span>
              <span className="font-mono font-bold">+{attemptedQuantity}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-rose-600 font-bold">
              <span>Bultos SOBRANTES resultantes:</span>
              <span className="font-mono">+{surplus} bulto(s)</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center">
            ¿Deseas confirmar este registro como <b>SOBRANTE</b>? La referencia cambiará a estado rojo y quedará documentado en el informe.
          </p>

          {/* Buttons */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Sobrante</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
