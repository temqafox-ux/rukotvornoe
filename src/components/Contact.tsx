import React, { useState, FormEvent } from 'react';
import { useReveal } from '../hooks/useReveal';

const Contact: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  const { ref: headerRef, isVisible: headerVisible } = useReveal<HTMLDivElement>({
    threshold: 0.3,
  });

  const { ref: contentRef, isVisible: contentVisible } = useReveal<HTMLDivElement>({
    threshold: 0.2,
    delay: 200,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Здесь подключить отправку (EmailJS / Formspree / свой бэкенд)
    console.log('Form submitted:', form);
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setForm({ name: '', email: '', message: '' });
  };

  return (
    <section className="contact" id="contact">
      <div
        ref={headerRef}
        className={`contact__header ${headerVisible ? 'reveal reveal--visible' : 'reveal'}`}
      >
        <h2 className="section-title">Контакты</h2>
        <div className="section-divider" />
      </div>

      <div
        ref={contentRef}
        className={`contact__content ${contentVisible ? 'reveal reveal--visible' : 'reveal'}`}
      >
        <div className="contact__info">
          <div className="contact__item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <a href="mailto:hello@rukotvoroe.art">hello@rukotvoroe.art</a>
          </div>

          <div className="contact__socials">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="contact__social-link"
              aria-label="Instagram"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="https://t.me/rukotvornoe_yana"
              target="_blank"
              rel="noopener noreferrer"
              className="contact__social-link"
              aria-label="Telegram"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 3L1 10l7 3m13-10l-7 14-6-7m13-7l-13 7" />
              </svg>
            </a>
          </div>
        </div>

        <form className="contact__form" onSubmit={handleSubmit}>
          <h3 className="contact__form-title">Написать автору</h3>

          <div className="contact__field">
            <input
              type="text"
              placeholder="Ваше имя"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="contact__field">
            <input
              type="email"
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="contact__field">
            <textarea
              placeholder="Сообщение"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="contact__submit" disabled={sent}>
            {sent ? 'Отправлено ✓' : 'Отправить'}
          </button>
        </form>
      </div>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Рукотворное</span>
      </footer>
    </section>
  );
};

export default Contact;