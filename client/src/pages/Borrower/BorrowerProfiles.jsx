import { useEffect, useState, useContext, useMemo } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useSidebarStore } from "../../../context/sidebarStore";
import {
  Users,
  User,
  Download,
  Printer,
  Building,
  Mail,
  BadgeCheck,
  Camera,
  FileText,
  ChevronRight,
} from "lucide-react";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";

const OFFICER_TITLES = [
  "president",
  "vice president",
  "secretary",
  "treasurer",
  "auditor",
  "pro",
  "public relations officer",
  "public relations",
  "committee chair",
  "chairperson",
  "chair",
  "lead",
  "manager",
  "officer",
];

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase();
}

function isOfficerPosition(positionName) {
  const normalized = normalizeTitle(positionName);
  if (!normalized) return false;

  return OFFICER_TITLES.some((title) => normalized.includes(title));
}

export default function BorrowerProfiles() {
  const { user } = useContext(UserContext);
  const { selectedDivision, globalSearchQuery } = useSidebarStore();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedBorrowerId, setSelectedBorrowerId] = useState(null);
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsError, setPositionsError] = useState(null);
  

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data } = await axios.get("/api/profiles/all", {
          withCredentials: true,
        });
        setProfiles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching profiles:", err);
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  useEffect(() => {
    const fetchPositions = async () => {
      try {
        setPositionsLoading(true);
        const { data } = await axios.get("/api/master-list/positions", { withCredentials: true });
        setPositions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching positions:", err);
        setPositionsError(err?.message || "Failed to load positions");
        setPositions([]);
      } finally {
        setPositionsLoading(false);
      }
    };

    fetchPositions();
  }, []);

  // Use global `selectedDivision` from the navbar store. No local divisions list.

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

  const filteredProfiles = useMemo(() => {
    const lowerQuery = globalSearchQuery.trim().toLowerCase();

    return profiles.filter((profile) => {
      if (profile.role === "admin") return false;
      // Treat the global filter value "All" (or falsy) as no-op
      if (selectedDivision && selectedDivision !== "All" && profile.department_name !== selectedDivision) return false;

      const matchesSearch =
        !lowerQuery ||
        (profile.name && profile.name.toLowerCase().includes(lowerQuery)) ||
        (profile.email && profile.email.toLowerCase().includes(lowerQuery)) ||
        (profile.department_name && profile.department_name.toLowerCase().includes(lowerQuery)) ||
        (profile.position_name && profile.position_name.toLowerCase().includes(lowerQuery));

      if (!matchesSearch) return false;

      return selectedStatus === "ALL" ? true : getCompletionStatus(profile) === selectedStatus;
    });
  }, [profiles, globalSearchQuery, selectedDivision, selectedStatus]);

  const groupedProfiles = useMemo(() => {
    const officers = filteredProfiles.filter((profile) => isOfficerPosition(profile.position_name));
    const members = filteredProfiles.filter((profile) => !isOfficerPosition(profile.position_name));

    return { officers, members };
  }, [filteredProfiles]);

  useEffect(() => {
    if (!filteredProfiles.length) {
      setSelectedBorrowerId(null);
      return;
    }

    if (!selectedBorrowerId || !filteredProfiles.some((profile) => profile.id === selectedBorrowerId)) {
      setSelectedBorrowerId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, selectedBorrowerId]);

  const selectedBorrower = profiles.find((profile) => profile.id === selectedBorrowerId) || null;

  const statusCounts = {
    COMPLETE: filteredProfiles.filter((profile) => getCompletionStatus(profile) === "COMPLETE").length,
    MISSING_DOCS: filteredProfiles.filter((profile) => getCompletionStatus(profile) === "MISSING_DOCS").length,
    PARTIAL: filteredProfiles.filter((profile) => getCompletionStatus(profile) === "PARTIAL").length,
    NO_PHOTO: filteredProfiles.filter((profile) => getCompletionStatus(profile) === "NO_PHOTO").length,
  };

  const handlePositionChange = async (borrowerId, value) => {
    try {
      const payload = { position_id: value === "" ? null : Number(value) };
      const { data } = await axios.patch(`/api/profiles/${borrowerId}`, payload, { withCredentials: true });

      if (data && data.profile) {
        setProfiles((prev) =>
          prev.map((profile) =>
            profile.id === borrowerId
              ? { ...profile, position_id: data.profile.position_id, position_name: data.profile.position_name }
              : profile
          )
        );
      }

      toast.success("Position updated");
    } catch (err) {
      console.error("Error updating position:", err);
      toast.error("Failed to update position");
    }
  };

  const handleDownload = async (url, borrowerName = "Borrower", docType = "Document") => {
    try {
      if (!url) throw new Error("No file URL provided");

      const relativePath = url.replace(/^https?:\/\/[^/]+/, "");
      const encodedPath = encodeURIComponent(relativePath);
      const backendUrl = `${import.meta.env.VITE_API_URL || window.location.origin}/api/profiles/download?path=${encodedPath}`;

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

  const handlePrint = (url) => {
    const win = window.open("");
    win.document.write(
      `<html><head><title>Print Image</title></head><body style="margin:0;text-align:center"><img src="${url}" style="max-width:100%;max-height:100vh;"/></body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  };

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

  return (
    <PageLayout>
      <div className="bg-[#f8fafc] dark:bg-[#171717] min-h-screen">
        <div className="px-2 md:px-4 lg:px-6 pt-4">
          <div className="max-w-7xl mx-auto">

            <div className="mt-4 flex items-center justify-between gap-4">
              <div />
              <div className="flex items-center gap-3">
                <label className="text-xs text-on-surface-variant dark:text-gray-400 mr-2">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-surface-container-low dark:bg-[#222] border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white"
                >
                  <option value="ALL">All</option>
                  <option value="COMPLETE">✅ Complete ({statusCounts.COMPLETE})</option>
                  <option value="MISSING_DOCS">🟡 Missing Documents ({statusCounts.MISSING_DOCS})</option>
                  <option value="PARTIAL">🟠 Partial ({statusCounts.PARTIAL})</option>
                  <option value="NO_PHOTO">⚪ No Photo ({statusCounts.NO_PHOTO})</option>
                </select>
              </div>
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="py-20 text-center text-on-surface-variant dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-60" />
                <p>
                  No matching borrowers{selectedDivision && selectedDivision !== "All" ? ` in ${selectedDivision}.` : "."}
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-5">
                <aside className="bg-white dark:bg-[#1b1b1b] rounded-2xl border border-outline-variant/20 dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="max-h-[75vh] overflow-y-auto p-3 space-y-5">
                    {[
                      { key: "officers", label: "Officers" },
                      { key: "members", label: "Members" },
                    ].map(({ key, label }) => {
                      const items = groupedProfiles[key];

                      return (
                        <div key={key} className="space-y-2">
                          <div className="relative px-2 py-1.5">
                            <h3 className="absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-[0.15em] text-on-surface-variant dark:text-gray-400">
                              {label}
                            </h3>
                            <span className="relative z-10 float-right text-[10px] px-2 py-0.5 rounded-full bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400">
                              {items.length}
                            </span>
                          </div>

                          {items.length === 0 ? (
                            <div className="px-2 py-3 text-xs text-on-surface-variant dark:text-gray-500 border border-dashed border-outline-variant/30 dark:border-gray-700 rounded-lg">
                              No {label.toLowerCase()} found.
                            </div>
                          ) : (
                            items.map((borrower) => {
                              const isSelected = selectedBorrowerId === borrower.id;

                              return (
                                <button
                                  key={borrower.id}
                                  onClick={() => setSelectedBorrowerId(borrower.id)}
                                  className={`w-full text-left rounded-xl border px-3 py-3 transition-all duration-200 flex items-center justify-between ${
                                    isSelected
                                      ? "border-primary/60 bg-primary/5 dark:bg-blue-500/10 shadow-sm"
                                      : "border-outline-variant/20 dark:border-gray-700 bg-surface-container-low dark:bg-[#222] hover:border-primary/30 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/20 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#1f1f1f] flex-shrink-0">
                                      {borrower.profile_pic_url ? (
                                        <img src={borrower.profile_pic_url} alt={borrower.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400">
                                          <User className="w-5 h-5" />
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-sm text-on-surface dark:text-white truncate">{borrower.name}</p>
                                      <p className="text-[11px] text-on-surface-variant dark:text-gray-400 truncate">
                                        {borrower.position_name || (key === "officers" ? "Officer" : "Member")}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="ml-3 flex-shrink-0 text-on-surface-variant dark:text-gray-400">
                                    <ChevronRight className="w-4 h-4" />
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <section className="bg-white dark:bg-[#1b1b1b] rounded-2xl border border-outline-variant/20 dark:border-gray-700 shadow-sm overflow-hidden min-h-[640px]">
                  {!selectedBorrower ? (
                    <div className="h-full flex items-center justify-center text-center p-10 text-on-surface-variant dark:text-gray-400">
                      <div>
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-60" />
                        <p>Select a borrower to view details.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 md:p-6 space-y-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/20 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#111]">
                            {selectedBorrower.profile_pic_url ? (
                              <img src={selectedBorrower.profile_pic_url} alt={selectedBorrower.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400">
                                <User className="w-8 h-8" />
                              </div>
                            )}
                          </div>

                          <div>
                            <h2 className="text-2xl font-bold text-on-surface dark:text-white">{selectedBorrower.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-on-surface-variant dark:text-gray-400">
                              <span>{selectedBorrower.department_name || "Unassigned division"}</span>
                              <span>•</span>
                              <span>{selectedBorrower.position_name || "No assigned position"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-on-surface-variant dark:text-gray-400">
                          <BadgeCheck className="w-4 h-4" />
                          <span>{getCompletionStatus(selectedBorrower).replace("_", " ")}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <InfoRow icon={<Building className="w-4 h-4" />} label="Division" value={selectedBorrower.department_name || "Not assigned"} />
                          <InfoRow icon={<User className="w-4 h-4" />} label="Position" value={selectedBorrower.position_name || "No assigned position"} />
                          <InfoRow icon={<FileText className="w-4 h-4" />} label="Student Number" value={selectedBorrower.student_number || "N/A"} />
                          <InfoRow icon={<FileText className="w-4 h-4" />} label="Course" value={selectedBorrower.program || selectedBorrower.college || "N/A"} />
                          <InfoRow icon={<FileText className="w-4 h-4" />} label="Year" value={selectedBorrower.year || "N/A"} />
                        </div>

                        <div className="space-y-3">
                          <InfoRow icon={<Camera className="w-4 h-4" />} label="Contact Number" value={selectedBorrower.phone || "N/A"} />
                          <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={selectedBorrower.email || "N/A"} />
                          <InfoRow icon={<Building className="w-4 h-4" />} label="College" value={selectedBorrower.college || "N/A"} />
                          <InfoRow icon={<FileText className="w-4 h-4" />} label="Date of Birth" value={selectedBorrower.date_of_birth || "N/A"} />
                          <InfoRow icon={<BadgeCheck className="w-4 h-4" />} label="Status" value={getCompletionStatus(selectedBorrower)} />
                        </div>
                      </div>

                      <div className="rounded-xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low dark:bg-[#202020] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-on-surface dark:text-white">Position Assignment</p>
                        </div>

                        {positionsLoading ? (
                          <p className="text-sm text-on-surface-variant dark:text-gray-400">Loading positions...</p>
                        ) : positionsError ? (
                          <p className="text-sm text-red-500">Failed to load positions</p>
                        ) : (
                          <div className="flex items-center gap-3">
                            <select
                              value={selectedBorrower.position_id || ""}
                              onChange={(e) => handlePositionChange(selectedBorrower.id, e.target.value)}
                              className="text-sm px-3 py-2 rounded-lg bg-white dark:bg-[#1a1a1a] border border-outline-variant/20 dark:border-gray-700 w-full"
                            >
                              <option value="">Assign this member</option>
                              {positions.map((position) => (
                                <option key={position.id} value={position.id}>{position.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low dark:bg-[#202020] p-4">
                        <p className="text-sm font-semibold text-on-surface dark:text-white mb-4 text-center">Documents</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          {renderDocumentCard("Profile Picture", selectedBorrower.profile_pic_url, handleDownload, handlePrint, selectedBorrower.name)}
                          {renderDocumentCard("Class Schedule", selectedBorrower.class_schedule_url, handleDownload, handlePrint, selectedBorrower.name, "Class-Schedule")}
                          {renderDocumentCard("ID Front", selectedBorrower.id_front_url, handleDownload, handlePrint, selectedBorrower.name, "ID-Front")}
                          {renderDocumentCard("ID Back", selectedBorrower.id_back_url, handleDownload, handlePrint, selectedBorrower.name, "ID-Back")}
                          {renderDocumentCard("Birth Certificate", selectedBorrower.birth_certificate_url, handleDownload, handlePrint, selectedBorrower.name, "Birth-Certificate")}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low dark:bg-[#202020] p-3">
      <div className="text-primary dark:text-blue-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.12em] text-on-surface-variant dark:text-gray-400">{label}</p>
        <p className="text-sm text-on-surface dark:text-white break-words">{value}</p>
      </div>
    </div>
  );
}

function renderDocumentCard(title, url, onDownload, onPrint, borrowerName, docType = title) {
  const hasFile = !!url;

  return (
    <div className="rounded-xl border border-outline-variant/20 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-on-surface dark:text-white">{title}</p>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${hasFile ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
          {hasFile ? "Available" : "Missing"}
        </span>
      </div>

      {hasFile ? (
        <>
          <img src={url} alt={title} className="w-full h-28 object-cover rounded-lg border border-outline-variant/20 dark:border-gray-700 mb-3" />
          <div className="flex gap-2">
            <button
              onClick={() => onDownload(url, borrowerName, docType)}
              title="Download"
              aria-label={`Download ${title}`}
              className="inline-flex items-center justify-center p-2 rounded-lg bg-primary/10 dark:bg-blue-500/10 text-primary dark:text-blue-400 hover:bg-primary/20 dark:hover:bg-blue-500/20 transition"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPrint(url)}
              title="Print"
              aria-label={`Print ${title}`}
              className="inline-flex items-center justify-center p-2 rounded-lg bg-surface-container-high dark:bg-[#2b2b2b] text-on-surface dark:text-white hover:bg-surface-container-high/80 dark:hover:bg-[#303030] transition"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-outline-variant/30 dark:border-gray-700 text-[11px] text-on-surface-variant dark:text-gray-500">
          No file uploaded
        </div>
      )}
    </div>
  );
}
