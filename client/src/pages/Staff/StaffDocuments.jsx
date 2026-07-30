import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../../context/userContext";
import { ArrowLeft, Check, X, Eye, Download, Filter } from "lucide-react";
import PageLayout from "../../components/layout/PageLayout";
import ImagePreviewModal from "../../components/modals/ImagePreviewModal";
import toast from "react-hot-toast";

export default function StaffDocuments() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [previewModal, setPreviewModal] = useState({ isOpen: false, imageUrl: "", fileName: "" });

  const documentTypes = [
    { key: "profile_pic", label: "Profile Pic", icon: "📷" },
    { key: "birth_certificate", label: "Birth Certificate", icon: "📋" },
    { key: "class_schedule", label: "Class Schedule", icon: "📅" },
    { key: "id_front", label: "ID Front", icon: "🆔" },
    { key: "id_back", label: "ID Back", icon: "🔙" },
  ];

  useEffect(() => {
    if (user?.role === "staff" || user?.role === "admin") {
      fetchAllProfiles();
    }
  }, [user]);

  async function fetchAllProfiles() {
    try {
      setLoading(true);
      const res = await axios.get("/api/profiles/all", { withCredentials: true });
      setProfiles(res.data);
      applyFilters(res.data, searchTerm, selectedStatusFilter);
    } catch (err) {
      console.error("Failed to fetch profiles:", err.response?.data || err.message);
      toast.error("Failed to load user documents");
    } finally {
      setLoading(false);
    }
  }

  const getDocumentStatus = (profile) => {
    const docs = ["profile_pic", "birth_certificate", "class_schedule", "id_front", "id_back"];
    const uploaded = docs.filter(doc => profile[`${doc}_url`]).length;
    const total = docs.length;
    
    if (uploaded === total) return "complete";
    if (uploaded === 0) return "empty";
    return "partial";
  };

  const getDocumentCount = (profile) => {
    const docs = ["profile_pic", "birth_certificate", "class_schedule", "id_front", "id_back"];
    return docs.filter(doc => profile[`${doc}_url`]).length;
  };

  const applyFilters = (data, search, status) => {
    let filtered = data;

    // Search by name or email
    if (search.trim()) {
      filtered = filtered.filter(p =>
        (p.name?.toLowerCase().includes(search.toLowerCase())) ||
        (p.email?.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Filter by document status
    if (status !== "all") {
      filtered = filtered.filter(p => getDocumentStatus(p) === status);
    }

    setFilteredProfiles(filtered);
  };

  const handleSearch = (val) => {
    setSearchTerm(val);
    applyFilters(profiles, val, selectedStatusFilter);
  };

  const handleStatusFilter = (val) => {
    setSelectedStatusFilter(val);
    applyFilters(profiles, searchTerm, val);
  };

  const handleDownloadFile = async (filePath, fileName) => {
    try {
      await axios.get("/api/profiles/download", {
        params: { path: filePath },
        withCredentials: true,
        responseType: "blob",
      });
      toast.success(`Downloaded: ${fileName}`);
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Download failed");
    }
  };

  if (!user || (user.role !== "staff" && user.role !== "admin")) {
    return (
      <PageLayout>
        <div className="text-center py-12">
          <p className="text-red-600 font-semibold">Access Denied: Staff/Admin only</p>
        </div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin">⏳ Loading documents...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Document Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              View and manage all user documents
            </p>
          </div>
          <button
            onClick={() => navigate("/staff/manage-requests")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            title="Go back"
          >
            <ArrowLeft size={20} />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{profiles.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Complete</p>
            <p className="text-2xl font-bold text-green-600">
              {profiles.filter(p => getDocumentStatus(p) === "complete").length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Partial</p>
            <p className="text-2xl font-bold text-yellow-600">
              {profiles.filter(p => getDocumentStatus(p) === "partial").length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">Empty</p>
            <p className="text-2xl font-bold text-red-600">
              {profiles.filter(p => getDocumentStatus(p) === "empty").length}
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search by Name or Email
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type here..."
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Status
              </label>
              <select
                value={selectedStatusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="complete">✅ Complete (5/5)</option>
                <option value="partial">🟡 Partial</option>
                <option value="empty">⚪ Empty (0/5)</option>
              </select>
            </div>

            {/* Results Count */}
            <div className="flex items-end">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-bold">{filteredProfiles.length}</span> of{" "}
                <span className="font-bold">{profiles.length}</span> users
              </p>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-600 dark:text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      {/* User Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {profile.profile_pic_url ? (
                            <img
                              src={profile.profile_pic_url}
                              alt={profile.name}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                {profile.name?.charAt(0)?.toUpperCase() || "U"}
                              </span>
                            </div>
                          )}
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {profile.name || "Unknown"}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 truncate">
                        {profile.email || "—"}
                      </td>

                      {/* Department */}
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {profile.department_name || "—"}
                      </td>

                      {/* Documents Count */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {getDocumentCount(profile)}/5
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4 text-center">
                        {getDocumentStatus(profile) === "complete" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            <Check size={16} /> Complete
                          </span>
                        )}
                        {getDocumentStatus(profile) === "partial" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                            <Filter size={16} /> Partial
                          </span>
                        )}
                        {getDocumentStatus(profile) === "empty" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            <X size={16} /> Empty
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/staff/user-profiles/${profile.id}`)}
                            title="View full profile"
                            className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() =>
                              setPreviewModal({
                                isOpen: true,
                                imageUrl: profile.profile_pic_url,
                                fileName: `${profile.name} - Profile Pic`,
                              })
                            }
                            disabled={!profile.profile_pic_url}
                            title="View profile picture"
                            className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 disabled:text-gray-400 dark:disabled:text-gray-600 transition-colors disabled:cursor-not-allowed"
                          >
                            📷
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Document Detail Cards - Below Table */}
        {filteredProfiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Document Details by Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {documentTypes.map((docType) => (
                <div key={docType.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="text-xl">{docType.icon}</span>
                    {docType.label}
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredProfiles
                      .filter((p) => p[`${docType.key}_url`])
                      .map((profile) => (
                        <div key={profile.id} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 dark:bg-gray-700">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                            {profile.name}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setPreviewModal({
                                  isOpen: true,
                                  imageUrl: profile[`${docType.key}_url`],
                                  fileName: `${profile.name} - ${docType.label}`,
                                })
                              }
                              className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                              title="Preview"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    {filteredProfiles.filter((p) => p[`${docType.key}_url`]).length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 py-2 text-center">No documents uploaded</p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400">
                    {filteredProfiles.filter((p) => p[`${docType.key}_url`]).length} of {filteredProfiles.length} users have this
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, imageUrl: "", fileName: "" })}
        imageUrl={previewModal.imageUrl}
        fileName={previewModal.fileName}
      />
    </PageLayout>
  );
}
