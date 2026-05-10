import 'dotenv/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { compareSync, hashSync } from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { ensureStorage, getUploadsDir, readDb, updateDb } from './store.js';
import { createId, nowIso, slugify } from './utils.js';
const app = express();
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (_req, file, callback) => {
        if (!allowedImageMimeTypes.has(file.mimetype)) {
            return callback(new Error('ONLY_IMAGE_FILES'));
        }
        return callback(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 20
    }
});
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const trustProxyHops = Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 1));
const uploadMaxWidth = Math.max(800, Math.min(Number(process.env.UPLOAD_MAX_WIDTH ?? 1800), 4000));
const uploadQuality = Math.max(60, Math.min(Number(process.env.UPLOAD_QUALITY ?? 82), 95));
const passwordSaltRounds = Math.max(8, Math.min(Number(process.env.PASSWORD_SALT_ROUNDS ?? 10), 14));
const loginRateLimitWindowMs = Math.max(60_000, Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60_000));
const loginRateLimitAttempts = Math.max(3, Number(process.env.LOGIN_RATE_LIMIT_ATTEMPTS ?? 10));
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2Bucket = process.env.R2_BUCKET;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
const isR2Enabled = Boolean(r2AccountId && r2Bucket && r2AccessKeyId && r2SecretAccessKey && r2PublicBaseUrl);
const r2Client = isR2Enabled
    ? new S3Client({
        region: 'auto',
        endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: r2AccessKeyId,
            secretAccessKey: r2SecretAccessKey
        }
    })
    : null;
