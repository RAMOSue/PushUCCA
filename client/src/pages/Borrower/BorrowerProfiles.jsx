import { useEffect, useState, useContext } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Users, User, Mail, BadgeCheck, Download, Printer, FileText, X, ChevronLeft, ChevronRight, Camera, Search, Building } from "lucide-react";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";

export default function BorrowerProfiles() {
  const { user } = useContext(UserContext);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProfiles, setExpandedProfiles] = useState({});
  const [selectedDivision, setSelectedDivision] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data } = await axios.get("/api/profiles/all", {
          withCredentials: true,
        });
        setProfiles(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching profiles:", err);
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  if (loading) {
    return (
      <PageLayout>
        <div className="bg-surface dark:bg-[#171717] min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <Users className="w-12 h-12 text-primary dark:text-blue-400 mx-auto mb-3 animate-pulse" />
            <p className="text-on-surface-variant dark:text-gray-400 text-sm">Loading profiles...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) return <p className="text-center mt-6 text-gray-600">Loading user info...</p>;

  // ✅ Enhanced Download Function
  const handleDownload = async (url, borrowerName = "Borrower", docType = "Document") => {
    try {
      if (!url) throw new Error("No file URL provided");

      const relativePath = url.replace(/^https?:\/\/[^/]+/, "");
      const encodedPath = encodeURIComponent(relativePath);
      const backendUrl = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/profiles/download?path=${encodedPath}`;

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

  // Filter profiles based on search query and division
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.department_name && p.department_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDivision = selectedDivision === "ALL" || p.department_name === selectedDivision;
    return matchesSearch && matchesDivision;
  });

  // Organize into sections by completion status
  const getCompletionStatus = (profile) => {
    const hasPhoto = !!profile.profile_pic_url;
    const hasIDFront = !!profile.id_front_url;
    const hasBirthCert = !!profile.birth_certificate_url;
    const completed = hasPhoto && hasIDFront && hasBirthCert;

    if (completed) return "COMPLETE";
    if (hasPhoto && hasIDFront) return "MISSING_DOCS";
    if (hasPhoto) return "PARTIAL";
    return "NO_PHOTO";
  };

  // Filter by status
  const getStatusCounts = () => {
    return {
      COMPLETE: filteredProfiles.filter(p => getCompletionStatus(p) === "COMPLETE").length,
      MISSING_DOCS: filteredProfiles.filter(p => getCompletionStatus(p) === "MISSING_DOCS").length,
      PARTIAL: filteredProfiles.filter(p => getCompletionStatus(p) === "PARTIAL").length,
      NO_PHOTO: filteredProfiles.filter(p => getCompletionStatus(p) === "NO_PHOTO").length,
    };
  };
  
  const statusCounts = getStatusCounts();
  
  const statusFilteredProfiles = selectedStatus === "ALL" 
    ? filteredProfiles 
    : filteredProfiles.filter(p => getCompletionStatus(p) === selectedStatus);

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        {/* ========== Header Section ========== */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 dark:bg-[#171717]">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            {/* Left Side - Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Borrower Profiles</h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">Manage and review borrower documentation</p>
            </div>

            {/* Right Side - Summary Pills */}
            <div className="flex gap-2 flex-wrap justify-end">
              <div className="px-3 py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Total: <span className="font-bold text-primary dark:text-blue-400">{totalBorrowers}</span>
              </div>
              <div className="px-3 py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                With Photos: <span className="font-bold text-primary dark:text-blue-400">{profilesWithPictures}</span>
              </div>
              <div className="px-3 py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Complete: <span className="font-bold text-primary dark:text-blue-400">{profilesComplete}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Main Content Area ========== */}
        <div className="px-6 md:px-8 lg:px-12">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Sticky Search Bar */}
            <div className="sticky top-0 z-10 bg-surface dark:bg-[#171717] py-3">
              <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-3 py-2.5 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:focus-within:border-transparent transition shadow-sm">
                <Search className="w-4 h-4 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent focus:outline-none text-xs text-on-surface dark:text-white dark:placeholder-gray-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="px-1.5 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Buttons */}
            <div className="flex gap-2 items-center flex-wrap">
              {[
                { key: "ALL", label: "All", color: "text-gray-600 dark:text-gray-400" },
                { key: "COMPLETE", label: "✅ Complete", color: "text-green-600 dark:text-green-400", count: statusCounts.COMPLETE },
                { key: "MISSING_DOCS", label: "🟡 Missing Documents", color: "text-yellow-600 dark:text-yellow-400", count: statusCounts.MISSING_DOCS },
                { key: "PARTIAL", label: "🟠 Partial", color: "text-orange-600 dark:text-orange-400", count: statusCounts.PARTIAL },
                { key: "NO_PHOTO", label: "⚪ No Photo", color: "text-gray-600 dark:text-gray-400", count: statusCounts.NO_PHOTO },
              ].map((status) => (
                <button
                  key={status.key}
                  onClick={() => setSelectedStatus(status.key)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                    selectedStatus === status.key
                      ? "bg-primary dark:bg-blue-600 text-on-primary dark:text-white"
                      : "bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 hover:border-primary/30 dark:hover:border-blue-400/30"
                  }`}
                >
                  {status.label} {status.count !== undefined && `(${status.count})`}
                </button>
              ))}
            </div>

            {/* Division Filter */}
            {profiles.length > 0 && (
              <div className="flex gap-2 items-center flex-wrap">
                
                
                {[...new Set(profiles.filter(p => p.role !== 'admin').map(p => p.department_name).filter(Boolean))].sort().map((division) => (
                  <button
                    key={division}
                    onClick={() => setSelectedDivision(division)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
                      selectedDivision === division
                        ? "bg-primary dark:bg-blue-600 text-on-primary dark:text-white"
                        : "bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 hover:border-primary/30 dark:hover:border-blue-400/30"
                    }`}
                  >
                    {division}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            {statusFilteredProfiles.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-on-surface-variant dark:text-gray-400 text-sm">{searchQuery ? "No matching profiles" : "No borrower profiles found"}</p>
              </div>
            ) : (
              <div className="space-y-2 pb-10">
                {statusFilteredProfiles.map((borrower) => {
                  const isExpanded = expandedProfiles[borrower.id];
                  const hasPhoto = !!borrower.profile_pic_url;
                  const hasIDFront = !!borrower.id_front_url;
                  const hasBirthCert = !!borrower.birth_certificate_url;

                  return (
                    <div
                      key={borrower.id}
                      className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg border border-outline-variant/20 dark:border-gray-700 shadow-sm hover:shadow-md dark:hover:shadow-black/40 overflow-hidden transition-all duration-200"
                    >
                      {/* Row Header - Clickable */}
                      <button
                        onClick={() => setExpandedProfiles({
                          ...expandedProfiles,
                          [borrower.id]: !isExpanded
                        })}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface-container-high dark:hover:bg-[#222] transition-colors text-left"
                      >
                        {/* Profile Picture Thumbnail */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border border-primary/30 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#222]">
                          {borrower.profile_pic_url ? (
                            <img
                              src={borrower.profile_pic_url}
                              alt={borrower.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400">
                              <User className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        {/* Profile Info - Two Lines */}
                        <div className="flex-1 min-w-0">
                          {/* Line 1: Name + Status Badges */}
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-xs font-semibold truncate text-on-surface dark:text-white">{borrower.name}</p>
                            <div className="flex gap-1 flex-shrink-0">
                              {hasPhoto && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Photo</span>}
                              {hasIDFront && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">ID</span>}
                              {hasBirthCert && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">Cert</span>}
                            </div>
                          </div>

                          {/* Line 2: Role + Department */}
                          <div className="flex items-center gap-2 text-[10px] text-on-surface-variant dark:text-gray-400">
                            {borrower.role && (
                              <>
                                <span className="font-medium text-on-surface dark:text-white">{borrower.role.toUpperCase()}</span>
                                <span>•</span>
                              </>
                            )}
                            {borrower.department_name && (
                              <span className="truncate">{borrower.department_name}</span>
                            )}
                          </div>
                        </div>

                        {/* Expand Chevron */}
                        <ChevronRight
                          className={`w-4 h-4 text-on-surface-variant dark:text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      </button>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-outline-variant/20 dark:border-gray-700 px-3 py-3 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/50 text-xs space-y-3">
                          {/* Personal Info */}
                          <div className="space-y-2">
                            <p className="text-[10px] text-on-surface-variant dark:text-gray-500 uppercase font-medium">Personal Info</p>
                            {borrower.phone && (
                              <p className="text-sm text-on-surface dark:text-white">📞 <span className="font-medium">{borrower.phone}</span></p>
                            )}
                          </div>

                          {/* Documents Section */}
                          <div className="space-y-2">
                            <p className="text-[10px] text-on-surface-variant dark:text-gray-500 uppercase font-medium">Documents</p>
                            
                            <div className="grid grid-cols-4 gap-2">
                              {/* Class Schedule */}
                              <div className="bg-surface-container-high dark:bg-[#2a2a2a] rounded-lg p-2 border border-outline-variant/20 dark:border-gray-700">
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <p className="text-xs font-medium text-on-surface dark:text-white">Schedule</p>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                    borrower.class_schedule_url
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                  }`}>
                                    {borrower.class_schedule_url ? '✓' : '✕'}
                                  </span>
                                </div>
                                {borrower.class_schedule_url && (
                                  <div className="space-y-1">
                                    <img src={borrower.class_schedule_url} alt="Class Schedule" className="w-full h-16 rounded object-cover border border-outline-variant/30 dark:border-gray-600" />
                                    <div className="flex gap-0.5">
                                      <button
                                        onClick={() => handleDownload(borrower.class_schedule_url, borrower.name, "Class-Schedule")}
                                        className="flex-1 p-1 bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handlePrint(borrower.class_schedule_url)}
                                        className="flex-1 p-1 bg-primary/10 dark:bg-blue-900/30 text-primary dark:text-blue-400 rounded hover:bg-primary/20 dark:hover:bg-blue-900/50 transition"
                                        title="Print"
                                      >
                                        <Printer className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* ID Front */}
                              <div className="bg-surface-container-high dark:bg-[#2a2a2a] rounded-lg p-2 border border-outline-variant/20 dark:border-gray-700">
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <p className="text-xs font-medium text-on-surface dark:text-white">ID Front</p>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                    borrower.id_front_url
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                  }`}>
                                    {borrower.id_front_url ? '✓' : '✕'}
                                  </span>
                                </div>
                                {borrower.id_front_url && (
                                  <div className="space-y-1">
                                    <img src={borrower.id_front_url} alt="ID Front" className="w-full h-16 rounded object-cover border border-outline-variant/30 dark:border-gray-600" />
                                    <div className="flex gap-0.5">
                                      <button
                                        onClick={() => handleDownload(borrower.id_front_url, borrower.name, "ID-Front")}
                                        className="flex-1 p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handlePrint(borrower.id_front_url)}
                                        className="flex-1 p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                                        title="Print"
                                      >
                                        <Printer className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* ID Back */}
                              <div className="bg-surface-container-high dark:bg-[#2a2a2a] rounded-lg p-2 border border-outline-variant/20 dark:border-gray-700">
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <p className="text-xs font-medium text-on-surface dark:text-white">ID Back</p>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                    borrower.id_back_url
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                  }`}>
                                    {borrower.id_back_url ? '✓' : '✕'}
                                  </span>
                                </div>
                                {borrower.id_back_url && (
                                  <div className="space-y-1">
                                    <img src={borrower.id_back_url} alt="ID Back" className="w-full h-16 rounded object-cover border border-outline-variant/30 dark:border-gray-600" />
                                    <div className="flex gap-0.5">
                                      <button
                                        onClick={() => handleDownload(borrower.id_back_url, borrower.name, "ID-Back")}
                                        className="flex-1 p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handlePrint(borrower.id_back_url)}
                                        className="flex-1 p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                                        title="Print"
                                      >
                                        <Printer className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Birth Certificate */}
                              <div className="bg-surface-container-high dark:bg-[#2a2a2a] rounded-lg p-2 border border-outline-variant/20 dark:border-gray-700">
                                <div className="flex items-center justify-between gap-1 mb-2">
                                  <p className="text-xs font-medium text-on-surface dark:text-white">Cert</p>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                                    borrower.birth_certificate_url
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                  }`}>
                                    {borrower.birth_certificate_url ? '✓' : '✕'}
                                  </span>
                                </div>
                                {borrower.birth_certificate_url && (
                                  <div className="space-y-1">
                                    <img src={borrower.birth_certificate_url} alt="Birth Certificate" className="w-full h-16 rounded object-cover border border-outline-variant/30 dark:border-gray-600" />
                                    <div className="flex gap-0.5">
                                      <button
                                        onClick={() => handleDownload(borrower.birth_certificate_url, borrower.name, "Birth-Certificate")}
                                        className="flex-1 p-1 bg-purple/10 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple/20 dark:hover:bg-purple-900/50 transition"
                                        title="Download"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handlePrint(borrower.birth_certificate_url)}
                                        className="flex-1 p-1 bg-purple/10 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple/20 dark:hover:bg-purple-900/50 transition"
                                        title="Print"
                                      >
                                        <Printer className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
