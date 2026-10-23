import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  History,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  AlertCircle,
  Package,
  PackagePlus,
  Layers,
  Flag,
  ChevronRight,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  Container,
  ReferenceItem,
  Movement,
  UnidentifiedItem,
  ContainerStats,
} from '../types';
import {
  dbService,
  computeContainerStats,
  calculateReferenceStatus,
} from '../services/db';
import { sounds } from '../services/audio';
import { QuickEntry } from './QuickEntry';
import { ReferenceList } from './ReferenceList';
import { ReferenceDetailModal } from './ReferenceDetailModal';
import { UnidentifiedModal } from './UnidentifiedModal';
import { AddReferenceModal } from './AddReferenceModal';
import { OverageWarningModal } from './OverageWarningModal';
import { MovementsDrawer } from './MovementsDrawer';
import { FinalizeModal } from './FinalizeModal';
import { ReportExportModal } from './ReportExportModal';

interface DownloadScreenProps {
  containerId: string;
  onBack: () => void;
  onRefreshAll: () => void;
}

export const DownloadScreen: React.FC<DownloadScreenProps> = ({
  containerId,
  onBack,
  onRefreshAll,
}) => {
  const [container, setContainer] = useState<Container | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [unidentified, setUnidentified] = useState<UnidentifiedItem[]>([]);
  const [stats, setStats] = useState<ContainerStats>({
    totalReferences: 0,
    completeReferences: 0,
    partialReferences: 0,
    pendingReferences: 0,
    overageReferences: 0,
    expectedPackages: 0,
    registeredPackages: 0,
    missingPackages: 0,
    surplusPackages: 0,
    unidentifiedCount: 0,
    progressPercentage: 0,
  });

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'warn' | 'undo';
    text: string;
  } | null>(null);

  // Modal states
  const [selectedRefItem, setSelectedRefItem] = useState<ReferenceItem | null>(null);
  const [unidentifiedModalData, setUnidentifiedModalData] = useState<{
    isOpen: boolean;
    reference: string;
    quantity: number;
  }>({ isOpen: false, reference: '', quantity: 1 });

  const [addRefModalData, setAddRefModalData] = useState<{
    isOpen: boolean;
    initialReference?: string;
    initialQuantity?: number;
  }>({ isOpen: false, initialReference: '', initialQuantity: 1 });

  const [overageModalData, setOverageModalData] = useState<{
    isOpen: boolean;
    item: ReferenceItem | null;
    attemptedQuantity: number;
    onConfirm: () => void;
  }>({
    isOpen: false,
    item: null,
    attemptedQuantity: 1,
    onConfirm: () => {},
  });

  const [isMovementsOpen, setIsMovementsOpen] = useState(false);
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Load all container data from IndexedDB
  const loadContainerData = useCallback(async () => {
    try {
      const c = await dbService.getContainer(containerId);
      if (!c) {
        onBack();
        return;
      }
      const refs = await dbService.getReferencesByContainer(containerId);
      const movs = await dbService.getMovementsByContainer(containerId);
      const unids = await dbService.getUnidentifiedByContainer(containerId);

      setContainer(c);
      setReferences(refs);
      setMovements(movs);
      setUnidentified(unids);

      const computedStats = computeContainerStats(refs, unids);
      setStats(computedStats);
    } catch (err: any) {
      console.error('Error cargando datos del contenedor:', err);
    }
  }, [containerId, onBack]);

  useEffect(() => {
    loadContainerData();
  }, [loadContainerData]);

  // Show temporary toast
  const triggerToast = (type: 'success' | 'warn' | 'undo', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // --- CORE REGISTRATION HANDLER ---
  const handleRegister = async (
    referenceCode: string,
    quantity: number
  ): Promise<boolean> => {
    const item = references.find((r) => r.reference === referenceCode);
    if (!item) return false;

    try {
      const { updatedItem, movement } = await dbService.registerPackages(
        containerId,
        item.id,
        quantity,
        'ADD'
      );

      // Play sound
      if (updatedItem.status === 'COMPLETO') {
        sounds.playItemComplete();
      } else if (updatedItem.status === 'SOBRANTE') {
        sounds.playOverageWarning();
      } else {
        sounds.playScanSuccess();
      }

      // Discrete confirmation toast
      const statusText =
        updatedItem.status === 'COMPLETO'
          ? '✓ COMPLETO'
          : updatedItem.status === 'SOBRANTE'
          ? '⚠️ SOBRANTE'
          : 'PARCIAL';

      triggerToast(
        updatedItem.status === 'SOBRANTE' ? 'warn' : 'success',
        `Registrado: ${updatedItem.reference} (+${quantity} bulto${quantity > 1 ? 's' : ''}) — Total: ${updatedItem.registeredPackages}/${updatedItem.expectedPackages} (${statusText})`
      );

      // Reload fresh data from IndexedDB
      await loadContainerData();
      onRefreshAll();
      return true;
    } catch (err: any) {
      alert('Error registrando bulto: ' + err?.message);
      return false;
    }
  };

  // Quick Inline Add from reference row or detail
  const handleQuickAdd = async (refId: string, quantity: number = 1) => {
    const item = references.find((r) => r.id === refId);
    if (!item) return;

    if (item.registeredPackages + quantity > item.expectedPackages) {
      sounds.playOverageWarning();
      setOverageModalData({
        isOpen: true,
        item,
        attemptedQuantity: quantity,
        onConfirm: async () => {
          await handleRegister(item.reference, quantity);
        },
      });
      return;
    }

    await handleRegister(item.reference, quantity);
  };

  // Quick Inline Subtract from reference row or detail
  const handleQuickSubtract = async (refId: string) => {
    const item = references.find((r) => r.id === refId);
    if (!item || item.registeredPackages <= 0) return;

    try {
      const { updatedItem } = await dbService.registerPackages(
        containerId,
        item.id,
        -1,
        'REMOVE'
      );
      sounds.playUndo();
      triggerToast(
        'undo',
        `Restado 1 bulto en ${updatedItem.reference} (Quedan ${updatedItem.registeredPackages}/${updatedItem.expectedPackages})`
      );
      await loadContainerData();
      onRefreshAll();
    } catch (err: any) {
      alert('Error restando bulto: ' + err?.message);
    }
  };

  // Correct count manually
  const handleCorrectCount = async (
    refId: string,
    newCount: number,
    reason: string
  ) => {
    try {
      const { updatedItem } = await dbService.correctReferenceCount(
        containerId,
        refId,
        newCount,
        reason
      );
      sounds.playScanSuccess();
      triggerToast(
        'success',
        `Ajuste confirmado en ${updatedItem.reference}: nuevo conteo = ${updatedItem.registeredPackages}`
      );
      await loadContainerData();
      onRefreshAll();
    } catch (err: any) {
      alert('Error corrigiendo conteo: ' + err?.message);
    }
  };

  // Unidentified reference detected in quick entry
  const handleUnidentifiedFound = (refCode: string, qty: number) => {
    sounds.playUnidentifiedAlert();
    setUnidentifiedModalData({
      isOpen: true,
      reference: refCode,
      quantity: qty,
    });
  };

  // Confirm unidentified merchandise
  const handleConfirmUnidentified = async (
    reference: string,
    packages: number,
    notes?: string
  ) => {
    try {
      await dbService.registerUnidentifiedGoods(
        containerId,
        reference,
        packages,
        notes
      );
      sounds.playScanSuccess();
      triggerToast(
        'warn',
        `Mercancía no identificada guardada: ${reference} (+${packages} bultos)`
      );
      await loadContainerData();
      onRefreshAll();
    } catch (err: any) {
      alert('Error guardando mercancía no identificada: ' + err?.message);
    }
  };

  // Add new reference directly to container manifest
  const handleAddNewReference = async (
    refCode: string,
    expectedPackages: number,
    registeredPackages: number,
    notes?: string
  ): Promise<boolean> => {
    try {
      const { referenceItem } = await dbService.addNewReferenceToContainer(
        containerId,
        refCode,
        expectedPackages,
        registeredPackages,
        notes
      );

      if (registeredPackages > 0) {
        if (referenceItem.status === 'COMPLETO') {
          sounds.playItemComplete();
        } else {
          sounds.playScanSuccess();
        }
      } else {
        sounds.playScanSuccess();
      }

      triggerToast(
        'success',
        `Referencia agregada: ${referenceItem.reference} (${referenceItem.registeredPackages}/${referenceItem.expectedPackages} bultos - ${referenceItem.status})`
      );

      await loadContainerData();
      onRefreshAll();
      return true;
    } catch (err: any) {
      alert(err?.message || 'Error agregando referencia');
      return false;
    }
  };

  // UNDO last movement
  const handleUndo = async () => {
    try {
      const result = await dbService.undoLastMovement(containerId);
      if (result.success) {
        sounds.playUndo();
        triggerToast('undo', result.message);
        await loadContainerData();
        onRefreshAll();
      } else {
        alert(result.message);
      }
    } catch (err: any) {
      alert('Error deshaciendo movimiento: ' + err?.message);
    }
  };

  // Finalize container
  const handleConfirmFinalize = async (
    newStatus: Container['status'],
    notes?: string
  ) => {
    if (!container) return;
    const updated: Container = {
      ...container,
      status: newStatus,
      completedAt: new Date().toISOString(),
      notes: notes || container.notes,
    };
    await dbService.saveContainer(updated);
    setContainer(updated);
    triggerToast(
      'success',
      `Descarga finalizada: ${
        newStatus === 'FINALIZADO_CORRECTO'
          ? 'Finalizado Correctamente'
          : 'Finalizado con Diferencias'
      }`
    );
    await loadContainerData();
    onRefreshAll();
  };

  // Reopen container
  const handleReopenContainer = async () => {
    if (!container) return;
    const updated: Container = {
      ...container,
      status: 'EN_PROCESO',
      completedAt: null,
    };
    await dbService.saveContainer(updated);
    setContainer(updated);
    triggerToast('undo', 'Descarga reabierta. Puedes continuar registrando o corrigiendo bultos.');
    await loadContainerData();
    onRefreshAll();
  };

  if (!container) return null;

  const isFinalized = container.status.startsWith('FINALIZADO');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 sm:right-8 z-50 max-w-md p-3.5 rounded-xl shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-slate-900 border-emerald-500 text-white'
              : toastMessage.type === 'warn'
              ? 'bg-amber-900 border-amber-400 text-white'
              : 'bg-slate-800 border-blue-400 text-slate-100'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'warn' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <RotateCcw className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Navigation & Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors active:scale-95"
            title="Volver al listado de contenedores"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                CONTENEDOR ACTIVO
              </span>
              {isFinalized && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
                  FINALIZADO
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 tracking-tight">
              {container.code}
            </h1>
          </div>
        </div>

        {/* Action Buttons: Add Ref, Undo, History, Report, Finalize */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ADD REFERENCE BUTTON */}
          <button
            type="button"
            onClick={() =>
              setAddRefModalData({
                isOpen: true,
                initialReference: '',
                initialQuantity: 1,
              })
            }
            title="Agregar manualmente una referencia que no estaba en el archivo Excel con sus bultos"
            className="px-3.5 py-2 rounded-xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
          >
            <PackagePlus className="w-4 h-4 text-blue-600 stroke-[2.5]" />
            <span>+ AGREGAR REFERENCIA</span>
          </button>

          {/* UNDO BUTTON */}
          <button
            onClick={handleUndo}
            disabled={movements.length === 0}
            title={
              movements.length > 0
                ? `Deshacer último: ${movements[0].reference} (${movements[0].quantity > 0 ? '+' : ''}${movements[0].quantity})`
                : 'No hay movimientos para deshacer'
            }
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">DESHACER ÚLTIMO</span>
            <span className="sm:hidden">DESHACER</span>
          </button>

          {/* Movements History */}
          <button
            onClick={() => setIsMovementsOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Historial</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-[10px] font-mono">
              {movements.length}
            </span>
          </button>

          {/* Download Report */}
          <button
            onClick={() => setIsReportOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Informe</span>
          </button>

          {/* Finalize Container Button */}
          <button
            onClick={() => setIsFinalizeOpen(true)}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm text-white shadow-sm flex items-center gap-1.5 active:scale-95 transition-all ${
              isFinalized
                ? 'bg-slate-800 hover:bg-slate-900'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>{isFinalized ? 'Ver Finalización' : 'FINALIZAR DESCARGA'}</span>
          </button>
        </div>
      </div>

      {/* Top Indicators Dashboard & Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="uppercase text-slate-500 tracking-wider">
              Avance general de descarga
            </span>
            <span
              className={`font-mono text-base ${
                stats.progressPercentage === 100
                  ? 'text-emerald-600 font-extrabold'
                  : 'text-blue-600'
              }`}
            >
              {stats.progressPercentage}%
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80">
            <div
              className={`h-full transition-all duration-300 ${
                stats.progressPercentage === 100
                  ? 'bg-emerald-500'
                  : stats.progressPercentage > 0
                  ? 'bg-blue-600'
                  : 'bg-slate-300'
              }`}
              style={{ width: `${Math.min(100, stats.progressPercentage)}%` }}
            />
          </div>
        </div>

        {/* 6 Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Referencias Completas */}
          <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-center">
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
              Ref. Completas
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-800">
              {stats.completeReferences}
              <span className="text-xs text-emerald-600 font-normal"> / {stats.totalReferences}</span>
            </p>
          </div>

          {/* 2. Referencias Pendientes */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Ref. Pendientes
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-slate-700">
              {stats.pendingReferences + stats.partialReferences}
            </p>
          </div>

          {/* 3. Bultos Registrados */}
          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-center">
            <p className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
              Bultos Recibidos
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-blue-900">
              {stats.registeredPackages}
            </p>
          </div>

          {/* 4. Bultos Esperados */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Bultos Esperados
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-slate-900">
              {stats.expectedPackages}
            </p>
          </div>

          {/* 5. Bultos Faltantes */}
          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-center">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
              Bultos Faltantes
            </p>
            <p className="text-xl sm:text-2xl font-mono font-bold text-amber-800">
              {stats.missingPackages}
            </p>
          </div>

          {/* 6. Bultos Sobrantes */}
          <div
            className={`p-3 rounded-xl border text-center ${
              stats.surplusPackages > 0
                ? 'bg-rose-50 border-rose-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                stats.surplusPackages > 0 ? 'text-rose-800' : 'text-slate-500'
              }`}
            >
              Bultos Sobrantes
            </p>
            <p
              className={`text-xl sm:text-2xl font-mono font-bold ${
                stats.surplusPackages > 0 ? 'text-rose-600' : 'text-slate-700'
              }`}
            >
              {stats.surplusPackages > 0 ? `+${stats.surplusPackages}` : '0'}
            </p>
          </div>
        </div>
      </div>

      {/* QUICK ENTRY MODULE (The most critical component) */}
      <QuickEntry
        references={references}
        onRegister={handleRegister}
        onUnidentifiedFound={handleUnidentifiedFound}
        onOpenAddReference={(refCode, qty) =>
          setAddRefModalData({
            isOpen: true,
            initialReference: refCode,
            initialQuantity: qty,
          })
        }
        onOverageWarning={(item, qty, onConfirm) => {
          sounds.playOverageWarning();
          setOverageModalData({
            isOpen: true,
            item,
            attemptedQuantity: qty,
            onConfirm,
          });
        }}
      />

      {/* UNIDENTIFIED GOODS SECTION (Visible if any unexpected items recorded) */}
      {unidentified.length > 0 && (
        <div className="bg-purple-50/60 rounded-2xl border-2 border-purple-300 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h3 className="text-sm font-extrabold uppercase tracking-tight text-purple-950">
                MERCANCÍA NO IDENTIFICADA ({unidentified.length})
              </h3>
            </div>
            <span className="text-xs text-purple-800 font-semibold">
              Bultos no presentes en manifiesto Excel
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unidentified.map((un) => (
              <div
                key={un.id}
                className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900 block">
                    {un.reference}
                  </span>
                  {un.notes && (
                    <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                      {un.notes}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 font-mono font-bold text-xs">
                    +{un.registeredPackages} bultos
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REFERENCES LIST */}
      <ReferenceList
        references={references}
        onSelectReference={(item) => setSelectedRefItem(item)}
        onQuickAdd={(refId) => handleQuickAdd(refId, 1)}
        onQuickSubtract={(refId) => handleQuickSubtract(refId)}
        onOpenAddReference={(initialRef) =>
          setAddRefModalData({
            isOpen: true,
            initialReference: initialRef || '',
            initialQuantity: 1,
          })
        }
      />

      {/* MODALS */}
      {/* 1. Reference Detail Drawer/Modal */}
      <ReferenceDetailModal
        item={selectedRefItem}
        movements={movements}
        onClose={() => setSelectedRefItem(null)}
        onAddPackages={async (id, qty) => {
          await handleQuickAdd(id, qty);
          // refresh selected item state
          const updated = references.find((r) => r.id === id);
          if (updated) setSelectedRefItem(updated);
        }}
        onSubtractPackage={async (id) => {
          await handleQuickSubtract(id);
          const updated = references.find((r) => r.id === id);
          if (updated) setSelectedRefItem(updated);
        }}
        onCorrectCount={async (id, count, reason) => {
          await handleCorrectCount(id, count, reason);
          const updated = references.find((r) => r.id === id);
          if (updated) setSelectedRefItem(updated);
        }}
      />

      {/* 2. Unidentified Goods Modal */}
      <UnidentifiedModal
        isOpen={unidentifiedModalData.isOpen}
        referenceCode={unidentifiedModalData.reference}
        initialQuantity={unidentifiedModalData.quantity}
        onClose={() =>
          setUnidentifiedModalData({ isOpen: false, reference: '', quantity: 1 })
        }
        onConfirm={handleConfirmUnidentified}
        onAddAsReference={handleAddNewReference}
      />

      {/* 2.5 Add New Reference Modal */}
      <AddReferenceModal
        isOpen={addRefModalData.isOpen}
        initialReference={addRefModalData.initialReference}
        initialQuantity={addRefModalData.initialQuantity}
        existingReferences={references}
        onClose={() =>
          setAddRefModalData({
            isOpen: false,
            initialReference: '',
            initialQuantity: 1,
          })
        }
        onAddReference={handleAddNewReference}
      />

      {/* 3. Overage Warning Modal */}
      <OverageWarningModal
        isOpen={overageModalData.isOpen}
        item={overageModalData.item}
        attemptedQuantity={overageModalData.attemptedQuantity}
        onClose={() =>
          setOverageModalData({
            isOpen: false,
            item: null,
            attemptedQuantity: 1,
            onConfirm: () => {},
          })
        }
        onConfirm={overageModalData.onConfirm}
      />

      {/* 4. Movements History Drawer */}
      <MovementsDrawer
        isOpen={isMovementsOpen}
        onClose={() => setIsMovementsOpen(false)}
        movements={movements}
        onUndoLast={handleUndo}
      />

      {/* 5. Finalize Download Modal */}
      <FinalizeModal
        isOpen={isFinalizeOpen}
        container={container}
        stats={stats}
        references={references}
        unidentified={unidentified}
        onClose={() => setIsFinalizeOpen(false)}
        onConfirmFinalize={handleConfirmFinalize}
        onReopenContainer={handleReopenContainer}
      />

      {/* 6. Report Export Modal */}
      <ReportExportModal
        isOpen={isReportOpen}
        container={container}
        stats={stats}
        references={references}
        unidentified={unidentified}
        movements={movements}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
};
