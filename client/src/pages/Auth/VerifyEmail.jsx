// client/src/pages/VerifyEmail.jsx
import { useState, useEffect, useContext } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Clock, RotateCw, ArrowRight } from "lucide-react";
import { UserContext } from "../../../context/userContext";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useContext(UserContext);
  const email = location.state?.email;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  const [canResend, setCanResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Redirect to register if no email
  useEffect(() => {
    if (!email) {
      navigate("/register");
    }
  }, [email, navigate]);

  // Timer for verification code expiry
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (code.length !== 6) {
      toast.error("Verification code must be 6 digits");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post("/api/auth/verify-email", {
        email,
        verificationCode: code,
      });

      // ✅ NEW: Set user in context for automatic login
      if (res.data.user) {
        setUser(res.data.user);
        toast.success("✅ Email verified! Logging in...");
        
        // Redirect based on user role
        const role = res.data.user.role;
        setTimeout(() => {
          if (role === "admin") {
            navigate("/admin/available-items");
          } else if (role === "staff") {
            navigate("/staff/available-items");
          } else {
            navigate("/available-items");
          }
        }, 1500);
      } else {
        toast.success("✅ Email verified! Redirecting to login...");
        setTimeout(() => {
          navigate("/login", { state: { email } });
        }, 2000);
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || "Verification failed. Please try again.";
      toast.error(errorMsg);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);

    try {
      await axios.post("/api/auth/resend-verification", { email });
      toast.success("✅ New verification code sent! Check your email.");
      setTimeLeft(900); // Reset 15 minutes
      setCanResend(false);
      setCode("");
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || "Failed to resend code. Please try again.";
      toast.error(errorMsg);
    } finally {
      setResendLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(value);
  };

  if (!email) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20 shadow-2xl">
          {/* Header */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full mb-4">
              <Mail className="w-8 h-8 text-gray-900" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Verify Email
            </h1>
            <p className="text-gray-200 text-sm">
              Check your inbox for the verification code
            </p>
          </motion.div>

          {/* Email Display */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 text-center"
          >
            <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">
              Verification sent to
            </p>
            <p className="text-yellow-300 font-semibold break-all">{email}</p>
          </motion.div>

          {/* Code Input Form */}
          <motion.form
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            onSubmit={handleVerifyCode}
            className="space-y-6"
          >
            {/* Code Input */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-3">
                6-Digit Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength="6"
                placeholder="000000"
                value={code}
                onChange={handleCodeChange}
                className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-center text-3xl tracking-widest font-bold placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition"
                required
              />
              <p className="text-gray-400 text-xs mt-2 text-center">
                Only numbers allowed
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 disabled:from-gray-500 disabled:to-gray-600 text-gray-900 font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                  Verifying...
                </>
              ) : (
                <>
                  Continue <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </motion.form>

          {/* Timer & Resend Section */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 pt-6 border-t border-white/10"
          >
            {/* Timer */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-yellow-300" />
              <p className="text-gray-300 text-sm">
                Code expires in:{" "}
                <span className="font-bold text-yellow-300">
                  {formatTime(timeLeft)}
                </span>
              </p>
            </div>

            {/* Resend Button */}
            {canResend ? (
              <button
                onClick={handleResendCode}
                disabled={resendLoading}
                className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-yellow-300 hover:text-yellow-200 font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resendLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-b-2 border-yellow-300"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4" />
                    Resend Code
                  </>
                )}
              </button>
            ) : (
              <p className="text-gray-400 text-xs text-center">
                Can resend in {formatTime(timeLeft)}
              </p>
            )}

            {/* Help Text */}
            <p className="text-gray-400 text-xs text-center mt-4">
              Didn't receive the code? Check your spam folder or{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-yellow-300 hover:text-yellow-200 underline"
              >
                go back to register
              </button>
            </p>
          </motion.div>

          {/* Security Notice */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <p className="text-red-200 text-xs leading-relaxed">
              <strong>🔒 Security:</strong> Never share this code with anyone.
              CARSU will never ask for your code via email or phone.
            </p>
          </motion.div>
        </div>

        {/* Footer Help */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-6"
        >
          <p className="text-gray-300 text-xs">
            Having trouble? Email{" "}
            <a
              href="mailto:support@carsu.edu.ph"
              className="text-yellow-300 hover:text-yellow-200"
            >
              support@carsu.edu.ph
            </a>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
