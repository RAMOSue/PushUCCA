// src/pages/staff/ManageBorrowRequests.jsx
import { useEffect, useState, useContext } from "react";
import { useLocation } from 'react-router-dom';
import axios from "axios";
import { UserContext } from "../../context/userContext";
import toast from "react-hot-toast";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

export default function ManageBorrowRequests() {
  const { user } = useContext(UserContext);
  const location = useLocation();
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dueDates, setDueDates] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  // Fetch requests
  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/borrow/requests");
      const normalized = res.data.map((req) => ({
        ...req,
        items: req.items.map((item) => {
          let displayCategory = "Costume";
          if (item.category?.toLowerCase() === "instrument") displayCategory = "Instrument";
          else if (item.garment_type?.toLowerCase() === "accessory") displayCategory = "Accessory";

          return {
            ...item,
            displayName: `${item.item_name}${item.size ? ` (${item.size})` : ""}`,
            displayCategory,
            displayQuantity: item.unit_ids?.length || item.quantity || 1,
          };
        }),
      }));
  // Hide any requests that are still in 'reserved' status (staff view)
  const visible = normalized.filter((r) => r.status !== "reserved");
  setRequests(visible);
  setFilteredRequests(visible);
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

  // If the URL contains ?openRequestId=..., open modal for that request after we load requests
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openRequestId = params.get('openRequestId');
    if (!openRequestId) return;
    // wait until requests are loaded
    if (requests.length === 0) return;

    const match = requests.find((r) => String(r.id) === String(openRequestId));
    if (match) {
      setFilteredRequests([match]);
      setSelectedDate(new Date(match.request_date).toDateString());
      setIsModalOpen(true);
    }
  }, [location.search, requests]);

  // Filter by status
  useEffect(() => {
    if (filter === "all") setFilteredRequests(requests);
    else setFilteredRequests(requests.filter((r) => r.status === filter));
  }, [filter, requests]);

  const handleApprove = async (id) => {
    const due_date = dueDates[id];
    if (!due_date) return toast.error("Please select a due date before approving.");

    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await axios.put(`/api/borrow/requests/${id}/approve`, {
        staff_id: user.id,
        due_date,
      });
      toast.success("✅ Request approved");
      fetchRequests();
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
      // send reason (optional) and use JSON body
      const resp = await axios.put(`/api/borrow/requests/${id}/decline`, {
        reason: 'Declined by staff'
      });

      if (resp?.data?.success) {
        toast.success("✅ Request declined");
        // Refresh list and also emit event so notifications UI updates
        fetchRequests();
        try { window.dispatchEvent(new Event('notifications:updated')); } catch(e){}
      } else {
        console.error('❌ Decline API did not return success:', resp?.data);
        toast.error('Failed to decline request');
      }
    } catch (err) {
      console.error("❌ Decline error:", err?.response?.data || err.message || err);
      toast.error("Failed to decline request: " + (err?.response?.data?.error || err.message || 'Server error'));
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Get all request dates for highlighting in calendar
  const requestDates = new Set(
    requests.map((r) => new Date(r.request_date).toDateString())
  );

  const handleDateClick = (date) => {
    const clicked = new Date(date).toDateString();
    const sameDayRequests = requests.filter(
      (r) => new Date(r.request_date).toDateString() === clicked
    );
    setFilteredRequests(sameDayRequests);
    setSelectedDate(clicked);
    setIsModalOpen(true);
  };

  if (loading)
    return <div className="text-center mt-10 text-gray-600">Loading requests...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded mt-6">
      <h1 className="text-3xl font-bold text-blue-600 mb-6 text-center">
        Manage Borrow Requests (Calendar View)
      </h1>

      {/* Filter Dropdown */}
      <div className="flex justify-center mb-4">
        <label className="mr-2 text-gray-700 font-medium">Filter:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      {/* Calendar */}
      <div className="flex justify-center">
        <Calendar
          onClickDay={handleDateClick}
          tileContent={({ date }) =>
            requestDates.has(date.toDateString()) ? (
              <div className="flex justify-center mt-1">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              </div>
            ) : null
          }
          tileClassName={({ date }) =>
            requestDates.has(date.toDateString()) ? "bg-blue-100 rounded-full" : null
          }
        />
      </div>

      {/* Modal for Requests of Selected Date */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-4 text-blue-600 text-center">
              Borrow Requests on {selectedDate}
            </h2>

            {filteredRequests.length === 0 ? (
              <p className="text-center text-gray-500">No requests found on this date.</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {filteredRequests.map((req) => (
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
                        Requested:{" "}
                        {new Date(req.request_date).toLocaleString("en-US", {
                          year: "numeric",
                          month: "short",
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
        </div>
      )}
    </div>
  );
}
