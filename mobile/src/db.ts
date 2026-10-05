import * as SQLite from "expo-sqlite";

const db = SQLite.openDatabaseSync("groundtruth.db");

db.execSync(`
  CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    scientificName TEXT NOT NULL,
    commonName TEXT,
    family TEXT,
    height TEXT,
    notes TEXT,
    photo TEXT,
    lat REAL,
    lng REAL,
    createdAt TEXT,
    synced INTEGER DEFAULT 0
  );
`);

export type Plant = {
  id: string; scientificName: string; commonName: string; family: string;
  height: string; notes: string; photo: string; lat: number; lng: number;
  createdAt: string; synced: number;
};

export function savePlant(p: Omit<Plant, "createdAt" | "synced">) {
  db.runSync(
    `INSERT INTO plants (id, scientificName, commonName, family, height, notes, photo, lat, lng, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.scientificName, p.commonName, p.family, p.height, p.notes, p.photo, p.lat, p.lng, new Date().toISOString()]
  );
}

export function getPlants(): Plant[] {
  return db.getAllSync<Plant>("SELECT * FROM plants ORDER BY createdAt DESC");
}

export function getPlant(id: string): Plant | null {
  return db.getFirstSync<Plant>("SELECT * FROM plants WHERE id = ?", [id]);
}