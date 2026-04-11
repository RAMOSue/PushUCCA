// client/src/pages/Admin/AdminUserManagement.jsx
import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Users, Mail, Shield, Trash2, Search, Building } from "lucide-react";

export default function AdminUserManagement() {
  const { user, loading } = useContext(UserContext);
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userLoading, setUserLoading] = useState(true);

  // ✅ Only allow admin to view this page
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      toast.error("Access denied. Admins only.");
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // ✅ Fetch divisions
  const fetchDivisions = async () => {
    try {
      const res = await axios.get("/api/master-list/units");
      setDivisions(res.data);
    } catch (error) {
      console.error("Error fetching divisions:", error.message);
    }
  };

  // ✅ Fetch all users
  const fetchUsers = async () => {
    try {
      setUserLoading(true);
      const res = await axios.get("/api/auth/admin/users");
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error.message);
      toast.error("Failed to load users.");
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers();
      fetchDivisions();
    }
  }, [user]);

  // ✅ Handle role update
  const updateRole = async (id, newRole) => {
    try {
      await axios.put(`/api/auth/admin/users/${id}/role`, { role: newRole });
      toast.success("Role updated");
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
      );
    } catch (error) {
      console.error("Error updating role:", error.message);
      toast.error("Failed to update role.");
    }
  };

  // ✅ Handle division update
  const updateDivision = async (id, newDivisionId) => {
    try {
      await axios.put(`/api/auth/admin/users/${id}/division`, { 
        division_id: newDivisionId === "" ? null : newDivisionId 
      });
      toast.success("Division updated");
      setUsers((prev) =>
        prev.map((u) => 
          u.id === id ? { ...u, division_id: newDivisionId === "" ? null : newDivisionId } : u
        )
      );
    } catch (error) {
      console.error("Error updating division:", error.message);
      toast.error("Failed to update division.");
    }
  };

  // 🗑️ Handle delete user
  const deleteUser = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this user?");
    if (!confirmDelete) return;

    try {
      await axios.delete(`/api/auth/admin/users/${id}`);
      toast.success("User deleted successfully.");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (error) {
      console.error("Error deleting user:", error.message);
      toast.error("Failed to delete user.");
    }
  };

  // ✅ Filter users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.department_name && u.department_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchRole = roleFilter === "all" || u.role === roleFilter;

    return matchSearch && matchRole;
  });

  // ✅ Stats
  const totalUsers = users.length;
  const staffCount = users.filter((u) => u.role === "staff").length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const borrowerCount = users.filter((u) => u.role === "borrower").length;

  if (loading || userLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717]">
        {/* ========== HEADER ========== */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface mb-2">
                User Management
              </h1>
              <p className="text-on-surface-variant text-sm">
                Manage roles, divisions, and permissions for all users
              </p>
            </div>

            {/* Stats Pills */}
            <div className="flex gap-3 flex-wrap items-center justify-end">
              <div className="px-4 py-2 bg-surface-container-low rounded-full text-sm font-medium text-on-surface border border-outline-variant/20 whitespace-nowrap">
                Total: <span className="font-bold text-primary">{totalUsers}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low rounded-full text-sm font-medium text-on-surface border border-outline-variant/20 whitespace-nowrap">
                Staff: <span className="font-bold text-primary">{staffCount}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low rounded-full text-sm font-medium text-on-surface border border-outline-variant/20 whitespace-nowrap">
                Admin: <span className="font-bold text-primary">{adminCount}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low rounded-full text-sm font-medium text-on-surface border border-outline-variant/20 whitespace-nowrap">
                Borrower: <span className="font-bold text-primary">{borrowerCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== SEARCH & FILTERS ========== */}
        <div className="px-6 md:px-8 lg:px-12 space-y-4">
          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-surface-container-low rounded-lg px-4 py-3 border border-transparent hover:border-primary/20 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition shadow-sm">
            <Search className="w-5 text-on-surface-variant flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email, or division..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-2 text-on-surface-variant hover:text-on-surface transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-surface-container-low border border-outline-variant/30 rounded-lg text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="borrower">Borrower</option>
            </select>
          </div>
        </div>

        {/* ========== TABLE ========== */}
        <div className="px-6 md:px-8 lg:px-12 mt-6">
          <div className="bg-surface-container-low rounded-xl shadow-sm border border-outline-variant/10 overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
                <p className="text-on-surface-variant text-sm">
                  {searchQuery ? "No users match your search" : "No users found"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-container-lowest border-b border-outline-variant/20">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-on-surface">Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-on-surface">Email</th>
                      <th className="text-left px-4 py-3 font-semibold text-on-surface">Role</th>
                      <th className="text-left px-4 py-3 font-semibold text-on-surface">Division</th>
                      <th className="text-left px-4 py-3 font-semibold text-on-surface">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-outline-variant/10 hover:bg-surface-container-high transition">
                        <td className="px-4 py-3 text-on-surface font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-on-surface flex items-center gap-2">
                          <Mail className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => updateRole(u.id, e.target.value)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-primary transition ${
                              u.role === "admin"
                                ? "bg-error/15 border-error/30 text-error"
                                : u.role === "staff"
                                ? "bg-primary/15 border-primary/30 text-primary"
                                : "bg-surface-container-high border-outline-variant/30 text-on-surface"
                            }`}
                          >
                            <option value="admin">Admin</option>
                            <option value="staff">Staff</option>
                            <option value="borrower">Borrower</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.division_id || ""}
                            onChange={(e) => updateDivision(u.id, e.target.value)}
                            className="flex items-center gap-2 px-3 py-1 rounded-lg border border-outline-variant/30 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition bg-surface-container-high"
                          >
                            <option value="">Unassigned</option>
                            {divisions.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteUser(u.id)}
                            className="p-2 hover:bg-error/10 text-error rounded-lg transition"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