const publicDir = path.resolve(process.cwd(), '..', 'public');
const loginAttemptMap = new Map();
app.set('trust proxy', trustProxyHops);
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: false
}));
app.use(express.json());
app.use('/uploads', express.static(getUploadsDir(), {
    etag: true,
    immutable: true,
    maxAge: '365d'
}));
app.use('/images', express.static(path.join(publicDir, 'images')));
const folderSchema = z.object({
    title: z.string().trim().min(2)
});
const workDetailsSchema = z.array(z.string().trim().min(1).max(200)).max(12);
const workUpdateSchema = z.object({
    title: z.string().trim().max(160),
    details: z.array(z.string().trim().min(1).max(200)).max(12)
});
const reorderSchema = z.object({
    direction: z.enum(['up', 'down'])
});
const loginSchema = z.object({
    login: z.string().trim().min(1),
    password: z.string().trim().min(1)
});
const sortFolders = (folders) => [...folders].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
const sortWorks = (works) => [...works].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.localeCompare(a.createdAt));
const mapWork = (work) => ({
    id: work.id,
    title: work.title,
    imageUrl: work.imageUrl,
    details: work.details,
    sortOrder: work.sortOrder
});
const mapFolder = (folder, works) => ({
    id: folder.id,
    title: folder.title,
    slug: folder.slug,
    coverImageUrl: folder.coverImageUrl,
    sortOrder: folder.sortOrder,
    worksCount: works.filter((work) => work.folderId === folder.id).length
});
const resolveDetails = (folder, works) => ({
    ...mapFolder(folder, works),
    works: sortWorks(works.filter((work) => work.folderId === folder.id)).map(mapWork)
});
const getToken = (header) => {
    if (!header?.startsWith('Bearer ')) {
        return null;
    }
    return header.slice('Bearer '.length);
};
const requireAdmin = async (authorization) => {
    const token = getToken(authorization);
    if (!token) {
        return null;
    }
    const db = await readDb();
    const session = db.sessions.find((item) => item.token === token);
    if (!session) {
        return null;
    }
    const user = db.users.find((item) => item.id === session.userId);
    if (!user) {
        return null;
    }
    return {
        token,
        user: {
            id: user.id,
            login: user.login,
            name: user.name
        }
    };
};
const isSystemImage = (url) => url.startsWith('/images/');
const extractR2Key = (url) => {
    if (!r2PublicBaseUrl || !url.startsWith(`${r2PublicBaseUrl}/`)) {
        return null;
    }
    return url.slice(r2PublicBaseUrl.length + 1);
};
const deleteAsset = async (assetUrl) => {
    if (!assetUrl || isSystemImage(assetUrl)) {
        return;
    }
    const r2Key = extractR2Key(assetUrl);
    if (r2Key && r2Client && r2Bucket) {
        await r2Client.send(new DeleteObjectCommand({
            Bucket: r2Bucket,
            Key: r2Key
        }));
        return;
    }
    if (assetUrl.startsWith('/uploads/')) {
        const fileName = path.basename(assetUrl);
        const destination = path.join(getUploadsDir(), fileName);
        await fs.rm(destination, { force: true });
    }
};
const getLoginRateLimitKey = (req) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    return `ip:${ip}`;
};
const isLoginRateLimited = (key) => {
    const now = Date.now();
    const snapshot = loginAttemptMap.get(key);
    if (!snapshot)
        return false;
    if (snapshot.resetAt <= now) {
        loginAttemptMap.delete(key);
        return false;
    }
    return snapshot.count >= loginRateLimitAttempts;
};
const registerFailedLogin = (key) => {
    const now = Date.now();
    const current = loginAttemptMap.get(key);
    if (!current || current.resetAt <= now) {
        loginAttemptMap.set(key, { count: 1, resetAt: now + loginRateLimitWindowMs });
        return;
    }
    current.count += 1;
    loginAttemptMap.set(key, current);
};
const saveUpload = async (file) => {
    const filename = `${createId('asset')}.webp`;
    const optimizedBuffer = await sharp(file.buffer)
        .rotate()
        .resize({
        width: uploadMaxWidth,
        fit: 'inside',
        withoutEnlargement: true
    })
        .webp({ quality: uploadQuality })
        .toBuffer();
    if (isR2Enabled && r2Client && r2Bucket && r2PublicBaseUrl) {
        const key = `uploads/${filename}`;
        await r2Client.send(new PutObjectCommand({
            Bucket: r2Bucket,
            Key: key,
            Body: optimizedBuffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable'
        }));
        return `${r2PublicBaseUrl}/${key}`;
    }
    const destination = path.join(getUploadsDir(), filename);
    await fs.writeFile(destination, optimizedBuffer);
    return `/uploads/${filename}`;
};
const parseWorkDetails = (raw) => {
    if (raw === undefined || raw === null || raw === '') {
        return { success: true, data: [] };
    }
    if (typeof raw !== 'string') {
        return { success: false };
    }
    try {
        const parsed = JSON.parse(raw);
        const normalized = Array.isArray(parsed)
            ? parsed.map((item) => {
                if (typeof item === 'string')
                    return item.trim();
                if (!item || typeof item !== 'object')
                    return '';
                const candidate = item;
                const key = typeof candidate.key === 'string' ? candidate.key.trim() : '';
                const value = typeof candidate.value === 'string' ? candidate.value.trim() : '';
                return key && value ? `${key}: ${value}` : '';
            }).filter(Boolean)
            : parsed;
        const result = workDetailsSchema.safeParse(normalized);
        if (!result.success) {
            return { success: false };
        }
        return { success: true, data: result.data };
    }
    catch {
        return { success: false };
    }
};
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});
app.post('/api/auth/login', async (req, res) => {
    const rateLimitKey = getLoginRateLimitKey(req);
    if (isLoginRateLimited(rateLimitKey)) {
        return res.status(429).json({ message: 'Слишком много попыток входа. Попробуйте позже.' });
    }
    const payload = loginSchema.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({ message: 'Некорректные данные для входа.' });
    }
    const db = await readDb();
    const user = db.users.find((item) => item.login === payload.data.login);
    let isPasswordValid = false;
    let shouldUpgradePasswordHash = false;
    if (user) {
        if (user.password.startsWith('$2')) {
            try {
                isPasswordValid = compareSync(payload.data.password, user.password);
            }
            catch {
                isPasswordValid = false;
            }
        }
        else {
            isPasswordValid = user.password === payload.data.password;
            shouldUpgradePasswordHash = isPasswordValid;
        }
    }
    if (!user || !isPasswordValid) {
        registerFailedLogin(rateLimitKey);
        return res.status(401).json({ message: 'Неверный логин или пароль.' });
    }
    if (shouldUpgradePasswordHash) {
        user.password = hashSync(payload.data.password, passwordSaltRounds);
    }
    loginAttemptMap.delete(rateLimitKey);
    const token = createId('token');
    db.sessions = db.sessions.filter((item) => item.userId !== user.id);
    db.sessions.push({
        token,
        userId: user.id,
        createdAt: nowIso()
    });
    await updateDb(async (store) => {
        store.sessions = db.sessions;
    });
    return res.json({
        token,
        user: {
            id: user.id,
            login: user.login,
            name: user.name
        }
    });
});
app.get('/api/auth/me', async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Не авторизован.' });
    }
    return res.json(auth.user);
});
app.post('/api/auth/logout', async (req, res) => {
    const token = getToken(req.headers.authorization);
    if (!token) {
        return res.status(204).send();
    }
    await updateDb(async (db) => {
        db.sessions = db.sessions.filter((session) => session.token !== token);
    });
    return res.status(204).send();
});
app.get('/api/folders', async (_req, res) => {
    const db = await readDb();
    const folders = sortFolders(db.folders);
    return res.json(folders.map((folder) => mapFolder(folder, db.works)));
});
app.get('/api/folders/:slug/works', async (req, res) => {
    const db = await readDb();
    const folder = db.folders.find((item) => item.slug === req.params.slug);
    if (!folder) {
        return res.status(404).json({ message: 'Папка не найдена.' });
    }
    return res.json(resolveDetails(folder, db.works));
});
app.post('/api/admin/folders', upload.single('cover'), async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const payload = folderSchema.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({ message: 'Заполните название папки.' });
    }
    const result = await updateDb(async (db) => {
        const baseSlug = slugify(payload.data.title);
        let slug = baseSlug;
        let suffix = 2;
        while (db.folders.some((folder) => folder.slug === slug)) {
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }
        const folder = {
            id: createId('folder'),
            title: payload.data.title,
            slug,
            coverImageUrl: req.file ? await saveUpload(req.file) : '/images/photo1.jpg',
            sortOrder: Math.max(0, ...db.folders.map((item) => item.sortOrder)) + 1,
            createdAt: nowIso(),
            updatedAt: nowIso()
        };
        db.folders.push(folder);
        return mapFolder(folder, db.works);
    });
    return res.status(201).json(result);
});
app.patch('/api/admin/folders/:id', upload.single('cover'), async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const payload = folderSchema.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({ message: 'Заполните название папки.' });
    }
    const result = await updateDb(async (db) => {
        const folder = db.folders.find((item) => item.id === req.params.id);
        if (!folder) {
            return null;
        }
        const previousCoverImageUrl = folder.coverImageUrl;
        const baseSlug = slugify(payload.data.title);
        let slug = baseSlug;
        let suffix = 2;
        while (db.folders.some((item) => item.id !== folder.id && item.slug === slug)) {
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }
        folder.title = payload.data.title;
        folder.slug = slug;
        folder.updatedAt = nowIso();
        if (req.file) {
            folder.coverImageUrl = await saveUpload(req.file);
        }
        const shouldDeletePreviousCover = req.file &&
            previousCoverImageUrl !== folder.coverImageUrl &&
            !db.folders.some((item) => item.id !== folder.id && item.coverImageUrl === previousCoverImageUrl);
        return {
            details: resolveDetails(folder, db.works),
            previousCoverToDelete: shouldDeletePreviousCover ? previousCoverImageUrl : null
        };
    });
    if (!result) {
        return res.status(404).json({ message: 'Папка не найдена.' });
    }
    if (result.previousCoverToDelete) {
        await deleteAsset(result.previousCoverToDelete);
    }
    return res.json(result.details);
});
app.post('/api/admin/folders/:id/reorder', async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const payload = reorderSchema.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({ message: 'Некорректный запрос на изменение порядка.' });
    }
    const result = await updateDb(async (db) => {
        const sortedFolders = sortFolders(db.folders);
        const currentIndex = sortedFolders.findIndex((item) => item.id === req.params.id);
        if (currentIndex === -1) {
            return 'not-found';
        }
        const targetIndex = payload.data.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= sortedFolders.length) {
            return 'edge';
        }
        const current = sortedFolders[currentIndex];
        const target = sortedFolders[targetIndex];
        const currentOrder = current.sortOrder;
        current.sortOrder = target.sortOrder;
        target.sortOrder = currentOrder;
        current.updatedAt = nowIso();
        target.updatedAt = nowIso();
        return 'ok';
    });
    if (result === 'not-found') {
        return res.status(404).json({ message: 'Папка не найдена.' });
    }
    if (result === 'edge') {
        return res.status(400).json({ message: 'Нельзя переместить папку дальше.' });
    }
    return res.status(204).send();
});
app.delete('/api/admin/folders/:id', async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const result = await updateDb(async (db) => {
        const folder = db.folders.find((item) => item.id === req.params.id);
        if (!folder) {
            return null;
        }
        const removedWorks = db.works.filter((work) => work.folderId === req.params.id);
        db.folders = db.folders.filter((item) => item.id !== req.params.id);
        db.works = db.works.filter((work) => work.folderId !== req.params.id);
        const urlsToDelete = new Set();
        if (!isSystemImage(folder.coverImageUrl) && !db.folders.some((item) => item.coverImageUrl === folder.coverImageUrl)) {
            urlsToDelete.add(folder.coverImageUrl);
        }
        for (const work of removedWorks) {
            if (!db.works.some((item) => item.imageUrl === work.imageUrl)) {
                urlsToDelete.add(work.imageUrl);
            }
        }
        return Array.from(urlsToDelete);
    });
    if (!result) {
        return res.status(404).json({ message: 'Папка не найдена.' });
    }
    await Promise.all(result.map((assetUrl) => deleteAsset(assetUrl)));
    return res.status(204).send();
});
app.post('/api/admin/folders/:id/works/upload', upload.array('files', 20), async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const files = req.files;
    if (!files?.length) {
        return res.status(400).json({ message: 'Добавьте хотя бы один файл.' });
    }
    const result = await updateDb(async (db) => {
        const folder = db.folders.find((item) => item.id === req.params.id);
        if (!folder) {
            return null;
        }
        const works = await Promise.all(files.map(async (file, index) => {
            const nextSortOrder = Math.max(0, ...db.works.filter((item) => item.folderId === folder.id).map((item) => item.sortOrder)) + index + 1;
            const work = {
                id: createId('work'),
                folderId: folder.id,
                title: '',
                imageUrl: await saveUpload(file),
                details: [],
                sortOrder: nextSortOrder,
                createdAt: nowIso(),
                updatedAt: nowIso()
            };
            db.works.push(work);
            return mapWork(work);
        }));
        folder.updatedAt = nowIso();
        return works;
    });
    if (!result) {
        return res.status(404).json({ message: 'Папка не найдена.' });
    }
    return res.status(201).json(result);
});
app.patch('/api/admin/works/:id', upload.single('file'), async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const parsedDetails = parseWorkDetails(req.body.details);
    const payload = workUpdateSchema.safeParse({
        title,
        details: parsedDetails.success ? parsedDetails.data : null
    });
    if (!payload.success) {
        return res.status(400).json({ message: 'Проверьте название и параметры работы.' });
    }
    const result = await updateDb(async (db) => {
        const work = db.works.find((item) => item.id === req.params.id);
        if (!work) {
            return null;
        }
        const previousImageUrl = work.imageUrl;
        work.title = payload.data.title;
        work.details = payload.data.details;
        work.updatedAt = nowIso();
        if (req.file) {
            work.imageUrl = await saveUpload(req.file);
        }
        const shouldDeletePreviousImage = req.file &&
            previousImageUrl !== work.imageUrl &&
            !db.works.some((item) => item.id !== work.id && item.imageUrl === previousImageUrl);
        return {
            work: mapWork(work),
            previousImageToDelete: shouldDeletePreviousImage ? previousImageUrl : null
        };
    });
    if (!result) {
        return res.status(404).json({ message: 'Работа не найдена.' });
    }
    if (result.previousImageToDelete) {
        await deleteAsset(result.previousImageToDelete);
    }
    return res.json(result.work);
});
app.post('/api/admin/works/:id/reorder', async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const payload = reorderSchema.safeParse(req.body);
    if (!payload.success) {
        return res.status(400).json({ message: 'Некорректный запрос на изменение порядка.' });
    }
    const result = await updateDb(async (db) => {
        const current = db.works.find((item) => item.id === req.params.id);
        if (!current) {
            return 'not-found';
        }
        const siblings = sortWorks(db.works.filter((item) => item.folderId === current.folderId));
        const currentIndex = siblings.findIndex((item) => item.id === current.id);
        if (currentIndex === -1) {
            return 'not-found';
        }
        const targetIndex = payload.data.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) {
            return 'edge';
        }
        const target = siblings[targetIndex];
        const currentOrder = current.sortOrder;
        current.sortOrder = target.sortOrder;
        target.sortOrder = currentOrder;
        current.updatedAt = nowIso();
        target.updatedAt = nowIso();
        return 'ok';
    });
    if (result === 'not-found') {
        return res.status(404).json({ message: 'Работа не найдена.' });
    }
    if (result === 'edge') {
        return res.status(400).json({ message: 'Нельзя переместить работу дальше.' });
    }
    return res.status(204).send();
});
app.delete('/api/admin/works/:id', async (req, res) => {
    const auth = await requireAdmin(req.headers.authorization);
    if (!auth) {
        return res.status(401).json({ message: 'Нужна авторизация.' });
    }
    const result = await updateDb(async (db) => {
        const work = db.works.find((item) => item.id === req.params.id);
        if (!work) {
            return null;
        }
        db.works = db.works.filter((item) => item.id !== req.params.id);
        const shouldDeleteImage = !db.works.some((item) => item.imageUrl === work.imageUrl);
        return shouldDeleteImage ? work.imageUrl : null;
    });
    if (result === null) {
        return res.status(404).json({ message: 'Работа не найдена.' });
    }
    if (result) {
        await deleteAsset(result);
    }
    return res.status(204).send();
});
app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
        return res.status(400).json({ message: 'Ошибка загрузки файла. Проверьте размер и формат.' });
    }
    if (error instanceof Error && error.message === 'ONLY_IMAGE_FILES') {
        return res.status(400).json({ message: 'Можно загружать только изображения.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера.' });
});
ensureStorage()
    .then(() => {
    app.listen(port, () => {
        console.log(`API ready on http://localhost:${port}`);
    });
})
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
