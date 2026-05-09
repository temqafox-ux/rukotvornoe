import React, { useEffect, useRef, useState } from 'react';
import Hero from '../components/Hero';
import About from '../components/About';
import QuoteBlocks from '../components/QuoteBlocks';
import Contact from '../components/Contact';

const HomePage: React.FC = () => {
  const [isContactCtaVisible, setIsContactCtaVisible] = useState(false);
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false);
  const ctaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const threshold = Math.max(220, window.innerHeight * 0.92);
      setIsContactCtaVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    if (isContactCtaVisible) return;
    setIsContactMenuOpen(false);
  }, [isContactCtaVisible]);

  useEffect(() => {
    if (!isContactMenuOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && ctaRef.current?.contains(target)) return;
      setIsContactMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsContactMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isContactMenuOpen]);

  return (
    <>
      <Hero />
      <About />
      <QuoteBlocks />
      <Contact />
      <div
        ref={ctaRef}
        className={`home-contact-cta ${isContactMenuOpen ? 'home-contact-cta--open' : ''} ${isContactCtaVisible ? 'home-contact-cta--visible' : ''}`}
        aria-hidden={!isContactCtaVisible}
      >
        {isContactMenuOpen && (
          <div className="home-contact-cta__menu" role="menu" aria-label="Быстрые контакты">
            <a
              className="home-contact-cta__link"
              role="menuitem"
              href="https://t.me/rukotvornoe_yana"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsContactMenuOpen(false)}
            >
              Telegram
            </a>
            <a
              className="home-contact-cta__link"
              role="menuitem"
              href="mailto:elfin.v@gmail.com"
              onClick={() => setIsContactMenuOpen(false)}
            >
              Email
            </a>
            <a
              className="home-contact-cta__link"
              role="menuitem"
              href="https://instagram.com/gulyai_shalnaya"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsContactMenuOpen(false)}
            >
              Instagram
            </a>
          </div>
        )}
        <button
          type="button"
          className="btn home-contact-cta__btn"
          onClick={() => setIsContactMenuOpen((open) => !open)}
          aria-expanded={isContactMenuOpen}
          aria-haspopup="menu"
        >
          <span className="home-contact-cta__icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </span>
          <span>Связаться</span>
          <span className="home-contact-cta__pulse" aria-hidden="true" />
        </button>
      </div>
    </>
  );
};

export default HomePage;
