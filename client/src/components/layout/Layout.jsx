// src/components/Layout.jsx
import { useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../navigation/Navbar';
import { UserContext } from '../../../context/userContext';

export default function Layout() {
  const { user } = useContext(UserContext);
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div>
      {!isAuthPage && user && <Navbar />}
      <main className={!user ? 'flex items-center justify-center h-screen bg-gray-50 dark:bg-[#171717]' : 'p-6 dark:bg-[#171717]'}>
        <Outlet />
      </main>
    </div>
  );
}
