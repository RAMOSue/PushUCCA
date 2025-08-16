// src/components/Layout.jsx
import { useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { UserContext } from '../context/userContext';

export default function Layout() {
  const { user } = useContext(UserContext);
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div>
      {!isAuthPage && user && <Navbar />}
      <main className={!user ? 'flex items-center justify-center h-screen bg-gray-50' : 'p-6'}>
        <Outlet />
      </main>
    </div>
  );
}
