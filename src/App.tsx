import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import WorksPage from './pages/WorksPage';
import './App.css';

const App: React.FC = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/works" element={<WorksPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
};

export default App;
