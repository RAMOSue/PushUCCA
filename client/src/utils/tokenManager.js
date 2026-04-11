/**
 * Token Manager - Manage multiple user tokens for testing
 * Allows storing and switching between multiple logged-in users
 * 
 * Usage:
 *   - Store tokens: tokenManager.addToken(userId, email, token)
 *   - Switch users: tokenManager.setActiveToken(userId)
 *   - Get active: tokenManager.getActiveToken()
 *   - Remove user: tokenManager.removeToken(userId)
 */

class TokenManager {
  constructor() {
    this.STORAGE_KEY = "multi_user_tokens";
    this.ACTIVE_TOKEN_KEY = "active_user_id";
    this.loadTokens();
  }

  /**
   * Load tokens from localStorage
   */
  loadTokens() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.tokens = stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error("❌ Failed to load tokens:", e);
      this.tokens = {};
    }
  }

  /**
   * Save tokens to localStorage
   */
  saveTokens() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tokens));
    } catch (e) {
      console.error("❌ Failed to save tokens:", e);
    }
  }

  /**
   * Add/update a token for a user
   * @param {number} userId - User ID
   * @param {string} email - User email
   * @param {string} token - JWT token
   * @param {object} userData - User data (name, role, phone, etc.)
   */
  addToken(userId, email, token, userData = {}) {
    this.tokens[userId] = {
      userId,
      email,
      token,
      userData: {
        id: userId,
        email,
        ...userData,
      },
      addedAt: new Date().toISOString(),
    };
    this.saveTokens();
    console.log(`✅ Token added for user: ${email} (ID: ${userId})`);
    return this.tokens[userId];
  }

  /**
   * Get all stored tokens/users
   */
  getAllUsers() {
    return Object.values(this.tokens).map((t) => ({
      userId: t.userId,
      email: t.email,
      name: t.userData?.name || "Unknown",
      role: t.userData?.role || "unknown",
      addedAt: t.addedAt,
    }));
  }

  /**
   * Set the currently active user/token
   * @param {number} userId - User ID to make active
   */
  setActiveToken(userId) {
    if (!this.tokens[userId]) {
      console.warn(`⚠️ No token found for user ID: ${userId}`);
      return null;
    }
    localStorage.setItem(this.ACTIVE_TOKEN_KEY, userId.toString());
    console.log(`✅ Switched to user: ${this.tokens[userId].email}`);
    return this.tokens[userId];
  }

  /**
   * Get currently active token
   */
  getActiveToken() {
    const activeId = localStorage.getItem(this.ACTIVE_TOKEN_KEY);
    if (!activeId) return null;
    
    const token = this.tokens[activeId];
    if (!token) {
      // Active user was removed, clear the active token
      localStorage.removeItem(this.ACTIVE_TOKEN_KEY);
      return null;
    }
    return token;
  }

  /**
   * Get active token string (for axios headers)
   */
  getActiveTokenString() {
    const token = this.getActiveToken();
    return token ? token.token : null;
  }

  /**
   * Get active user data
   */
  getActiveUser() {
    const token = this.getActiveToken();
    return token ? token.userData : null;
  }

  /**
   * Remove a user's token
   * @param {number} userId - User ID to remove
   */
  removeToken(userId) {
    if (this.tokens[userId]) {
      const email = this.tokens[userId].email;
      delete this.tokens[userId];
      this.saveTokens();
      
      // If this was the active user, clear active token
      if (localStorage.getItem(this.ACTIVE_TOKEN_KEY) === userId.toString()) {
        localStorage.removeItem(this.ACTIVE_TOKEN_KEY);
      }
      
      console.log(`✅ Token removed for user: ${email}`);
      return true;
    }
    return false;
  }

  /**
   * Clear all tokens
   */
  clearAll() {
    this.tokens = {};
    this.saveTokens();
    localStorage.removeItem(this.ACTIVE_TOKEN_KEY);
    console.log("✅ All tokens cleared");
  }

  /**
   * Check if a user is stored
   */
  hasUser(userId) {
    return !!this.tokens[userId];
  }

  /**
   * Get total number of stored users
   */
  count() {
    return Object.keys(this.tokens).length;
  }

  /**
   * Debug: Print all stored users
   */
  debug() {
    console.log("📋 Stored Users:");
    this.getAllUsers().forEach((u) => {
      const isActive = localStorage.getItem(this.ACTIVE_TOKEN_KEY) === u.userId.toString();
      console.log(
        `${isActive ? "✅" : "  "} ID: ${u.userId} | ${u.email} | Role: ${u.role} | Added: ${new Date(u.addedAt).toLocaleTimeString()}`
      );
    });
    const activeUserData = this.getActiveUser();
    console.log(`🔑 Active User: ${activeUserData?.email || "None"}`);
  }
}

// Export singleton instance
const tokenManager = new TokenManager();
export default tokenManager;
