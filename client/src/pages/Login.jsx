// client/src/pages/Login.jsx
import { useState, useContext } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../context/userContext";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);

  const [data, setData] = useState({
    email: "",
    password: "",
  });

  const loginUser = async (e) => {
    e.preventDefault();
    const { email, password } = data;

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      );

      if (res.data.error) {
        toast.error(res.data.error);
      } else {
        toast.success("Login successful!");
        const loggedInUser = res.data.user;

        setUser(loggedInUser);
        setData({ email: "", password: "" });

        // ✅ Redirect based on user role
        const role = loggedInUser.role;
        if (role === "admin") {
          navigate("/admin/dashboard"); // ✅ corrected path
        } else if (role === "staff") {
          navigate("/staff"); // ✅ fixed from /staff/dashboard
        } else {
          navigate("/dashboard"); // borrower default
        }
      }
    } catch (error) {
      console.error("Login error:", error.message);
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gray-100">
      <form
        onSubmit={loginUser}
        className="bg-white shadow-md p-6 rounded w-80"
      >
        <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>

        <label className="block mb-1">Email</label>
        <input
          type="email"
          className="w-full px-3 py-2 border rounded mb-3"
          placeholder="Enter email..."
          value={data.email}
          onChange={(e) => setData({ ...data, email: e.target.value })}
          required
        />

        <label className="block mb-1">Password</label>
        <input
          type="password"
          className="w-full px-3 py-2 border rounded mb-4"
          placeholder="Enter password..."
          value={data.password}
          onChange={(e) => setData({ ...data, password: e.target.value })}
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          Login
        </button>

        <div className="mt-4 text-center">
          <a
            href={`${import.meta.env.VITE_API_URL || window.location.origin}/api/auth/google`}
            className="inline-block px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Login with Google
          </a>
        </div>
      </form>
    </div>
  );
}
