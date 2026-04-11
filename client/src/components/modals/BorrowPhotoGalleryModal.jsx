import { useEffect, useState } from "react";
import { Image as ImageIcon, X, Download, Trash2, AlertCircle } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Modal to view photos of a borrow request
 * Used by staff to see items before/after borrowing
 */
export default function BorrowPhotoGalleryModal({ isOpen, requestId, borrowerName, onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch photos when modal opens
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const fetchPhotos = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await axios.get(`/api/borrow/photos/${requestId}`, {
          withCredentials: true,
        });

        if (response.data.success) {
          setPhotos(response.data.photos || []);
        } else {
          setError("Failed to load photos");
        }
      } catch (err) {
        console.error("Fetch photos error:", err);
        setError(err.response?.data?.error || "Failed to load photos");
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [isOpen, requestId]);

  const handleDelete = async (photoId) => {
    if (!window.confirm("Delete this photo?")) return;

    try {
      const response = await axios.delete(`/api/borrow/photos/${photoId}`, {
        withCredentials: true,
      });

      if (response.data.success) {
        setPhotos(photos.filter((p) => p.id !== photoId));
        toast.success("Photo deleted");
      }
    } catch (err) {
      toast.error("Failed to delete photo");
    }
  };

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
      link.download = `photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Photo downloaded");
    } catch (err) {
      toast.error("Failed to download photo");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold">📷 Item Photos</h2>
              {borrowerName && <p className="text-sm text-gray-600">Borrower: {borrowerName}</p>}
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
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin border-4 border-blue-200 border-t-blue-600 rounded-full w-12 h-12"></div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {!loading && !error && photos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500">
              <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
              <p>No photos captured yet</p>
            </div>
          )}

          {!loading && photos.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Total: <strong>{photos.length}</strong> photo{photos.length !== 1 ? "s" : ""}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo) => {
                  const photoUrl = photo.photo_url?.startsWith('http')
                    ? photo.photo_url
                    : `http://localhost:8000${photo.photo_url}`;
                  
                  return (
                    <div
                      key={photo.id}
                      className="relative group bg-gray-100 rounded-lg overflow-hidden aspect-square hover:shadow-lg transition"
                    >
                      <img
                        src={photoUrl}
                        alt={photo.photo_type}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-family='system-ui' font-size='12' fill='%239ca3af'%3EImage not found%3C/text%3E%3C/svg%3E";
                        }}
                      />

                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => handleDownload(photo)}
                          title="Download"
                          className="p-2 bg-white rounded-full hover:bg-blue-600 hover:text-white transition"
                        >
                          <Download className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleDelete(photo.id)}
                          title="Delete"
                          className="p-2 bg-white rounded-full hover:bg-red-600 hover:text-white transition"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Type badge */}
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        {photo.photo_type}
                      </div>

                      {/* Date */}
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        {new Date(photo.uploaded_at).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex justify-end">
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
