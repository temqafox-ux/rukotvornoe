import type { AdminUser, DatabaseRecord, FolderRecord, SessionRecord, WorkRecord } from './types.js';
import { hashSync } from 'bcryptjs';
import { createId, nowIso } from './utils.js';

const adminLogin = process.env.ADMIN_LOGIN ?? 'admin';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
const adminName = process.env.ADMIN_NAME ?? 'Администратор';
const passwordSaltRounds = Math.max(8, Math.min(Number(process.env.PASSWORD_SALT_ROUNDS ?? 10), 14));

const asString = (value: unknown, fallback = '') => (typeof value === 'string' && value.trim() ? value : fallback);
const asNumber = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const asDetails = (value: unknown): Array<{ key: string; value: string }> => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      const key = asString(candidate.key).trim();
      const detailValue = asString(candidate.value).trim();
      if (!key || !detailValue) return null;
      return { key, value: detailValue };
    })
    .filter((item): item is { key: string; value: string } => Boolean(item));
};

const toAdminUser = (value: unknown): AdminUser | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const id = asString(item.id, createId('admin'));
  const login = asString(item.login, adminLogin);
  const rawPassword = asString(item.password, adminPassword);
  const name = asString(item.name, adminName);
  const password = rawPassword.startsWith('$2') ? rawPassword : hashSync(rawPassword, passwordSaltRounds);

  return { id, login, password, name };
};

const toSessionRecord = (value: unknown): SessionRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const token = asString(item.token);
  const userId = asString(item.userId);
  if (!token || !userId) return null;

  return {
    token,
    userId,
    createdAt: asString(item.createdAt, nowIso())
  };
};

const toFolderRecord = (value: unknown): FolderRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const id = asString(item.id);
  const title = asString(item.title);
  const slug = asString(item.slug);
  const coverImageUrl = asString(item.coverImageUrl, '/images/photo1.jpg');

  if (!id || !title || !slug) return null;

  return {
    id,
    title,
    slug,
    coverImageUrl,
    sortOrder: Math.max(0, asNumber(item.sortOrder, 0)),
    createdAt: asString(item.createdAt, nowIso()),
    updatedAt: asString(item.updatedAt, nowIso())
  };
};

const toWorkRecord = (value: unknown): WorkRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;

  const id = asString(item.id);
  const folderId = asString(item.folderId);
  const title = asString(item.title);
  const imageUrl = asString(item.imageUrl);

  if (!id || !folderId || !title || !imageUrl) return null;

  return {
    id,
    folderId,
    title,
    imageUrl,
    details: asDetails(item.details),
    sortOrder: Math.max(0, asNumber(item.sortOrder, 0)),
    createdAt: asString(item.createdAt, nowIso()),
    updatedAt: asString(item.updatedAt, nowIso())
  };
};

export const createDefaultAdminUser = (): AdminUser => ({
  id: createId('admin'),
  login: adminLogin,
  password: hashSync(adminPassword, passwordSaltRounds),
  name: adminName
});

export const createSeedDb = (): DatabaseRecord => {
  return {
    users: [createDefaultAdminUser()],
    sessions: [],
    folders: [],
    works: []
  };
};

export const normalizeDb = (db: unknown): DatabaseRecord => {
  const value = db && typeof db === 'object' ? (db as Record<string, unknown>) : {};

  const users = (Array.isArray(value.users) ? value.users : []).map(toAdminUser).filter((item): item is AdminUser => Boolean(item));
  const userIds = new Set(users.map((item) => item.id));
  const folders = (Array.isArray(value.folders) ? value.folders : []).map(toFolderRecord).filter((item): item is FolderRecord => Boolean(item));
  const folderIds = new Set(folders.map((item) => item.id));

  const sessions = (Array.isArray(value.sessions) ? value.sessions : [])
    .map(toSessionRecord)
    .filter((item): item is SessionRecord => Boolean(item))
    .filter((item) => userIds.has(item.userId));

  const works = (Array.isArray(value.works) ? value.works : [])
    .map(toWorkRecord)
    .filter((item): item is WorkRecord => Boolean(item))
    .filter((item) => folderIds.has(item.folderId));

  const normalizedFolders = folders.map((folder, index) => ({
    ...folder,
    sortOrder: folder.sortOrder > 0 ? folder.sortOrder : index + 1
  }));

  const workOrderByFolder = new Map<string, number>();
  const normalizedWorks = works.map((work) => {
    const fallbackOrder = (workOrderByFolder.get(work.folderId) ?? 0) + 1;
    workOrderByFolder.set(work.folderId, fallbackOrder);
    return {
      ...work,
      sortOrder: work.sortOrder > 0 ? work.sortOrder : fallbackOrder
    };
  });

  return {
    users: users.length > 0 ? users : [createDefaultAdminUser()],
    sessions,
    folders: normalizedFolders,
    works: normalizedWorks
  };
};
