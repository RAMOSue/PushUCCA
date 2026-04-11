import { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

/**
 * Modal for borrower to initiate return of borrowed items
 * Shows which items can be returned and collects return notes
 * After confirmation, opens ReturnPhotoCaptureModal
 */
export default function InitiateReturnModal({
  isOpen,
  requestId,
  items = [],
  onClose,
  onReturnSubmitted,
}) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && items.length > 0) {
      // By default, select all items for return
      setSelectedItems(items.map((item) => item.id || item.unit_id || item.inventory_unit_id));
    }
  }, [isOpen, items]);

  const handleToggleItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleReturnSubmit = async () => {
    if (selectedItems.length === 0) {
      setError("Please select at least one item to return");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Create return request with selected items
      const response = await axios.post(
        `/api/borrow/return/initiate`,
        {
          borrowing_request_id: requestId,
          returned_unit_ids: selectedItems,
          notes,
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        toast.success("✅ Return initiated! Please proceed to capture photos.");
        
        // Close this modal and let parent open the photo capture modal
        if (onReturnSubmitted) {
          onReturnSubmitted({
            returnRequestId: response.data.return_request_id,
            selectedItems,
            notes,
          });
        }
        
        onClose();
      } else {
        setError(response.data.error || "Failed to initiate return");
      }
    } catch (err) {
      console.error("Return initiation error:", err);
      setError(err.response?.data?.error || "Failed to initiate return");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">↩️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Return Items</h2>
              <p className="text-sm text-gray-600">Select items to return</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Items to Return */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Items to Return</h3>
            
            {items.length === 0 ? (
              <p className="text-gray-600 text-sm italic">No items to return</p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const itemId = item.id || item.unit_id || item.inventory_unit_id;
                  const isSelected = selectedItems.includes(itemId);

                  return (
                    <label
                      key={itemId}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                        isSelected
                          ? "border-orange-600 bg-orange-50"
                          : "border-gray-200 bg-gray-50 hover:border-orange-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleItem(itemId)}
                        className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {item.item_name || item.name || "Unknown Item"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.size ? `Size: ${item.size}` : ""}{" "}
                          {item.category ? `• ${item.category}` : ""}
                        </p>
                      </div>
                      {isSelected && <CheckCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes Field */}
          <div className="space-y-2">
            <label className="block font-semibold text-gray-900 text-sm">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any damage or condition changes? Please note here..."
              className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
              disabled={loading}
            />
            <p className="text-xs text-gray-500">For transparency and record keeping</p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Next Step:</strong> After confirming, you'll need to capture photos of the returned items for verification.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReturnSubmit}
            disabled={loading || selectedItems.length === 0}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>✓ Confirm & Capture Photos</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
