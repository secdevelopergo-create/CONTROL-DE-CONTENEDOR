import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  FileJson,
  Layers,
  ArrowRight,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';
import { dbService } from '../services/db';
import { BackupData, Container } from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

type RestoreStrategy = 'SKIP_EXISTING' | 'OVERWRITE' | 'CLEAN_REPLACE';

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Preview & Confirmation stage
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);
  const [conflictData, setConflictData] = useState<{
    existingContainers: Container[];
    conflictingCodes: string[];
    newContainers: Container[];
  } | null>(null);

  const [strategy, setStrategy] = useState<RestoreStrategy>('SKIP_EXISTING');
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsProcessing(true);
      const data = await dbService.exportBackup();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Respaldo_Control_Descarga_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMsg({
        type: 'success',
        text: `Respaldo exportado exitosamente (${data.containers.length} contenedores, ${data.references.length} referencias, ${data.movements?.length || 0} movimientos).`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: 'Error generando respaldo: ' + (err?.message || err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setStatusMsg(null);
    setPendingBackup(null);
    setConflictData(null);
    setConfirmCheckbox(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('El archivo seleccionado no tiene un formato JSON válido.');
        }

        // Validate deeply
        const validation = dbService.validateBackupData(parsed);
        if (!validation.isValid) {
          throw new Error(
            'El archivo de respaldo tiene errores de esquema:\n• ' + validation.errors.join('\n• ')
          );
        }

        const backup = parsed as BackupData;
        const conflicts = await dbService.checkBackupConflicts(backup);

        setPendingBackup(backup);
        setConflictData(conflicts);
        // Default strategy
        setStrategy(conflicts.conflictingCodes.length > 0 ? 'SKIP_EXISTING' : 'OVERWRITE');
      } catch (err: any) {
        setStatusMsg({
          type: 'error',
          text: err?.message || 'Error procesando archivo de respaldo.',
        });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setStatusMsg({ type: 'error', text: 'Error de lectura de archivo.' });
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!pendingBackup) return;
    if (!confirmCheckbox) {
      alert('Por favor marca la casilla de confirmación para proceder con la restauración.');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await dbService.executeRestore(pendingBackup, strategy);

      setStatusMsg({
        type: 'success',
        text: `Restauración completada con éxito: ${result.restoredCount} contenedor(es) restaurado(s)${
          result.skippedCount > 0 ? `, ${result.skippedCount} omitido(s) por coincidir con existentes` : ''
        }.`,
      });

      // Clear preview
      setPendingBackup(null);
      setConflictData(null);
      onRestored();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: 'Error durante la restauración: ' + (err?.message || err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight">
                RESPALDO Y RESTAURACIÓN LOCAL
              </h2>
              <p className="text-xs text-slate-400">
                Copias de seguridad en formato JSON con validación de integridad
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
          {/* Status Message */}
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="whitespace-pre-line font-medium">{statusMsg.text}</div>
            </div>
          )}

          {/* MAIN ACTIONS (When not in preview) */}
          {!pendingBackup ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Persistencia 100% en este dispositivo (IndexedDB)</span>
                </div>
                <p className="text-slate-600">
                  Los datos nunca se envían a ningún servidor externo. Si limpias el historial de tu navegador o cambias de tablet/ordenador, puedes usar un archivo de respaldo JSON para transferir todos tus contenedores, bultos y movimientos.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Export Button */}
                <button
                  onClick={handleExport}
                  disabled={isProcessing}
                  className="w-full p-4 rounded-xl border border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between text-left group active:scale-98 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        Exportar Respaldo Completo (.json)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Descarga un archivo con todos los contenedores, referencias e historial.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Import Trigger */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelected}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full p-4 rounded-xl border border-slate-300 hover:border-amber-500 hover:bg-amber-50/30 transition-all flex items-center justify-between text-left group active:scale-98 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          Restaurar desde Respaldo (.json)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Valida el archivo y muestra una vista previa antes de aplicar cambios.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW & CONFLICT RESOLUTION STAGE */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                    Vista Previa del Respaldo
                  </h3>
                </div>
                <button
                  onClick={() => setPendingBackup(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  Cancelar
                </button>
              </div>

              {/* Summary counters */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Contenedores
                  </span>
                  <span className="text-lg font-mono font-bold text-slate-900">
                    {pendingBackup.containers.length}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Referencias
                  </span>
                  <span className="text-lg font-mono font-bold text-slate-900">
                    {pendingBackup.references.length}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Movimientos
                  </span>
                  <span className="text-lg font-mono font-bold text-slate-900">
                    {pendingBackup.movements?.length || 0}
                  </span>
                </div>
              </div>

              {/* Conflict indicator */}
              {conflictData && conflictData.conflictingCodes.length > 0 ? (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs space-y-2 text-amber-900">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {conflictData.conflictingCodes.length} contenedor(es) coinciden con los ya existentes en tu dispositivo:
                    </span>
                  </div>
                  <div className="font-mono text-[11px] bg-white/80 p-2 rounded border border-amber-200 max-h-20 overflow-y-auto">
                    {conflictData.conflictingCodes.join(', ')}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No hay conflictos. Todos los contenedores del archivo son nuevos.</span>
                </div>
              )}

              {/* Containers list */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-600 uppercase">
                  Contenedores en el archivo:
                </span>
                <div className="border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {pendingBackup.containers.map((c) => {
                    const isConflict = conflictData?.conflictingCodes.includes(c.code);
                    return (
                      <div key={c.id} className="p-2.5 flex items-center justify-between font-mono">
                        <div>
                          <span className="font-bold text-slate-900">{c.code}</span>
                          <span className="text-[11px] text-slate-400 block font-sans">
                            Estado: {c.status}
                          </span>
                        </div>
                        {isConflict ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Ya existe
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Nuevo
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strategy radio selector */}
              <div className="space-y-2 pt-1 border-t">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Estrategia de Restauración:
                </span>
                <div className="space-y-2 text-xs">
                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input
                      type="radio"
                      name="strategy"
                      checked={strategy === 'SKIP_EXISTING'}
                      onChange={() => setStrategy('SKIP_EXISTING')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-slate-900">
                        Omitir existentes (Más seguro)
                      </span>
                      <p className="text-slate-500 text-[11px]">
                        Conserva tus contenedores actuales intactos y solo importa los que sean nuevos.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input
                      type="radio"
                      name="strategy"
                      checked={strategy === 'OVERWRITE'}
                      onChange={() => setStrategy('OVERWRITE')}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-slate-900">
                        Sobrescribir coincidentes
                      </span>
                      <p className="text-slate-500 text-[11px]">
                        Actualiza los contenedores con el mismo código con la versión del archivo.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-red-200 bg-red-50/40 cursor-pointer hover:bg-red-50">
                    <input
                      type="radio"
                      name="strategy"
                      checked={strategy === 'CLEAN_REPLACE'}
                      onChange={() => setStrategy('CLEAN_REPLACE')}
                      className="mt-0.5 text-red-600"
                    />
                    <div>
                      <span className="font-bold text-red-900">
                        Reemplazo completo (Wipe & Restore)
                      </span>
                      <p className="text-red-700 text-[11px]">
                        Borra la base de datos local actual y deja únicamente el contenido del respaldo.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Explicit Confirmation Checkbox */}
              <div className="p-3 bg-slate-50 rounded-xl border-2 border-slate-300">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600"
                  />
                  <div className="text-xs text-slate-800">
                    <span className="font-bold">Confirmo la restauración:</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      He revisado la vista previa y acepto aplicar esta copia de seguridad en mi almacenamiento local.
                    </p>
                  </div>
                </label>
              </div>

              {/* Execution Action Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingBackup(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={!confirmCheckbox || isProcessing}
                  onClick={handleExecuteRestore}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>{isProcessing ? 'Restaurando...' : 'Proceder con la Restauración'}</span>
                </button>
              </div>
            </div>
          )}
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
