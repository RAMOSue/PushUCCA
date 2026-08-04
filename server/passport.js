// server/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

/**
 * Google OAuth Strategy
 * ------------------------------------------------------------
 * This sets up Google authentication for users.
 */

// ✅ Construct callback URL with fallback
const getCallbackURL = () => {
  // Priority 1: Explicit env variable (for local testing)
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  
  // Priority 2: Render-provided URL (production)
  if (process.env.RENDER_EXTERNAL_URL) {
    return `${process.env.RENDER_EXTERNAL_URL}/api/auth/google/callback`;
  }
  
  // Priority 3: Fallback for local development
  return 'http://localhost:8000/api/auth/google/callback';
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: getCallbackURL(),
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || "No Name";

        if (!email) {
          return done(new Error("No email found in Google profile"), null);
        }

        // Return the Google profile only so the callback can prefill the register form
        return done(null, {
          id: null,
          name,
          email,
          provider: "google",
        });
      } catch (err) {
        console.error("❌ Error in GoogleStrategy:", err.message);
        return done(err, null);
      }
    }
  )
);

/**
 * Serialize & Deserialize user
 * ------------------------------------------------------------
 * Required even if you’re not using traditional sessions.
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
