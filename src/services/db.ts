import {
  Container,
  ReferenceItem,
  Movement,
  UnidentifiedItem,
  BackupData,
  ReferenceStatus,
  ContainerStatus,
  ContainerStats,
  PlannedContainerSpec,
  ContainerConflictDetail,
  ContainerPrepareResult,
  PlannedPreparationSummary,
} from '../types';

const DB_NAME = 'ControlDescargaContenedoresDB';
const DB_VERSION = 1;

class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private prepareMutex: Promise<any> = Promise.resolve();

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

  // Exact normalized lookup for Contenedor 3 aliases (no prefix/substring confusion)
  async findContainer3(): Promise<Container | null> {
    const db = await this.getDB();
    const aliases = [
      'CONTENEDOR 3',
      'CONTENEDOR-3',
      'UDC260925-1',
      'UDC2609251',
      'FFAU6562414',
    ];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('containers', 'readonly');
      const store = tx.objectStore('containers');
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result as Container[]) || [];
        const match = list.find((c) =>
          matchesContainerAliases(c, aliases, 'container3_UDC260925-1')
        );
        resolve(match || null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Idempotent atomic creation of Contenedor 3 in a single readwrite transaction
  async createContainer3Atomic(
    container: Container,
    referenceItems: ReferenceItem[]
  ): Promise<{ container: Container; isExisting: boolean }> {
    const db = await this.getDB();
    const aliases = container.lookupAliases || [
      'CONTENEDOR 3',
      'CONTENEDOR-3',
      'UDC260925-1',
      'UDC2609251',
      'FFAU6562414',
    ];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['containers', 'references'], 'readwrite');
      const cStore = tx.objectStore('containers');
      const rStore = tx.objectStore('references');

      const getAllReq = cStore.getAll();
      getAllReq.onsuccess = () => {
        const list = (getAllReq.result as Container[]) || [];
        const existing = list.find((c) =>
          matchesContainerAliases(c, aliases, container.id)
        );

        if (existing) {
          resolve({ container: existing, isExisting: true });
          return;
        }

        cStore.put(container);
        referenceItems.forEach((r) => rStore.put(r));

        tx.oncomplete = () => {
          resolve({ container, isExisting: false });
        };
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Idempotently and atomically prepares planned unloading containers (e.g. Containers 3, 4, 5).
   * - Never deletes, clears, resets, merges, or overwrites existing containers or counts.
   * - Reuses existing unique matching records and checks manifest parity, reporting conflicts per container/reference.
   * - Creates only missing containers with SIN_INICIAR, startedAt/completedAt null, registeredPackages=0, PENDIENTE, 0 movements.
   * - Serialized via mutex + single readwrite IndexedDB transaction to guarantee safety against double-clicks or reloads.
   */
  async preparePlannedContainers(
    specs: PlannedContainerSpec[]
  ): Promise<PlannedPreparationSummary> {
    const run = async (): Promise<PlannedPreparationSummary> => {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['containers', 'references', 'movements'], 'readwrite');
        const cStore = tx.objectStore('containers');
        const rStore = tx.objectStore('references');
        const mStore = tx.objectStore('movements');

        let allContainers: Container[] | null = null;
        let allRefs: ReferenceItem[] | null = null;
        let allMovements: Movement[] | null = null;
        let summaryResult: PlannedPreparationSummary | null = null;

        const cReq = cStore.getAll();
        const rReq = rStore.getAll();
        const mReq = mStore.getAll();

        const tryProcess = () => {
          if (allContainers === null || allRefs === null || allMovements === null) {
            return;
          }

          const now = new Date().toISOString();
          const results: ContainerPrepareResult[] = [];
          let totalCreated = 0;
          let totalExistingMatch = 0;
          let totalWithConflicts = 0;

          for (const spec of specs) {
            const matchingContainers = allContainers.filter((c) =>
              matchesContainerAliases(c, spec.lookupAliases, spec.id)
            );

            if (matchingContainers.length > 1) {
              // Conflict: Multiple equivalent containers already exist. Do NOT merge or delete!
              totalWithConflicts++;
              results.push({
                specId: spec.id,
                code: spec.code,
                documentCode: spec.documentCode,
                physicalContainerCode: spec.physicalContainerCode,
                outcome: 'CONFLICT',
                expectedReferences: spec.totals.references,
                expectedPackages: spec.totals.expectedPackages,
                expectedUnits: spec.totals.expectedUnits,
                preservedManualReferencesCount: 0,
                conflicts: [
                  {
                    type: 'DUPLICATE_CONTAINERS',
                    message: `Existen ${matchingContainers.length} registros equivalentes para ${spec.code} (${spec.documentCode}). No se fusionan ni eliminan automáticamente.`,
                    existingContainerIds: matchingContainers.map(
                      (mc) => `${mc.code} [${mc.id}] (${mc.status})`
                    ),
                  },
                ],
              });
              continue;
            }

            if (matchingContainers.length === 1) {
              // Unique existing container: reuse its current ID, NEVER reset counts or alter history!
              const existing = matchingContainers[0];
              const existingRefs = allRefs.filter((r) => r.containerId === existing.id);
              const existingMovs = allMovements.filter((m) => m.containerId === existing.id);

              const evaluation = evaluateExistingContainerAgainstManifest(
                existingRefs,
                existingMovs,
                spec
              );

              if (evaluation.conflicts.length > 0) {
                totalWithConflicts++;
                results.push({
                  specId: spec.id,
                  code: spec.code,
                  documentCode: spec.documentCode,
                  physicalContainerCode: spec.physicalContainerCode,
                  outcome: 'CONFLICT',
                  existingContainerId: existing.id,
                  container: existing,
                  expectedReferences: spec.totals.references,
                  expectedPackages: spec.totals.expectedPackages,
                  expectedUnits: spec.totals.expectedUnits,
                  preservedManualReferencesCount: evaluation.preservedManualReferencesCount,
                  conflicts: evaluation.conflicts,
                });
              } else {
                totalExistingMatch++;
                results.push({
                  specId: spec.id,
                  code: spec.code,
                  documentCode: spec.documentCode,
                  physicalContainerCode: spec.physicalContainerCode,
                  outcome: 'EXISTING_MATCH',
                  existingContainerId: existing.id,
                  container: existing,
                  expectedReferences: spec.totals.references,
                  expectedPackages: spec.totals.expectedPackages,
                  expectedUnits: spec.totals.expectedUnits,
                  preservedManualReferencesCount: evaluation.preservedManualReferencesCount,
                  conflicts: [],
                });
              }
              continue;
            }

            // 0 matching containers -> Create new container atomically with initial SIN_INICIAR and 0 counts
            const { container: newContainer, references: newRefs } =
              buildPlannedContainerRecords(spec, now);

            cStore.put(newContainer);
            newRefs.forEach((r) => rStore.put(r));

            // Keep snapshot updated in memory in case subsequent specs inspect allContainers
            allContainers.push(newContainer);
            totalCreated++;

            results.push({
              specId: spec.id,
              code: spec.code,
              documentCode: spec.documentCode,
              physicalContainerCode: spec.physicalContainerCode,
              outcome: 'CREATED',
              existingContainerId: newContainer.id,
              container: newContainer,
              expectedReferences: spec.totals.references,
              expectedPackages: spec.totals.expectedPackages,
              expectedUnits: spec.totals.expectedUnits,
              preservedManualReferencesCount: 0,
              conflicts: [],
            });
          }

          summaryResult = {
            preparedAt: now,
            results,
            hasConflicts: totalWithConflicts > 0,
            totalCreated,
            totalExistingMatch,
            totalWithConflicts,
          };
        };

        cReq.onsuccess = () => {
          allContainers = (cReq.result as Container[]) || [];
          tryProcess();
        };
        rReq.onsuccess = () => {
          allRefs = (rReq.result as ReferenceItem[]) || [];
          tryProcess();
        };
        mReq.onsuccess = () => {
          allMovements = (mReq.result as Movement[]) || [];
          tryProcess();
        };

        tx.oncomplete = () => {
          if (summaryResult) {
            resolve(summaryResult);
          } else {
            reject(new Error('No se pudo completar la lectura atómica de contenedores.'));
          }
        };
        tx.onerror = () => reject(tx.error);
      });
    };

    const next = this.prepareMutex.then(run, run);
    this.prepareMutex = next.catch(() => {});
    return next;
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

  // Add a newly arrived reference that was not in the manifest with its packages
  async addNewReferenceToContainer(
    containerId: string,
    rawReference: string,
    expectedPackages: number,
    initialRegisteredPackages: number = 0,
    notes?: string
  ): Promise<{ referenceItem: ReferenceItem; movement?: Movement }> {
    const reference = normalizeReference(rawReference);
    if (!reference) {
      throw new Error('El código de referencia no puede estar vacío.');
    }
    if (expectedPackages < 0 || initialRegisteredPackages < 0) {
      throw new Error('La cantidad de bultos no puede ser negativa.');
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['references', 'movements', 'containers'], 'readwrite');
      const refStore = tx.objectStore('references');
      const movStore = tx.objectStore('movements');
      const containerStore = tx.objectStore('containers');

      const index = refStore.index('containerId');
      const req = index.getAll(IDBKeyRange.only(containerId));

      req.onsuccess = () => {
        const existingRefs: ReferenceItem[] = req.result || [];
        const existing = existingRefs.find(
          (r) => normalizeReference(r.reference) === reference
        );

        if (existing) {
          reject(
            new Error(
              `La referencia "${reference}" ya existe en este contenedor (${existing.registeredPackages}/${existing.expectedPackages} bultos).`
            )
          );
          return;
        }

        const now = new Date().toISOString();
        const refId =
          'ref_' + containerId + '_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const status = calculateReferenceStatus(expectedPackages, initialRegisteredPackages);

        const newRefItem: ReferenceItem = {
          id: refId,
          containerId,
          reference,
          expectedPackages,
          registeredPackages: initialRegisteredPackages,
          status,
          lastUpdated: now,
        };

        refStore.put(newRefItem);

        let movement: Movement | undefined;
        if (initialRegisteredPackages > 0) {
          movement = {
            id: 'mov_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            containerId,
            reference,
            isUnidentified: false,
            quantity: initialRegisteredPackages,
            previousCount: 0,
            newCount: initialRegisteredPackages,
            operationType: 'MANUAL_ADD_REF',
            timestamp: now,
            details: `Referencia agregada manualmente: ${initialRegisteredPackages} bulto(s) registrado(s) de ${expectedPackages} esperados${
              notes ? ` (${notes})` : ''
            }`,
          };
          movStore.put(movement);
        }

        // Update container status if initial packages registered
        const cReq = containerStore.get(containerId);
        cReq.onsuccess = () => {
          const container: Container = cReq.result;
          if (container) {
            if (initialRegisteredPackages > 0) {
              if (!container.startedAt) container.startedAt = now;
              if (container.status === 'SIN_INICIAR') container.status = 'EN_PROCESO';
            }
            containerStore.put(container);
          }
        };

        tx.oncomplete = () => {
          resolve({ referenceItem: newRefItem, movement });
        };
        tx.onerror = () => reject(tx.error);
      };

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

  // --- UNDO WITH LINKED COMPENSATING MOVEMENT (Prevents undo-redo loops and preserves full audit history) ---

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

    // Collect IDs of movements that have already been compensated/undone
    const undoneIds = new Set<string>();
    for (const m of movements) {
      if ((m.operationType === 'UNDO' || m.operationType === 'COMPENSATING_UNDO') && m.undoneMovementId) {
        undoneIds.add(m.undoneMovementId);
      }
    }

    // Find the latest operational movement that has NOT yet been undone
    const targetMovement = movements.find(
      (m) =>
        m.operationType !== 'UNDO' &&
        m.operationType !== 'COMPENSATING_UNDO' &&
        !undoneIds.has(m.id)
    );

    if (!targetMovement) {
      return {
        success: false,
        message: 'Todos los movimientos operativos previos ya han sido deshechos compensatoriamente.',
      };
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['references', 'unidentified', 'movements'], 'readwrite');
      const refStore = tx.objectStore('references');
      const unStore = tx.objectStore('unidentified');
      const movStore = tx.objectStore('movements');

      let compensatingMovement: Movement;

      if (targetMovement.isUnidentified) {
        // Compensate unidentified item
        const unIndex = unStore.index('containerId');
        const req = unIndex.openCursor(IDBKeyRange.only(containerId));

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const item = cursor.value as UnidentifiedItem;
            if (item.reference === targetMovement.reference) {
              const currentCount = item.registeredPackages;
              // Balance verification: subtract the delta of the target movement
              const delta = targetMovement.quantity;
              const targetCount = Math.max(0, currentCount - delta);
              const compQty = targetCount - currentCount;

              if (targetCount === 0) {
                cursor.delete();
              } else {
                item.registeredPackages = targetCount;
                cursor.update(item);
              }

              // Register compensating movement linking to the undone movement ID
              compensatingMovement = {
                id: 'mov_undo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                containerId,
                reference: targetMovement.reference,
                isUnidentified: true,
                quantity: compQty,
                previousCount: currentCount,
                newCount: targetCount,
                operationType: 'COMPENSATING_UNDO',
                timestamp: new Date().toISOString(),
                undoneMovementId: targetMovement.id,
                details: `Deshacer compensatorio: Revierte movimiento [${targetMovement.id}] de ${
                  targetMovement.quantity > 0 ? '+' : ''
                }${targetMovement.quantity} bulto(s). Conteo de ${currentCount} restablecido a ${targetCount}.`,
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
        const req = refIndex.get([containerId, targetMovement.reference]);

        req.onsuccess = () => {
          const item = req.result as ReferenceItem;
          if (item) {
            const currentCount = item.registeredPackages;
            // Balance verification: subtract delta of target movement
            const delta = targetMovement.quantity;
            const targetCount = Math.max(0, currentCount - delta);
            const compQty = targetCount - currentCount;

            item.registeredPackages = targetCount;
            item.status = calculateReferenceStatus(item.expectedPackages, targetCount);
            item.lastUpdated = new Date().toISOString();
            refStore.put(item);

            // Register compensating movement linking to the undone movement ID
            compensatingMovement = {
              id: 'mov_undo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              containerId,
              reference: item.reference,
              isUnidentified: false,
              quantity: compQty,
              previousCount: currentCount,
              newCount: targetCount,
              operationType: 'COMPENSATING_UNDO',
              timestamp: new Date().toISOString(),
              undoneMovementId: targetMovement.id,
              details: `Deshacer compensatorio: Revierte movimiento [${targetMovement.id}] de ${
                targetMovement.quantity > 0 ? '+' : ''
              }${targetMovement.quantity} bulto(s). Conteo de ${currentCount} restablecido a ${targetCount}.`,
            };
            movStore.put(compensatingMovement);
          }
        };
      }

      tx.oncomplete = () => {
        resolve({
          success: true,
          compensatingMovement,
          message: `Deshecho registrado en historial: ${targetMovement.reference} pasa de ${
            targetMovement.newCount
          } a ${Math.max(0, targetMovement.previousCount)} bultos.`,
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
  let effectiveCountedPackages = 0;

  for (const ref of references) {
    expectedPackages += ref.expectedPackages;
    registeredPackages += ref.registeredPackages;
    effectiveCountedPackages += Math.min(ref.registeredPackages, ref.expectedPackages);

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

  // Effective progress: sum(min(counted_i, expected_i)). Surplus cannot offset deficit.
  // Never show 100% while expected packages remain uncounted.
  let progressPercentage = 0;
  if (expectedPackages > 0) {
    const rawPct = (effectiveCountedPackages / expectedPackages) * 100;
    if (missingPackages > 0) {
      progressPercentage = Math.min(99, Math.floor(rawPct));
    } else {
      progressPercentage = 100;
    }
  }

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

// Strict reference matching: recognize 26423, R26423, R-26423 ONLY if full code exists in manifest.
// Do NOT guess missing digits (e.g. 2614 must NOT become R-26414). Unknowns go to "Por identificar".
export function resolveReferenceMatch(
  input: string,
  references: ReferenceItem[]
): {
  matchedItem: ReferenceItem | null;
  matchType: 'EXACT' | 'PREFIX_NORMALIZED' | 'ALIAS' | 'NONE';
  warningMessage?: string;
} {
  const raw = String(input || '').trim();
  if (!raw) return { matchedItem: null, matchType: 'NONE' };

  const norm = normalizeReference(raw);

  // 1. Direct exact match by reference code, canonicalReference, originalDocumentReference, or sourceReference
  const directMatch = references.find(
    (r) =>
      r.reference === norm ||
      (r.canonicalReference && r.canonicalReference === norm) ||
      (r.originalDocumentReference && r.originalDocumentReference === norm) ||
      (r.sourceReference && r.sourceReference === norm)
  );

  if (directMatch) {
    const isAlias =
      directMatch.reference !== norm &&
      (directMatch.canonicalReference === norm ||
        directMatch.originalDocumentReference === norm ||
        directMatch.sourceReference === norm);
    return {
      matchedItem: directMatch,
      matchType: isAlias ? 'ALIAS' : 'EXACT',
      warningMessage: directMatch.warningNote,
    };
  }

  // 2. Strict prefix normalization without guessing missing digits:
  // Rule: recognize '26423', 'R26423', 'R-26423' as 'R-26423' ONLY if full reference exists in manifest.
  // Do NOT guess missing digits (e.g. '2614' must NOT become 'R-26414').

  // Case A: User typed pure digits, e.g. "26423"
  if (/^\d+$/.test(norm)) {
    const candidateR = `R-${norm}`;
    const candidateUC = `UC${norm}`;
    const matchR = references.find(
      (r) =>
        r.reference === candidateR ||
        r.canonicalReference === candidateR ||
        r.originalDocumentReference === candidateR ||
        r.sourceReference === candidateR
    );
    if (matchR) {
      return {
        matchedItem: matchR,
        matchType: 'PREFIX_NORMALIZED',
        warningMessage: matchR.warningNote,
      };
    }
    const matchUC = references.find((r) => r.reference === candidateUC);
    if (matchUC) {
      return {
        matchedItem: matchUC,
        matchType: 'PREFIX_NORMALIZED',
        warningMessage: matchUC.warningNote,
      };
    }
  }

  // Case B: User typed "R" followed by digits, e.g. "R26423"
  if (/^R\d+$/i.test(norm)) {
    const candidateR = `R-${norm.slice(1)}`;
    const matchR = references.find(
      (r) =>
        r.reference === candidateR ||
        r.canonicalReference === candidateR ||
        r.originalDocumentReference === candidateR ||
        r.sourceReference === candidateR
    );
    if (matchR) {
      return {
        matchedItem: matchR,
        matchType: 'PREFIX_NORMALIZED',
        warningMessage: matchR.warningNote,
      };
    }
  }

  // Case C: Alphanumeric equality check (e.g. missing or extra hyphen in known code)
  const normAlpha = norm.replace(/[^A-Z0-9]/g, '');
  if (normAlpha.length >= 4) {
    const candidateMatches = references.filter((r) => {
      const refAlpha = r.reference.replace(/[^A-Z0-9]/g, '');
      const canAlpha = r.canonicalReference?.replace(/[^A-Z0-9]/g, '');
      const origAlpha = r.originalDocumentReference?.replace(/[^A-Z0-9]/g, '');
      const srcAlpha = r.sourceReference?.replace(/[^A-Z0-9]/g, '');
      return (
        refAlpha === normAlpha ||
        canAlpha === normAlpha ||
        origAlpha === normAlpha ||
        srcAlpha === normAlpha
      );
    });

    if (candidateMatches.length === 1) {
      const match = candidateMatches[0];
      return {
        matchedItem: match,
        matchType: 'PREFIX_NORMALIZED',
        warningMessage: match.warningNote,
      };
    }
  }

  // Unknown reference -> goes to "Por identificar"
  return { matchedItem: null, matchType: 'NONE' };
}

// --- LOGISTIC IDENTITY & PLANNED MANIFEST HELPERS ---

export function normalizeContainerIdentityToken(value: string): string {
  if (!value) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    .replace(/\s+/g, ' ');
}

export function compactContainerIdentityToken(value: string): string {
  return normalizeContainerIdentityToken(value).replace(/[\s\-_]/g, '');
}

/**
 * Exact full-value normalized comparison against lookupAliases.
 * Never groups by prefix (so UDC260925-1 and UDC260925-2 never collide).
 */
export function matchesContainerAliases(
  container: Container,
  lookupAliases: string[],
  specId?: string
): boolean {
  if (specId && container.id === specId) {
    return true;
  }

  const normalizedAliases = new Set<string>();
  const compactAliases = new Set<string>();

  for (const alias of lookupAliases) {
    const norm = normalizeContainerIdentityToken(alias);
    const compact = compactContainerIdentityToken(alias);
    if (norm) normalizedAliases.add(norm);
    if (compact) compactAliases.add(compact);
  }

  const candidateFields = [
    container.code,
    container.documentNumber || '',
    container.physicalContainer || '',
  ];

  for (const field of candidateFields) {
    const normField = normalizeContainerIdentityToken(field);
    const compactField = compactContainerIdentityToken(field);
    if (!normField) continue;
    if (normalizedAliases.has(normField) || compactAliases.has(compactField)) {
      return true;
    }
  }

  return false;
}

export function buildPlannedContainerRecords(
  spec: PlannedContainerSpec,
  nowIso: string = new Date().toISOString()
): { container: Container; references: ReferenceItem[] } {
  const uniqueAliases = Array.from(new Set(spec.lookupAliases));

  const container: Container = {
    id: spec.id,
    code: spec.code,
    documentNumber: spec.documentCode,
    physicalContainer: spec.physicalContainerCode,
    createdAt: nowIso,
    startedAt: null,
    completedAt: null,
    status: 'SIN_INICIAR',
    fileName: spec.sourceFile,
    sourceSha256: spec.sourceSha256,
    lookupAliases: uniqueAliases,
    notes: `Documento: ${spec.documentCode} | Contenedor físico: ${spec.physicalContainerCode} | Previsión: ${spec.totals.references} ref, ${spec.totals.expectedPackages} bultos, ${spec.totals.expectedUnits.toLocaleString('es-ES')} piezas previstas. Estado: SIN_INICIAR / PREVISTO.`,
  };

  const references: ReferenceItem[] = spec.manifest.map((row) => {
    const canonRef = normalizeReference(row.reference);
    const srcRef = normalizeReference(row.sourceReference || row.reference);
    return {
      id: `ref_${spec.id}_${canonRef}`,
      containerId: spec.id,
      reference: canonRef,
      canonicalReference: canonRef,
      originalDocumentReference: srcRef,
      sourceReference: srcRef,
      expectedPackages: row.expectedPackages,
      registeredPackages: 0,
      status: 'PENDIENTE',
      lastUpdated: nowIso,
      expectedPieces: row.expectedUnits,
      expectedUnits: row.expectedUnits,
      description: row.description,
      warningNote: row.warningNote,
    };
  });

  return { container, references };
}

export function evaluateExistingContainerAgainstManifest(
  existingRefs: ReferenceItem[],
  existingMovements: Movement[],
  spec: PlannedContainerSpec
): {
  conflicts: ContainerConflictDetail[];
  preservedManualReferencesCount: number;
} {
  const conflicts: ContainerConflictDetail[] = [];
  const matchedDbRefIds = new Set<string>();

  const manualRefCodes = new Set(
    existingMovements
      .filter((m) => m.operationType === 'MANUAL_ADD_REF')
      .map((m) => normalizeReference(m.reference))
  );

  for (const row of spec.manifest) {
    const normRef = normalizeReference(row.reference);
    const normSrc = normalizeReference(row.sourceReference || row.reference);

    const matchingDbRows = existingRefs.filter((r) => {
      const rMain = normalizeReference(r.reference);
      const rCanon = normalizeReference(r.canonicalReference || '');
      const rOrig = normalizeReference(r.originalDocumentReference || '');
      const rSrc = normalizeReference(r.sourceReference || '');
      return (
        rMain === normRef ||
        rMain === normSrc ||
        (rCanon !== '' && (rCanon === normRef || rCanon === normSrc)) ||
        (rOrig !== '' && (rOrig === normRef || rOrig === normSrc)) ||
        (rSrc !== '' && (rSrc === normRef || rSrc === normSrc))
      );
    });

    if (matchingDbRows.length > 1) {
      conflicts.push({
        type: 'DUPLICATE_REFERENCE',
        reference: row.reference,
        sourceReference: row.sourceReference,
        message: `La referencia ${row.reference} aparece duplicada (${matchingDbRows.length} filas) en el contenedor guardado.`,
        storedValue: matchingDbRows.length,
        manifestValue: 1,
      });
      matchingDbRows.forEach((m) => matchedDbRefIds.add(m.id));
      continue;
    }

    if (matchingDbRows.length === 0) {
      conflicts.push({
        type: 'MISSING_REFERENCE',
        reference: row.reference,
        sourceReference: row.sourceReference,
        message: `La referencia ${row.reference}${
          row.sourceReference !== row.reference ? ` (doc: ${row.sourceReference})` : ''
        } figura en el manifiesto (${row.expectedPackages} bultos / ${row.expectedUnits} pzas), pero no existe en el registro guardado.`,
        storedValue: 'No existe',
        manifestValue: `${row.expectedPackages} bultos / ${row.expectedUnits} pzas`,
      });
      continue;
    }

    const dbRef = matchingDbRows[0];
    matchedDbRefIds.add(dbRef.id);

    if (dbRef.expectedPackages !== row.expectedPackages) {
      conflicts.push({
        type: 'EXPECTED_PACKAGES_MISMATCH',
        reference: row.reference,
        sourceReference: row.sourceReference,
        message: `Diferencia de bultos esperados en ${row.reference}: guardado ${dbRef.expectedPackages}, manifiesto ${row.expectedPackages}.`,
        storedValue: dbRef.expectedPackages,
        manifestValue: row.expectedPackages,
        registeredPackages: dbRef.registeredPackages,
      });
    }

    const storedUnits = dbRef.expectedUnits ?? dbRef.expectedPieces;
    if (storedUnits !== undefined && storedUnits !== row.expectedUnits) {
      conflicts.push({
        type: 'EXPECTED_UNITS_MISMATCH',
        reference: row.reference,
        sourceReference: row.sourceReference,
        message: `Diferencia de piezas previstas en ${row.reference}: guardado ${storedUnits}, manifiesto ${row.expectedUnits}.`,
        storedValue: storedUnits,
        manifestValue: row.expectedUnits,
        registeredPackages: dbRef.registeredPackages,
      });
    }
  }

  let preservedManualReferencesCount = 0;
  for (const dbRef of existingRefs) {
    if (matchedDbRefIds.has(dbRef.id)) continue;
    const normDbRef = normalizeReference(dbRef.reference);
    if (manualRefCodes.has(normDbRef)) {
      preservedManualReferencesCount++;
    } else {
      conflicts.push({
        type: 'UNEXPECTED_REFERENCE',
        reference: dbRef.reference,
        sourceReference: dbRef.sourceReference || dbRef.originalDocumentReference,
        message: `La referencia guardada ${dbRef.reference} (${dbRef.expectedPackages} bultos esp., ${dbRef.registeredPackages} reg.) no forma parte del manifiesto previsto oficial.`,
        storedValue: `${dbRef.expectedPackages} bultos`,
        manifestValue: 'No prevista',
        registeredPackages: dbRef.registeredPackages,
      });
    }
  }

  return { conflicts, preservedManualReferencesCount };
}
