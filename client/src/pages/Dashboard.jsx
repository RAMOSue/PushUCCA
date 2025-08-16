// client/src/pages/Dashboard.jsx
import React, { useContext, useEffect } from "react";
import { UserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";
import DashboardBorrower from "./DashboardBorrower";
import DashboardStaff from "./DashboardStaff";
import DashboardAdmin from "./DashboardAdmin";

export default function Dashboard() {
  const { user, loading } = useContext(UserContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user === null) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">
        Hi, {user.name}!
      </h1>

      {/* Render dashboard content based on role */}
      {user.role === "borrower" && <DashboardBorrower />}
      {user.role === "staff" && <DashboardStaff />}
      {user.role === "admin" && <DashboardAdmin />}
    </div>
  );
}
