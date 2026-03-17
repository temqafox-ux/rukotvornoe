import React from 'react';
import Hero from '../components/Hero';
import About from '../components/About';
import QuoteBlocks from '../components/QuoteBlocks';
import Contact from '../components/Contact';

const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <About />
      <QuoteBlocks />
      <Contact />
    </>
  );
};

export default HomePage;
