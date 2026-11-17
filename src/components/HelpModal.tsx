import React from 'react';
import { HelpCircle, X, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTestSuite?: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, onOpenTestSuite }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold">GUÍA DE OPERACIÓN Y CASOS DE PRUEBA</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              1. Flujo de Descarga en Almacén
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>El operador escribe o busca la referencia que los empleados anuncian desde el contenedor.</li>
              <li>Pulsa <b>Enter</b> o el botón <b>+ REGISTRAR</b> para sumar 1 bulto (o la cantidad anunciada).</li>
              <li>El estado cambia automáticamente:
                <ul className="list-none pl-3 mt-1 space-y-0.5 font-semibold">
                  <li className="text-slate-600">⚪ PENDIENTE: 0 bultos recibidos.</li>
                  <li className="text-amber-700">🟡 PARCIAL: Bultos recibidos menores al esperado.</li>
                  <li className="text-emerald-700">🟢 COMPLETO: Bultos recibidos exactamente iguales al esperado.</li>
                  <li className="text-rose-700">🔴 SOBRANTE: Bultos recibidos superan el esperado (solicita confirmación).</li>
                </ul>
              </li>
            </ul>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              2. Referencias Nuevas y Mercancía No Registrada
            </h3>
            <p>
              Si llegan referencias que no estaban en el archivo Excel original, puedes incorporarlas al contenedor con el botón <b>+ AGREGAR REFERENCIA</b> o escribiendo el código en el registro rápido. Podrás indicar los bultos esperados y recibidos para que se sumen al control y a los informes oficiales.
            </p>
            <div className="space-y-1.5 text-[11px] bg-amber-50 p-3 rounded-lg border border-amber-200 text-amber-900">
              <p>
                <b>Advertencia sobre R-26423:</b> Ya llegaron 720 piezas con el segundo contenedor. Se conserva la previsión de packing del tercer contenedor, pero se exige cotejar una nueva llegada física antes de incorporarla nuevamente al inventario. No marques ese bulto como recibido automáticamente.
              </p>
              <p>
                <b>Trazabilidad R-26195:</b> Corresponde a la referencia canónica R-2608114. El sistema conserva ambos códigos para trazabilidad y auditoría.
              </p>
              <p>
                <b>Nota sobre R-26415:</b> Continúa pendiente de aclaración con el proveedor. No se debe suponer su recepción.
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              3. Corrección y Deshacer Compensatorio
            </h3>
            <p>
              Usa el botón <b>DESHACER ÚLTIMO REGISTRO</b> para revertir un error. El sistema genera un movimiento compensatorio auditado sin borrar el historial previo. Múltiples clics retroceden ordenadamente en el historial sin bucles.
            </p>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              4. Casos de Prueba Verificados
            </h3>
            <div className="bg-slate-50 p-3 rounded-lg border font-mono space-y-1">
              <p>✓ CONTENEDOR 3: 105 referencias, 216 bultos (CTNS), 18.232 piezas</p>
              <p>✓ PROGRESO ACOTADO: El excedente de una referencia no compensa faltantes de otra</p>
              <p>✓ MATCHING EXACTO: 26423 y R26423 &rarr; R-26423 (sin adivinar 2614 &rarr; R-26414)</p>
              <p>✓ R-26195 &rarr; Canónica R-2608114 con código original conservado</p>
              <p>✓ DESHACER COMPENSATORIO: Historial inmutable y balance verificado</p>
              <p>✓ PERSISTENCIA LOCAL: IndexedDB aislado en este dispositivo sin servidores externos</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t flex items-center justify-between">
          {onOpenTestSuite ? (
            <button
              onClick={() => {
                onClose();
                onOpenTestSuite();
              }}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              Diagnóstico y pruebas del sistema (aislado)
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
