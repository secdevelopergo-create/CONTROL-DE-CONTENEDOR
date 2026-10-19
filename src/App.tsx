import React, { useState, useEffect, useCallback } from 'react';
import { Container, ContainerStats, ReferenceItem, Movement, UnidentifiedItem } from './types';
import {
  dbService,
  computeContainerStats,
} from './services/db';
import { createReferenceItems } from './services/excel';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { DownloadScreen } from './components/DownloadScreen';
import { ImportModal } from './components/ImportModal';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { HelpModal } from './components/HelpModal';
import { ReportExportModal } from './components/ReportExportModal';
import { TestSuiteModal } from './components/TestSuiteModal';

export default function App() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [containerStatsMap, setContainerStatsMap] = useState<Record<string, ContainerStats>>({});
  const [activeContainerId, setActiveContainerId] = useState<string | null>(null);

  // Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);

  // Quick report from dashboard
  const [dashboardReportTarget, setDashboardReportTarget] = useState<{
    container: Container;
    stats: ContainerStats;
    references: ReferenceItem[];
    unidentified: UnidentifiedItem[];
    movements: Movement[];
  } | null>(null);

  // Load all containers and their quick statistics
  const refreshContainers = useCallback(async () => {
    try {
      const list = await dbService.getAllContainers();
      setContainers(list);

      const statsMap: Record<string, ContainerStats> = {};
      for (const c of list) {
        const refs = await dbService.getReferencesByContainer(c.id);
        const unids = await dbService.getUnidentifiedByContainer(c.id);
        statsMap[c.id] = computeContainerStats(refs, unids);
      }
      setContainerStatsMap(statsMap);
    } catch (err) {
      console.error('Error cargando contenedores desde IndexedDB:', err);
    }
  }, []);

  useEffect(() => {
    refreshContainers();
  }, [refreshContainers]);

  // Handle new container import confirmation with duplicate code protection
  const handleConfirmImport = async (data: {
    containerCode: string;
    fileName: string;
    grouped: { reference: string; expectedPackages: number }[];
  }) => {
    const containerId = 'cont_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();

    const newContainer: Container = {
      id: containerId,
      code: data.containerCode,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      status: 'SIN_INICIAR',
      fileName: data.fileName,
    };

    const referenceItems = createReferenceItems(containerId, data.grouped);

    // Atomic insert with duplicate code check
    await dbService.createNewContainer(newContainer, referenceItems);

    await refreshContainers();
    setActiveContainerId(containerId);
  };

  // Handle container deletion
  const handleDeleteContainer = async (containerId: string) => {
    try {
      await dbService.deleteContainer(containerId);
      if (activeContainerId === containerId) {
        setActiveContainerId(null);
      }
      await refreshContainers();
    } catch (err: any) {
      alert('Error eliminando contenedor: ' + err?.message);
    }
  };

  // Handle report export trigger from Dashboard
  const handleOpenDashboardReport = async (container: Container) => {
    try {
      const refs = await dbService.getReferencesByContainer(container.id);
      const unids = await dbService.getUnidentifiedByContainer(container.id);
      const movs = await dbService.getMovementsByContainer(container.id);
      const stats = computeContainerStats(refs, unids);

      setDashboardReportTarget({
        container,
        stats,
        references: refs,
        unidentified: unids,
        movements: movs,
      });
    } catch (err: any) {
      alert('Error preparando informe: ' + err?.message);
    }
  };

  const activeContainer = containers.find((c) => c.id === activeContainerId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* App Header */}
      <Header
        activeContainerCode={activeContainer?.code}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenTestSuite={() => setIsTestSuiteOpen(true)}
        onNavigateHome={() => setActiveContainerId(null)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {activeContainerId ? (
          <DownloadScreen
            containerId={activeContainerId}
            onBack={() => {
              setActiveContainerId(null);
              refreshContainers();
            }}
            onRefreshAll={refreshContainers}
          />
        ) : (
          <Dashboard
            containers={containers}
            containerStatsMap={containerStatsMap}
            onSelectContainer={(id) => setActiveContainerId(id)}
            onNewContainer={() => setIsImportOpen(true)}
            onDeleteContainer={handleDeleteContainer}
            onExportReport={handleOpenDashboardReport}
            onRefresh={refreshContainers}
          />
        )}
      </main>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onConfirmImport={handleConfirmImport}
      />

      {/* Backup and Restore Modal with Validations & Conflict Resolution */}
      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        onRestored={() => {
          refreshContainers();
        }}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Automated Test Suite Modal */}
      <TestSuiteModal
        isOpen={isTestSuiteOpen}
        onClose={() => setIsTestSuiteOpen(false)}
      />

      {/* Dashboard Report Modal */}
      {dashboardReportTarget && (
        <ReportExportModal
          isOpen={true}
          container={dashboardReportTarget.container}
          stats={dashboardReportTarget.stats}
          references={dashboardReportTarget.references}
          unidentified={dashboardReportTarget.unidentified}
          movements={dashboardReportTarget.movements}
          onClose={() => setDashboardReportTarget(null)}
        />
      )}
    </div>
  );
}
