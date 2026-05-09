import fs from 'node:fs/promises';
import path from 'node:path';
import Database from 'better-sqlite3';
import { createDefaultAdminUser, normalizeDb } from './seed.js';
const runtimeRoot = process.cwd();
const dataDir = path.resolve(runtimeRoot, 'data');
const uploadsDir = path.resolve(runtimeRoot, 'uploads');
const legacyJsonPath = path.join(dataDir, 'db.json');
const sqliteFileName = process.env.DB_FILE ?? 'app.sqlite';
const sqlitePath = path.join(dataDir, sqliteFileName);
let sqlite = null;
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
const createSchema = (db) => {
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
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      folderId TEXT NOT NULL,
      title TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY(folderId) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_works_folderId ON works(folderId);
  `);
};
const readDbSync = (db) => ({
    users: db.prepare('SELECT id, login, password, name FROM users').all(),
    sessions: db.prepare('SELECT token, userId, createdAt FROM sessions').all(),
    folders: db.prepare('SELECT id, title, slug, coverImageUrl, createdAt, updatedAt FROM folders').all(),
    works: db.prepare('SELECT id, folderId, title, imageUrl, createdAt, updatedAt FROM works').all()
});
const replaceDbSync = (db, data) => {
    const apply = db.transaction((payload) => {
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
        const insertFolder = db.prepare('INSERT INTO folders (id, title, slug, coverImageUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
        for (const folder of payload.folders) {
            insertFolder.run(folder.id, folder.title, folder.slug, folder.coverImageUrl, folder.createdAt, folder.updatedAt);
        }
        const insertWork = db.prepare('INSERT INTO works (id, folderId, title, imageUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
        for (const work of payload.works) {
            insertWork.run(work.id, work.folderId, work.title, work.imageUrl, work.createdAt, work.updatedAt);
        }
    });
    apply(data);
};
const maybeImportLegacyJson = async (db) => {
    const counters = db
        .prepare('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM folders) AS folders, (SELECT COUNT(*) FROM works) AS works')
        .get();
    if (counters.users > 0 || counters.folders > 0 || counters.works > 0) {
        return;
    }
    try {
        const legacy = await fs.readFile(legacyJsonPath, 'utf8');
        const parsed = JSON.parse(legacy);
        const normalized = normalizeDb(parsed);
        replaceDbSync(db, normalized);
    }
    catch {
        const seeded = {
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
export const readDb = async () => {
    await ensureStorage();
    return readDbSync(getSqlite());
};
export const updateDb = async (updater) => {
    const operation = writeQueue.then(async () => {
        const db = await readDb();
        const result = await updater(db);
        replaceDbSync(getSqlite(), normalizeDb(db));
        return result;
    });
    writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
};
