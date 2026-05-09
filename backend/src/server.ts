import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ensureStorage, getUploadsDir, readDb, updateDb } from './store.js';
import type { AuthPayload, FolderRecord, PublicFolder, PublicFolderDetails, PublicWork, WorkRecord } from './types.js';
import { createId, nowIso, slugify } from './utils.js';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
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
const publicDir = path.resolve(process.cwd(), '..', 'public');

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: false
  })
);
app.use(express.json());
app.use('/uploads', express.static(getUploadsDir()));
app.use('/images', express.static(path.join(publicDir, 'images')));

const folderSchema = z.object({
  title: z.string().trim().min(2)
});

const workSchema = z.object({
  title: z.string().trim().min(2)
});

const loginSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().trim().min(1)
});

const mapWork = (work: WorkRecord): PublicWork => ({
  id: work.id,
  title: work.title,
  imageUrl: work.imageUrl
});

const mapFolder = (folder: FolderRecord, works: WorkRecord[]): PublicFolder => ({
  id: folder.id,
  title: folder.title,
  slug: folder.slug,
  coverImageUrl: folder.coverImageUrl,
  worksCount: works.filter((work) => work.folderId === folder.id).length
});

const resolveDetails = (folder: FolderRecord, works: WorkRecord[]): PublicFolderDetails => ({
  ...mapFolder(folder, works),
  works: works.filter((work) => work.folderId === folder.id).map(mapWork)
});

const getToken = (header?: string) => {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length);
};

const requireAdmin = async (authorization?: string) => {
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
  } satisfies AuthPayload;
};

const saveUpload = async (file: Express.Multer.File) => {
  const extension = path.extname(file.originalname) || '.jpg';
  const filename = `${createId('asset')}${extension}`;
  const destination = path.join(getUploadsDir(), filename);

  await fs.writeFile(destination, file.buffer);

  return `/uploads/${filename}`;
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const payload = loginSchema.safeParse(req.body);

  if (!payload.success) {
    return res.status(400).json({ message: 'Некорректные данные для входа.' });
  }

  const db = await readDb();
  const user = db.users.find((item) => item.login === payload.data.login && item.password === payload.data.password);

  if (!user) {
    return res.status(401).json({ message: 'Неверный логин или пароль.' });
  }

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
  } satisfies AuthPayload);
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
  return res.json(db.folders.map((folder) => mapFolder(folder, db.works)));
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

    const folder: FolderRecord = {
      id: createId('folder'),
      title: payload.data.title,
      slug,
      coverImageUrl: req.file ? await saveUpload(req.file) : '/images/photo1.jpg',
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

    return resolveDetails(folder, db.works);
  });

  if (!result) {
    return res.status(404).json({ message: 'Папка не найдена.' });
  }

  return res.json(result);
});

app.delete('/api/admin/folders/:id', async (req, res) => {
  const auth = await requireAdmin(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ message: 'Нужна авторизация.' });
  }

  const deleted = await updateDb(async (db) => {
    const folderExists = db.folders.some((folder) => folder.id === req.params.id);

    if (!folderExists) {
      return false;
    }

    db.folders = db.folders.filter((folder) => folder.id !== req.params.id);
    db.works = db.works.filter((work) => work.folderId !== req.params.id);
    return true;
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Папка не найдена.' });
  }

  return res.status(204).send();
});

app.post('/api/admin/folders/:id/works/upload', upload.array('files', 20), async (req, res) => {
  const auth = await requireAdmin(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ message: 'Нужна авторизация.' });
  }

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    return res.status(400).json({ message: 'Добавьте хотя бы один файл.' });
  }

  const result = await updateDb(async (db) => {
    const folder = db.folders.find((item) => item.id === req.params.id);

    if (!folder) {
      return null;
    }

    const works = await Promise.all(
      files.map(async (file, index) => {
        const work: WorkRecord = {
          id: createId('work'),
          folderId: folder.id,
          title: String(req.body[`title_${index}`] ?? file.originalname.replace(/\.[^.]+$/, '')),
          imageUrl: await saveUpload(file),
          createdAt: nowIso(),
          updatedAt: nowIso()
        };

        db.works.push(work);
        return mapWork(work);
      })
    );

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

  const payload = workSchema.safeParse(req.body);
  if (!payload.success) {
    return res.status(400).json({ message: 'Заполните название работы.' });
  }

  const result = await updateDb(async (db) => {
    const work = db.works.find((item) => item.id === req.params.id);

    if (!work) {
      return null;
    }

    work.title = payload.data.title;
    work.updatedAt = nowIso();

    if (req.file) {
      work.imageUrl = await saveUpload(req.file);
    }

    return mapWork(work);
  });

  if (!result) {
    return res.status(404).json({ message: 'Работа не найдена.' });
  }

  return res.json(result);
});

app.delete('/api/admin/works/:id', async (req, res) => {
  const auth = await requireAdmin(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ message: 'Нужна авторизация.' });
  }

  const deleted = await updateDb(async (db) => {
    const workExists = db.works.some((item) => item.id === req.params.id);

    if (!workExists) {
      return false;
    }

    db.works = db.works.filter((item) => item.id !== req.params.id);
    return true;
  });

  if (!deleted) {
    return res.status(404).json({ message: 'Работа не найдена.' });
  }

  return res.status(204).send();
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
