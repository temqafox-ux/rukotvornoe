import React, { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Folder,
  Work,
  useCreateFolderMutation,
  useDeleteFolderMutation,
  useDeleteWorkMutation,
  useGetFolderWorksQuery,
  useGetFoldersQuery,
  useLogoutMutation,
  useUpdateFolderMutation,
  useUpdateWorkMutation,
  useUploadWorksMutation
} from '../app/contentApi';

const MOBILE_BREAKPOINT = 768;
const WORKS_PAGE_SIZE = 12;
const SKELETON_ITEMS_COUNT = 6;

interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

const WorksPage: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [isUserPreview, setIsUserPreview] = useState(localStorage.getItem('admin_preview_mode') === 'user');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

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
  const [visibleWorksCount, setVisibleWorksCount] = useState(WORKS_PAGE_SIZE);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

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

  const [logoutAdmin, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [createFolder, { isLoading: isCreatingFolder }] = useCreateFolderMutation();
  const [updateFolder, { isLoading: isUpdatingFolder }] = useUpdateFolderMutation();
  const [deleteFolder, { isLoading: isDeletingFolder }] = useDeleteFolderMutation();
  const [uploadWorks, { isLoading: isUploadingWorks }] = useUploadWorksMutation();
  const [updateWork, { isLoading: isUpdatingWork }] = useUpdateWorkMutation();
  const [deleteWork, { isLoading: isDeletingWork }] = useDeleteWorkMutation();

  const isAdmin = Boolean(token);
  const showAdminUi = isAdmin && !isUserPreview;
  const folderActionsBusy = isCreatingFolder || isUpdatingFolder || isDeletingFolder;
  const workActionsBusy = isUploadingWorks || isUpdatingWork || isDeletingWork;
  const isAnyActionPending = Boolean(pendingKey);

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

  useEffect(() => {
    if (isAdmin) return;
    setIsUserPreview(false);
    localStorage.removeItem('admin_preview_mode');
  }, [isAdmin]);

  const works = useMemo(() => folderDetails?.works ?? [], [folderDetails]);
  const visibleWorks = useMemo(() => works.slice(0, visibleWorksCount), [works, visibleWorksCount]);
  const hasMoreWorks = visibleWorksCount < works.length;
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

  const notifyError = (error: unknown) => {
    toast.error(errorMessage(error));
  };

  const openConfirmDialog = (state: ConfirmDialogState) => {
    setConfirmDialog(state);
  };

  const closeConfirmDialog = () => {
    if (isConfirmLoading) return;
    setConfirmDialog(null);
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

  useEffect(() => {
    setVisibleWorksCount(WORKS_PAGE_SIZE);
  }, [selectedFolder?.id]);

  const onLogout = async () => {
    setPendingKey('logout');
    try {
      await logoutAdmin().unwrap();
    } catch (_error) {
      // Пользователь должен иметь возможность выйти даже при временном сбое сети.
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_preview_mode');
      setToken(null);
      setIsUserPreview(false);
      toast.success('Режим редактирования выключен.');
      setPendingKey(null);
    }
  };

  const toggleAdminPreview = () => {
    const nextValue = !isUserPreview;
    setIsUserPreview(nextValue);
    localStorage.setItem('admin_preview_mode', nextValue ? 'user' : 'admin');
  };

  const onSubmitFolder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const actionKey = editingFolder ? `save-folder-${editingFolder.id}` : 'create-folder';
    setPendingKey(actionKey);

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
      toast.success('Папка сохранена.');
    } catch (error) {
      notifyError(error);
    } finally {
      setPendingKey(null);
    }
  };

  const onDeleteFolder = async (folder: Folder) => {
    openConfirmDialog({
      title: 'Удалить папку?',
      description: `Папка "${folder.title}" и все работы внутри будут удалены.`,
      confirmLabel: 'Удалить',
      action: async () => {
        const actionKey = `delete-folder-${folder.id}`;
        setPendingKey(actionKey);
        try {
          await deleteFolder(folder.id).unwrap();
          if (selectedFolder?.id === folder.id) {
            setSelectedFolder(null);
          }
          await refetchFolders();
          toast.success('Папка удалена.');
        } finally {
          setPendingKey(null);
        }
      }
    });
  };

  const onSubmitUploadWorks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFolder || uploadFiles.length === 0) return;
    setPendingKey('upload-works');

    const body = new FormData();
    uploadFiles.forEach((file, index) => {
      const title = file.name.replace(/\.[^.]+$/, '');
      body.append('files', file);
      body.append(`title_${index}`, title);
    });

    try {
      await uploadWorks({ folderId: selectedFolder.id, body }).unwrap();
      setIsUploadModalOpen(false);
      setUploadFiles([]);
      await refetchFolderWorks();
      await refetchFolders();
      toast.success('Фотографии добавлены.');
    } catch (error) {
      notifyError(error);
    } finally {
      setPendingKey(null);
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
    setPendingKey(`save-work-${editingWork.id}`);

    const body = new FormData();
    body.append('title', workTitle);
    if (workFile) {
      body.append('file', workFile);
    }

    try {
      await updateWork({ id: editingWork.id, body }).unwrap();
      setIsWorkModalOpen(false);
      await refetchFolderWorks();
      toast.success('Работа обновлена.');
    } catch (error) {
      notifyError(error);
    } finally {
      setPendingKey(null);
    }
  };

  const onDeleteWork = async (work: Work) => {
    openConfirmDialog({
      title: 'Удалить работу?',
      description: `Работа "${work.title}" будет удалена без возможности восстановления.`,
      confirmLabel: 'Удалить',
      action: async () => {
        const actionKey = `delete-work-${work.id}`;
        setPendingKey(actionKey);
        try {
          await deleteWork(work.id).unwrap();
          await refetchFolderWorks();
          await refetchFolders();
          toast.success('Работа удалена.');
        } finally {
          setPendingKey(null);
        }
      }
    });
  };

  const onConfirmDialogAction = async () => {
    if (!confirmDialog) return;
    setIsConfirmLoading(true);
    try {
      await confirmDialog.action();
      setConfirmDialog(null);
    } catch (error) {
      notifyError(error);
    } finally {
      setIsConfirmLoading(false);
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

  const handleBackToFolders = () => {
    setSelectedFolder(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="works-page">
      <header className="works-page__header">
        <div className="works-page__top">
          <Link to="/" className="btn btn--ghost">На главную</Link>
          {isAdmin && (
            <div className="works-page__admin-controls">
              <span className="works-page__admin-state">
                {isUserPreview ? 'Просмотр как пользователь' : 'Режим редактирования'}
              </span>
              <button type="button" className="btn btn--ghost" onClick={toggleAdminPreview} disabled={isAnyActionPending}>
                {isUserPreview ? 'Вернуть админ-вид' : 'Смотреть как пользователь'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onLogout} disabled={isLoggingOut || isAnyActionPending}>
                {isLoggingOut || pendingKey === 'logout' ? 'Выходим...' : 'Выйти'}
              </button>
            </div>
          )}
        </div>
        <h1 className="section-title">{selectedFolder ? selectedFolder.title : 'Все работы'}</h1>
        <div className="section-divider" />
      </header>

      {!selectedFolder && showAdminUi && (
        <div className="works-page__actions">
          <button
            type="button"
            className="btn"
            onClick={openCreateFolderModal}
            disabled={folderActionsBusy || isAnyActionPending}
          >
            {pendingKey === 'create-folder' ? 'Создаем...' : '+ Добавить папку'}
          </button>
        </div>
      )}

      {selectedFolder ? (
        <>
          <div className="works-page__actions">
            <button type="button" className="btn btn--ghost" onClick={handleBackToFolders}>
              Назад
            </button>
            {showAdminUi && (
              <button
                type="button"
                className="btn"
                onClick={() => setIsUploadModalOpen(true)}
                disabled={workActionsBusy || isAnyActionPending}
              >
                + Добавить фото
              </button>
            )}
          </div>

          {isWorksLoading ? (
            <section className="works-grid" aria-label="Загрузка работ">
              {Array.from({ length: SKELETON_ITEMS_COUNT }).map((_, index) => (
                <article key={`work-skeleton-${index}`} className="works-grid__card works-grid__card--skeleton">
                  <div className="works-grid__img works-grid__img--skeleton" />
                </article>
              ))}
            </section>
          ) : (
            <>
              <section className="works-grid" aria-label="Работы в папке">
                {visibleWorks.map((work, i) => (
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
                      <img src={toImageUrl(work.imageUrl)} alt={work.title} loading="lazy" decoding="async" />
                    </div>
                  </button>
                  {showAdminUi && (
                    <div className="works-grid__admin-actions">
                      <button type="button" className="btn btn--ghost" onClick={() => openEditWorkModal(work)} disabled={isAnyActionPending}>Изменить</button>
                      <button type="button" className="btn btn--ghost" onClick={() => onDeleteWork(work)} disabled={workActionsBusy || isAnyActionPending}>
                        {pendingKey === `delete-work-${work.id}` ? 'Удаляем...' : 'Удалить'}
                      </button>
                    </div>
                  )}
                </article>
                ))}
              </section>
              {hasMoreWorks && (
                <div className="works-page__more-wrap">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setVisibleWorksCount((count) => count + WORKS_PAGE_SIZE)}
                    disabled={isAnyActionPending}
                  >
                    Показать еще
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : isFoldersLoading ? (
        <section className="works-grid" aria-label="Загрузка папок">
          {Array.from({ length: SKELETON_ITEMS_COUNT }).map((_, index) => (
            <article key={`folder-skeleton-${index}`} className="works-grid__card works-grid__card--skeleton">
              <div className="works-grid__img works-grid__img--skeleton" />
              <div className="works-grid__info">
                <div className="works-grid__line-skeleton" />
              </div>
            </article>
          ))}
        </section>
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
                  <img src={toImageUrl(folder.coverImageUrl)} alt={folder.title} loading="lazy" decoding="async" />
                </div>
                <div className="works-grid__info">
                  <h3 className="works-grid__title works-grid__title--folder">{folder.title}</h3>
                </div>
              </button>
              {showAdminUi && (
                <div className="works-grid__admin-actions">
                  <button type="button" className="btn btn--ghost" onClick={() => openEditFolderModal(folder)} disabled={isAnyActionPending}>Изменить</button>
                  <button type="button" className="btn btn--ghost" onClick={() => onDeleteFolder(folder)} disabled={folderActionsBusy || isAnyActionPending}>
                    {pendingKey === `delete-folder-${folder.id}` ? 'Удаляем...' : 'Удалить'}
                  </button>
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
              <span className="work-modal__counter">{currentIndex + 1} из {works.length}</span>
            </div>
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
              <button type="submit" className="btn" disabled={folderActionsBusy || isAnyActionPending}>
                {pendingKey?.startsWith('save-folder-') || pendingKey === 'create-folder' ? 'Сохраняем...' : 'Сохранить'}
              </button>
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
              <button type="submit" className="btn" disabled={workActionsBusy || uploadFiles.length === 0 || isAnyActionPending}>
                {pendingKey === 'upload-works' ? 'Загружаем...' : `Загрузить ${uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}`}
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
              <button type="submit" className="btn" disabled={workActionsBusy || isAnyActionPending}>
                {pendingKey === `save-work-${editingWork.id}` ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedFolder && (
        <div className="works-mobile-actions" role="region" aria-label="Быстрые действия">
          <button type="button" className="btn btn--ghost" onClick={handleBackToFolders} disabled={isAnyActionPending}>
            Назад
          </button>
          {showAdminUi && (
            <button
              type="button"
              className="btn"
              onClick={() => setIsUploadModalOpen(true)}
              disabled={isAnyActionPending || workActionsBusy}
            >
              + Фото
            </button>
          )}
        </div>
      )}

      {confirmDialog && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={closeConfirmDialog} />
          <div className="work-modal__dialog work-modal__dialog--form">
            <button className="work-modal__close" onClick={closeConfirmDialog} aria-label="Закрыть">×</button>
            <h2 className="work-modal__title">{confirmDialog.title}</h2>
            <p className="works-page__confirm-text">{confirmDialog.description}</p>
            <div className="works-page__confirm-actions">
              <button type="button" className="btn btn--ghost" onClick={closeConfirmDialog} disabled={isConfirmLoading}>
                Отмена
              </button>
              <button type="button" className="btn" onClick={onConfirmDialogAction} disabled={isConfirmLoading}>
                {isConfirmLoading ? 'Выполняем...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default WorksPage;
