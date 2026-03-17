import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

interface ArtWork {
  id: number;
  title: string;
  category: string;
  color: string;
  src: string;
}

const GalleryCard: React.FC<{ work: ArtWork; onOpen: (work: ArtWork) => void }> = ({
  work,
  onOpen,
}) => {
  return (
    <button
      className="gallery__card"
      onClick={() => onOpen(work)}
      aria-label={`Открыть ${work.title}`}
    >
      <div className="gallery__image" style={{ backgroundColor: work.color }}>
        <img src={work.src} alt={work.title} className="gallery__image" />
      </div>
      <div className="gallery__info">
        <h3 className="gallery__title">{work.title}</h3>
        <span className="gallery__category">{work.category}</span>
      </div>
    </button>
  );
};

const GalleryModal: React.FC<{ work: ArtWork | null; onClose: () => void; allWorks: ArtWork[] }> = ({
  work,
  onClose,
  allWorks,
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (!work) return;
      const currentIndex = allWorks.findIndex((w) => w.id === work.id);
      if (e.key === 'ArrowRight' && currentIndex < allWorks.length - 1) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('selectWork', { detail: allWorks[currentIndex + 1] }));
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('selectWork', { detail: allWorks[currentIndex - 1] }));
      }
    };

    if (work) {
      document.addEventListener('keydown', handleEsc);
      document.addEventListener('keydown', handleArrowKeys);
      return () => {
        document.removeEventListener('keydown', handleEsc);
        document.removeEventListener('keydown', handleArrowKeys);
      };
    }
  }, [work, onClose, allWorks]);

  if (!work) return null;

  const currentIndex = allWorks.findIndex((w) => w.id === work.id);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < allWorks.length - 1;

  const handlePrev = () => {
    if (canGoPrev) window.dispatchEvent(new CustomEvent('selectWork', { detail: allWorks[currentIndex - 1] }));
  };
  const handleNext = () => {
    if (canGoNext) window.dispatchEvent(new CustomEvent('selectWork', { detail: allWorks[currentIndex + 1] }));
  };

  return (
    <div className="gallery-modal gallery-modal--open">
      <div className="gallery-modal__overlay" onClick={onClose} />
      <div className="gallery-modal__dialog">
        <button className="gallery-modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        {canGoPrev && (
          <button className="gallery-modal__nav gallery-modal__nav--prev" onClick={handlePrev} aria-label="Предыдущая работа">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {canGoNext && (
          <button className="gallery-modal__nav gallery-modal__nav--next" onClick={handleNext} aria-label="Следующая работа">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
        <div className="gallery-modal__image" style={{ backgroundColor: work.color }} role="img" aria-label={work.title}>
          <img src={work.src} alt={work.title} />
        </div>
        <div className="gallery-modal__info">
          <h2 className="gallery-modal__title">{work.title}</h2>
          <span className="gallery-modal__category">{work.category}</span>
          <span className="gallery-modal__counter">{currentIndex + 1} из {allWorks.length}</span>
        </div>
      </div>
    </div>
  );
};

const Gallery: React.FC = () => {
  const [selectedWork, setSelectedWork] = useState<ArtWork | null>(null);
  const [works, setWorks] = useState<ArtWork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/works.json')
      .then((r) => r.json())
      .then((data) => { setWorks(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => setSelectedWork((e as CustomEvent<ArtWork>).detail);
    window.addEventListener('selectWork', handler);
    return () => window.removeEventListener('selectWork', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selectedWork ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedWork]);

  const scroll = (direction: 'left' | 'right') => {
    if (!gridRef.current) return;
    const amount = 320;
    gridRef.current.scrollTo({
      left: gridRef.current.scrollLeft + (direction === 'left' ? -amount : amount),
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return (
      <section className="gallery" id="gallery">
        <div className="gallery__header">
          <h2 className="section-title">Работы</h2>
          <div className="section-divider" />
        </div>
        <div className="gallery__wrapper">
          <p style={{ padding: '2rem', textAlign: 'center' }}>Загрузка...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="gallery" id="gallery">
      <div className="gallery__header">
        <h2 className="section-title">Работы</h2>
        <div className="section-divider" />
      </div>

      <div className="gallery__wrapper">
        <button className="gallery__nav gallery__nav--left" onClick={() => scroll('left')} aria-label="Предыдущие работы">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        <div className="gallery__grid" ref={gridRef}>
          {works.map((work) => (
            <GalleryCard key={work.id} work={work} onOpen={setSelectedWork} />
          ))}
        </div>

        <button className="gallery__nav gallery__nav--right" onClick={() => scroll('right')} aria-label="Следующие работы">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="gallery__actions">
        <Link to="/works" className="btn btn--primary">Все работы</Link>
      </div>

      <GalleryModal work={selectedWork} onClose={() => setSelectedWork(null)} allWorks={works} />
    </section>
  );
};

export default Gallery;
