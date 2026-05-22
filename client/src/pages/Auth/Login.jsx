// client/src/pages/Login.jsx
import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { UserContext } from "../../../context/userContext";
import tokenManager from "../../utils/tokenManager"; // ✅ Multi-user testing

export default function Login() {
  const navigate = useNavigate();
  const { setUser, user, loading } = useContext(UserContext);

  // ✅ SECURITY: Redirect based on auth status
  useEffect(() => {
    if (!loading) {
      if (user) {
        // Redirect logged-in users to dashboard
        const role = user?.role;
        if (role === "admin") {
          navigate("/admin", { replace: true });
        } else if (role === "staff") {
          navigate("/staff", { replace: true });
        } else {
          navigate("/available-items", { replace: true });
        }
      } else {
        // Redirect logged-out users to GetStarted page (root path)
        navigate("/", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  const [data, setData] = useState({
    email: "",
    password: "",
  });

  const [formErrors, setFormErrors] = useState({});
  const [loading_, setLoading_] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // ✅ SECURITY: Rate limiting - lock after 5 failed attempts
  useEffect(() => {
    if (loginAttempts >= 5) {
      setIsLocked(true);
      // Unlock after 15 minutes
      const timer = setTimeout(() => {
        setLoginAttempts(0);
        setIsLocked(false);
        toast.success("🔓 Account unlocked. Try again.");
      }, 15 * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  // ✅ SECURITY: Input validation
  const validateForm = () => {
    const errors = {};
    
    if (!data.email) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = "Invalid email format";
    }
    
    if (!data.password) {
      errors.password = "Password is required";
    } else if (data.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loginUser = async (e) => {
    e.preventDefault();

    // ✅ SECURITY: Check rate limiting
    if (isLocked) {
      toast.error("🔐 Too many login attempts. Please try again after 15 minutes.");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading_(true);
    try {
      console.log(`⏳ [Login] Attempting login for email: ${data.email}`);
      // ✅ Use axios which is configured with VITE_API_URL from environment
      const res = await axios.post(
        "/api/auth/login",
        { email: data.email.toLowerCase().trim(), password: data.password },
        { withCredentials: true }
      );

      if (res.data.error) {
        setLoginAttempts(prev => prev + 1);
        console.error(`❌ [Login] Error: ${res.data.error}`);
        toast.error(res.data.error);
      } else {
        // ✅ SECURITY: Reset attempts on successful login
        setLoginAttempts(0);
        console.log(`✅ [Login] Login successful for: ${res.data.user?.email}`);
        toast.success("✅ Login successful!");
        const loggedInUser = res.data.user;

        // ✅ Multi-user testing: Store token for this user
        const token = res.data.token || (document.cookie.match(/(?:^|; )token=([^;]*)/)?.[1] || null);
        if (token && loggedInUser.id) {
          tokenManager.addToken(loggedInUser.id, loggedInUser.email, token, {
            name: loggedInUser.name,
            role: loggedInUser.role,
            phone: loggedInUser.phone,
          });
          tokenManager.setActiveToken(loggedInUser.id);
          console.log(`✅ [Login] User token stored: ${loggedInUser.email}`);
        }

        setUser(loggedInUser);
        setData({ email: "", password: "" });
        setFormErrors({});

        // Redirect based on user role
        const role = loggedInUser.role;
        if (role === "admin") {
          navigate("/admin");
        } else if (role === "staff") {
          navigate("/staff");
        } else {
          navigate("/available-items");
        }
      }
    } catch (error) {
      setLoginAttempts(prev => prev + 1);
      console.error("❌ [Login] Catch error:", error.message);
      
      const errorMsg = error.response?.data?.error || "Login failed. Please try again.";
      toast.error(errorMsg);
      
      // Show warning after 3 attempts
      if (loginAttempts >= 2) {
        toast.error(`⚠️ ${5 - loginAttempts - 1} attempts remaining before lock`);
      }
    } finally {
      setLoading_(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is logged in
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-green-600 rounded-full blur-3xl opacity-10"
          animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500 rounded-full blur-3xl opacity-10"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header is now handled by Navbar component */}
        
        {/* Login Form Container */}
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Form Card */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
              {/* Heading */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
                <p className="text-yellow-300 text-sm font-semibold uppercase tracking-wider">Caraga State University</p>
                <p className="text-gray-200 text-xs mt-2">Musical Instruments & Costumes Management System</p>
              </div>

              {/* Security Alert - Rate Limiting */}
              {isLocked && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3 mb-6"
                >
                  <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-200 font-semibold text-sm">🔐 Account Temporarily Locked</p>
                    <p className="text-red-100 text-xs mt-1">Too many failed attempts. Please try again after 15 minutes.</p>
                  </div>
                </motion.div>
              )}

              {/* Form */}
              <form onSubmit={loginUser} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label className="block text-gray-100 font-semibold text-sm mb-2">Email Address</label>
                  <input
                    type="email"
                    className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 transition duration-300 ${
                      formErrors.email ? "border-red-500 focus:ring-red-400" : "border-white/20 focus:ring-yellow-400 focus:border-transparent"
                    }`}
                    placeholder="Enter your email..."
                    value={data.email}
                    onChange={(e) => setData({ ...data, email: e.target.value })}
                    disabled={isLocked || loading_}
                    required
                  />
                  {formErrors.email && <p className="text-red-300 text-xs mt-1">⚠️ {formErrors.email}</p>}
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-gray-100 font-semibold text-sm mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`w-full px-4 py-3 pr-12 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 transition duration-300 ${
                        formErrors.password ? "border-red-500 focus:ring-red-400" : "border-white/20 focus:ring-yellow-400 focus:border-transparent"
                      }`}
                      placeholder="Enter your password..."
                      value={data.password}
                      onChange={(e) => setData({ ...data, password: e.target.value })}
                      disabled={isLocked || loading_}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLocked || loading_}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-gray-100 transition disabled:opacity-50"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-red-300 text-xs mt-1">⚠️ {formErrors.password}</p>}
                </div>

                {/* Remember & Forgot */}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-gray-200 cursor-pointer">
                    <input type="checkbox" className="rounded" />
                    <span>Remember me</span>
                  </label>
                  <a href="#" className="text-yellow-300 hover:text-yellow-200 transition">
                    Forgot password?
                  </a>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading_ || isLocked || formErrors.email || formErrors.password || !data.email || !data.password}
                  className={`w-full mt-6 px-6 py-3 font-bold rounded-lg shadow-xl transition-all duration-300 transform text-sm ${
                    isLocked
                      ? "bg-gray-500 cursor-not-allowed opacity-50 text-gray-300"
                      : loading_
                      ? "bg-yellow-500 text-gray-900 scale-105"
                      : "bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 hover:shadow-2xl hover:scale-105"
                  }`}
                >
                  {loading_ ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin h-5 w-5 border-b-2 border-gray-900"></div>
                      Logging in...
                    </span>
                  ) : isLocked ? (
                    "🔐 Account Locked (15 min)"
                  ) : (
                    "Log In"
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-white/20"></div>
                  <span className="text-gray-300 text-xs">OR</span>
                  <div className="flex-1 h-px bg-white/20"></div>
                </div>

                {/* Google Login */}
                <a
                  href={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/auth/google`}
                  className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </a>
              </form>

              {/* Signup Link */}
              <p className="text-center text-gray-300 text-sm mt-6">
                Don't have an account?{" "}
                <Link to="/register" className="text-yellow-300 font-semibold hover:text-yellow-200 transition">
                  Create one here
                </Link>
              </p>
            </div>

            {/* Security Info */}
            <motion.p
              className="text-center text-gray-300 text-xs mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              🔒 Secure authentication • University verified
            </motion.p>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          className="px-6 py-4 text-center text-gray-300 text-xs border-t border-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <p>© 2025 Caraga State University. Creating Futures. Empowering Communities.</p>
        </motion.div>
      </div>
    </div>
  );
}
