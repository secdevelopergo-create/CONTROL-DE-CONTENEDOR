import React, { useState } from 'react';
import {
  Plus,
  Play,
  FileSpreadsheet,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Container, ContainerStats } from '../types';
import { createUDC260826Container, downloadUDC260826ExcelFile } from '../services/sampleData';
import { dbService } from '../services/db';

interface DashboardProps {
  containers: Container[];
  containerStatsMap: Record<string, ContainerStats>;
  onSelectContainer: (containerId: string) => void;
  onNewContainer: () => void;
  onDeleteContainer: (containerId: string) => void;
  onExportReport: (container: Container) => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  containers,
  containerStatsMap,
  onSelectContainer,
  onNewContainer,
  onDeleteContainer,
  onExportReport,
  onRefresh,
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loadingUDC, setLoadingUDC] = useState(false);

  const handleLoadUDC260826 = async () => {
    try {
      setLoadingUDC(true);
      const existing = await dbService.getContainerByCode('UDC260826');
      if (existing) {
        // As requested: Do NOT overwrite, open existing and notify
        alert(`El contenedor UDC260826 ya existe en este dispositivo. Abriendo descarga existente sin sobrescribir.`);
        onSelectContainer(existing.id);
        return;
      }

      const container = await createUDC260826Container();
      onRefresh();
      onSelectContainer(container.id);
    } catch (err: any) {
      alert('Error cargando contenedor UDC260826: ' + err?.message);
    } finally {
      setLoadingUDC(false);
    }
  };

  const getStatusBadge = (status: Container['status']) => {
    switch (status) {
      case 'SIN_INICIAR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            SIN INICIAR
          </span>
        );
      case 'EN_PROCESO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            EN PROCESO
          </span>
        );
      case 'FINALIZADO_CORRECTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            FINALIZADO CORRECTO
          </span>
        );
      case 'FINALIZADO_CON_DIFERENCIAS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            FINALIZADO CON DIFERENCIAS
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  // Global summary counters
  const totalContainers = containers.length;
  const inProgressCount = containers.filter((c) => c.status === 'EN_PROCESO').length;
  const completedCount = containers.filter(
    (c) => c.status === 'FINALIZADO_CORRECTO' || c.status === 'FINALIZADO_CON_DIFERENCIAS'
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Banner & Main Action */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Operación de Almacén
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            CONTROL DE CONTENEDORES
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl">
            Gestiona la descarga física de bultos importados desde Excel. Registra referencias en tiempo real, verifica faltantes y genera informes de auditoría.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Download real provider Excel for testing */}
          <button
            onClick={() => downloadUDC260826ExcelFile()}
            title="Descarga el archivo Excel con formato original del proveedor (hojas INVOICE y PACKING LIST, fila 14 encabezados, Quantity y CTNS)"
            className="px-3.5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Descargar Excel UDC260826</span>
          </button>

          {/* Quick Real Manifest Seeder */}
          <button
            onClick={handleLoadUDC260826}
            disabled={loadingUDC}
            title="Inicia o abre la operación física real del contenedor UDC260826 (113 referencias, 209 bultos)"
            className="px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100/80 text-amber-900 font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>{loadingUDC ? 'Cargando UDC260826...' : 'Contenedor UDC260826'}</span>
          </button>

          {/* Primary New Container Button */}
          <button
            onClick={onNewContainer}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-base shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>+ NUEVO CONTENEDOR</span>
          </button>
        </div>
      </div>

      {/* Global Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contenedores Registrados
            </p>
            <p className="text-2xl font-bold text-slate-900">{totalContainers}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              En Descarga Activa
            </p>
            <p className="text-2xl font-bold text-slate-900">{inProgressCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-xs">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Finalizados
            </p>
            <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* Containers List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Listado de Contenedores</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
              {containers.length}
            </span>
          </h2>
        </div>

        {containers.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Package className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-bold text-slate-800">
                No hay contenedores registrados aún
              </h3>
              <p className="text-sm text-slate-500">
                Comienza importando un archivo Excel o CSV con el manifiesto de carga o genera un contenedor de prueba.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onNewContainer}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>+ NUEVO CONTENEDOR</span>
              </button>
              <button
                onClick={handleLoadUDC260826}
                disabled={loadingUDC}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{loadingUDC ? 'Cargando UDC260826...' : 'Cargar Manifiesto UDC260826'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {containers.map((c) => {
              const stats = containerStatsMap[c.id];
              const pct = stats ? stats.progressPercentage : 0;
              const expected = stats ? stats.expectedPackages : 0;
              const registered = stats ? stats.registeredPackages : 0;
              const totalRefs = stats ? stats.totalReferences : 0;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          CONTENEDOR
                        </div>
                        <h3 className="text-xl font-extrabold font-mono text-slate-900 group-hover:text-blue-600 transition-colors">
                          {c.code}
                        </h3>
                      </div>
                      <div>{getStatusBadge(c.status)}</div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Importado: {formatDate(c.createdAt)}</span>
                    </div>
                  </div>

                  {/* Card Body: Stats */}
                  <div className="p-5 space-y-4 bg-slate-50/50">
                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600">Progreso de descarga</span>
                        <span className={`font-mono ${pct === 100 ? 'text-emerald-600 font-bold' : 'text-blue-600'}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            pct === 100
                              ? 'bg-emerald-500'
                              : pct > 0
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Metric Pills */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[11px] font-medium text-slate-500 uppercase">
                          Referencias
                        </p>
                        <p className="text-base font-bold font-mono text-slate-800">
                          {totalRefs}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                        <p className="text-[11px] font-medium text-slate-500 uppercase">
                          Bultos
                        </p>
                        <p className="text-base font-bold font-mono">
                          <span className={registered >= expected && expected > 0 ? 'text-emerald-600' : 'text-slate-900'}>
                            {registered}
                          </span>
                          <span className="text-slate-400 font-normal"> / {expected}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer / Actions */}
                  <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectContainer(c.id)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{c.status.startsWith('FINALIZADO') ? 'Ver Conteo' : 'Abrir Descarga'}</span>
                    </button>

                    <button
                      onClick={() => onExportReport(c)}
                      title="Descargar informe Excel"
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    </button>

                    {deleteConfirmId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onDeleteContainer(c.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-[11px] font-bold"
                        >
                          X
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(c.id)}
                        title="Eliminar contenedor"
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Information footer note */}
      <div className="bg-slate-100/80 rounded-xl p-4 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800">
            Almacenamiento Local Seguro (IndexedDB)
          </p>
          <p>
            Todos los conteos, bultos y movimientos se guardan de forma persistente e inmediata en este navegador. No se envía ningún dato a servidores externos. Puedes cerrar la ventana o recargar en cualquier momento sin perder tu avance.
          </p>
        </div>
      </div>
    </div>
  );
};
