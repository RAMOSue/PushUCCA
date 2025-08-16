// client/src/pages/AdminUserManagement.jsx
import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function AdminUserManagement() {
  const { user, loading } = useContext(UserContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);

  // ✅ Only allow admin to view this page
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      toast.error("Access denied. Admins only.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // ✅ Fetch all users
  const fetchUsers = async () => {
    try {
      const res = await axios.get("/api/auth/admin/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error.message);
      toast.error("Failed to load users.");
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
    }
  }, [user]);

  // ✅ Handle role update
  const updateRole = async (id, newRole) => {
    try {
      const res = await axios.put(`/api/auth/admin/users/${id}/role`, { role: newRole });
      toast.success("Role updated");
      // Update UI
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
      );
    } catch (error) {
      console.error("Error updating role:", error.message);
      toast.error("Failed to update role.");
    }
  };

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-blue-600">User Role Management</h2>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Email</th>
            <th className="border px-4 py-2">Current Role</th>
            <th className="border px-4 py-2">Change Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border px-4 py-2">{u.id}</td>
              <td className="border px-4 py-2">{u.name}</td>
              <td className="border px-4 py-2">{u.email}</td>
              <td className="border px-4 py-2 capitalize">{u.role}</td>
              <td className="border px-4 py-2">
                <select
                  value={u.role}
                  onChange={(e) => updateRole(u.id, e.target.value)}
                  className="border px-2 py-1 rounded"
                >
                  <option value="borrower">Borrower</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
