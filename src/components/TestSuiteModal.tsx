import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  X,
  ShieldCheck,
  Clock,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { runAllTests, TestResult } from '../services/testSuite';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TestSuiteModal: React.FC<TestSuiteModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress({ completed: 0, total: 8 });

    try {
      const testResults = await runAllTests((completed, total, current) => {
        setProgress({ completed, total });
        setResults((prev) => [...prev, current]);
      });
      setResults(testResults);
    } finally {
      setIsRunning(false);
    }
  };

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((acc, curr) => acc + curr.durationMs, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight">
                SUITE DE PRUEBAS DEL SISTEMA
              </h2>
              <p className="text-xs text-slate-400">
                Verificación automatizada de importación, conteos, persistencia y restauración
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

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Top Banner & Trigger */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                8 Pruebas Automatizadas de Requisitos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ejecuta comprobaciones reales contra la base de datos IndexedDB y lógica de conteo.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              <RotateCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Ejecutando Pruebas...' : 'Ejecutar Batería de Pruebas'}</span>
            </button>
          </div>

          {/* Progress or Stats */}
          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-700 uppercase font-bold block">
                  Aprobadas
                </span>
                <span className="text-xl font-mono font-bold text-emerald-800">
                  {totalPassed} / {results.length}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  totalFailed > 0
                    ? 'bg-red-50 border-red-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span
                  className={`text-[10px] uppercase font-bold block ${
                    totalFailed > 0 ? 'text-red-700' : 'text-slate-400'
                  }`}
                >
                  Falladas
                </span>
                <span
                  className={`text-xl font-mono font-bold ${
                    totalFailed > 0 ? 'text-red-700' : 'text-slate-700'
                  }`}
                >
                  {totalFailed}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Tiempo Total
                </span>
                <span className="text-xl font-mono font-bold text-slate-800">
                  {totalDuration} ms
                </span>
              </div>
            </div>
          )}

          {/* Test items list */}
          <div className="space-y-2.5">
            {results.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <FileCheck2 className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs">
                  Haz clic en &quot;Ejecutar Batería de Pruebas&quot; para comprobar la aplicación.
                </p>
              </div>
            ) : (
              results.map((r, idx) => (
                <div
                  key={r.id || idx}
                  className={`p-3.5 rounded-xl border transition-all text-xs space-y-1 ${
                    r.passed
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-red-50 border-red-300 text-red-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {r.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                        {r.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {r.durationMs}ms
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-600 pl-6 text-[11px] font-mono leading-relaxed">
                    {r.details}
                  </p>

                  {r.error && (
                    <div className="pl-6 text-red-600 font-mono text-[11px] font-bold">
                      Error: {r.error}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
