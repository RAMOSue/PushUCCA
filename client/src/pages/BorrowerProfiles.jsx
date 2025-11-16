import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";

export default function BorrowerProfiles() {
  const { user } = useContext(UserContext);
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [currentIdSide, setCurrentIdSide] = useState("front");
  const [currentImageType, setCurrentImageType] = useState("");

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

  return (
    <div className="p-3 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-semibold text-pink-600 mb-4 text-center sm:text-left">
        👥 Borrower Profiles
      </h2>

      {/* Profile Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="border rounded-lg p-4 bg-white shadow hover:shadow-lg transition max-w-sm mx-auto w-full"
          >
            <h3 className="font-bold text-lg text-center sm:text-left">{p.name}</h3>
            <p className="text-sm text-gray-600 text-center sm:text-left break-words">{p.email}</p>

            <button
              className="mt-3 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
              onClick={() => {
                setSelected(p);
                setCurrentIdSide("front");
              }}
            >
              View Details
            </button>
          </div>
        ))}
      </div>

      {/* ============================
          MODAL: PROFILE DETAILS
      ============================ */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-3">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-lg"
              onClick={() => setSelected(null)}
            >
              ✕
            </button>

            <h3 className="text-lg sm:text-xl font-semibold mb-3 text-center sm:text-left">
              {selected.name}'s Profile
            </h3>

            <div className="space-y-3 text-sm sm:text-base">
              <p><strong>Email:</strong> {selected.email}</p>
              <p><strong>Role:</strong> {selected.role}</p>

              {/* Profile Picture */}
              {selected.profile_pic_url && (
                <div>
                  <strong>1x1 Picture:</strong>
                  <img
                    src={selected.profile_pic_url}
                    alt="Profile"
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded mt-2 border cursor-pointer mx-auto sm:mx-0"
                    onClick={() => {
                      setImagePreview(selected.profile_pic_url);
                      setCurrentImageType("1x1");
                    }}
                  />
                </div>
              )}

              {/* Birth Certificate */}
              {selected.birth_certificate_url && (
                <div>
                  <strong>Birth Certificate:</strong>
                  <img
                    src={selected.birth_certificate_url}
                    alt="Birth Certificate"
                    className="w-36 h-36 sm:w-40 sm:h-40 object-cover rounded mt-2 border cursor-pointer mx-auto sm:mx-0"
                    onClick={() => {
                      setImagePreview(selected.birth_certificate_url);
                      setCurrentImageType("BirthCertificate");
                    }}
                  />
                </div>
              )}

              {/* Class Schedule */}
              {selected.class_schedule_url && (
                <div>
                  <strong>Class Schedule:</strong>
                  <img
                    src={selected.class_schedule_url}
                    alt="Class Schedule"
                    className="w-36 h-36 sm:w-40 sm:h-40 object-cover rounded mt-2 border cursor-pointer mx-auto sm:mx-0"
                    onClick={() => {
                      setImagePreview(selected.class_schedule_url);
                      setCurrentImageType("ClassSchedule");
                    }}
                  />
                </div>
              )}

              {/* Combined ID (Front & Back) */}
              {(selected.id_front_url || selected.id_back_url) && (
                <div>
                  <strong>ID:</strong>
                  <div className="flex flex-col items-center sm:flex-row sm:items-center sm:gap-3 mt-2">
                    <img
                      src={
                        currentIdSide === "front"
                          ? selected.id_front_url
                          : selected.id_back_url
                      }
                      alt="ID"
                      className="w-52 h-32 sm:w-56 sm:h-36 object-cover rounded border cursor-pointer"
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

                  <div className="flex justify-center sm:justify-between items-center mt-2 gap-3">
                    <button
                      onClick={() => setCurrentIdSide("front")}
                      disabled={currentIdSide === "front"}
                      className={`px-3 py-1 text-sm rounded ${
                        currentIdSide === "front"
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      ◀ Front
                    </button>

                    <button
                      onClick={() => setCurrentIdSide("back")}
                      disabled={currentIdSide === "back"}
                      className={`px-3 py-1 text-sm rounded ${
                        currentIdSide === "back"
                          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      Back ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================
          MODAL: IMAGE PREVIEW
      ============================ */}
      {imagePreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 px-2"
          onClick={() => setImagePreview(null)}
        >
          <button
            className="absolute top-4 right-5 text-white text-2xl font-bold"
            onClick={() => setImagePreview(null)}
          >
            ✕
          </button>

          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-[95%] sm:max-w-[90%] max-h-[70vh] rounded-lg shadow-lg object-contain"
          />

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(imagePreview, selected?.name, currentImageType);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base"
            >
              ⬇️ Download
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrint(imagePreview);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm sm:text-base"
            >
              🖨️ Print
            </button>
          </div>

          <p className="text-white mt-3 text-xs sm:text-sm italic text-center">
            Tap anywhere outside to close
          </p>
        </div>
      )}
    </div>
  );
}
