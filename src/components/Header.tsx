import React, { useState } from 'react';
import {
  Package,
  Volume2,
  VolumeX,
  HardDrive,
  Download,
  HelpCircle,
  FileCheck2,
  WifiOff,
} from 'lucide-react';
import { sounds } from '../services/audio';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface HeaderProps {
  onOpenBackup: () => void;
  onOpenHelp: () => void;
  onOpenTestSuite: () => void;
  activeContainerCode?: string;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBackup,
  onOpenHelp,
  onOpenTestSuite,
  activeContainerCode,
  onNavigateHome,
}) => {
  const [soundOn, setSoundOn] = useState(sounds.enabled);
  const isOnline = useOnlineStatus();

  const handleToggleSound = () => {
    const newState = sounds.toggleSound();
    setSoundOn(newState);
    if (newState) {
      sounds.playScanSuccess();
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base sm:text-lg text-white">
                CONTROL DE DESCARGA
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-blue-950 text-blue-300 border border-blue-800 rounded">
                OPERATIVO
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Control físico de bultos por contenedor
            </p>
          </div>
        </div>

        {/* Center: Container indicator if inside a container */}
        {activeContainerCode && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs">
            <span className="text-slate-400 font-medium">Contenedor activo:</span>
            <span className="font-mono font-bold text-amber-400">{activeContainerCode}</span>
          </div>
        )}

        {/* Right utility buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Offline indicator if disconnected */}
          {!isOnline && (
            <div
              title="Sin conexión de red. La aplicación funciona 100% de manera autónoma con IndexedDB y el Service Worker."
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500 text-amber-300 text-xs font-bold animate-pulse"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* PWA In-App Install Button */}
          <PWAInstallButton />

          {/* Audio toggle */}
          <button
            onClick={handleToggleSound}
            title={soundOn ? 'Sonido activado (clic para silenciar)' : 'Sonido silenciado (clic para activar)'}
            className={`p-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              soundOn
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-red-950/60 border-red-900 text-red-300 hover:bg-red-900/80'
            }`}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
            <span className="hidden lg:inline">{soundOn ? 'Audio ON' : 'Audio OFF'}</span>
          </button>

          {/* Automated Test Suite Button */}
          <button
            onClick={onOpenTestSuite}
            title="Suite de pruebas de importación, conteos y persistencia"
            className="px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Pruebas</span>
          </button>

          {/* Backup & Restore */}
          <button
            onClick={onOpenBackup}
            title="Copia de seguridad y restauración JSON"
            className="px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Respaldo</span>
          </button>

          {/* Help / Guide */}
          <button
            onClick={onOpenHelp}
            title="Guía operativa y casos de prueba"
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
