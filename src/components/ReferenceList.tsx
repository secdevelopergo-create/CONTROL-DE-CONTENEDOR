import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  AlertCircle,
  Plus,
  Minus,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { ReferenceItem, ReferenceStatus } from '../types';

interface ReferenceListProps {
  references: ReferenceItem[];
  onSelectReference: (item: ReferenceItem) => void;
  onQuickAdd: (referenceId: string) => void;
  onQuickSubtract: (referenceId: string) => void;
  onOpenAddReference?: (initialRef?: string) => void;
}

type FilterType = 'TODAS' | 'COMPLETAS' | 'PARCIALES' | 'PENDIENTES' | 'SOBRANTES';

export const ReferenceList: React.FC<ReferenceListProps> = ({
  references,
  onSelectReference,
  onQuickAdd,
  onQuickSubtract,
  onOpenAddReference,
}) => {
  const [filter, setFilter] = useState<FilterType>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts for each tab
  const counts = useMemo(() => {
    let completas = 0;
    let parciales = 0;
    let pendientes = 0;
    let sobrantes = 0;

    for (const r of references) {
      if (r.status === 'COMPLETO') completas++;
      else if (r.status === 'PARCIAL') parciales++;
      else if (r.status === 'PENDIENTE') pendientes++;
      else if (r.status === 'SOBRANTE') sobrantes++;
    }

    return {
      todas: references.length,
      completas,
      parciales,
      pendientes,
      sobrantes,
    };
  }, [references]);

  // Filtered and searched list
  const filteredList = useMemo(() => {
    return references.filter((item) => {
      // Tab filter
      if (filter === 'COMPLETAS' && item.status !== 'COMPLETO') return false;
      if (filter === 'PARCIALES' && item.status !== 'PARCIAL') return false;
      if (filter === 'PENDIENTES' && item.status !== 'PENDIENTE') return false;
      if (filter === 'SOBRANTES' && item.status !== 'SOBRANTE') return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toUpperCase();
        if (!item.reference.includes(query)) return false;
      }

      return true;
    });
  }, [references, filter, searchQuery]);

  const getStatusBadge = (status: ReferenceStatus) => {
    switch (status) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            PENDIENTE
          </span>
        );
      case 'PARCIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            PARCIAL
          </span>
        );
      case 'COMPLETO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            COMPLETO
          </span>
        );
      case 'SOBRANTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            SOBRANTE
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Search and Filters Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Listado de Referencias</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-600 font-semibold">
                {filteredList.length} de {references.length}
              </span>
            </h2>
            {onOpenAddReference && (
              <button
                type="button"
                onClick={() => onOpenAddReference()}
                title="Agregar manualmente una referencia que no estaba en el archivo Excel"
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ AGREGAR REFERENCIA</span>
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por referencia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 bg-slate-50 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
          <button
            onClick={() => setFilter('TODAS')}
            className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === 'TODAS'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Todas</span>
            <span className="px-1.5 py-0.2 rounded bg-black/20 text-[10px]">
              {counts.todas}
            </span>
          </button>

          <button
            onClick={() => setFilter('COMPLETAS')}
            className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === 'COMPLETAS'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completas</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-900/20 text-[10px]">
              {counts.completas}
            </span>
          </button>

          <button
            onClick={() => setFilter('PARCIALES')}
            className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === 'PARCIALES'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Parciales</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-900/20 text-[10px]">
              {counts.parciales}
            </span>
          </button>

          <button
            onClick={() => setFilter('PENDIENTES')}
            className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
              filter === 'PENDIENTES'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Pendientes</span>
            <span className="px-1.5 py-0.2 rounded bg-black/10 text-[10px]">
              {counts.pendientes}
            </span>
          </button>

          {counts.sobrantes > 0 && (
            <button
              onClick={() => setFilter('SOBRANTES')}
              className={`px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                filter === 'SOBRANTES'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>Sobrantes</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-900/20 text-[10px]">
                {counts.sobrantes}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Rows List */}
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm space-y-3">
            <p>No se encontraron referencias con los filtros aplicados.</p>
            {searchQuery.trim() && onOpenAddReference && (
              <div>
                <button
                  type="button"
                  onClick={() => onOpenAddReference(searchQuery.trim())}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Agregar &quot;{searchQuery.trim().toUpperCase()}&quot; al contenedor</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredList.map((item) => {
            const isComplete = item.status === 'COMPLETO';
            const isPartial = item.status === 'PARCIAL';
            const isOverage = item.status === 'SOBRANTE';
            const pct =
              item.expectedPackages > 0
                ? Math.min(100, Math.round((item.registeredPackages / item.expectedPackages) * 100))
                : 0;

            return (
              <div
                key={item.id}
                onClick={() => onSelectReference(item)}
                className={`p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors group select-none ${
                  isComplete
                    ? 'bg-emerald-50/25 hover:bg-emerald-50/50'
                    : isPartial
                    ? 'bg-amber-50/20 hover:bg-amber-50/40'
                    : isOverage
                    ? 'bg-rose-50/25 hover:bg-rose-50/50'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Left: Reference + Mini Progress */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                      {item.reference}
                    </span>
                    <span className="hidden sm:inline-block">
                      {getStatusBadge(item.status)}
                    </span>
                  </div>

                  {/* Progress indicator */}
                  <div className="flex items-center gap-2 max-w-xs">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          isComplete
                            ? 'bg-emerald-500'
                            : isOverage
                            ? 'bg-rose-500'
                            : isPartial
                            ? 'bg-amber-500'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">{pct}%</span>
                  </div>
                </div>

                {/* Center / Right: Counts */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="font-mono font-bold text-base sm:text-lg text-slate-900">
                      <span
                        className={
                          isComplete
                            ? 'text-emerald-700'
                            : isOverage
                            ? 'text-rose-600'
                            : isPartial
                            ? 'text-amber-700'
                            : 'text-slate-800'
                        }
                      >
                        {item.registeredPackages}
                      </span>
                      <span className="text-slate-400 font-normal"> / {item.expectedPackages}</span>
                    </div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      BULTOS
                    </p>
                  </div>

                  {/* Mobile badge */}
                  <div className="sm:hidden">{getStatusBadge(item.status)}</div>

                  {/* Quick +/- Action Buttons */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="hidden sm:flex items-center gap-1 ml-2"
                  >
                    <button
                      type="button"
                      disabled={item.registeredPackages <= 0}
                      onClick={() => onQuickSubtract(item.id)}
                      title="Restar 1 bulto"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:hover:bg-white active:scale-90 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickAdd(item.id)}
                      title="Añadir 1 bulto"
                      className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
