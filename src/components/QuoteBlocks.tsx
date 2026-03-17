import React from 'react';
import { Link } from 'react-router-dom';

type QuoteItem = {
  id: string;
  quote: string;
  author?: string;
  imageSrc: string;
  alt: string;
};

const items: QuoteItem[] = [
  {
    id: 'q1',
    quote: 'Линия — это след дыхания. В ней слышно то, что не сказать словами.',
    author: 'Яна',
    imageSrc: '/images/6.jpg',
    alt: 'Цитата — линия дыхания',
  },
  {
    id: 'q2',
    quote: 'Цвет приходит из тишины — как будто бумага сама подсказывает тон.',
    author: 'Яна',
    imageSrc: '/images/7.jpg',
    alt: 'Цитата — цвет из тишины',
  },
  {
    id: 'q3',
    quote: 'Каждая работа — встреча. Я просто оставляю место для чувства.',
    author: 'Яна',
    imageSrc: '/images/8.jpg',
    alt: 'Цитата — место для чувства',
  },
];

const QuoteCard: React.FC<{ item: QuoteItem; index: number }> = ({ item }) => {
  return (
    <article className="quotes__card" aria-label="Цитата">

      <div className="quotes__media" aria-hidden="true">
        <img className="quotes__img" src={item.imageSrc} alt={item.alt} />
        <div className="quotes__veil" />
      </div>
      <div className="quotes__content">
        <p className="quotes__quote">&laquo;{item.quote}&raquo;</p>
        {item.author && <p className="quotes__author">— {item.author}</p>}
      </div>
    </article>
  );
};

const QuoteBlocks: React.FC = () => {
  return (
    <section className="quotes" aria-label="Цитаты">
      <div className="quotes__header">
        <h2 className="section-title">Слова о процессе</h2>
        <div className="section-divider" />
      </div>

      <div className="quotes__track" aria-label="Лента цитат">
        {items.map((item, index) => (
          <QuoteCard key={item.id} item={item} index={index} />
        ))}
      </div>

      <div className="quotes__actions">
        <Link to="/works" className="btn btn--primary">Все работы</Link>
      </div>
    </section>
  );
};

export default QuoteBlocks;
