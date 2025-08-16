// src/pages/GetStarted.jsx
import { Link } from "react-router-dom";

export default function GetStarted() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 px-4">
      <h1 className="text-5xl font-bold text-blue-700 mb-6">Welcome to MyApp</h1>
      <p className="text-lg text-gray-700 mb-8 text-center">Securely manage your borrowing experience with ease.</p>
      <div className="space-x-4">
        <Link to="/login" className="px-6 py-3 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition">Login</Link>
        <Link to="/register" className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded shadow hover:bg-blue-50 transition">Register</Link>
      </div>
    </div>
  );
}
