import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  AlertCircle,
  CornerDownLeft,
  X,
  Volume2,
} from 'lucide-react';
import { ReferenceItem, ReferenceStatus } from '../types';
import { normalizeReference } from '../services/db';

interface QuickEntryProps {
  references: ReferenceItem[];
  onRegister: (referenceCode: string, quantity: number) => Promise<boolean>;
  onUnidentifiedFound: (unrecognizedCode: string, quantity: number) => void;
  onOverageWarning: (
    refItem: ReferenceItem,
    attemptedQuantity: number,
    onConfirm: () => void
  ) => void;
  disabled?: boolean;
}

export const QuickEntry: React.FC<QuickEntryProps> = ({
  references,
  onRegister,
  onUnidentifiedFound,
  onOverageWarning,
  disabled = false,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<ReferenceItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [activeItem, setActiveItem] = useState<ReferenceItem | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const isSubmittingLock = useRef(false);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Update suggestions when user types
  useEffect(() => {
    const raw = inputVal.trim();
    if (!raw) {
      setSuggestions([]);
      setActiveItem(null);
      setSelectedIndex(-1);
      return;
    }

    const norm = normalizeReference(raw);
    const matches = references
      .filter((r) => r.reference.includes(norm))
      .slice(0, 8);

    setSuggestions(matches);
    setSelectedIndex(-1);

    // Exact match check
    const exact = references.find((r) => r.reference === norm);
    if (exact) {
      setActiveItem(exact);
    } else {
      setActiveItem(null);
    }
  }, [inputVal, references]);

  const handleSelectSuggestion = (item: ReferenceItem) => {
    setInputVal(item.reference);
    setActiveItem(item);
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const executeRegistration = async (targetRef: string, qty: number) => {
    if (isSubmittingLock.current) return;
    isSubmittingLock.current = true;
    setIsSubmitting(true);

    try {
      const norm = normalizeReference(targetRef);
      if (!norm) return;

      const item = references.find((r) => r.reference === norm);

      if (!item) {
        // Not in manifest -> Trigger unidentified modal
        onUnidentifiedFound(norm, qty);
        setInputVal('');
        setActiveItem(null);
        setSuggestions([]);
        setQuantity(1);
        return;
      }

      // Check for overage warning
      const futureTotal = item.registeredPackages + qty;
      if (futureTotal > item.expectedPackages) {
        onOverageWarning(item, qty, async () => {
          await onRegister(item.reference, qty);
          resetForm();
        });
        return;
      }

      // Normal valid registration
      await onRegister(item.reference, qty);
      resetForm();
    } finally {
      setIsSubmitting(false);
      isSubmittingLock.current = false;
    }
  };

  const resetForm = () => {
    setInputVal('');
    setActiveItem(null);
    setSuggestions([]);
    setQuantity(1);
    // Keep focus ready for next item
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingLock.current || disabled) return;

    if (!inputVal.trim()) return;

    // If an item in dropdown was highlighted via arrow keys
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      executeRegistration(suggestions[selectedIndex].reference, quantity);
      return;
    }

    executeRegistration(inputVal, quantity);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  const getStatusBadge = (status: ReferenceStatus) => {
    switch (status) {
      case 'PENDIENTE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            PENDIENTE
          </span>
        );
      case 'PARCIAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            PARCIAL
          </span>
        );
      case 'COMPLETO':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            COMPLETO
          </span>
        );
      case 'SOBRANTE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            SOBRANTE
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-md p-4 sm:p-6 space-y-4 relative">
      {/* Module Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
          <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-900">
            REGISTRO RÁPIDO DE BULTOS
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
          Pulsa [Enter] para registrar al instante
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Reference Input with Autocomplete */}
        <div className="relative">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            ESCRIBIR REFERENCIA
          </label>
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              disabled={disabled || isSubmitting}
              placeholder="Ej. R-2608002 o escribe para buscar..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck="false"
              className="w-full pl-4 pr-12 py-3.5 sm:py-4 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-lg sm:text-2xl font-mono font-bold text-slate-900 uppercase tracking-tight placeholder:text-slate-400 placeholder:normal-case placeholder:font-normal placeholder:text-base transition-all disabled:opacity-50"
            />
            {inputVal && (
              <button
                type="button"
                onClick={() => {
                  setInputVal('');
                  setActiveItem(null);
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border-2 border-blue-400 rounded-xl shadow-xl z-40 max-h-60 overflow-y-auto divide-y divide-slate-100">
              {suggestions.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const missing = Math.max(0, item.expectedPackages - item.registeredPackages);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSuggestion(item)}
                    className={`p-3 cursor-pointer flex items-center justify-between text-sm transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-base">{item.reference}</span>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="text-xs font-mono text-slate-600">
                      <span>{item.registeredPackages}</span> /{' '}
                      <span className="font-bold">{item.expectedPackages}</span> bultos
                      {missing > 0 ? (
                        <span className="text-amber-600 ml-2 font-semibold">
                          (faltan {missing})
                        </span>
                      ) : (
                        <span className="text-emerald-600 ml-2 font-semibold">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Reference Status Card (Live Feedback when reference is typed/matched) */}
        {activeItem && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">REFERENCIA:</span>
                <span className="font-mono text-lg sm:text-xl font-extrabold text-blue-900">
                  {activeItem.reference}
                </span>
              </div>
              <div>{getStatusBadge(activeItem.status)}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <p className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase">
                  ESPERADOS
                </p>
                <p className="font-mono text-base sm:text-xl font-bold text-slate-800">
                  {activeItem.expectedPackages}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <p className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase">
                  REGISTRADOS
                </p>
                <p
                  className={`font-mono text-base sm:text-xl font-bold ${
                    activeItem.registeredPackages === activeItem.expectedPackages
                      ? 'text-emerald-600'
                      : activeItem.registeredPackages > activeItem.expectedPackages
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  }`}
                >
                  {activeItem.registeredPackages}
                </p>
              </div>

              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <p className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase">
                  {activeItem.registeredPackages > activeItem.expectedPackages
                    ? 'SOBRANTES'
                    : 'FALTANTES'}
                </p>
                <p
                  className={`font-mono text-base sm:text-xl font-bold ${
                    activeItem.registeredPackages > activeItem.expectedPackages
                      ? 'text-rose-600'
                      : activeItem.registeredPackages === activeItem.expectedPackages
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {activeItem.registeredPackages > activeItem.expectedPackages
                    ? activeItem.registeredPackages - activeItem.expectedPackages
                    : activeItem.expectedPackages - activeItem.registeredPackages}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quantity and Action Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
          {/* Quantity selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-600 shrink-0">
              Cantidad:
            </span>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                className="w-10 h-11 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-l-xl font-bold text-slate-700 flex items-center justify-center text-lg active:scale-95"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setQuantity(isNaN(val) || val < 1 ? 1 : val);
                }}
                className="w-16 h-11 border-y border-slate-300 text-center font-mono font-bold text-lg text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((prev) => prev + 1)}
                className="w-10 h-11 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-r-xl font-bold text-slate-700 flex items-center justify-center text-lg active:scale-95"
              >
                +
              </button>
            </div>

            {/* Quick quantity shortcuts */}
            <div className="flex items-center gap-1 ml-1">
              {[1, 2, 4, 5].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={`px-2 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors ${
                    quantity === q
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Big Action Button */}
          <button
            type="submit"
            disabled={!inputVal.trim() || isSubmitting || disabled}
            className="flex-1 py-3.5 sm:py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base sm:text-lg shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
            <span>
              {isSubmitting
                ? 'REGISTRANDO...'
                : `+ REGISTRAR ${quantity > 1 ? `${quantity} BULTOS` : '1 BULTO'}`}
            </span>
            <CornerDownLeft className="w-4 h-4 ml-1 opacity-70 hidden sm:inline" />
          </button>
        </div>
      </form>
    </div>
  );
};
