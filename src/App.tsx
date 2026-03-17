import React from 'react';
import Hero from './components/Hero';
import About from './components/About';
import Gallery from './components/Gallery';
import Contact from './components/Contact';
import './App.css';

const App: React.FC = () => {
  return (
    <main>
      <Hero />
      <About />
      <Gallery />
      <Contact />
    </main>
  );
};

export default App;