import { useEffect, useState } from "react";
import { X, Download, Trash2, Image } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Modal to view captured photos for a borrow request
 * Used by staff in StaffBorrowTimeline.jsx
 */
export default function ViewBorrowPhotosModal({
  isOpen,
  requestId,
  borrowerName = "Borrower",
  onClose,
  onPhotoDeleted,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Load photos on modal open
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const loadPhotos = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(`/api/borrow/photos/${requestId}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          setPhotos(response.data.photos);
        }
      } catch (err) {
        console.error("Failed to load photos:", err);
        setError("Failed to load photos");
        toast.error("Could not load photos");
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [isOpen, requestId]);

  // Download photo
  const handleDownload = async (photo) => {
    try {
      const photoUrl = photo.photo_url?.startsWith('http')
        ? photo.photo_url
        : `http://localhost:8000${photo.photo_url}`;

      const response = await axios.get(photoUrl, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "image/jpeg" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `photo-${photo.id}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("✅ Photo downloaded");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download photo");
    }
  };

  // Delete photo
  const handleDelete = async (photoId) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;

    try {
      await axios.delete(`/api/borrow/photos/${photoId}`, {
        withCredentials: true,
      });
      setPhotos(photos.filter((p) => p.id !== photoId));
      toast.success("✅ Photo deleted");
      onPhotoDeleted?.();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete photo");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-800">📸 Borrowed Items Photos</h2>
              <p className="text-sm text-gray-600 mt-1">Borrowed by: {borrowerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {!loading && photos.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Image className="w-12 h-12 mb-2 opacity-30" />
              <p>No photos captured for this borrow request</p>
            </div>
          )}

          {!loading && photos.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {photos.length} photo{photos.length > 1 ? "s" : ""} captured
              </p>

              {/* Full Screen View */}
              {selectedPhoto && (
                <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
                  <div className="max-w-4xl w-full">
                    <div className="flex justify-between items-center mb-4">
                      <button
                        onClick={() => setSelectedPhoto(null)}
                        className="text-white hover:text-gray-300 transition"
                      >
                        <X className="w-8 h-8" />
                      </button>
                      <div className="text-white text-sm">
                        {photos.findIndex((p) => p.id === selectedPhoto.id) + 1} of {photos.length}
                      </div>
                    </div>
                    <img
                      src={
                        selectedPhoto.photo_url?.startsWith("http")
                          ? selectedPhoto.photo_url
                          : `http://localhost:8000${selectedPhoto.photo_url}`
                      }
                      alt="Full view"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Photo Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => {
                  const photoUrl = photo.photo_url?.startsWith("http")
                    ? photo.photo_url
                    : `http://localhost:8000${photo.photo_url}`;

                  return (
                    <div
                      key={photo.id}
                      className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition"
                    >
                      {/* Image */}
                      <img
                        src={photoUrl}
                        alt="Borrowed item"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        onClick={() => setSelectedPhoto(photo)}
                        onError={(e) => {
                          e.target.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='12'%3EUnable to load%3C/text%3E%3C/svg%3E";
                        }}
                      />

                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => handleDownload(photo)}
                          className="p-2 bg-white rounded-full hover:bg-blue-50 transition"
                          title="Download"
                        >
                          <Download className="w-5 h-5 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(photo.id)}
                          className="p-2 bg-white rounded-full hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5 text-red-600" />
                        </button>
                      </div>

                      {/* Metadata */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs">
                          {photo.photo_type || "item-photo"}
                        </p>
                        <p className="text-gray-300 text-xs">
                          {new Date(photo.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
