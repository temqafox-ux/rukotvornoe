import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { DatabaseRecord } from './types.js';
import { createDefaultAdminUser, normalizeDb } from './seed.js';

const runtimeRoot = process.cwd();
const dataDir = path.resolve(runtimeRoot, 'data');
const uploadsDir = path.resolve(runtimeRoot, 'uploads');
const legacyJsonPath = path.join(dataDir, 'db.json');
const sqliteFileName = process.env.DB_FILE ?? 'app.sqlite';
const sqlitePath = path.join(dataDir, sqliteFileName);

let sqlite: Database.Database | null = null;

let writeQueue = Promise.resolve();

const getSqlite = () => {
  if (!sqlite) {
    sqlite = new Database(sqlitePath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
  }
  return sqlite;
};

export const getUploadsDir = () => uploadsDir;

const createSchema = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      coverImageUrl TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      folderId TEXT NOT NULL,
      title TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '[]',
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(folderId) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_works_folderId ON works(folderId);
  `);

  const ensureColumn = (table: string, column: string, definition: string) => {
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!tableInfo.some((item) => item.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  ensureColumn('folders', 'sortOrder', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('works', 'sortOrder', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('works', 'details', "TEXT NOT NULL DEFAULT '[]'");

  const foldersWithoutOrder = db
    .prepare('SELECT id FROM folders WHERE sortOrder = 0 ORDER BY createdAt ASC')
    .all() as Array<{ id: string }>;
  if (foldersWithoutOrder.length > 0) {
    const updateFolderOrder = db.prepare('UPDATE folders SET sortOrder = ? WHERE id = ?');
    foldersWithoutOrder.forEach((folder, index) => {
      updateFolderOrder.run(index + 1, folder.id);
    });
  }

  const worksWithoutOrder = db
    .prepare('SELECT id, folderId FROM works WHERE sortOrder = 0 ORDER BY folderId ASC, createdAt ASC')
    .all() as Array<{ id: string; folderId: string }>;
  if (worksWithoutOrder.length > 0) {
    const updateWorkOrder = db.prepare('UPDATE works SET sortOrder = ? WHERE id = ?');
    const sequenceMap = new Map<string, number>();
    for (const work of worksWithoutOrder) {
      const nextOrder = (sequenceMap.get(work.folderId) ?? 0) + 1;
      sequenceMap.set(work.folderId, nextOrder);
      updateWorkOrder.run(nextOrder, work.id);
    }
  }
};

const readDbSync = (db: Database.Database): DatabaseRecord => ({
  users: db.prepare('SELECT id, login, password, name FROM users').all() as DatabaseRecord['users'],
  sessions: db.prepare('SELECT token, userId, createdAt FROM sessions').all() as DatabaseRecord['sessions'],
  folders: db.prepare('SELECT id, title, slug, coverImageUrl, sortOrder, createdAt, updatedAt FROM folders').all() as DatabaseRecord['folders'],
  works: (
    db.prepare('SELECT id, folderId, title, imageUrl, details, sortOrder, createdAt, updatedAt FROM works').all() as Array<
      Omit<DatabaseRecord['works'][number], 'details'> & { details?: string }
    >
  ).map((work) => {
    const parsedDetails = (() => {
      if (typeof work.details !== 'string' || !work.details.trim()) return [];
      try {
        const value = JSON.parse(work.details) as unknown;
        if (!Array.isArray(value)) return [];
        return value
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const candidate = item as Record<string, unknown>;
            const key = typeof candidate.key === 'string' ? candidate.key.trim() : '';
            const detailValue = typeof candidate.value === 'string' ? candidate.value.trim() : '';
            if (!key || !detailValue) return null;
            return { key, value: detailValue };
          })
          .filter((item): item is { key: string; value: string } => Boolean(item));
      } catch {
        return [];
      }
    })();

    return {
      ...work,
      details: parsedDetails
    };
  })
});

const replaceDbSync = (db: Database.Database, data: DatabaseRecord) => {
  const apply = db.transaction((payload: DatabaseRecord) => {
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM works').run();
    db.prepare('DELETE FROM folders').run();
    db.prepare('DELETE FROM users').run();

    const insertUser = db.prepare('INSERT INTO users (id, login, password, name) VALUES (?, ?, ?, ?)');
    for (const user of payload.users) {
      insertUser.run(user.id, user.login, user.password, user.name);
    }

    const insertSession = db.prepare('INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)');
    for (const session of payload.sessions) {
      insertSession.run(session.token, session.userId, session.createdAt);
    }

    const insertFolder = db.prepare(
      'INSERT INTO folders (id, title, slug, coverImageUrl, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const folder of payload.folders) {
      insertFolder.run(folder.id, folder.title, folder.slug, folder.coverImageUrl, folder.sortOrder, folder.createdAt, folder.updatedAt);
    }

    const insertWork = db.prepare(
      'INSERT INTO works (id, folderId, title, imageUrl, details, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const work of payload.works) {
      insertWork.run(
        work.id,
        work.folderId,
        work.title,
        work.imageUrl,
        JSON.stringify(work.details),
        work.sortOrder,
        work.createdAt,
        work.updatedAt
      );
    }
  });

  apply(data);
};

const maybeImportLegacyJson = async (db: Database.Database) => {
  const counters = db
    .prepare('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM folders) AS folders, (SELECT COUNT(*) FROM works) AS works')
    .get() as { users: number; folders: number; works: number };

  if (counters.users > 0 || counters.folders > 0 || counters.works > 0) {
    return;
  }

  try {
    const legacy = await fs.readFile(legacyJsonPath, 'utf8');
    const parsed = JSON.parse(legacy);
    const normalized = normalizeDb(parsed);
    replaceDbSync(db, normalized);
  } catch {
    const seeded: DatabaseRecord = {
      users: [createDefaultAdminUser()],
      sessions: [],
      folders: [],
      works: []
    };
    replaceDbSync(db, seeded);
  }
};

export const ensureStorage = async () => {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  const db = getSqlite();
  createSchema(db);
  await maybeImportLegacyJson(db);
};

export const readDb = async (): Promise<DatabaseRecord> => {
  await ensureStorage();
  return readDbSync(getSqlite());
};

export const updateDb = async <T>(updater: (db: DatabaseRecord) => Promise<T> | T): Promise<T> => {
  const operation = writeQueue.then(async () => {
    const db = await readDb();
    const result = await updater(db);
    replaceDbSync(getSqlite(), normalizeDb(db));
    return result;
  });

  writeQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
};
