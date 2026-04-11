import { useEffect, useState } from "react";
import { X, Camera, AlertCircle } from "lucide-react";
import axios from "axios";

/**
 * Component to display return photos captured by borrower
 * Used by staff to verify returned items
 */
export default function ReturnPhotosViewer({
  isOpen,
  requestId,
  borrowerName,
  onClose,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    if (!isOpen || !requestId) return;

    const loadPhotos = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await axios.get(
          `/api/borrow/return/photos/${requestId}`,
          { withCredentials: true }
        );

        if (response.data.success) {
          setPhotos(response.data.photos || []);
          if (!response.data.photos || response.data.photos.length === 0) {
            setError("No return photos found for this request.");
          }
        } else {
          setError(response.data.error || "Failed to load photos");
        }
      } catch (err) {
        console.error("Failed to load return photos:", err);
        setError(
          err.response?.data?.error ||
            "Error loading return photos. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    loadPhotos();
  }, [isOpen, requestId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-cyan-50 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Camera size={24} className="text-blue-600" />
              Return Photos
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Borrower: <span className="font-semibold">{borrowerName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-600">Loading photos...</p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && photos.length > 0 && (
            <div>
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Total Photos: <span className="text-blue-600">{photos.length}</span>
                </h3>
              </div>

              {/* Photo Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="relative rounded-lg overflow-hidden cursor-pointer group bg-gray-100"
                  >
                    <img
                      src={photo.photo_url}
                      alt={`Return photo ${idx + 1}`}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Camera size={24} className="text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 group-hover:bg-opacity-80 transition-all">
                      <p className="truncate">
                        {new Date(photo.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && photos.length === 0 && !error && (
            <div className="text-center py-12">
              <Camera size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No return photos captured yet</p>
            </div>
          )}
        </div>

        {/* Full-screen Photo Viewer */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div
              className="relative max-w-4xl max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedPhoto.photo_url}
                alt="Full view"
                className="max-w-full max-h-[85vh] object-contain"
              />
              <div className="mt-3 bg-black bg-opacity-75 text-white p-3 rounded text-center text-sm">
                <p>{new Date(selectedPhoto.uploaded_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-2 right-2 p-2 bg-white rounded-full hover:bg-gray-200"
              >
                <X size={24} className="text-black" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
