import React, { useState } from 'react';
import { useReveal } from '../hooks/useReveal';

interface ArtWork {
  id: number;
  title: string;
  category: string;
  color: string; // Заглушка — заменить на реальный src
}

const works: ArtWork[] = [
  { id: 1, title: 'Утренний свет', category: 'Акварель', color: '#e8ddd3' },
  { id: 2, title: 'Тишина', category: 'Графика', color: '#d5d0cb' },
  { id: 3, title: 'Ветер в поле', category: 'Акварель', color: '#e2dcd4' },
  { id: 4, title: 'Набросок. Руки', category: 'Скетч', color: '#ddd8d0' },
  { id: 5, title: 'Старый мост', category: 'Тушь', color: '#d8d3cc' },
  { id: 6, title: 'Море зимой', category: 'Акварель', color: '#dfe0de' },
  { id: 7, title: 'Птица', category: 'Графика', color: '#e5dfda' },
  { id: 8, title: 'Профиль', category: 'Скетч', color: '#dbd5ce' },
];

const GalleryCard: React.FC<{ work: ArtWork; index: number }> = ({
  work,
  index,
}) => {
  const { ref, isVisible } = useReveal<HTMLDivElement>({
    threshold: 0.1,
    delay: index * 100,
  });

  return (
    <div
      ref={ref}
      className={`gallery__card ${isVisible ? 'reveal reveal--visible' : 'reveal'}`}
    >
      {/* Замените div на img с реальным изображением */}
      <div
        className="gallery__image"
        style={{ backgroundColor: work.color }}
        role="img"
        aria-label={work.title}
      >
        {/* <img src={`/images/works/${work.id}.jpg`} alt={work.title} /> */}
        <div className="gallery__image-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b5a99a" strokeWidth="0.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      </div>
      <div className="gallery__info">
        <h3 className="gallery__title">{work.title}</h3>
        <span className="gallery__category">{work.category}</span>
      </div>
    </div>
  );
};

const Gallery: React.FC = () => {
  const { ref: headerRef, isVisible: headerVisible } = useReveal<HTMLDivElement>({
    threshold: 0.3,
  });

  return (
    <section className="gallery" id="gallery">
      <div
        ref={headerRef}
        className={`gallery__header ${headerVisible ? 'reveal reveal--visible' : 'reveal'}`}
      >
        <h2 className="section-title">Работы</h2>
        <div className="section-divider" />
      </div>

      <div className="gallery__grid">
        {works.map((work, i) => (
          <GalleryCard key={work.id} work={work} index={i} />
        ))}
      </div>
    </section>
  );
};

export default Gallery;