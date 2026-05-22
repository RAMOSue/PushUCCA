import { useState, useContext, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { UserContext } from "../../../context/userContext";

export default function Register() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useContext(UserContext);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [data, setData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  // ✅ SECURITY: Redirect logged-in users away from register page
  useEffect(() => {
    if (!authLoading && user) {
      const role = user?.role;
      if (role === "admin") {
        navigate("/admin/available-items", { replace: true });
      } else if (role === "staff") {
        navigate("/staff/available-items", { replace: true });
      } else {
        navigate("/available-items", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  // Show loading state
  if (authLoading) {
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

  // ✅ NEW: Email domain validation
  const ALLOWED_DOMAINS = ["@carsu.edu.ph", "@gmail.com"];
  const isValidEmail = (email) => {
    return ALLOWED_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
  };

  const getEmailStatus = () => {
    if (!data.email) return null;
    if (isValidEmail(data.email)) {
      return { valid: true, message: "✓ Valid email" };
    }
    return {
      valid: false,
      message: `Only ${ALLOWED_DOMAINS.join(" or ")} emails are allowed`,
    };
  };

  const emailStatus = getEmailStatus();

  // ✅ SECURITY: Validate form inputs
  const validateForm = () => {
    const errors = {};

    if (!data.name.trim()) {
      errors.name = "Name is required";
    } else if (data.name.length < 2) {
      errors.name = "Name must be at least 2 characters";
    } else if (data.name.length > 100) {
      errors.name = "Name must be less than 100 characters";
    }

    if (!data.email) {
      errors.email = "Email is required";
    } else if (!isValidEmail(data.email)) {
      errors.email = "Only @carsu.edu.ph or @gmail.com emails allowed";
    }

    if (!data.password) {
      errors.password = "Password is required";
    } else if (data.password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(data.password)) {
      errors.password = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(data.password)) {
      errors.password = "Password must contain at least one lowercase letter";
    } else if (!/\d/.test(data.password)) {
      errors.password = "Password must contain at least one number";
    } else if (!/[!@#$%^&*]/.test(data.password)) {
      errors.password = "Password must contain at least one special character (!@#$%^&*)";
    }

    if (!data.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^[0-9+-]{10,}$/.test(data.phone.trim())) {
      errors.phone = "Invalid phone number format";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const registerUser = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const { name, email, password, phone } = data;

    if (!name || !email || !password || !phone) {
      toast.error("Please fill in all fields");
      return;
    }

    // ✅ NEW: Validate allowed email domains
    if (!isValidEmail(email)) {
      toast.error(`Only ${ALLOWED_DOMAINS.join(" or ")} emails are allowed`);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post("/api/auth/register", {
        name,
        email,
        password,
        phone,
      });

      if (res.data.error) {
        toast.error(res.data.error);
      } else {
        toast.success("✅ Check your email for verification code!");
        setData({ name: "", email: "", password: "", phone: "" });
        // ✅ NEW: Redirect to verification page instead of login
        navigate("/verify-email", { state: { email } });
      }
    } catch (error) {
      console.error(error);
      const errorMsg =
        error.response?.data?.error ||
        "Something went wrong. Please try again.";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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
        {/* Header */}
        <motion.div
          className="px-6 py-4 flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
         

          
        </motion.div>

        {/* Registration Form Container */}
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
                <h1 className="text-3xl font-bold text-white mb-2">
                  Create Account
                </h1>
                <p className="text-yellow-300 text-sm font-semibold uppercase tracking-wider">
                  Join Our Community
                </p>
                <p className="text-gray-200 text-xs mt-2">
                  Musical Instruments & Costumes Management System
                </p>
              </div>

              {/* ✅ NEW: Allowed Email Domains Notice */}
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                <p className="text-blue-200 text-xs leading-relaxed">
                  <strong>ℹ️ Email Required:</strong> You can register with{" "}
                  <strong>@carsu.edu.ph</strong> or <strong>@gmail.com</strong> email
                  addresses.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={registerUser} className="space-y-4">
                {/* Full Name Field */}
                <div>
                  <label className="block text-gray-100 font-semibold text-sm mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={data.name}
                    onChange={(e) =>
                      setData({ ...data, name: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition duration-300"
                  />
                </div>

                {/* Email Field with Validation */}
                <div>
                  <label className="block text-gray-100 font-semibold text-sm mb-2">
                    School Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="example@carsu.edu.ph"
                      value={data.email}
                      onChange={(e) =>
                        setData({ ...data, email: e.target.value })
                      }
                      required
                      className={`w-full px-4 py-3 pr-10 bg-white/10 border rounded-lg text-white placeholder-gray-300 focus:outline-none focus:border-transparent transition duration-300 ${
                        emailStatus
                          ? emailStatus.valid
                            ? "border-green-400 focus:ring-2 focus:ring-green-400"
                            : "border-red-400 focus:ring-2 focus:ring-red-400"
                          : "border-white/20 focus:ring-2 focus:ring-yellow-400"
                      }`}
                    />
                    {/* ✅ NEW: Email validation icon */}
                    {emailStatus && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        {emailStatus.valid ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {/* ✅ NEW: Email status message */}
                  {emailStatus && (
                    <p
                      className={`text-xs mt-2 ${
                        emailStatus.valid
                          ? "text-green-300"
                          : "text-red-300"
                      }`}
                    >
                      {emailStatus.message}
                    </p>
                  )}
                </div>

                {/* Phone Field */}
                <div>
                  <label className="block text-gray-100 font-semibold text-sm mb-2">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your phone number"
                    value={data.phone}
                    onChange={(e) =>
                      setData({ ...data, phone: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition duration-300"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-gray-100 font-semibold text-sm mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={data.password}
                      onChange={(e) =>
                        setData({ ...data, password: e.target.value })
                      }
                      required
                      className="w-full px-4 py-3 pr-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 hover:text-gray-100 transition"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-2 text-xs text-gray-200 cursor-pointer">
                  <input type="checkbox" className="mt-1" required />
                  <span>I agree to the Terms of Service and Privacy Policy</span>
                </label>

                {/* Register Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 font-bold rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-white/20"></div>
                  <span className="text-gray-300 text-xs">OR</span>
                  <div className="flex-1 h-px bg-white/20"></div>
                </div>

                {/* Google Register */}
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
                  Sign up with Google
                </a>
              </form>

              {/* Login Link */}
              <p className="text-center text-gray-300 text-sm mt-6">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-yellow-300 font-semibold hover:text-yellow-200 transition"
                >
                  Sign in here
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
              🔒 Your data is secure • University protected
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
          <p>
            © 2025 Caraga State University. Creating Futures. Empowering
            Communities.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
