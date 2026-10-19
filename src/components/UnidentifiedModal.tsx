import React, { useState } from 'react';
import { AlertCircle, PackagePlus, X, HelpCircle } from 'lucide-react';

interface UnidentifiedModalProps {
  isOpen: boolean;
  referenceCode: string;
  initialQuantity: number;
  onClose: () => void;
  onConfirm: (reference: string, packages: number, notes?: string) => Promise<void>;
}

export const UnidentifiedModal: React.FC<UnidentifiedModalProps> = ({
  isOpen,
  referenceCode,
  initialQuantity,
  onClose,
  onConfirm,
}) => {
  const [packages, setPackages] = useState(initialQuantity || 1);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (packages <= 0) return;

    setIsSubmitting(true);
    try {
      await onConfirm(referenceCode, packages, notes.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-400 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Warning */}
        <div className="px-6 py-4 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-6 h-6 stroke-[2.5]" />
            <h2 className="text-base font-extrabold uppercase tracking-tight">
              REFERENCIA NO ENCONTRADA
            </h2>
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
              ESTA REFERENCIA NO ESTÁ EN EL CONTENEDOR IMPORTADO
            </p>
            <p className="font-mono text-2xl font-extrabold text-amber-950">
              {referenceCode}
            </p>
            <p className="text-xs text-amber-700">
              No coincide con ninguna referencia del archivo Excel cargado.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Cantidad de Bultos a Registrar:
            </label>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setPackages((prev) => Math.max(1, prev - 1))}
                className="w-12 h-11 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-l-xl font-bold text-slate-700 text-lg active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={packages}
                onChange={(e) => setPackages(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="flex-1 h-11 border-y border-slate-300 text-center font-mono font-bold text-lg text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setPackages((prev) => prev + 1)}
                className="w-12 h-11 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-r-xl font-bold text-slate-700 text-lg active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Observaciones (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej. Bulto roto, etiquetado borroso, producto ajeno..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Se guardará en la sección separada <b>MERCANCÍA NO IDENTIFICADA</b> sin alterar el manifiesto original del Excel.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
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
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
            >
              <PackagePlus className="w-4 h-4" />
              <span>+ REGISTRAR COMO MERCANCÍA INESPERADA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
