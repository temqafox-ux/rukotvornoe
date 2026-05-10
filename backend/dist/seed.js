import { hashSync } from 'bcryptjs';
import { createId, nowIso } from './utils.js';
const adminLogin = process.env.ADMIN_LOGIN ?? 'admin';
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
const adminName = process.env.ADMIN_NAME ?? 'Администратор';
const passwordSaltRounds = Math.max(8, Math.min(Number(process.env.PASSWORD_SALT_ROUNDS ?? 10), 14));
const asString = (value, fallback = '') => (typeof value === 'string' && value.trim() ? value : fallback);
const asNumber = (value, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const asDetails = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => {
        if (typeof item === 'string') {
            const text = item.trim();
            return text || null;
        }
        if (!item || typeof item !== 'object')
            return null;
        const candidate = item;
        const key = asString(candidate.key).trim();
        const detailValue = asString(candidate.value).trim();
        if (!key || !detailValue)
            return null;
        return `${key}: ${detailValue}`;
    })
        .filter((item) => Boolean(item));
};
const toAdminUser = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const item = value;
    const id = asString(item.id, createId('admin'));
    const login = asString(item.login, adminLogin);
    const rawPassword = asString(item.password, adminPassword);
    const name = asString(item.name, adminName);
    const password = rawPassword.startsWith('$2') ? rawPassword : hashSync(rawPassword, passwordSaltRounds);
    return { id, login, password, name };
};
const toSessionRecord = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const item = value;
    const token = asString(item.token);
    const userId = asString(item.userId);
    if (!token || !userId)
        return null;
    return {
        token,
        userId,
        createdAt: asString(item.createdAt, nowIso())
    };
};
const toFolderRecord = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const item = value;
    const id = asString(item.id);
    const title = asString(item.title);
    const slug = asString(item.slug);
    const coverImageUrl = asString(item.coverImageUrl, '/images/photo1.jpg');
    if (!id || !title || !slug)
        return null;
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
const toWorkRecord = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const item = value;
    const id = asString(item.id);
    const folderId = asString(item.folderId);
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const imageUrl = asString(item.imageUrl);
    if (!id || !folderId || !imageUrl)
        return null;
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
export const createDefaultAdminUser = () => ({
    id: createId('admin'),
    login: adminLogin,
    password: hashSync(adminPassword, passwordSaltRounds),
    name: adminName
});
export const createSeedDb = () => {
    return {
        users: [createDefaultAdminUser()],
        sessions: [],
        folders: [],
        works: []
    };
};
export const normalizeDb = (db) => {
    const value = db && typeof db === 'object' ? db : {};
    const users = (Array.isArray(value.users) ? value.users : []).map(toAdminUser).filter((item) => Boolean(item));
    const userIds = new Set(users.map((item) => item.id));
    const folders = (Array.isArray(value.folders) ? value.folders : []).map(toFolderRecord).filter((item) => Boolean(item));
    const folderIds = new Set(folders.map((item) => item.id));
    const sessions = (Array.isArray(value.sessions) ? value.sessions : [])
        .map(toSessionRecord)
        .filter((item) => Boolean(item))
        .filter((item) => userIds.has(item.userId));
    const works = (Array.isArray(value.works) ? value.works : [])
        .map(toWorkRecord)
        .filter((item) => Boolean(item))
        .filter((item) => folderIds.has(item.folderId));
    const normalizedFolders = folders.map((folder, index) => ({
        ...folder,
        sortOrder: folder.sortOrder > 0 ? folder.sortOrder : index + 1
    }));
    const workOrderByFolder = new Map();
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
