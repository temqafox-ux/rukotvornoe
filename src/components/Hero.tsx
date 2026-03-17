import React, { useEffect, useState } from 'react';

const Hero: React.FC = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleScroll = () => {
    const about = document.getElementById('about');
    about?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero" id="hero">
      {/* 
        Фоновое изображение — замените URL на свою текстуру бумаги или картину.
        Сейчас используется CSS-градиент как заглушка.
      */}
      <div className="hero__bg" />
      <div className="hero__overlay" />

      <div className={`hero__content ${loaded ? 'hero__content--visible' : ''}`}>
        <span className="hero__line" />
        <h1 className="hero__title">Рукотворное</h1>
        <p className="hero__subtitle">
          Искусство, рождённое прикосновением руки
        </p>
        <span className="hero__line" />
      </div>

      <button
        className={`hero__scroll ${loaded ? 'hero__scroll--visible' : ''}`}
        onClick={handleScroll}
        aria-label="Прокрутить вниз"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <path d="M7 10l5 5 5-5" />
        </svg>
      </button>
    </section>
  );
};

export default Hero;