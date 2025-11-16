// server/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const pool = require("./db"); // ✅ correct relative path
require("dotenv").config();

/**
 * Google OAuth Strategy
 * ------------------------------------------------------------
 * This sets up Google authentication for users.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL || "http://localhost:8000"}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName || "No Name";

        if (!email) return done(new Error("No email found in Google profile"), null);

        // 🔍 Check if the user already exists
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        let user;

        if (result.rows.length > 0) {
          user = result.rows[0];
        } else {
          // 🧩 Insert a new Google user with default role
          const insert = await pool.query(
            `INSERT INTO users (name, email, password, role, phone)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, email, "google-oauth", "borrower", ""]
          );
          user = insert.rows[0];
        }

        return done(null, user);
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
