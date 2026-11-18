import { File, Directory, Paths } from "expo-file-system";
import { api, uploadPlantPhoto } from "./api";
import { session } from "./session";

export type PendingPlant = {
  id: string;
  user_id: number;
  saved_at: string;
  body: Record<string, unknown>;
  photo: string | null;
  plant_id?: number;
  error?: string;
};

export type SyncResult = { synced: number; failed: number; remaining: number; offline: boolean };

const QUEUE_FILE = "offline-plants.json";
const PHOTO_DIR = "offline-photos";

function queueFile() {
  return new File(Paths.document, QUEUE_FILE);
}

function readAll(): PendingPlant[] {
  try {
    const file = queueFile();
    if (!file.exists) return [];
    const data = JSON.parse(file.textSync());
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAll(list: PendingPlant[]) {
  const file = queueFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify(list));
}

function deletePhoto(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}

export function isOfflineError(e: any) {
  return e?.status === 0;
}

export function pendingPlants(): PendingPlant[] {
  const userId = session.user?.user_id;
  return userId ? readAll().filter((p) => p.user_id === userId) : [];
}

export function savePlantOffline(body: Record<string, unknown>, photoUri: string | null) {
  const userId = session.user?.user_id;
  if (!userId) throw new Error("Please log in again.");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let photo: string | null = null;
  if (photoUri) {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    if (!dir.exists) dir.create({ intermediates: true });
    const ext = (photoUri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
    const copy = new File(dir, `${id}.${ext}`);
    new File(photoUri).copySync(copy);
    photo = copy.uri;
  }

  const list = readAll();
  list.push({ id, user_id: userId, saved_at: new Date().toISOString(), body, photo });
  writeAll(list);
}

export function discardPending(id: string) {
  const list = readAll();
  const item = list.find((p) => p.id === id);
  deletePhoto(item?.photo ?? null);
  writeAll(list.filter((p) => p.id !== id));
}

let running: Promise<SyncResult> | null = null;

export function syncPending(): Promise<SyncResult> {
  if (!running) running = runSync().finally(() => { running = null; });
  return running;
}

async function runSync(): Promise<SyncResult> {
  const userId = session.user?.user_id;
  const result: SyncResult = { synced: 0, failed: 0, remaining: 0, offline: false };
  if (!userId || !session.token) return result;

  for (const item of readAll().filter((p) => p.user_id === userId)) {
    let plantId = item.plant_id;
    try {
      if (!plantId) {
        const created = await api<{ plant_id: number }>("/api/plants", { method: "POST", body: item.body });
        plantId = created.plant_id;
        writeAll(readAll().map((p) => (p.id === item.id ? { ...p, plant_id: plantId, error: undefined } : p)));
      }
      if (item.photo) {
        try {
          await uploadPlantPhoto(plantId, item.photo);
        } catch (e: any) {
          if (isOfflineError(e) || e?.status === 401) throw e;
        }
      }
      deletePhoto(item.photo);
      writeAll(readAll().filter((p) => p.id !== item.id));
      result.synced++;
    } catch (e: any) {
      if (isOfflineError(e) || e?.status === 401) {
        result.offline = isOfflineError(e);
        break;
      }
      writeAll(readAll().map((p) => (p.id === item.id ? { ...p, error: e.message } : p)));
      result.failed++;
    }
  }

  result.remaining = pendingPlants().length;
  return result;
}
