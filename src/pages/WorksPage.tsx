import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface ArtWork {
  id: number;
  title: string;
  category: string;
  color: string;
  src: string;
}

const MOBILE_BREAKPOINT = 768;

const WorksPage: React.FC = () => {
  const [works, setWorks] = useState<ArtWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ArtWork | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_BREAKPOINT);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetch('/data/works.json')
      .then((r) => r.json())
      .then((data) => { setWorks(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  const currentIndex = selected ? works.findIndex((w) => w.id === selected.id) : -1;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < works.length - 1;

  const goPrev = useCallback(() => {
    if (canGoPrev) setSelected(works[currentIndex - 1]);
  }, [canGoPrev, works, currentIndex]);

  const goNext = useCallback(() => {
    if (canGoNext) setSelected(works[currentIndex + 1]);
  }, [canGoNext, works, currentIndex]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, goPrev, goNext]);

  const handleCardClick = (work: ArtWork) => {
    if (!isMobile) setSelected(work);
  };

  return (
    <main className="works-page">
      <header className="works-page__header">
        <div className="works-page__top">
          <Link to="/" className="btn btn--ghost">На главную</Link>
        </div>
        <h1 className="section-title">Все работы</h1>
        <div className="section-divider" />
      </header>

      {isLoading ? (
        <p className="works-page__loading">Загрузка...</p>
      ) : (
        <section className="works-grid" aria-label="Сетка работ">
          {works.map((work, i) => (
            <button
              key={work.id}
              className="works-grid__card"
              onClick={() => handleCardClick(work)}
              style={{ '--delay': `${i * 40}ms` } as React.CSSProperties}
              aria-label={work.title}
            >
              <div className="works-grid__img" style={{ backgroundColor: work.color }}>
                <img src={work.src} alt={work.title} />
              </div>
              <div className="works-grid__info">
                <h3 className="works-grid__title">{work.title}</h3>
                <span className="works-grid__cat">{work.category}</span>
              </div>
            </button>
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

      {selected && (
        <div className="work-modal work-modal--open" role="dialog" aria-modal="true">
          <div className="work-modal__overlay" onClick={() => setSelected(null)} />

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
            <button className="work-modal__close" onClick={() => setSelected(null)} aria-label="Закрыть">×</button>
            <div className="work-modal__image" style={{ backgroundColor: selected.color }}>
              <img src={selected.src} alt={selected.title} />
            </div>
            <div className="work-modal__info">
              <h2 className="work-modal__title">{selected.title}</h2>
              <span className="work-modal__category">{selected.category}</span>
              <span className="work-modal__counter">{currentIndex + 1} из {works.length}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default WorksPage;
