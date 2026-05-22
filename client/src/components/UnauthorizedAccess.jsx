import { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/userContext';
import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * ✅ Security Component: Immediately logs out and redirects to login
 * Triggered when user attempts to access unauthorized routes
 * 
 * ⚠️ CRITICAL: Only renders when loading is FALSE to prevent logout loops
 */
export default function UnauthorizedAccess({ loading = false }) {
  const { setUser } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    // ✅ CRITICAL: Don't perform logout if still loading - prevents logout on unauthenticated initial load
    if (loading) return;

    const performLogout = async () => {
      try {
        // Call backend to invalidate session
        await axios.post('/api/auth/logout');
      } catch (err) {
        console.error('Logout API call failed:', err.message);
      } finally {
        // Clear user state regardless of API success
        setUser(null);
        
        // Show security alert
        toast.error('Unauthorized Access - Session Terminated', {
          duration: 3000,
          icon: '🔒'
        });
        
        // Redirect to login
        navigate('/login');
      }
    };

    performLogout();
  }, [setUser, navigate, loading]);

  // Show loading state while logout is in progress or loading
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#222] rounded-lg p-8 text-center shadow-2xl">
        {loading ? (
          <>
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-900 dark:text-white font-semibold">Checking access...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <p className="text-gray-900 dark:text-white font-semibold mb-2">Logging Out</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Unauthorized access detected. Securing your session...</p>
          </>
        )}
      </div>
    </div>
  );
}
