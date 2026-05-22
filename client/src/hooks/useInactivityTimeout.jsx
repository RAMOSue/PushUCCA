/**
 * useInactivityTimeout Hook
 * 
 * Automatically logs out users after a period of inactivity
 * Keeps users logged in across page reloads/closing (session persistence)
 * 
 * Features:
 * ✅ Tracks user activity (mouse, keyboard, scroll, touch)
 * ✅ Automatic logout after inactivity
 * ✅ Optional warning before logout
 * ✅ Session persistence across page reloads
 * ✅ Resets timer on user activity
 * ✅ Resets timer on window focus
 */

import { useEffect, useRef, useCallback, useContext } from 'react';
import { UserContext } from '../../context/userContext';
import { INACTIVITY_CONFIG, SESSION_STATE } from '../config/inactivityConfig';
import toast from 'react-hot-toast';

export const useInactivityTimeout = () => {
  const { user, setUser } = useContext(UserContext);
  const inactivityTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const hasShownWarningRef = useRef(false);

  /**
   * ❌ Logout user due to inactivity
   */
  const handleInactivityLogout = useCallback(async () => {
    try {
      await fetch('http://localhost:8000/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error during inactivity logout:', error);
    }

    // Clear session persistence
    if (INACTIVITY_CONFIG.PERSIST_SESSION) {
      localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
    }

    setUser(null);
    hasShownWarningRef.current = false;
    
    toast.error('Session expired due to inactivity. Please log in again.', {
      duration: 5000,
      icon: '⏰',
    });
  }, [setUser]);

  /**
   * 🔄 Reset inactivity timer (call on any user activity)
   */
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    hasShownWarningRef.current = false;

    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    // Only set timers if user is logged in
    if (!user) return;

    // Warning timer disabled - no session expiration warning shown to user

    // Set logout timer
    inactivityTimerRef.current = setTimeout(() => {
      handleInactivityLogout();
    }, INACTIVITY_CONFIG.INACTIVITY_TIMEOUT);
  }, [user, handleInactivityLogout]);

  /**
   * 🎯 Handle user activity events
   */
  const handleActivityEvent = useCallback(() => {
    if (user && !hasShownWarningRef.current) {
      resetInactivityTimer();
    }
  }, [user, resetInactivityTimer]);

  /**
   * 🪟 Handle window focus/blur
   */
  useEffect(() => {
    const handleFocus = () => {
      if (INACTIVITY_CONFIG.RESET_ON_FOCUS && user) {
        resetInactivityTimer();
      }
    };

    const handleBlur = () => {
      // Don't reset on blur, just stop the timer from being reset
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [user, resetInactivityTimer]);

  /**
   * 📡 Set up activity event listeners
   */
  useEffect(() => {
    if (!user) {
      // Clear timers if no user
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      return;
    }

    // Initialize timer on login
    resetInactivityTimer();

    // Add event listeners for activity tracking
    INACTIVITY_CONFIG.TRACK_ACTIVITY_ON_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivityEvent);
    });

    return () => {
      // Clean up event listeners
      INACTIVITY_CONFIG.TRACK_ACTIVITY_ON_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivityEvent);
      });

      // Clear timers
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [user, resetInactivityTimer, handleActivityEvent]);

  /**
   * ⏱️ Check for max session duration
   */
  useEffect(() => {
    if (!user || !INACTIVITY_CONFIG.MAX_SESSION_DURATION) return;

    const maxSessionTimer = setInterval(() => {
      const sessionDuration = Date.now() - sessionStartRef.current;
      if (sessionDuration > INACTIVITY_CONFIG.MAX_SESSION_DURATION) {
        toast.error('Your session has expired. Please log in again.', {
          duration: 5000,
          icon: '🔐',
        });
        handleInactivityLogout();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(maxSessionTimer);
  }, [user, handleInactivityLogout]);

  return {
    lastActivity: lastActivityRef.current,
    sessionStart: sessionStartRef.current,
    resetTimer: resetInactivityTimer,
  };
};
