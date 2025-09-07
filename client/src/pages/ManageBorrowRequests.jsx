import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";
import toast from "react-hot-toast";

export default function ManageBorrowRequests() {
  const { user } = useContext(UserContext);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dueDates, setDueDates] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  // Fetch all borrowing requests
  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/borrow/requests");

      // Normalize items for display consistency
      const normalized = res.data.map((req) => ({
        ...req,
        items: req.items.map((item) => {
          let displayCategory = "Costume";

          if (item.category && item.category.toLowerCase() === "instrument") {
            displayCategory = "Instrument";
          } else if (
            item.garment_type &&
            item.garment_type.toLowerCase() === "accessory"
          ) {
            displayCategory = "Accessory";
          }

          return {
            ...item,
            displayName: `${item.item_name}${
              item.size ? ` (${item.size})` : ""
            }`,
            displayCategory,
            displayQuantity: item.unit_ids?.length || item.quantity || 1,
          };
        }),
      }));

      setRequests(normalized);
    } catch (err) {
      console.error("❌ Failed to load requests:", err.message);
      toast.error("Failed to load borrow requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    const due_date = dueDates[id];
    if (!due_date) {
      toast.error("Please select a due date before approving.");
      return;
    }

    setActionLoading((prev) => ({ ...prev, [id]: true }));

    try {
      await axios.put(`/api/borrow/requests/${id}/approve`, {
        staff_id: user.id,
        due_date,
      });
      toast.success("✅ Request approved");
      fetchRequests(); // refresh list
    } catch (err) {
      console.error("❌ Approve error:", err.message);
      toast.error("Failed to approve request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDecline = async (id) => {
    if (!window.confirm("Are you sure you want to decline this request?")) return;

    setActionLoading((prev) => ({ ...prev, [id]: true }));

    try {
      await axios.put(`/api/borrow/requests/${id}/decline`);
      toast.success("❌ Request declined");

      // Immediately remove declined request from UI
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("❌ Decline error:", err.message);
      toast.error("Failed to decline request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (loading) return <div className="text-center mt-10">Loading requests...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded mt-6">
      <h1 className="text-3xl font-bold text-blue-600 mb-6">
        Manage Borrow Requests
      </h1>

      {requests.length === 0 ? (
        <p>No borrow requests found.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="border p-4 rounded shadow-sm bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center"
            >
              <div>
                <p className="font-semibold text-lg">
                  Borrower: {req.borrower_name}
                </p>
                <p>
                  Status:{" "}
                  <span
                    className={`px-2 py-1 rounded text-white ${
                      req.status === "pending"
                        ? "bg-yellow-500"
                        : req.status === "approved"
                        ? "bg-green-600"
                        : req.status === "declined"
                        ? "bg-red-600"
                        : req.status === "returned"
                        ? "bg-blue-600"
                        : "bg-gray-600"
                    }`}
                  >
                    {req.status.toUpperCase()}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Requested: {new Date(req.request_date).toLocaleString("en-US", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hour12: true,
})}
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-gray-700">
                  {req.items.map((item, idx) => (
                    <li key={idx}>
                      {item.displayName} ({item.displayCategory}) — x
                      {item.displayQuantity}
                    </li>
                  ))}
                </ul>
              </div>

              {req.status === "pending" && (
                <div className="mt-3 md:mt-0 flex flex-col items-start gap-2">
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full"
                    onChange={(e) =>
                      setDueDates((prev) => ({
                        ...prev,
                        [req.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actionLoading[req.id]}
                    className={`bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 w-full ${
                      actionLoading[req.id]
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {actionLoading[req.id] ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDecline(req.id)}
                    disabled={actionLoading[req.id]}
                    className={`bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 w-full ${
                      actionLoading[req.id]
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {actionLoading[req.id] ? "Declining..." : "Decline"}
                  </button>
                </div>
              )}

              {req.status === "approved" && (
                <div className="mt-3 md:mt-0 text-right">
                  {req.due_date && (
                    <p className="text-sm text-gray-600">
                      Due: {new Date(req.due_date).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">✔ Waiting for return</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
