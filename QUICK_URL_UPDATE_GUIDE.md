# QUICK REFERENCE: UPDATING RENDER URLS

## If Your Render URLs Change

When you redeploy or Render changes your URLs, follow this checklist:

### 1. Update Backend .env File
File: `server/.env`

```env
# CHANGE THESE:
NODE_ENV=production
SERVER_URL=https://YOUR-NEW-BACKEND-URL.onrender.com
FRONTEND_URL=https://YOUR-NEW-FRONTEND-URL.onrender.com
GOOGLE_CALLBACK_URL=https://YOUR-NEW-BACKEND-URL.onrender.com/api/auth/google/callback
```

### 2. Update Frontend .env.local File
File: `client/.env.local`

```env
# CHANGE THIS:
VITE_API_URL=https://YOUR-NEW-BACKEND-URL.onrender.com
```

### 3. Update Google OAuth in Google Cloud Console

Go to: https://console.cloud.google.com/

1. Select your project
2. Go to APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID
4. Add new Authorized Redirect URI:
   ```
   https://YOUR-NEW-BACKEND-URL.onrender.com/api/auth/google/callback
   ```

### 4. Git Commit & Push
```bash
git add server/.env client/.env.local
git commit -m "Update Render production URLs"
git push
```

### 5. Redeploy on Render
- Backend: Click "Redeploy"
- Frontend: Click "Redeploy"

---

## Files That AUTO-USE Environment Variables

These files are already configured to use environment variables, no changes needed:

- ✅ `server/index.js` - Uses FRONTEND_URL for CORS
- ✅ `server/passport.js` - Uses GOOGLE_CALLBACK_URL
- ✅ `server/controllers/*.js` - Use SERVER_URL for image URLs
- ✅ `client/src/config/axios.js` - Uses VITE_API_URL
- ✅ `client/src/App.jsx` - Uses VITE_API_URL
- ✅ `client/context/userContext.jsx` - Uses VITE_API_URL
- ✅ All photo components - Dynamically construct URLs from VITE_API_URL

---

## No Hardcoded URLs Remaining

✅ All of these have been REMOVED:
- ❌ `http://localhost:8000` - REMOVED from all frontend components
- ❌ `http://localhost:5173` - REMOVED from backend CORS
- ❌ `127.0.0.1:8000` - REMOVED from frontend
- ❌ Hardcoded image URLs - REPLACED with dynamic construction

---

## Testing After Redeployment

1. Open frontend in browser
2. Open DevTools → Network tab
3. Check that all API requests go to correct backend URL
4. Check that all images load from correct domain
5. Test login and Google OAuth
6. Test image upload and display

---

## Environment Variable Reference

| Variable | Location | Example | Purpose |
|----------|----------|---------|---------|
| `VITE_API_URL` | `client/.env.local` | `https://server-abc123.onrender.com` | Frontend API endpoint |
| `SERVER_URL` | `server/.env` | `https://server-abc123.onrender.com` | Backend for image URLs |
| `FRONTEND_URL` | `server/.env` | `https://frontend-abc123.onrender.com` | Backend CORS/OAuth |
| `NODE_ENV` | `server/.env` | `production` | Enable production features |
| `GOOGLE_CALLBACK_URL` | `server/.env` | `https://server-abc123.onrender.com/api/auth/google/callback` | OAuth redirect |

---

## Environment Priority (What Gets Used First)

1. ✅ `.env.local` (frontend) / `.env` (backend) files
2. ✅ Render environment variables (if set manually)
3. ✅ Hardcoded defaults (for local development)

Since we're using .env files and Render deploys from git, the .env files will be used.
