import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  readExcelFile,
  detectColumnsAndHeaderRow,
  processImportRows,
  isPieceOrUnitColumn,
  ParsedWorkbook,
} from '../services/excel';
import { dbService, normalizeContainerCode } from '../services/db';
import { RejectedRow } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (data: {
    containerCode: string;
    fileName: string;
    grouped: { reference: string; expectedPackages: number }[];
    rejectedRows: RejectedRow[];
  }) => Promise<void>;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const [containerCode, setContainerCode] = useState('');
  const [duplicateCodeError, setDuplicateCodeError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [parsedWb, setParsedWb] = useState<ParsedWorkbook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedRefCol, setSelectedRefCol] = useState<string>('');
  const [selectedPkgCol, setSelectedPkgCol] = useState<string>('');
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);

  // Explicit confirmation state
  const [isMappingConfirmed, setIsMappingConfirmed] = useState(false);

  const [groupedRefs, setGroupedRefs] = useState<{ reference: string; expectedPackages: number; rowCount: number }[]>([]);
  const [rejectedRows, setRejectedRows] = useState<RejectedRow[]>([]);
  const [totalExpected, setTotalExpected] = useState<number>(0);

  const [showRejectedModal, setShowRejectedModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check duplicate container code when code changes
  useEffect(() => {
    const checkDuplicate = async () => {
      const trimmed = containerCode.trim();
      if (!trimmed) {
        setDuplicateCodeError(null);
        return;
      }
      try {
        const existing = await dbService.getContainerByCode(trimmed);
        if (existing) {
          setDuplicateCodeError(
            `Ya existe un contenedor registrado con el código "${existing.code}". Usa un código distinto o agrega un sufijo (ej. ${existing.code}-2).`
          );
        } else {
          setDuplicateCodeError(null);
        }
      } catch {
        setDuplicateCodeError(null);
      }
    };

    const timer = setTimeout(checkDuplicate, 250);
    return () => clearTimeout(timer);
  }, [containerCode]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setErrorMessage(null);
    setIsProcessingFile(true);
    setIsMappingConfirmed(false);

    try {
      if (!containerCode.trim()) {
        const baseName = selectedFile.name.replace(/\.[^/.]+$/, '').trim();
        setContainerCode(baseName.toUpperCase().replace(/\s+/g, '-'));
      }

      const parsed = await readExcelFile(selectedFile);
      setFile(selectedFile);
      setParsedWb(parsed);

      const defaultSheet = parsed.sheetNames[0] || '';
      setSelectedSheet(defaultSheet);

      analyzeSheet(parsed, defaultSheet);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al procesar el archivo Excel.');
      setFile(null);
      setParsedWb(null);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const analyzeSheet = (wb: ParsedWorkbook, sheetName: string) => {
    const rows = wb.rawSheetsData[sheetName] || [];
    if (rows.length === 0) {
      setErrorMessage(`La hoja "${sheetName}" está vacía.`);
      setAvailableColumns([]);
      setGroupedRefs([]);
      return;
    }

    const { headerRowIndex: hIdx, columns, suggestedRefCol, suggestedPkgCol } =
      detectColumnsAndHeaderRow(rows);

    setHeaderRowIndex(hIdx);
    setAvailableColumns(columns);
    setSelectedRefCol(suggestedRefCol);
    setSelectedPkgCol(suggestedPkgCol);
    setIsMappingConfirmed(false);

    recalculateGrouped(rows, hIdx, suggestedRefCol, suggestedPkgCol);
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    setIsMappingConfirmed(false);
    if (parsedWb) {
      analyzeSheet(parsedWb, sheetName);
    }
  };

  const recalculateGrouped = (
    rows: any[][],
    hIdx: number,
    refCol: string,
    pkgCol: string
  ) => {
    if (!refCol || !pkgCol) {
      setGroupedRefs([]);
      setTotalExpected(0);
      return;
    }

    try {
      const result = processImportRows(rows, hIdx, refCol, pkgCol);
      setGroupedRefs(result.grouped);
      setRejectedRows(result.rejectedRows);
      setTotalExpected(result.totalExpectedPackages);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error calculando filas.');
      setGroupedRefs([]);
      setTotalExpected(0);
    }
  };

  const handleRefColChange = (newRefCol: string) => {
    setSelectedRefCol(newRefCol);
    setIsMappingConfirmed(false);
    if (parsedWb && selectedSheet) {
      recalculateGrouped(
        parsedWb.rawSheetsData[selectedSheet] || [],
        headerRowIndex,
        newRefCol,
        selectedPkgCol
      );
    }
  };

  const handlePkgColChange = (newPkgCol: string) => {
    setSelectedPkgCol(newPkgCol);
    setIsMappingConfirmed(false);
    if (parsedWb && selectedSheet) {
      recalculateGrouped(
        parsedWb.rawSheetsData[selectedSheet] || [],
        headerRowIndex,
        selectedRefCol,
        newPkgCol
      );
    }
  };

  const handleConfirm = async () => {
    if (!containerCode.trim()) {
      setErrorMessage('Por favor ingresa un código o nombre para el contenedor.');
      return;
    }

    if (duplicateCodeError) {
      setErrorMessage(duplicateCodeError);
      return;
    }

    // Final duplicate check
    const existing = await dbService.getContainerByCode(containerCode.trim());
    if (existing) {
      setErrorMessage(`El código "${existing.code}" ya está en uso. Ingresa un código único.`);
      return;
    }

    if (!selectedRefCol || !selectedPkgCol) {
      setErrorMessage('Debes seleccionar las columnas de Referencia y Bultos.');
      return;
    }

    if (!isMappingConfirmed) {
      setErrorMessage('Debes confirmar expresamente que la columna seleccionada corresponde a BULTOS y no a unidades/piezas.');
      return;
    }

    if (!file || groupedRefs.length === 0) {
      setErrorMessage('No hay referencias válidas para importar.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmImport({
        containerCode: containerCode.trim().toUpperCase(),
        fileName: file.name,
        grouped: groupedRefs,
        rejectedRows,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage('Error guardando contenedor: ' + err?.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSuspiciousPkgCol = isPieceOrUnitColumn(selectedPkgCol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">NUEVO CONTENEDOR</h2>
              <p className="text-xs text-slate-400">
                Importar manifiesto de bultos desde archivo Excel o CSV
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

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Container Code Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <span>Código o Nombre del Contenedor</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. UDC260825, MSCU-789012, CONT-JUGUETES"
              value={containerCode}
              onChange={(e) => setContainerCode(e.target.value.toUpperCase())}
              className={`w-full px-4 py-3 rounded-xl border font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 text-base uppercase transition-colors ${
                duplicateCodeError
                  ? 'border-red-400 focus:ring-red-500 bg-red-50/30'
                  : 'border-slate-300 focus:ring-blue-600'
              }`}
            />
            {duplicateCodeError ? (
              <p className="text-xs text-red-600 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{duplicateCodeError}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Identificador único de la descarga. El sistema previene códigos duplicados.
              </p>
            )}
          </div>

          {/* File Upload Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
              <span>Archivo de Manifiesto (.xlsx, .xls, .csv)</span>
              <span className="text-red-500">*</span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                file
                  ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-800 text-sm truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-emerald-600 font-medium">
                      Archivo cargado correctamente. Clic para cambiar.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Selecciona o arrastra el archivo Excel (.xlsx, .xls, .csv)
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Procesamiento 100% local en tu navegador
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sheet Selector (if multiple sheets) */}
          {parsedWb && parsedWb.sheetNames.length > 1 && (
            <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-700">
                Seleccionar Hoja del Libro Excel ({parsedWb.sheetNames.length} hojas encontradas):
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {parsedWb.sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Column Mapping Section */}
          {availableColumns.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Mapeo de Columnas (Encabezados Originales)
                </h3>
                <span className="text-[11px] text-blue-600 font-medium">
                  Verificación requerida
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Reference Column */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Columna de Referencia:
                  </label>
                  <select
                    value={selectedRefCol}
                    onChange={(e) => handleRefColChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
                  >
                    <option value="">-- Seleccionar columna --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Packages Column */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Columna de Bultos / Cajas (NO piezas):
                  </label>
                  <select
                    value={selectedPkgCol}
                    onChange={(e) => handlePkgColChange(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border font-medium text-slate-800 text-sm focus:ring-2 focus:outline-none font-mono ${
                      isSuspiciousPkgCol
                        ? 'border-amber-400 bg-amber-50/50 focus:ring-amber-500'
                        : 'border-slate-300 bg-white focus:ring-blue-600'
                    }`}
                  >
                    <option value="">-- Seleccionar columna de bultos --</option>
                    {availableColumns.map((col) => {
                      const isPiece = isPieceOrUnitColumn(col);
                      return (
                        <option key={col} value={col}>
                          {col} {isPiece ? '⚠️ (Posible unidad/pieza)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Warning if user picked pieces/unidades */}
              {isSuspiciousPkgCol && (
                <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold uppercase">
                      ¡Atención! Posible confusión de piezas vs bultos
                    </p>
                    <p>
                      Has seleccionado la columna <b>&quot;{selectedPkgCol}&quot;</b>, la cual parece contener unidades o piezas. Recuerda que la aplicación debe controlar <b>únicamente bultos físicos descargados</b> (cajas/cartons), nunca piezas individuales por caja.
                    </p>
                  </div>
                </div>
              )}

              {/* Explicit Mapping Confirmation Checkbox */}
              {selectedRefCol && selectedPkgCol && (
                <div className="p-3.5 rounded-xl bg-slate-50 border-2 border-slate-300 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isMappingConfirmed}
                      onChange={(e) => setIsMappingConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div className="text-xs text-slate-800">
                      <span className="font-bold">Confirmación explícita del mapeo:</span>
                      <p className="text-slate-600 mt-0.5">
                        He verificado que la columna <b>&quot;{selectedPkgCol}&quot;</b> representa la cantidad real de bultos/cajas físicas que se descargarán, y que la columna <b>&quot;{selectedRefCol}&quot;</b> corresponde a las referencias de producto.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Summary of Detected Data */}
              {groupedRefs.length > 0 && (
                <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Resumen de importación
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400">Referencias únicas</p>
                      <p className="text-xl font-mono font-bold text-white">
                        {groupedRefs.length}
                      </p>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <p className="text-xs text-slate-400">Bultos esperados</p>
                      <p className="text-xl font-mono font-bold text-amber-400">
                        {totalExpected}
                      </p>
                    </div>
                  </div>

                  {/* Rejected Rows Alert */}
                  {rejectedRows.length > 0 && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                      <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {rejectedRows.length} fila(s) descartadas por formato inválido o vacío.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRejectedModal(true)}
                        className="underline text-slate-300 hover:text-white"
                      >
                        Ver detalle
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Preview table (first 10 items) */}
              {groupedRefs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Vista previa de referencias agrupadas ({groupedRefs.length} en total):
                  </p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5">Referencia</th>
                          <th className="p-2.5 text-right">Bultos Esperados</th>
                          <th className="p-2.5 text-center">Filas Agrupadas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {groupedRefs.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">{item.reference}</td>
                            <td className="p-2.5 text-right text-blue-700 font-bold">
                              {item.expectedPackages}
                            </td>
                            <td className="p-2.5 text-center text-slate-500">
                              {item.rowCount > 1 ? (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-semibold">
                                  {item.rowCount} filas sumadas
                                </span>
                              ) : (
                                '1 fila'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              !containerCode.trim() ||
              !!duplicateCodeError ||
              !selectedRefCol ||
              !selectedPkgCol ||
              !isMappingConfirmed ||
              groupedRefs.length === 0 ||
              isSubmitting
            }
            title={
              !isMappingConfirmed
                ? 'Debes marcar la casilla de confirmación del mapeo antes de iniciar'
                : duplicateCodeError
                ? 'El código del contenedor está duplicado'
                : 'Confirmar e iniciar descarga'
            }
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <span>{isSubmitting ? 'Guardando...' : 'CONFIRMAR E INICIAR DESCARGA'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rejections Details Modal */}
      {showRejectedModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                Filas Rechazadas ({rejectedRows.length})
              </h3>
              <button
                onClick={() => setShowRejectedModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Estas filas fueron omitidas porque no contenían una referencia válida o tenían cantidades incorrectas (negativas, decimales, cero o no numéricas):
            </p>
            <div className="space-y-2 text-xs font-mono">
              {rejectedRows.map((r, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-red-600">Fila {r.rowNumber}: {r.reason}</div>
                  <div className="text-slate-600">
                    Ref: &quot;{r.rawReference}&quot; | Bultos: &quot;{String(r.rawPackages)}&quot;
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowRejectedModal(false)}
              className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
