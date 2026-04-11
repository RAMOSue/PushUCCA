import { useEffect, useState, useContext } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Users, User, Mail, BadgeCheck, Download, Printer, FileText, X, ChevronLeft, ChevronRight, Camera, Search, Building } from "lucide-react";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";

export default function BorrowerProfiles() {
  const { user } = useContext(UserContext);
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentIdSide, setCurrentIdSide] = useState("front");
  const [currentImageType, setCurrentImageType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data } = await axios.get("/api/profiles/all", {
          withCredentials: true,
        });
        setProfiles(data);
      } catch (err) {
        console.error("Error fetching profiles:", err);
      }
    };
    fetchProfiles();
  }, []);

  if (!user) return <p className="text-center mt-6 text-gray-600">Loading user info...</p>;

  // ✅ Enhanced Download Function
  const handleDownload = async (url, borrowerName = "Borrower", docType = "Document") => {
    try {
      if (!url) throw new Error("No file URL provided");

      const relativePath = url.replace(/^https?:\/\/[^/]+/, "");
      const encodedPath = encodeURIComponent(relativePath);
      const backendUrl = `http://localhost:8000/api/profiles/download?path=${encodedPath}`;

      const response = await fetch(backendUrl, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Server Response:", errText);
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;

      // Format borrower name for filename
      const safeName = borrowerName.replace(/\s+/g, "-");
      const ext = url.split(".").pop().split("?")[0];
      const fileName = `${safeName}_${docType}.${ext}`;

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("❌ Error downloading file:", err);
      alert("Failed to download file. Check console for details.");
    }
  };

  // ✅ Print Image
  const handlePrint = (url) => {
    const win = window.open("");
    win.document.write(
      `<html><head><title>Print Image</title></head><body style="margin:0;text-align:center"><img src="${url}" style="max-width:100%;max-height:100vh;"/></body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  };

  // Calculate stats
  const totalBorrowers = profiles.length;
  const profilesWithPictures = profiles.filter(p => p.profile_pic_url).length;
  const profilesComplete = profiles.filter(p => p.profile_pic_url && p.id_front_url && p.birth_certificate_url).length;

  // Filter profiles based on search query
  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.department_name && p.department_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        {/* ========== Header Section ========== */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 dark:bg-[#171717]">
          <div className="flex items-start justify-between gap-6">
            {/* Left Side - Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Borrower Profiles</h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">Manage and review borrower documentation and profiles</p>
            </div>

            {/* Right Side - Summary Pills */}
            <div className="flex gap-3 flex-wrap items-center justify-end">
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Total: <span className="font-bold text-primary dark:text-blue-400">{totalBorrowers}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                With Photos: <span className="font-bold text-primary dark:text-blue-400">{profilesWithPictures}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Complete: <span className="font-bold text-primary dark:text-blue-400">{profilesComplete}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Main Content Area ========== */}
        <div className="px-6 md:px-8 lg:px-12 space-y-6 dark:bg-[#171717]">
          {/* Full Width Search Bar */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-gray-600 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition shadow-sm dark:shadow-black/40">
            <Search className="w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by name, email, or division..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-2 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Borrower Cards Grid */}
          {filteredProfiles.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">{searchQuery ? "No matching profiles" : "No borrower profiles found"}</p>
              <p className="text-on-surface-variant dark:text-gray-500 text-xs mt-2">{searchQuery ? "Try a different search" : "Get started by creating profiles"}</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfiles.map((borrower) => (
              <motion.div
                key={borrower.id}
                whileHover={{ shadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}
                className="bg-surface-container-low dark:bg-[#222] rounded-xl border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-gray-600 transition-all shadow-sm hover:shadow-md dark:shadow-black/40 dark:hover:shadow-black/60 overflow-hidden cursor-pointer h-full flex flex-col"
                onClick={() => {
                  setSelected(borrower);
                  setCurrentIdSide("front");
                }}
              >
                {/* Profile Picture Section */}
                <div className="relative h-40 bg-primary/10 dark:bg-blue-900/20 overflow-hidden group">
                  {borrower.profile_pic_url ? (
                    <img
                      src={borrower.profile_pic_url}
                      alt={borrower.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600" />
                    </div>
                  )}
                  {borrower.profile_pic_url && (
                    <div className="absolute top-2 right-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" />
                      Photo
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-4 flex-grow flex flex-col">
                  {/* Name */}
                  <h3 className="text-sm font-semibold text-on-surface dark:text-white truncate">{borrower.name}</h3>

                  {/* Email */}
                  <div className="flex items-center gap-2 mt-2 mb-3">
                    <Mail className="w-3 h-3 text-on-surface-variant dark:text-gray-400" />
                    <p className="text-xs text-on-surface-variant dark:text-gray-400 truncate">{borrower.email}</p>
                  </div>

                  {/* Division/Department Badge */}
                  {borrower.department_name && (
                    <div className="flex items-center gap-2 mb-3">
                      <Building className="w-3 h-3 text-primary dark:text-blue-400" />
                      <p className="text-xs text-primary dark:text-blue-400 font-medium truncate">{borrower.department_name}</p>
                    </div>
                  )}

                  {/* Role Badge */}
                  <div className="mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                      borrower.role === 'admin' ? 'bg-error/15 dark:bg-red-900/30 text-error dark:text-red-400' :
                      borrower.role === 'staff' ? 'bg-primary/15 dark:bg-blue-900/30 text-primary dark:text-blue-400' :
                      'bg-surface-container-high dark:bg-[#2a2a2a] text-on-surface dark:text-white'
                    }`}>
                      {borrower.role.charAt(0).toUpperCase() + borrower.role.slice(1)}
                    </span>
                  </div>

                  {/* Documents Status */}
                  <div className="space-y-1.5 mb-4 flex-grow text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${borrower.profile_pic_url ? 'bg-primary dark:bg-blue-400' : 'bg-outline-variant/40 dark:bg-gray-600'}`}></div>
                      <span className={borrower.profile_pic_url ? 'text-on-surface dark:text-white' : 'text-on-surface-variant dark:text-gray-400'}>Profile Photo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${borrower.birth_certificate_url ? 'bg-primary dark:bg-blue-400' : 'bg-outline-variant/40 dark:bg-gray-600'}`}></div>
                      <span className={borrower.birth_certificate_url ? 'text-on-surface dark:text-white' : 'text-on-surface-variant dark:text-gray-400'}>Birth Certificate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${borrower.id_front_url ? 'bg-primary dark:bg-blue-400' : 'bg-outline-variant/40 dark:bg-gray-600'}`}></div>
                      <span className={borrower.id_front_url ? 'text-on-surface dark:text-white' : 'text-on-surface-variant dark:text-gray-400'}>ID Documents</span>
                    </div>
                  </div>

                  {/* View Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(borrower);
                      setCurrentIdSide("front");
                    }}
                    className="w-full px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium hover:bg-primary-container dark:hover:bg-blue-700 transition text-xs"
                  >
                    View Details
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </div>

        {/* ============================
            MODAL: PROFILE DETAILS (ENHANCED)
        ============================ */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-3 py-6"
              onClick={() => setSelected(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#222] rounded-xl shadow-2xl dark:shadow-black/60 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary dark:bg-blue-600 p-6 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-on-primary/10 dark:bg-white/10 flex items-center justify-center">
                    {selected.profile_pic_url ? (
                      <img src={selected.profile_pic_url} alt={selected.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-on-primary dark:text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-on-primary dark:text-white">{selected.name}</h3>
                    <p className="text-on-primary/80 dark:text-white/70 text-sm">{selected.role.toUpperCase()}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-on-primary dark:text-white hover:bg-on-primary/10 dark:hover:bg-white/10 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 dark:bg-[#222]">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg p-4 border border-outline-variant/20 dark:border-gray-700">
                      <p className="text-xs text-on-surface-variant dark:text-gray-400 font-semibold uppercase mb-2">Email</p>
                      <p className="text-sm text-on-surface dark:text-white flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary dark:text-blue-400" />
                        {selected.email}
                      </p>
                    </div>
                    <div className="bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg p-4 border border-outline-variant/20 dark:border-gray-700">
                      <p className="text-xs text-on-surface-variant dark:text-gray-400 font-semibold uppercase mb-2">Role</p>
                      <p className="text-sm text-on-surface dark:text-white font-semibold">{selected.role.toUpperCase()}</p>
                    </div>
                    {selected.department_name && (
                      <div className="bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg p-4 border border-outline-variant/20 dark:border-gray-700">
                        <p className="text-xs text-on-surface-variant dark:text-gray-400 font-semibold uppercase mb-2">Division</p>
                        <p className="text-sm text-on-surface dark:text-white flex items-center gap-2">
                          <Building className="w-4 h-4 text-primary dark:text-blue-400" />
                          {selected.department_name}
                        </p>
                      </div>
                    )}
                    {selected.phone && (
                      <div className="bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg p-4 border border-outline-variant/20 dark:border-gray-700">
                        <p className="text-xs text-on-surface-variant dark:text-gray-400 font-semibold uppercase mb-2">Phone</p>
                        <p className="text-sm text-on-surface dark:text-white">{selected.phone}</p>
                      </div>
                    )}
                  </div>

                  {/* Documents Section */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-on-surface dark:text-white text-lg">Submitted Documents</h4>

                    {/* Profile Picture */}
                    {selected.profile_pic_url && (
                      <div className="border border-outline-variant/20 dark:border-gray-700 rounded-lg p-4 bg-surface-container-lowest/30 dark:bg-[#1a1a1a]/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Camera className="w-5 h-5 text-primary dark:text-blue-400" />
                            <span className="font-semibold text-on-surface dark:text-white">Profile Photo (1x1)</span>
                            <BadgeCheck className="w-4 h-4 text-primary dark:text-blue-400" />
                          </div>
                        </div>
                        <img
                          src={selected.profile_pic_url}
                          alt="Profile"
                          className="w-32 h-32 rounded-lg border-2 border-outline-variant/20 dark:border-gray-700 object-cover cursor-pointer hover:border-primary/50 dark:hover:border-blue-600 transition"
                          onClick={() => {
                            setImagePreview(selected.profile_pic_url);
                            setCurrentImageType("1x1");
                          }}
                        />
                      </div>
                    )}

                    {/* Birth Certificate */}
                    {selected.birth_certificate_url && (
                      <div className="border border-outline-variant/20 dark:border-gray-700 rounded-lg p-4 bg-surface-container-lowest/30 dark:bg-[#1a1a1a]/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary dark:text-blue-400" />
                            <span className="font-semibold text-on-surface dark:text-white">Birth Certificate</span>
                            <BadgeCheck className="w-4 h-4 text-primary dark:text-blue-400" />
                          </div>
                        </div>
                        <img
                          src={selected.birth_certificate_url}
                          alt="Birth Certificate"
                          className="w-48 h-auto rounded-lg border-2 border-outline-variant/20 dark:border-gray-700 object-cover cursor-pointer hover:border-primary/50 dark:hover:border-blue-600 transition"
                          onClick={() => {
                            setImagePreview(selected.birth_certificate_url);
                            setCurrentImageType("BirthCertificate");
                          }}
                        />
                      </div>
                    )}

                    {/* Class Schedule */}
                    {selected.class_schedule_url && (
                      <div className="border border-outline-variant/20 dark:border-gray-700 rounded-lg p-4 bg-surface-container-lowest/30 dark:bg-[#1a1a1a]/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-warning dark:text-orange-400" />
                            <span className="font-semibold text-on-surface dark:text-white">Class Schedule</span>
                            <BadgeCheck className="w-4 h-4 text-primary dark:text-blue-400" />
                          </div>
                        </div>
                        <img
                          src={selected.class_schedule_url}
                          alt="Class Schedule"
                          className="w-48 h-auto rounded-lg border-2 border-outline-variant/20 dark:border-gray-700 object-cover cursor-pointer hover:border-primary/50 dark:hover:border-blue-600 transition"
                          onClick={() => {
                            setImagePreview(selected.class_schedule_url);
                            setCurrentImageType("ClassSchedule");
                          }}
                        />
                      </div>
                    )}

                    {/* ID Documents */}
                    {(selected.id_front_url || selected.id_back_url) && (
                      <div className="border border-outline-variant/20 dark:border-gray-700 rounded-lg p-4 bg-surface-container-lowest/30 dark:bg-[#1a1a1a]/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary dark:text-blue-400" />
                            <span className="font-semibold text-on-surface dark:text-white">ID Documents</span>
                            {selected.id_front_url && selected.id_back_url && (
                              <BadgeCheck className="w-4 h-4 text-primary dark:text-blue-400" />
                            )}
                          </div>
                        </div>

                        {/* ID Navigation Tabs */}
                        <div className="flex gap-2 mb-4">
                          {selected.id_front_url && (
                            <button
                              onClick={() => setCurrentIdSide("front")}
                              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                                currentIdSide === "front"
                                  ? "bg-primary dark:bg-blue-600 text-on-primary dark:text-white"
                                  : "bg-surface-container-low dark:bg-[#2a2a2a] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#333]"
                              }`}
                            >
                              <ChevronLeft className="w-4 h-4 inline mr-1" />
                              Front
                            </button>
                          )}
                          {selected.id_back_url && (
                            <button
                              onClick={() => setCurrentIdSide("back")}
                              className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                                currentIdSide === "back"
                                  ? "bg-primary dark:bg-blue-600 text-on-primary dark:text-white"
                                  : "bg-surface-container-low dark:bg-[#2a2a2a] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#333]"
                              }`}
                            >
                              Back
                              <ChevronRight className="w-4 h-4 inline ml-1" />
                            </button>
                          )}
                        </div>

                        {/* ID Image */}
                        <img
                          src={
                            currentIdSide === "front"
                              ? selected.id_front_url
                              : selected.id_back_url
                          }
                          alt="ID"
                          className="w-64 h-auto rounded-lg border-2 border-outline-variant/20 dark:border-gray-700 object-cover cursor-pointer hover:border-primary/50 dark:hover:border-blue-600 transition"
                          onClick={() => {
                            setImagePreview(
                              currentIdSide === "front"
                                ? selected.id_front_url
                                : selected.id_back_url
                            );
                            setCurrentImageType(
                              currentIdSide === "front" ? "ID_Front" : "ID_Back"
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================
            MODAL: IMAGE PREVIEW (ENHANCED)
        ============================ */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 dark:bg-black/95 flex flex-col items-center justify-center z-50 px-2 py-4"
              onClick={() => setImagePreview(null)}
            >
              <button
                className="absolute top-4 right-6 text-white dark:text-gray-300 hover:text-gray-400 dark:hover:text-gray-200 transition"
                onClick={() => setImagePreview(null)}
              >
                <X className="w-8 h-8" />
              </button>

              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={imagePreview}
                alt="Preview"
                className="max-w-[95%] sm:max-w-[90%] max-h-[70vh] rounded-lg shadow-2xl dark:shadow-black/80 object-contain"
                onClick={(e) => e.stopPropagation()}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row gap-3 mt-6"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(imagePreview, selected?.name, currentImageType);
                  }}
                  className="px-6 py-3 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg hover:bg-primary-container dark:hover:bg-blue-700 transition font-medium flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrint(imagePreview);
                  }}
                  className="px-6 py-3 bg-surface-container-high dark:bg-[#2a2a2a] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 rounded-lg hover:bg-surface-container-highest dark:hover:bg-[#333] transition font-medium flex items-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Print
                </button>
              </motion.div>

              <p className="text-gray-300 dark:text-gray-400 mt-4 text-sm italic text-center">
                Click anywhere to close
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}
