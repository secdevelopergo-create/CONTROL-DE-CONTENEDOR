import React from 'react';
import { HelpCircle, X, CheckCircle2, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
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
            <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <b>Nota sobre R-26415:</b> La referencia R-26415 ya fue recibida en una entrega anterior y no está en este contenedor. Si llegaran bultos físicos no previstos, puedes agregarlos al instante con sus respectivos bultos.
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              3. Corrección y Deshacer
            </h3>
            <p>
              Usa el botón <b>DESHACER ÚLTIMO REGISTRO</b> para revertir rápidamente un error, o haz clic en cualquier referencia para restar bultos o corregir el conteo con nota de auditoría.
            </p>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h3 className="font-bold text-slate-900 uppercase text-xs">
              4. Casos de Prueba Verificados
            </h3>
            <div className="bg-slate-50 p-3 rounded-lg border font-mono space-y-1">
              <p>✓ PRUEBA 1: R-2608001 (1 bulto) &rarr; +1 &rarr; COMPLETO (verde)</p>
              <p>✓ PRUEBA 2: R-2608003 (5 bultos) &rarr; +2 &rarr; PARCIAL (faltan 3) &rarr; +3 &rarr; COMPLETO</p>
              <p>✓ PRUEBA 3: R-2608004 (2 bultos) &rarr; +3 &rarr; Advertencia de Sobrante (+1 excedente)</p>
              <p>✓ PRUEBA 4: Ref desconocida &rarr; Registro en Mercancía No Identificada</p>
              <p>✓ PRUEBA 5: Persistencia IndexedDB &rarr; recargar la página mantiene datos intactos</p>
              <p>✓ PRUEBA 6: Deshacer movimiento &rarr; restaura conteo previo</p>
              <p>✓ PRUEBA 9: Filas duplicadas en Excel &rarr; se agrupan y suman automáticamente</p>
              <p>✓ PRUEBA 10: Exportación de informe Excel con múltiples hojas</p>
              <p>✓ PRUEBA 11: Bloqueo anti-doble clic en envíos simultáneos</p>
              <p>✓ PRUEBA 12: Exportación y restauración de respaldo JSON</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t flex justify-end">
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
