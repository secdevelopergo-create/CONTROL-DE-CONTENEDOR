import React from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Container,
  ContainerStats,
  ReferenceItem,
  UnidentifiedItem,
  Movement,
} from '../types';
import { exportContainerReport, exportContainerCSV } from '../services/excel';

interface ReportExportModalProps {
  isOpen: boolean;
  container: Container;
  stats: ContainerStats;
  references: ReferenceItem[];
  unidentified: UnidentifiedItem[];
  movements: Movement[];
  onClose: () => void;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  container,
  stats,
  references,
  unidentified,
  movements,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleDownloadXlsx = () => {
    exportContainerReport(container, stats, references, unidentified, movements);
    onClose();
  };

  const handleDownloadCSV = () => {
    exportContainerCSV(container, references);
    onClose();
  };

  const isFinalized = container.status.startsWith('FINALIZADO');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight">
                DESCARGAR INFORME
              </h2>
              <p className="text-xs text-slate-400">
                Contenedor: <span className="font-mono text-white">{container.code}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Estado de descarga:</span>
              <span className="font-bold text-slate-800 font-mono">
                {container.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total referencias:</span>
              <span className="font-bold text-slate-800">{stats.totalReferences}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bultos esperados / registrados:</span>
              <span className="font-bold text-slate-800 font-mono">
                {stats.registeredPackages} / {stats.expectedPackages}
              </span>
            </div>
            {stats.missingPackages > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Bultos faltantes:</span>
                <span>{stats.missingPackages}</span>
              </div>
            )}
            {stats.surplusPackages > 0 && (
              <div className="flex justify-between text-rose-700 font-bold">
                <span>Bultos sobrantes:</span>
                <span>+{stats.surplusPackages}</span>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {/* XLSX Option */}
            <button
              onClick={handleDownloadXlsx}
              className="w-full p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-950 transition-all flex items-center justify-between text-left group active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-950">
                    Libro Excel (.xlsx) Completo
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Incluye hojas de Resumen, Faltantes, Sobrantes, No Identificadas e Historial.
                  </p>
                </div>
              </div>
              <Download className="w-5 h-5 text-emerald-700 group-hover:translate-y-0.5 transition-transform" />
            </button>

            {/* CSV Option */}
            <button
              onClick={handleDownloadCSV}
              className="w-full p-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 transition-all flex items-center justify-between text-left group active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    Archivo Plano CSV (.csv)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Formato estándar separado por comas con codificación UTF-8.
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-500 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-bold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
