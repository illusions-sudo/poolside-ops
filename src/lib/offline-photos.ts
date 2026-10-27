// Offline photo outbox. Photos taken without a signal are kept on the device
// (IndexedDB, because localStorage can't hold image data) and uploaded in order
// once the connection returns. Pairs with offline-queue.ts, which handles the
// text-based visit work.
import { supabase } from "@/integrations/supabase/client";
import { isNetworkError, newId } from "@/lib/offline-queue";

export type QueuedPhoto = {
  id: string;
  organizationId: string;
  serviceId: string;
  customerId: string;
  propertyId: string;
  poolId: string | null;
  fileName: string;
  contentType: string;
  blob: Blob;
  createdAt: string;
};

export type PhotoServiceRef = {
  id: string;
  organization_id: string;
  customer_id: string;
  property_id: string;
  pool_id: string | null;
};

const DB_NAME = "poolside-offline-photos";
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}

export function subscribePhotoQueue(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Storage path for a photo: org / visit / unique file name. */
export function buildPhotoPath(orgId: string, serviceId: string, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "jpg";
  return `${orgId}/${serviceId}/${newId()}.${ext}`;
}

/** Save a photo on the device for later upload. */
export async function queuePhoto(service: PhotoServiceRef, file: File): Promise<QueuedPhoto> {
  const photo: QueuedPhoto = {
    id: newId(),
    organizationId: service.organization_id,
    serviceId: service.id,
    customerId: service.customer_id,
    propertyId: service.property_id,
    poolId: service.pool_id,
    fileName: file.name || "photo.jpg",
    contentType: file.type || "image/jpeg",
    blob: file,
    createdAt: new Date().toISOString(),
  };
  await withStore("readwrite", (s) => s.put(photo));
  notify();
  return photo;
}

export async function listQueuedPhotos(serviceId?: string): Promise<QueuedPhoto[]> {
  const all = await withStore<QueuedPhoto[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedPhoto[]>);
  const filtered = serviceId ? all.filter((p) => p.serviceId === serviceId) : all;
  return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countQueuedPhotos(): Promise<number> {
  return withStore<number>("readonly", (s) => s.count());
}

export async function removeQueuedPhoto(id: string): Promise<void> {
  await withStore("readwrite", (s) => s.delete(id));
  notify();
}

async function uploadOne(photo: QueuedPhoto): Promise<void> {
  const path = buildPhotoPath(photo.organizationId, photo.serviceId, photo.fileName);
  const up = await supabase.storage.from("service-photos").upload(path, photo.blob, {
    contentType: photo.contentType,
  });
  if (up.error) throw up.error;
  const { error } = await supabase.from("service_photos").insert({
    organization_id: photo.organizationId,
    service_record_id: photo.serviceId,
    customer_id: photo.customerId,
    property_id: photo.propertyId,
    pool_id: photo.poolId,
    storage_path: path,
  });
  if (error) throw error;
}

let flushing: Promise<number> | null = null;

/** Upload saved photos in order. Resolves with how many were uploaded. */
export function flushPhotos(): Promise<number> {
  if (typeof indexedDB === "undefined") return Promise.resolve(0);
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      const queued = await listQueuedPhotos();
      for (const photo of queued) {
        try {
          await uploadOne(photo);
          await removeQueuedPhoto(photo.id);
          sent++;
        } catch (e) {
          if (isNetworkError(e)) break; // still no signal; try again later
          // A real server error (e.g. visit deleted): drop it rather than block the rest.
          await removeQueuedPhoto(photo.id);
        }
      }
    } finally {
      flushing = null;
    }
    return sent;
  })();
  return flushing;
}
