import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  AlertCircle,
  RotateCcw,
  History,
  Edit3,
} from 'lucide-react';
import { ReferenceItem, Movement } from '../types';

interface ReferenceDetailModalProps {
  item: ReferenceItem | null;
  movements: Movement[];
  onClose: () => void;
  onAddPackages: (refId: string, quantity: number) => Promise<void>;
  onSubtractPackage: (refId: string) => Promise<void>;
  onCorrectCount: (refId: string, newCount: number, reason: string) => Promise<void>;
}

export const ReferenceDetailModal: React.FC<ReferenceDetailModalProps> = ({
  item,
  movements,
  onClose,
  onAddPackages,
  onSubtractPackage,
  onCorrectCount,
}) => {
  const [customAddQty, setCustomAddQty] = useState<number>(1);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<number>(item?.registeredPackages || 0);
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!item) return null;

  // Filter movements for this reference
  const itemMovements = movements.filter((m) => m.reference === item.reference);

  const handleCustomAdd = async () => {
    if (customAddQty <= 0) return;
    setIsSubmitting(true);
    try {
      await onAddPackages(item.id, customAddQty);
      setCustomAddQty(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCorrect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (correctionTarget < 0) return;
    if (!correctionReason.trim()) {
      alert('Por favor especifica el motivo de la corrección manual.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCorrectCount(item.id, correctionTarget, correctionReason.trim());
      setShowCorrectionForm(false);
      setCorrectionReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (item.status) {
      case 'PENDIENTE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            PENDIENTE
          </span>
        );
      case 'PARCIAL':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            PARCIAL
          </span>
        );
      case 'COMPLETO':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            COMPLETO
          </span>
        );
      case 'SOBRANTE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            SOBRANTE
          </span>
        );
    }
  };

  const missing = Math.max(0, item.expectedPackages - item.registeredPackages);
  const surplus = Math.max(0, item.registeredPackages - item.expectedPackages);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              DETALLE DE REFERENCIA
            </span>
            <h2 className="text-xl font-mono font-extrabold tracking-tight">
              {item.reference}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status and Numbers summary */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Estado Actual:
              </span>
              {getStatusBadge()}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Esperados</p>
                <p className="text-xl font-mono font-bold text-slate-900">
                  {item.expectedPackages}
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Registrados</p>
                <p
                  className={`text-xl font-mono font-bold ${
                    item.status === 'COMPLETO'
                      ? 'text-emerald-600'
                      : item.status === 'SOBRANTE'
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  }`}
                >
                  {item.registeredPackages}
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  {surplus > 0 ? 'Sobrantes' : 'Faltantes'}
                </p>
                <p
                  className={`text-xl font-mono font-bold ${
                    surplus > 0
                      ? 'text-rose-600'
                      : missing === 0
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {surplus > 0 ? `+${surplus}` : missing}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Operaciones Rápidas
            </h3>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onAddPackages(item.id, 1)}
                className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+1 Bulto</span>
              </button>

              <button
                type="button"
                disabled={item.registeredPackages <= 0 || isSubmitting}
                onClick={() => onSubtractPackage(item.id)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm border border-slate-300 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
              >
                <Minus className="w-4 h-4 stroke-[3]" />
                <span>-1 Bulto</span>
              </button>
            </div>

            {/* Add Custom Quantity */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 shrink-0">
                Añadir varios:
              </span>
              <input
                type="number"
                min="1"
                value={customAddQty}
                onChange={(e) => setCustomAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-center text-sm"
              />
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCustomAdd}
                className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar +{customAddQty}</span>
              </button>
            </div>

            {/* Manual Correction Form Trigger */}
            {!showCorrectionForm ? (
              <button
                type="button"
                onClick={() => {
                  setCorrectionTarget(item.registeredPackages);
                  setShowCorrectionForm(true);
                }}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Corregir Conteo Manualmente (Ajuste de Conteo)</span>
              </button>
            ) : (
              <form onSubmit={handleCorrect} className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase">
                    Ajuste Directo de Conteo
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCorrectionForm(false)}
                    className="text-amber-700 hover:text-amber-900 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Nuevo Total de Bultos:
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={correctionTarget}
                    onChange={(e) => setCorrectionTarget(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold text-base"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Motivo del Ajuste (Obligatorio para auditoría):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Error de anuncio, doble conteo..."
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
                >
                  Confirmar Corrección
                </button>
              </form>
            )}
          </div>

          {/* Movements Timeline for this Reference */}
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Movimientos de esta Referencia ({itemMovements.length})</span>
            </h3>

            {itemMovements.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay movimientos registrados aún.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto font-mono text-xs">
                {itemMovements.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity} bulto(s)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {m.details || `${m.previousCount} → ${m.newCount}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(m.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
