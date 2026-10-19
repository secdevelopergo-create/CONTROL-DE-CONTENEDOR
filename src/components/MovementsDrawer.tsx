import React from 'react';
import { X, History, Plus, Minus, Edit3, ArrowLeftRight, Clock, RotateCcw } from 'lucide-react';
import { Movement } from '../types';

interface MovementsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  movements: Movement[];
  onUndoLast: () => void;
}

export const MovementsDrawer: React.FC<MovementsDrawerProps> = ({
  isOpen,
  onClose,
  movements,
  onUndoLast,
}) => {
  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return {
        time: d.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        date: d.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: 'short',
        }),
      };
    } catch {
      return { time: iso, date: '' };
    }
  };

  const getOpBadge = (type: Movement['operationType'], qty: number) => {
    switch (type) {
      case 'ADD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
            <Plus className="w-3 h-3" />+{qty}
          </span>
        );
      case 'REMOVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
            <Minus className="w-3 h-3" />
            {qty}
          </span>
        );
      case 'CORRECTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
            <Edit3 className="w-3 h-3" />
            AJUSTE
          </span>
        );
      case 'UNIDENTIFIED_ADD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
            INESPERADO +{qty}
          </span>
        );
      case 'UNDO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
            <RotateCcw className="w-3 h-3" />
            DESHECHO {qty > 0 ? `+${qty}` : qty}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                HISTORIAL DE MOVIMIENTOS
              </h2>
              <p className="text-[11px] text-slate-400">
                {movements.length} operaciones registradas en este contenedor
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Undo Action Banner */}
        {movements.length > 0 && (
          <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-3">
            <div className="text-xs text-blue-900">
              <span className="font-bold">Último: </span>
              <span className="font-mono">{movements[0].reference}</span> (
              {movements[0].quantity > 0 ? `+${movements[0].quantity}` : movements[0].quantity})
            </div>
            <button
              onClick={onUndoLast}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors active:scale-95 shadow-xs"
            >
              Deshacer último
            </button>
          </div>
        )}

        {/* Movements Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {movements.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs">No hay movimientos registrados todavía.</p>
            </div>
          ) : (
            movements.map((m) => {
              const { time, date } = formatDate(m.timestamp);
              return (
                <div key={m.id} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {m.reference}
                      </span>
                      {getOpBadge(m.operationType, m.quantity)}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {time} ({date})
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                    <span>
                      Conteo: {m.previousCount} →{' '}
                      <span className="font-bold text-slate-900">{m.newCount}</span>
                    </span>
                    {m.isUnidentified && (
                      <span className="text-[10px] text-purple-700 font-sans font-medium">
                        No en Excel
                      </span>
                    )}
                  </div>

                  {m.details && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 px-2 py-1 rounded">
                      {m.details}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
          >
            Cerrar Historial
          </button>
        </div>
      </div>
    </div>
  );
};
