import React, { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Folder,
  Work,
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useDeleteWorkMutation,
  useGetFolderWorksQuery,
  useGetFoldersQuery,
  useLoginMutation,
  useLogoutMutation,
  useUpdateFolderMutation,
  useUpdateWorkMutation,
  useUploadWorksMutation
} from '../app/contentApi';

const MOBILE_BREAKPOINT = 768;

const WorksPage: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [message, setMessage] = useState('');

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderTitle, setFolderTitle] = useState('');
  const [folderCover, setFolderCover] = useState<File | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  const [editingWork, setEditingWork] = useState<Work | null>(null);
  const [workTitle, setWorkTitle] = useState('');
  const [workFile, setWorkFile] = useState<File | null>(null);

  const {
    data: folders = [],
    isLoading: isFoldersLoading,
    refetch: refetchFolders
  } = useGetFoldersQuery();
  const {
    data: folderDetails,
    isLoading: isWorksLoading,
    refetch: refetchFolderWorks
  } = useGetFolderWorksQuery(selectedFolder?.slug ?? '', { skip: !selectedFolder });

  const [loginAdmin, { isLoading: isLoggingIn }] = useLoginMutation();
  const [logoutAdmin] = useLogoutMutation();
  const [createFolder, { isLoading: isCreatingFolder }] = useCreateFolderMutation();
  const [updateFolder, { isLoading: isUpdatingFolder }] = useUpdateFolderMutation();
  const [deleteFolder, { isLoading: isDeletingFolder }] = useDeleteFolderMutation();
  const [uploadWorks, { isLoading: isUploadingWorks }] = useUploadWorksMutation();
  const [updateWork, { isLoading: isUpdatingWork }] = useUpdateWorkMutation();
  const [deleteWork, { isLoading: isDeletingWork }] = useDeleteWorkMutation();

  const isAdmin = Boolean(token);
  const folderActionsBusy = isCreatingFolder || isUpdatingFolder || isDeletingFolder;
  const workActionsBusy = isUploadingWorks || isUpdatingWork || isDeletingWork;

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!selectedWork) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [selectedWork]);

  const works = useMemo(() => folderDetails?.works ?? [], [folderDetails]);
  const currentIndex = selectedWork ? works.findIndex((work) => work.id === selectedWork.id) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < works.length - 1;

  const apiHost = process.env.REACT_APP_API_URL ?? 'http://localhost:4000';

  const selectedImageUrl = useMemo(() => {
    if (!selectedWork) return '';
    return selectedWork.imageUrl.startsWith('http') ? selectedWork.imageUrl : `${apiHost}${selectedWork.imageUrl}`;
  }, [apiHost, selectedWork]);

  const toImageUrl = (relativeOrAbsoluteUrl: string) => {
    if (!relativeOrAbsoluteUrl) return '';
    return relativeOrAbsoluteUrl.startsWith('http') ? relativeOrAbsoluteUrl : `${apiHost}${relativeOrAbsoluteUrl}`;
  };

  const errorMessage = (error: unknown) => {
    const fallback = 'Произошла ошибка. Попробуйте еще раз.';
    if (!error || typeof error !== 'object') return fallback;
    const value = error as { data?: { message?: string } };
    return value.data?.message ?? fallback;
  };

  const openCreateFolderModal = () => {
    setEditingFolder(null);
    setFolderTitle('');
    setFolderCover(null);
    setIsFolderModalOpen(true);
  };

  const openEditFolderModal = (folder: Folder) => {
    setEditingFolder(folder);
    setFolderTitle(folder.title);
    setFolderCover(null);
    setIsFolderModalOpen(true);
  };

  const onSubmitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    try {
      const result = await loginAdmin({ login, password }).unwrap();
      localStorage.setItem('admin_token', result.token);
      setToken(result.token);
      setIsLoginModalOpen(false);
      setPassword('');
      setMessage('Режим редактирования включен.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const onLogout = async () => {
    try {
      await logoutAdmin().unwrap();
    } catch (_error) {
      // Пользователь должен иметь возможность выйти даже при временном сбое сети.
    } finally {
      localStorage.removeItem('admin_token');
      setToken(null);
      setMessage('Режим редактирования выключен.');
    }
  };

  const onSubmitFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    const body = new FormData();
    body.append('title', folderTitle);
    if (folderCover) {
      body.append('cover', folderCover);
    }

    try {
      if (editingFolder) {
        await updateFolder({ id: editingFolder.id, body }).unwrap();
      } else {
        await createFolder(body).unwrap();
      }
      setIsFolderModalOpen(false);
      await refetchFolders();
      setMessage('Папка сохранена.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const onDeleteFolder = async (folder: Folder) => {
    const confirmed = window.confirm(`Удалить папку "${folder.title}"?`);
    if (!confirmed) return;

    setMessage('');
    try {
      await deleteFolder(folder.id).unwrap();
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(null);
      }
      await refetchFolders();
      setMessage('Папка удалена.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const onSubmitUploadWorks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFolder || uploadFiles.length === 0) return;

    const body = new FormData();
    uploadFiles.forEach((file, index) => {
      const title = file.name.replace(/\.[^.]+$/, '');
      body.append('files', file);
      body.append(`title_${index}`, title);
    });

    setMessage('');
    try {
      await uploadWorks({ folderId: selectedFolder.id, body }).unwrap();
      setIsUploadModalOpen(false);
      setUploadFiles([]);
      await refetchFolderWorks();
      await refetchFolders();
      setMessage('Фотографии добавлены.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const openEditWorkModal = (work: Work) => {
    setEditingWork(work);
    setWorkTitle(work.title);
    setWorkFile(null);
    setIsWorkModalOpen(true);
  };

  const onSubmitWorkEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingWork) return;

    const body = new FormData();
    body.append('title', workTitle);
    if (workFile) {
      body.append('file', workFile);
    }

    setMessage('');
    try {
      await updateWork({ id: editingWork.id, body }).unwrap();
      setIsWorkModalOpen(false);
      await refetchFolderWorks();
      setMessage('Работа обновлена.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const onDeleteWork = async (work: Work) => {
    const confirmed = window.confirm(`Удалить работу "${work.title}"?`);
    if (!confirmed) return;

    setMessage('');
    try {
      await deleteWork(work.id).unwrap();
      await refetchFolderWorks();
      await refetchFolders();
      setMessage('Работа удалена.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const goPrev = useCallback(() => {
    if (canGoPrev) setSelectedWork(works[currentIndex - 1]);
  }, [canGoPrev, currentIndex, works]);

  const goNext = useCallback(() => {
    if (canGoNext) setSelectedWork(works[currentIndex + 1]);
  }, [canGoNext, currentIndex, works]);

  useEffect(() => {
    if (!selectedWork) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedWork(null);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedWork, goPrev, goNext]);

  const handleWorkCardClick = (work: Work) => {
    if (!isMobile) {
      setSelectedWork(work);
    }
  };

  return (
    <main className="works-page">
      <header className="works-page__header">
        <div className="works-page__top">
          <Link to="/" className="btn btn--ghost">На главную</Link>
          <div className="works-page__admin-controls">
            {isAdmin ? (
              <>
                <span className="works-page__admin-state">Режим редактирования</span>
                <button type="button" className="btn btn--ghost" onClick={onLogout}>Выйти</button>
              </>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setIsLoginModalOpen(true)}>
                Вход для редактирования
              </button>
            )}
          </div>
        </div>
        <h1 className="section-title">{selectedFolder ? selectedFolder.title : 'Все работы'}</h1>
        <div className="section-divider" />
      </header>

      {message && <p className="works-page__message">{message}</p>}

      {!selectedFolder && isAdmin && (
        <div className="works-page__actions">
          <button
            type="button"
            className="btn"
            onClick={openCreateFolderModal}
            disabled={folderActionsBusy}
          >
            + Добавить папку
          </button>
        </div>
      )}

      {selectedFolder ? (
        <>
          <div className="works-page__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setSelectedFolder(null)}>
              Назад к папкам
            </button>
            {isAdmin && (
              <button
                type="button"
                className="btn"
                onClick={() => setIsUploadModalOpen(true)}
                disabled={workActionsBusy}
              >
                + Добавить фото
              </button>
            )}
          </div>

          {isWorksLoading ? (
            <p className="works-page__loading">Загрузка...</p>
          ) : (
            <section className="works-grid" aria-label="Работы в папке">
              {works.map((work, i) => (
                <article
                  key={work.id}
                  className="works-grid__card"
                  style={{ '--delay': `${i * 40}ms` } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="works-grid__card-hit"
                    onClick={() => handleWorkCardClick(work)}
                    aria-label={work.title}
                  >
                    <div className="works-grid__img">
                      <img src={toImageUrl(work.imageUrl)} alt={work.title} />
                    </div>
                  </button>
                  {isAdmin && (
                    <div className="works-grid__admin-actions">
                      <button type="button" className="btn btn--ghost" onClick={() => openEditWorkModal(work)}>Изменить</button>
                      <button type="button" className="btn btn--ghost" onClick={() => onDeleteWork(work)} disabled={workActionsBusy}>Удалить</button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      ) : isFoldersLoading ? (
        <p className="works-page__loading">Загрузка...</p>
      ) : (
        <section className="works-grid" aria-label="Папки с работами">
          {folders.map((folder, i) => (
            <article
              key={folder.id}
              className="works-grid__card"
              style={{ '--delay': `${i * 40}ms` } as React.CSSProperties}
            >
              <button
                type="button"
                className="works-grid__card-hit"
                onClick={() => setSelectedFolder(folder)}
                aria-label={folder.title}
              >
                <div className="works-grid__img">
                  <img src={toImageUrl(folder.coverImageUrl)} alt={folder.title} />
                </div>
                <div className="works-grid__info">
                  <h3 className="works-grid__title works-grid__title--folder">{folder.title}</h3>
                </div>
              </button>
              {isAdmin && (
                <div className="works-grid__admin-actions">
                  <button type="button" className="btn btn--ghost" onClick={() => openEditFolderModal(folder)}>Изменить</button>
                  <button type="button" className="btn btn--ghost" onClick={() => onDeleteFolder(folder)} disabled={folderActionsBusy}>Удалить</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      <section className="contact" style={{ marginTop: '4rem' }}>
        <div className="contact__header">
          <h2 className="section-title">Контакты</h2>
          <div className="section-divider" />
        </div>
        <div className="contact__content">
          <div className="contact__info">
            <div className="contact__item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <a href="mailto:elfin.v@gmail.com">elfin.v@gmail.com</a>
            </div>
            <div className="contact__socials">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="contact__social-link" aria-label="Instagram">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a href="https://t.me/rukotvornoe_yana" target="_blank" rel="noopener noreferrer" className="contact__social-link" aria-label="Telegram">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 3L1 10l7 3m13-10l-7 14-6-7m13-7l-13 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <footer className="footer">
          <span>© {new Date().getFullYear()} Рукотворное</span>
        </footer>
      </section>

      {selectedWork && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={() => setSelectedWork(null)} />

          {canGoPrev && (
            <button className="work-modal__nav work-modal__nav--prev" onClick={goPrev} aria-label="Предыдущая работа">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          {canGoNext && (
            <button className="work-modal__nav work-modal__nav--next" onClick={goNext} aria-label="Следующая работа">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}

          <div className="work-modal__dialog">
            <button className="work-modal__close" onClick={() => setSelectedWork(null)} aria-label="Закрыть">×</button>
            <div className="work-modal__image">
              <img src={selectedImageUrl} alt={selectedWork.title} />
            </div>
            <div className="work-modal__info">
              <h2 className="work-modal__title">{selectedWork.title}</h2>
              <span className="work-modal__counter">{currentIndex + 1} из {works.length}</span>
            </div>
          </div>
        </div>
      )}

      {isLoginModalOpen && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={() => setIsLoginModalOpen(false)} />
          <div className="work-modal__dialog work-modal__dialog--form">
            <button className="work-modal__close" onClick={() => setIsLoginModalOpen(false)} aria-label="Закрыть">×</button>
            <h2 className="work-modal__title">Вход в режим редактирования</h2>
            <form className="admin-form" onSubmit={onSubmitLogin}>
              <label className="admin-form__field">
                Логин
                <input value={login} onChange={(event) => setLogin(event.target.value)} required />
              </label>
              <label className="admin-form__field">
                Пароль
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <button type="submit" className="btn" disabled={isLoggingIn}>Войти</button>
            </form>
          </div>
        </div>
      )}

      {isFolderModalOpen && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={() => setIsFolderModalOpen(false)} />
          <div className="work-modal__dialog work-modal__dialog--form">
            <button className="work-modal__close" onClick={() => setIsFolderModalOpen(false)} aria-label="Закрыть">×</button>
            <h2 className="work-modal__title">{editingFolder ? 'Редактирование папки' : 'Новая папка'}</h2>
            <form className="admin-form" onSubmit={onSubmitFolder}>
              <label className="admin-form__field">
                Название
                <input value={folderTitle} onChange={(event) => setFolderTitle(event.target.value)} required />
              </label>
              <label className="admin-form__field">
                Обложка
                <input type="file" accept="image/*" onChange={(event) => setFolderCover(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" className="btn" disabled={folderActionsBusy}>Сохранить</button>
            </form>
          </div>
        </div>
      )}

      {isUploadModalOpen && selectedFolder && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={() => setIsUploadModalOpen(false)} />
          <div className="work-modal__dialog work-modal__dialog--form">
            <button className="work-modal__close" onClick={() => setIsUploadModalOpen(false)} aria-label="Закрыть">×</button>
            <h2 className="work-modal__title">Добавление фото в папку "{selectedFolder.title}"</h2>
            <form className="admin-form" onSubmit={onSubmitUploadWorks}>
              <label className="admin-form__field">
                Файлы
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  required
                  onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <button type="submit" className="btn" disabled={workActionsBusy || uploadFiles.length === 0}>
                Загрузить {uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}
              </button>
            </form>
          </div>
        </div>
      )}

      {isWorkModalOpen && editingWork && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={() => setIsWorkModalOpen(false)} />
          <div className="work-modal__dialog work-modal__dialog--form">
            <button className="work-modal__close" onClick={() => setIsWorkModalOpen(false)} aria-label="Закрыть">×</button>
            <h2 className="work-modal__title">Редактирование работы</h2>
            <form className="admin-form" onSubmit={onSubmitWorkEdit}>
              <label className="admin-form__field">
                Название
                <input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} required />
              </label>
              <label className="admin-form__field">
                Заменить фото
                <input type="file" accept="image/*" onChange={(event) => setWorkFile(event.target.files?.[0] ?? null)} />
              </label>
              <button type="submit" className="btn" disabled={workActionsBusy}>Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default WorksPage;
