import React from 'react';
import { useReveal } from '../hooks/useReveal';

const About: React.FC = () => {
  const { ref: sectionRef, isVisible } = useReveal<HTMLElement>({
    threshold: 0.2,
  });

  const { ref: imageRef, isVisible: imgVisible } = useReveal<HTMLDivElement>({
    threshold: 0.3,
    delay: 200,
  });

  const { ref: textRef, isVisible: textVisible } = useReveal<HTMLDivElement>({
    threshold: 0.3,
    delay: 400,
  });

  return (
    <section className="about" id="about" ref={sectionRef}>
      <div className="about__container">
        <div
          ref={imageRef}
          className={`about__image-wrap ${imgVisible ? 'reveal reveal--visible' : 'reveal'}`}
        >
          <img src="/images/photo.jpg" alt="Яна - автор" className="about__image" />
        </div>

        <div
          ref={textRef}
          className={`about__text ${textVisible ? 'reveal reveal--visible' : 'reveal'}`}
        >
          <h2 className="section-title">Об авторе</h2>
          <div className="about__divider" />
          <p>
            Меня зовут Яна. Я&nbsp;рисую то, что чувствую&nbsp;— линии,
            которые рождаются сами, цвета, которые приходят из&nbsp;тишины.
          </p>
          <p>
            Каждая работа создаётся вручную: акварель, графитный карандаш,
            тушь на&nbsp;бумаге. Никаких цифровых инструментов&nbsp;— только
            прикосновение руки и&nbsp;дыхание момента.
          </p>
        </div>
      </div>
    </section>
  );
};

export default About;