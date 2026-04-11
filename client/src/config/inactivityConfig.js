/**
 * Inactivity Timeout Configuration
 * Controls automatic logout and session management
 */

export const INACTIVITY_CONFIG = {
  // ⏱️ Time of inactivity before logout (in milliseconds)
  INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  
  // ⏱️ Time to show warning before logout (in milliseconds)
  // If set to non-zero, user sees a warning before being logged out
  WARNING_BEFORE_LOGOUT: 2 * 60 * 1000, // 2 minutes warning
  
  // 🔄 Whether to reset inactivity timer on window focus
  RESET_ON_FOCUS: true,
  
  // 🔄 Whether to track activity across all events
  TRACK_ACTIVITY_ON_EVENTS: [
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ],
  
  // 💾 Whether to persist session across page reloads/closing
  PERSIST_SESSION: true,
  
  // 🔑 LocalStorage key for session persistence
  SESSION_KEY: 'user_session_token',
  
  // ⏰ Maximum session duration regardless of activity (optional, set to null to disable)
  // Example: 24 hours = 24 * 60 * 60 * 1000
  MAX_SESSION_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ℹ️ Session states
export const SESSION_STATE = {
  ACTIVE: 'ACTIVE',
  WARNING: 'WARNING',
  EXPIRED: 'EXPIRED',
};
