import { useEffect, useState, useContext } from "react";
import axios from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { BorrowingContext } from "../../context/borrowingContext";

dayjs.extend(utc);
dayjs.extend(timezone);

function statusColor(status) {
  switch (status) {
    case "pending_return":
      return "text-orange-600";
    case "returned":
      return "text-green-600";
    case "declined":
      return "text-red-600";
    case "pending":
    default:
      return "text-gray-600";
  }
}

export default function ReturnItems() {
  const { refreshAfterReturn } = useContext(BorrowingContext);

  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch active requests
  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/borrow/requests");
      const active = res.data
        .map((r) => {
          // Compute status dynamically
          const allReturned = r.items.every((it) => {
            const borrowed = it.borrowed_quantity || it.unit_ids?.length || 0;
            const returned = it.unit_ids
              ? it.unit_ids.filter((u) => u.unit_status === "available").length
              : it.returned_quantity || 0;
            return borrowed - returned <= 0;
          });
          return {
            ...r,
            status: allReturned
              ? "returned"
              : r.status === "approved"
              ? "pending_return"
              : r.status,
          };
        })
        .filter((r) => r.status === "pending_return" || r.status === "returned");
      setRequests(active);
      // Update selectedRequest if currently viewing
      if (selectedRequest) {
        const updated = active.find((r) => r.id === selectedRequest.id) || null;
        setSelectedRequest(updated);
      }
    } catch (err) {
      console.error("Failed to fetch borrow requests:", err.message);
      setRequests([]);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const formatDateTime = (dateString) => {
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid()
      ? `${date.format("MMMM D, YYYY")} (${date.format("h:mm A")})`
      : "—";
  };

  const formatDate = (dateString) => {
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid() ? date.format("MMMM D, YYYY") : "—";
  };

  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    const initial = {};
    req.items.forEach((it) => {
      initial[it.item_id] = 0;
    });
    setReturnQuantities(initial);
    setMessage("");
  };

  const setQuantity = (itemId, newQty, maxRemain) => {
    const safe = Math.max(0, Math.min(newQty, maxRemain));
    setReturnQuantities((prev) => ({
      ...prev,
      [itemId]: safe,
    }));
  };

  const increment = (itemId, maxRemain) => {
    setQuantity(itemId, (returnQuantities[itemId] || 0) + 1, maxRemain);
  };

  const decrement = (itemId) => {
    setQuantity(itemId, (returnQuantities[itemId] || 0) - 1, Infinity);
  };

  const handleReturn = async () => {
    if (!selectedRequest) return;

    const unit_ids = [];
    const quantity_items = [];

    selectedRequest.items.forEach((it) => {
      const qty = Number(returnQuantities[it.item_id] || 0);
      if (qty <= 0) return;

      if (it.unit_ids && it.unit_ids.length > 0) {
        // Borrowed items tracked by units
        const notReturned = it.unit_ids.filter((u) => u.unit_status === "borrowed");
        unit_ids.push(...notReturned.slice(0, qty).map((u) => u.unit_id));
      } else if (it.borrowed_quantity) {
        // Borrowed items tracked by quantity (instruments/accessories)
        quantity_items.push({ item_id: it.item_id, quantity: qty });
      }
    });

    if (unit_ids.length === 0 && quantity_items.length === 0) {
      setMessage("Please specify at least one valid return quantity.");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/borrow/return", {
        request_id: selectedRequest.id,
        unit_ids,
        quantity_items,
      });

      setMessage("✅ Items successfully returned.");

      // Refresh stock and requests immediately
      if (refreshAfterReturn) await refreshAfterReturn();
      await fetchRequests();

      // Reset return quantities
      setReturnQuantities({});
    } catch (err) {
      console.error("Return error:", err?.response?.data || err.message);
      setMessage(
        `❌ Failed to return items: ${err?.response?.data?.error || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4 text-green-600">
        Manual / Partial Return of Borrowed Items
      </h2>

      {message && (
        <p
          className={`mb-4 ${
            message.startsWith("❌") ? "text-red-500" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}

      {!selectedRequest ? (
        <>
          <h3 className="text-lg font-semibold mb-2">Active Borrow Requests</h3>
          {requests.length === 0 ? (
            <p className="text-gray-500">No active borrow requests found.</p>
          ) : (
            <ul className="space-y-4">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="border rounded p-4 bg-gray-50 shadow hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSelectRequest(req)}
                >
                  <p className="font-semibold text-gray-700">
                    Borrower: {req.borrower_name}
                  </p>
                  <p className={statusColor(req.status)}>
                    Status: <span className="capitalize">{req.status}</span>
                  </p>
                  <p>Requested: {formatDate(req.request_date)}</p>
                  {req.due_date && <p>Due: {formatDate(req.due_date)}</p>}
                  {req.status === "returned" && req.returned_at && (
                    <p className="text-green-700">
                      Returned: {formatDateTime(req.returned_at)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <button
            className="mb-4 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            onClick={() => setSelectedRequest(null)}
            disabled={loading}
          >
            ← Back
          </button>

          <h3 className="text-lg font-semibold mb-2">
            Returning Items for {selectedRequest.borrower_name}
          </h3>

          <ul className="space-y-3">
            {selectedRequest.items.map((it) => {
              const borrowed = it.borrowed_quantity || it.unit_ids?.length || 0;
              const returned = it.unit_ids
                ? it.unit_ids.filter((u) => u.unit_status === "available").length
                : it.returned_quantity || 0;
              const remain = borrowed - returned;
              const isDone = remain <= 0;

              return (
                <li
                  key={it.item_id}
                  className={`border p-3 rounded ${
                    isDone ? "bg-green-100" : "bg-gray-50"
                  }`}
                >
                  <p className="font-semibold">{it.item_name}</p>
                  <p className="text-sm text-gray-600">
                    Borrowed: {borrowed} • Returned: {returned} • Remaining:{" "}
                    {remain}
                  </p>

                  {!isDone && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => decrement(it.item_id)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold"
                        disabled={(returnQuantities[it.item_id] || 0) <= 0}
                      >
                        −
                      </button>
                      <span className="w-10 text-center">
                        {returnQuantities[it.item_id] || 0}
                      </span>
                      <button
                        onClick={() => increment(it.item_id, remain)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold"
                        disabled={(returnQuantities[it.item_id] || 0) >= remain}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {isDone && (
                    <p className="text-green-700 text-sm mt-1">
                      Fully returned{" "}
                      {selectedRequest.returned_at &&
                        `(on ${formatDateTime(selectedRequest.returned_at)})`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <button
            className={`mt-6 px-4 py-2 rounded ${
              loading
                ? "bg-gray-400"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
            onClick={handleReturn}
            disabled={loading}
          >
            {loading ? "Processing..." : "Return Selected Items"}
          </button>
        </>
      )}
    </div>
  );
}
