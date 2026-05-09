import React, { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLoginMutation } from '../app/contentApi';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginAdmin, { isLoading }] = useLoginMutation();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      navigate('/works', { replace: true });
    }
  }, [navigate]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const result = await loginAdmin({ login, password }).unwrap();
      localStorage.setItem('admin_token', result.token);
      toast.success('Вход выполнен.');
      navigate('/works', { replace: true });
    } catch (error) {
      const fallback = 'Не удалось войти. Проверьте логин и пароль.';
      if (error && typeof error === 'object') {
        const value = error as { data?: { message?: string } };
        toast.error(value.data?.message ?? fallback);
        return;
      }
      toast.error(fallback);
    }
  };

  return (
    <main className="admin-auth-page">
      <div className="admin-auth-card">
        <div className="admin-auth-card__top">
          <Link to="/" className="btn btn--ghost">На главную</Link>
        </div>
        <h1 className="section-title">Вход в админку</h1>
        <div className="section-divider" />

        <form className="admin-form" onSubmit={onSubmit}>
          <label className="admin-form__field">
            Логин
            <input value={login} onChange={(event) => setLogin(event.target.value)} required />
          </label>
          <label className="admin-form__field">
            Пароль
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" className="btn" disabled={isLoading}>
            {isLoading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </main>
  );
};

export default AdminPage;
