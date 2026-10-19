import React, { useState } from 'react';
import { Smartphone, Download, Share2, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running standalone on home screen, do not show button
  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Instalar como aplicación en tablet o móvil"
        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 active:scale-95 transition-all"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Instalar en iPad / iPhone"
          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5"
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden md:inline">Instalar en iPad</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-slate-900">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-sm">Instalar en iPad / iPhone</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Share2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>1. Toca el botón <b>Compartir</b> en la barra superior o inferior de Safari.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <PlusSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>2. Desplázate hacia abajo y selecciona <b>Añadir a la pantalla de inicio</b>.</p>
                </div>
                <p className="text-[11px] text-slate-400">
                  La app quedará disponible a pantalla completa sin barras de navegador y con persistencia local garantizada.
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-slate-900 text-white font-bold text-xs rounded-xl"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
