import {
  Container,
  ReferenceItem,
  Movement,
  UnidentifiedItem,
  BackupData,
  ReferenceStatus,
  ContainerStatus,
  ContainerStats,
} from '../types';

const DB_NAME = 'ControlDescargaContenedoresDB';
const DB_VERSION = 1;

class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB no está disponible en este entorno.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Containers
        if (!db.objectStoreNames.contains('containers')) {
          const cStore = db.createObjectStore('containers', { keyPath: 'id' });
          cStore.createIndex('code', 'code', { unique: false });
        }

        // References
        if (!db.objectStoreNames.contains('references')) {
          const refStore = db.createObjectStore('references', { keyPath: 'id' });
          refStore.createIndex('containerId', 'containerId', { unique: false });
          refStore.createIndex('container_ref', ['containerId', 'reference'], { unique: false });
        }

        // Movements
        if (!db.objectStoreNames.contains('movements')) {
          const movStore = db.createObjectStore('movements', { keyPath: 'id' });
          movStore.createIndex('containerId', 'containerId', { unique: false });
          movStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Unidentified
        if (!db.objectStoreNames.contains('unidentified')) {
          const unStore = db.createObjectStore('unidentified', { keyPath: 'id' });
          unStore.createIndex('containerId', 'containerId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- CONTAINERS ---

  async getAllContainers(): Promise<Container[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('containers', 'readonly');
      const store = tx.objectStore('containers');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as Container[]) || [];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getContainer(id: string): Promise<Container | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('containers', 'readonly');
      const store = tx.objectStore('containers');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getContainerByCode(code: string): Promise<Container | null> {
    const db = await this.getDB();
    const normalizedTarget = normalizeContainerCode(code);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('containers', 'readonly');
      const store = tx.objectStore('containers');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as Container[]) || [];
        const match = list.find((c) => normalizeContainerCode(c.code) === normalizedTarget);
        resolve(match || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveContainer(container: Container): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('containers', 'readwrite');
      const store = tx.objectStore('containers');
      const req = store.put(container);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async createNewContainer(
    container: Container,
    referenceItems: ReferenceItem[]
  ): Promise<void> {
    const existing = await this.getContainerByCode(container.code);
    if (existing && existing.id !== container.id) {
      throw new Error(
        `Ya existe un contenedor con el código "${container.code}". Por favor utiliza un código o identificador diferente.`
      );
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['containers', 'references'], 'readwrite');
      const cStore = tx.objectStore('containers');
      const rStore = tx.objectStore('references');

      cStore.put(container);
      referenceItems.forEach((r) => rStore.put(r));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteContainer(containerId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['containers', 'references', 'movements', 'unidentified'],
        'readwrite'
      );

      // delete container
      tx.objectStore('containers').delete(containerId);

      // delete references
      const refIndex = tx.objectStore('references').index('containerId');
      const refReq = refIndex.openKeyCursor(IDBKeyRange.only(containerId));
      refReq.onsuccess = () => {
        const cursor = refReq.result;
        if (cursor) {
          tx.objectStore('references').delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // delete movements
      const movIndex = tx.objectStore('movements').index('containerId');
      const movReq = movIndex.openKeyCursor(IDBKeyRange.only(containerId));
      movReq.onsuccess = () => {
        const cursor = movReq.result;
        if (cursor) {
          tx.objectStore('movements').delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      // delete unidentified
      const unIndex = tx.objectStore('unidentified').index('containerId');
      const unReq = unIndex.openKeyCursor(IDBKeyRange.only(containerId));
      unReq.onsuccess = () => {
        const cursor = unReq.result;
        if (cursor) {
          tx.objectStore('unidentified').delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- REFERENCES ---

  async getReferencesByContainer(containerId: string): Promise<ReferenceItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('references', 'readonly');
      const index = tx.objectStore('references').index('containerId');
      const request = index.getAll(IDBKeyRange.only(containerId));

      request.onsuccess = () => {
        const list = (request.result as ReferenceItem[]) || [];
        list.sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveReferences(items: ReferenceItem[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('references', 'readwrite');
      const store = tx.objectStore('references');

      items.forEach((item) => store.put(item));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveReference(item: ReferenceItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('references', 'readwrite');
      const store = tx.objectStore('references');
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- MOVEMENTS ---

  async getMovementsByContainer(containerId: string): Promise<Movement[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('movements', 'readonly');
      const index = tx.objectStore('movements').index('containerId');
      const request = index.getAll(IDBKeyRange.only(containerId));

      request.onsuccess = () => {
        const list = (request.result as Movement[]) || [];
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async recordMovement(movement: Movement): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('movements', 'readwrite');
      const store = tx.objectStore('movements');
      const req = store.put(movement);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- UNIDENTIFIED ITEMS ---

  async getUnidentifiedByContainer(containerId: string): Promise<UnidentifiedItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('unidentified', 'readonly');
      const index = tx.objectStore('unidentified').index('containerId');
      const request = index.getAll(IDBKeyRange.only(containerId));

      request.onsuccess = () => {
        const list = (request.result as UnidentifiedItem[]) || [];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveUnidentifiedItem(item: UnidentifiedItem): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('unidentified', 'readwrite');
      const store = tx.objectStore('unidentified');
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- ATOMIC PACKAGES REGISTRATION ---

  async registerPackages(
    containerId: string,
    referenceId: string,
    delta: number,
    operationType: 'ADD' | 'REMOVE' = 'ADD'
  ): Promise<{ updatedItem: ReferenceItem; movement: Movement }> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['references', 'movements', 'containers'], 'readwrite');
      const refStore = tx.objectStore('references');
      const movStore = tx.objectStore('movements');
      const containerStore = tx.objectStore('containers');

      const refReq = refStore.get(referenceId);

      refReq.onsuccess = () => {
        const item: ReferenceItem = refReq.result;
        if (!item) {
          reject(new Error('Referencia no encontrada'));
          return;
        }

        const prevCount = item.registeredPackages;
        const newCount = Math.max(0, prevCount + delta);

        item.registeredPackages = newCount;
        item.status = calculateReferenceStatus(item.expectedPackages, newCount);
        item.lastUpdated = new Date().toISOString();

        refStore.put(item);

        const movement: Movement = {
          id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          containerId,
          reference: item.reference,
          isUnidentified: false,
          quantity: delta,
          previousCount: prevCount,
          newCount: newCount,
          operationType: operationType,
          timestamp: new Date().toISOString(),
          details: `${delta > 0 ? '+' : ''}${delta} bulto(s) (Pasa de ${prevCount} a ${newCount})`,
        };
        movStore.put(movement);

        // Update container status to EN_PROCESO if not finished
        const cReq = containerStore.get(containerId);
        cReq.onsuccess = () => {
          const container: Container = cReq.result;
          if (container) {
            if (!container.startedAt) {
              container.startedAt = new Date().toISOString();
            }
            if (container.status === 'SIN_INICIAR') {
              container.status = 'EN_PROCESO';
            }
            containerStore.put(container);
          }
        };

        tx.oncomplete = () => {
          resolve({ updatedItem: item, movement });
        };
        tx.onerror = () => reject(tx.error);
      };

      refReq.onerror = () => reject(refReq.error);
    });
  }

  // --- MANUAL AUDITED CORRECTION ---

  async correctReferenceCount(
    containerId: string,
    referenceId: string,
    newCount: number,
    reason: string
  ): Promise<{ updatedItem: ReferenceItem; movement: Movement }> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['references', 'movements'], 'readwrite');
      const refStore = tx.objectStore('references');
      const movStore = tx.objectStore('movements');

      const refReq = refStore.get(referenceId);

      refReq.onsuccess = () => {
        const item: ReferenceItem = refReq.result;
        if (!item) {
          reject(new Error('Referencia no encontrada'));
          return;
        }

        const prevCount = item.registeredPackages;
        const clampedNewCount = Math.max(0, newCount);
        const delta = clampedNewCount - prevCount;

        item.registeredPackages = clampedNewCount;
        item.status = calculateReferenceStatus(item.expectedPackages, clampedNewCount);
        item.lastUpdated = new Date().toISOString();

        refStore.put(item);

        const movement: Movement = {
          id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          containerId,
          reference: item.reference,
          isUnidentified: false,
          quantity: delta,
          previousCount: prevCount,
          newCount: clampedNewCount,
          operationType: 'CORRECTION',
          timestamp: new Date().toISOString(),
          details: `Corrección manual: ${prevCount} -> ${clampedNewCount}. Motivo: ${reason}`,
        };
        movStore.put(movement);

        tx.oncomplete = () => {
          resolve({ updatedItem: item, movement });
        };
        tx.onerror = () => reject(tx.error);
      };

      refReq.onerror = () => reject(refReq.error);
    });
  }

  // --- UNIDENTIFIED GOODS ---

  async registerUnidentifiedGoods(
    containerId: string,
    reference: string,
    packages: number,
    notes?: string
  ): Promise<{ item: UnidentifiedItem; movement: Movement }> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['unidentified', 'movements', 'containers'], 'readwrite');
      const unStore = tx.objectStore('unidentified');
      const movStore = tx.objectStore('movements');
      const containerStore = tx.objectStore('containers');

      const normRef = normalizeReference(reference);

      // Check if this unidentified reference already has a record in this container
      const unIndex = unStore.index('containerId');
      const req = unIndex.getAll(IDBKeyRange.only(containerId));

      req.onsuccess = () => {
        const existingList = (req.result as UnidentifiedItem[]) || [];
        const existing = existingList.find((u) => u.reference === normRef);

        let item: UnidentifiedItem;
        let prevCount = 0;
        let newCount = packages;

        if (existing) {
          prevCount = existing.registeredPackages;
          newCount = prevCount + packages;
          existing.registeredPackages = newCount;
          if (notes) existing.notes = notes;
          item = existing;
          unStore.put(item);
        } else {
          const unId = 'unid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
          item = {
            id: unId,
            containerId,
            reference: normRef,
            registeredPackages: packages,
            createdAt: new Date().toISOString(),
            notes: notes || undefined,
          };
          unStore.put(item);
        }

        const movement: Movement = {
          id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          containerId,
          reference: item.reference,
          isUnidentified: true,
          quantity: packages,
          previousCount: prevCount,
          newCount: newCount,
          operationType: 'UNIDENTIFIED_ADD',
          timestamp: new Date().toISOString(),
          details: `Mercancía no identificada: +${packages} bulto(s)${notes ? ' (' + notes + ')' : ''}`,
        };
        movStore.put(movement);

        const cReq = containerStore.get(containerId);
        cReq.onsuccess = () => {
          const container: Container = cReq.result;
          if (container) {
            if (!container.startedAt) container.startedAt = new Date().toISOString();
            if (container.status === 'SIN_INICIAR') container.status = 'EN_PROCESO';
            containerStore.put(container);
          }
        };

        tx.oncomplete = () => resolve({ item, movement });
        tx.onerror = () => reject(tx.error);
      };

      req.onerror = () => reject(req.error);
    });
  }

  // --- UNDO WITH COMPENSATING MOVEMENT (Preserves complete audit history!) ---

  async undoLastMovement(containerId: string): Promise<{
    success: boolean;
    compensatingMovement?: Movement;
    message: string;
  }> {
    const db = await this.getDB();
    const movements = await this.getMovementsByContainer(containerId);
    if (!movements || movements.length === 0) {
      return { success: false, message: 'No hay movimientos registrados para deshacer.' };
    }

    const lastMovement = movements[0]; // ordered desc (latest)

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['references', 'unidentified', 'movements'], 'readwrite');
      const refStore = tx.objectStore('references');
      const unStore = tx.objectStore('unidentified');
      const movStore = tx.objectStore('movements');

      let compensatingMovement: Movement;

      if (lastMovement.isUnidentified) {
        // Compensate unidentified item
        const unIndex = unStore.index('containerId');
        const req = unIndex.openCursor(IDBKeyRange.only(containerId));

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const item = cursor.value as UnidentifiedItem;
            if (item.reference === lastMovement.reference) {
              const targetCount = Math.max(0, lastMovement.previousCount);
              const compQty = targetCount - item.registeredPackages;

              if (targetCount === 0) {
                cursor.delete();
              } else {
                item.registeredPackages = targetCount;
                cursor.update(item);
              }

              // Register compensating movement (DO NOT DELETE past movement!)
              compensatingMovement = {
                id: 'mov_undo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                containerId,
                reference: lastMovement.reference,
                isUnidentified: true,
                quantity: compQty,
                previousCount: lastMovement.newCount,
                newCount: targetCount,
                operationType: 'UNDO',
                timestamp: new Date().toISOString(),
                details: `Deshacer: Revierte movimiento previo de ${lastMovement.quantity > 0 ? '+' : ''}${lastMovement.quantity} bulto(s). Conteo restablecido de ${lastMovement.newCount} a ${targetCount}.`,
              };
              movStore.put(compensatingMovement);
            } else {
              cursor.continue();
            }
          }
        };
      } else {
        // Compensate standard reference
        const refIndex = refStore.index('container_ref');
        const req = refIndex.get([containerId, lastMovement.reference]);

        req.onsuccess = () => {
          const item = req.result as ReferenceItem;
          if (item) {
            const targetCount = Math.max(0, lastMovement.previousCount);
            const compQty = targetCount - item.registeredPackages;

            item.registeredPackages = targetCount;
            item.status = calculateReferenceStatus(item.expectedPackages, targetCount);
            item.lastUpdated = new Date().toISOString();
            refStore.put(item);

            // Register compensating movement (DO NOT DELETE past movement!)
            compensatingMovement = {
              id: 'mov_undo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              containerId,
              reference: item.reference,
              isUnidentified: false,
              quantity: compQty,
              previousCount: lastMovement.newCount,
              newCount: targetCount,
              operationType: 'UNDO',
              timestamp: new Date().toISOString(),
              details: `Deshacer: Revierte movimiento previo de ${lastMovement.quantity > 0 ? '+' : ''}${lastMovement.quantity} bulto(s). Conteo restablecido de ${lastMovement.newCount} a ${targetCount}.`,
            };
            movStore.put(compensatingMovement);
          }
        };
      }

      tx.oncomplete = () => {
        resolve({
          success: true,
          compensatingMovement,
          message: `Deshecho registrado en historial: ${lastMovement.reference} pasa de ${lastMovement.newCount} a ${lastMovement.previousCount} bultos.`,
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- REINFORCED BACKUP & RESTORE WITH VALIDATION & STRATEGIES ---

  async exportBackup(): Promise<BackupData> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['containers', 'references', 'movements', 'unidentified'],
        'readonly'
      );

      const containersReq = tx.objectStore('containers').getAll();
      const referencesReq = tx.objectStore('references').getAll();
      const movementsReq = tx.objectStore('movements').getAll();
      const unidentifiedReq = tx.objectStore('unidentified').getAll();

      tx.oncomplete = () => {
        const backup: BackupData = {
          version: '1.1',
          exportedAt: new Date().toISOString(),
          containers: containersReq.result || [],
          references: referencesReq.result || [],
          movements: movementsReq.result || [],
          unidentified: unidentifiedReq.result || [],
        };
        resolve(backup);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // Validates backup structure deeply
  validateBackupData(data: any): {
    isValid: boolean;
    errors: string[];
    summary?: {
      containerCount: number;
      referenceCount: number;
      movementCount: number;
      unidentifiedCount: number;
    };
  } {
    const errors: string[] = [];
    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['El archivo no contiene un objeto JSON válido.'] };
    }

    if (!Array.isArray(data.containers)) {
      errors.push('Falta la lista obligatoria "containers".');
    } else {
      data.containers.forEach((c: any, idx: number) => {
        if (!c.id || !c.code || !c.createdAt) {
          errors.push(`Contenedor en índice ${idx} tiene campos obligatorios incompletos (id, code, createdAt).`);
        }
      });
    }

    if (!Array.isArray(data.references)) {
      errors.push('Falta la lista obligatoria "references".');
    } else {
      data.references.forEach((r: any, idx: number) => {
        if (!r.id || !r.containerId || !r.reference || typeof r.expectedPackages !== 'number') {
          errors.push(`Referencia en índice ${idx} tiene campos incompletos.`);
        }
      });
    }

    if (data.movements && !Array.isArray(data.movements)) {
      errors.push('El campo "movements" debe ser una lista.');
    }

    if (data.unidentified && !Array.isArray(data.unidentified)) {
      errors.push('El campo "unidentified" debe ser una lista.');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      summary: {
        containerCount: data.containers.length,
        referenceCount: data.references.length,
        movementCount: Array.isArray(data.movements) ? data.movements.length : 0,
        unidentifiedCount: Array.isArray(data.unidentified) ? data.unidentified.length : 0,
      },
    };
  }

  // Check conflicts with existing database
  async checkBackupConflicts(backup: BackupData): Promise<{
    existingContainers: Container[];
    conflictingCodes: string[];
    newContainers: Container[];
  }> {
    const existingContainers = await this.getAllContainers();
    const existingCodes = new Set(existingContainers.map((c) => normalizeContainerCode(c.code)));

    const conflictingCodes: string[] = [];
    const newContainers: Container[] = [];

    backup.containers.forEach((c) => {
      const norm = normalizeContainerCode(c.code);
      if (existingCodes.has(norm)) {
        conflictingCodes.push(c.code);
      } else {
        newContainers.push(c);
      }
    });

    return {
      existingContainers,
      conflictingCodes,
      newContainers,
    };
  }

  // Execute restore with strategy
  async executeRestore(
    backup: BackupData,
    strategy: 'OVERWRITE' | 'SKIP_EXISTING' | 'CLEAN_REPLACE'
  ): Promise<{ restoredCount: number; skippedCount: number }> {
    const validation = this.validateBackupData(backup);
    if (!validation.isValid) {
      throw new Error('Validación fallida: ' + validation.errors.join('; '));
    }

    const db = await this.getDB();
    const existing = await this.getAllContainers();
    const existingCodes = new Set(existing.map((c) => normalizeContainerCode(c.code)));

    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['containers', 'references', 'movements', 'unidentified'],
        'readwrite'
      );

      const cStore = tx.objectStore('containers');
      const rStore = tx.objectStore('references');
      const mStore = tx.objectStore('movements');
      const uStore = tx.objectStore('unidentified');

      if (strategy === 'CLEAN_REPLACE') {
        cStore.clear();
        rStore.clear();
        mStore.clear();
        uStore.clear();

        backup.containers.forEach((c) => cStore.put(c));
        backup.references.forEach((r) => rStore.put(r));
        if (backup.movements) backup.movements.forEach((m) => mStore.put(m));
        if (backup.unidentified) backup.unidentified.forEach((u) => uStore.put(u));

        tx.oncomplete = () => {
          resolve({ restoredCount: backup.containers.length, skippedCount: 0 });
        };
        tx.onerror = () => reject(tx.error);
        return;
      }

      // Filter containers according to strategy
      const containersToRestore: Container[] = [];
      let skippedCount = 0;

      backup.containers.forEach((c) => {
        const norm = normalizeContainerCode(c.code);
        const exists = existingCodes.has(norm);

        if (exists && strategy === 'SKIP_EXISTING') {
          skippedCount++;
        } else {
          containersToRestore.push(c);
        }
      });

      const allowedContainerIds = new Set(containersToRestore.map((c) => c.id));

      containersToRestore.forEach((c) => cStore.put(c));

      // Put references belonging to restored containers
      backup.references.forEach((r) => {
        if (allowedContainerIds.has(r.containerId)) {
          rStore.put(r);
        }
      });

      // Put movements
      if (backup.movements) {
        backup.movements.forEach((m) => {
          if (allowedContainerIds.has(m.containerId)) {
            mStore.put(m);
          }
        });
      }

      // Put unidentified
      if (backup.unidentified) {
        backup.unidentified.forEach((u) => {
          if (allowedContainerIds.has(u.containerId)) {
            uStore.put(u);
          }
        });
      }

      tx.oncomplete = () => {
        resolve({ restoredCount: containersToRestore.length, skippedCount });
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbService = new IndexedDBStorage();

// Helper functions
export function normalizeReference(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    // Unify all Unicode hyphens/dashes to standard hyphen '-'
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    // Clean multiple consecutive internal whitespace into single space
    .replace(/\s+/g, ' ');
}

export function normalizeContainerCode(code: string): string {
  if (!code) return '';
  return String(code).trim().toUpperCase().replace(/\s+/g, '-');
}

export function calculateReferenceStatus(
  expected: number,
  registered: number
): ReferenceStatus {
  if (registered === 0) return 'PENDIENTE';
  if (registered < expected) return 'PARCIAL';
  if (registered === expected) return 'COMPLETO';
  return 'SOBRANTE';
}

export function computeContainerStats(
  references: ReferenceItem[],
  unidentified: UnidentifiedItem[]
): ContainerStats {
  let completeReferences = 0;
  let partialReferences = 0;
  let pendingReferences = 0;
  let overageReferences = 0;

  let expectedPackages = 0;
  let registeredPackages = 0;
  let missingPackages = 0;
  let surplusPackages = 0;

  for (const ref of references) {
    expectedPackages += ref.expectedPackages;
    registeredPackages += ref.registeredPackages;

    if (ref.registeredPackages === 0) {
      pendingReferences++;
      missingPackages += ref.expectedPackages;
    } else if (ref.registeredPackages < ref.expectedPackages) {
      partialReferences++;
      missingPackages += ref.expectedPackages - ref.registeredPackages;
    } else if (ref.registeredPackages === ref.expectedPackages) {
      completeReferences++;
    } else {
      overageReferences++;
      surplusPackages += ref.registeredPackages - ref.expectedPackages;
    }
  }

  // Count unidentified registered packages into surplus
  for (const un of unidentified) {
    surplusPackages += un.registeredPackages;
  }

  const progressPercentage =
    expectedPackages > 0
      ? Math.min(100, Math.round((registeredPackages / expectedPackages) * 100))
      : 0;

  return {
    totalReferences: references.length,
    completeReferences,
    partialReferences,
    pendingReferences,
    overageReferences,
    expectedPackages,
    registeredPackages,
    missingPackages,
    surplusPackages,
    unidentifiedCount: unidentified.length,
    progressPercentage,
  };
}
