// src/pages/staff/ReturnItems.jsx
import { useEffect, useState, useContext } from "react";
import axios from "axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { BorrowingContext } from "../../context/borrowingContext";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

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
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [returnQuantities, setReturnQuantities] = useState({});
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Fetch all requests and determine status
  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/borrow/requests");
      const active = res.data
        .map((r) => {
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
        .filter((r) => r.due_date);
      setRequests(active);
      setFilteredRequests(active);
    } catch (err) {
      console.error("Failed to fetch borrow requests:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Only show red dots for items that are NOT yet returned
  const dueDates = new Set(
    requests
      .filter((r) => r.status !== "returned")
      .map((r) => dayjs(r.due_date).tz("Asia/Manila").toDate().toDateString())
  );

  const handleDateClick = (date) => {
    const clicked = date.toDateString();
    const sameDay = requests.filter(
      (r) => dayjs(r.due_date).tz("Asia/Manila").toDate().toDateString() === clicked
    );
    setFilteredRequests(sameDay);
    setSelectedDate(clicked);
    setIsModalOpen(true);
  };

  const handleReturn = async () => {
    if (!selectedRequest) return;
    const unit_ids = [];
    const quantity_items = [];

    selectedRequest.items.forEach((it) => {
      const qty = Number(returnQuantities[it.item_id] || 0);
      if (qty <= 0) return;
      if (it.unit_ids?.length > 0) {
        const notReturned = it.unit_ids.filter((u) => u.unit_status === "borrowed");
        unit_ids.push(...notReturned.slice(0, qty).map((u) => u.unit_id));
      } else if (it.borrowed_quantity) {
        quantity_items.push({ item_id: it.item_id, quantity: qty });
      }
    });

    if (unit_ids.length === 0 && quantity_items.length === 0) {
      setMessage("Please select at least one item to return.");
      return;
    }

    setProcessing(true);
    try {
      await axios.post("/api/borrow/return", {
        request_id: selectedRequest.id,
        unit_ids,
        quantity_items,
      });
      setMessage("✅ Items successfully returned.");
      if (refreshAfterReturn) await refreshAfterReturn();
      await fetchRequests();
      setReturnQuantities({});
      setSelectedRequest(null);
    } catch (err) {
      console.error("Return error:", err);
      setMessage("❌ Failed to return items.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="text-center mt-10 text-gray-600">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded mt-6">
      <h1 className="text-3xl font-bold text-green-600 mb-6 text-center">
        Borrowed Items Due Calendar
      </h1>

      {/* Calendar */}
      <div className="flex justify-center mb-8">
        <Calendar
          onClickDay={handleDateClick}
          tileContent={({ date }) =>
            dueDates.has(date.toDateString()) ? (
              <div className="relative flex justify-center items-center">
                <div className="absolute bottom-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
            ) : null
          }
        />
      </div>

      {/* Two-Column Layout: Approved & Declined */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Approved Requests Column */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-green-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
            Approved Requests (Waiting for Return)
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {requests.filter((r) => r.status === "pending_return").length === 0 ? (
              <p className="text-center text-gray-500 py-4">No approved requests waiting for return</p>
            ) : (
              requests
                .filter((r) => r.status === "pending_return")
                .map((req) => (
                  <div
                    key={req.id}
                    className="bg-white border border-green-100 rounded p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      setSelectedRequest(req);
                    }}
                  >
                    <p className="font-semibold text-gray-800">{req.borrower_name}</p>
                    <p className="text-sm text-gray-600">
                      Due: {dayjs(req.due_date).tz("Asia/Manila").format("MMM D, YYYY")}
                    </p>
                    <ul className="list-disc list-inside text-xs text-gray-700 mt-2">
                      {req.items.map((item, idx) => (
                        <li key={idx}>
                          {item.item_name} x{item.unit_ids?.length || item.borrowed_quantity || 1}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(req);
                      }}
                      className="mt-2 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                    >
                      Process Return
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Declined Requests Column */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-red-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
            Declined Requests
          </h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {requests.filter((r) => r.status === "declined").length === 0 ? (
              <p className="text-center text-gray-500 py-4">No declined requests</p>
            ) : (
              requests
                .filter((r) => r.status === "declined")
                .map((req) => (
                  <div
                    key={req.id}
                    className="bg-white border border-red-100 rounded p-4 hover:shadow-md transition-shadow"
                  >
                    <p className="font-semibold text-gray-800">{req.borrower_name}</p>
                    <p className="text-sm text-gray-600">
                      Requested: {dayjs(req.request_date).tz("Asia/Manila").format("MMM D, YYYY")}
                    </p>
                    <ul className="list-disc list-inside text-xs text-gray-700 mt-2">
                      {req.items.map((item, idx) => (
                        <li key={idx}>
                          {item.item_name} x{item.unit_ids?.length || item.borrowed_quantity || 1}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-red-600 mt-2 italic">Declined</p>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Modal for Requests on Selected Date */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-4 text-green-600 text-center">
              Due Requests on {selectedDate}
            </h2>

            {filteredRequests.length === 0 ? (
              <p className="text-center text-gray-500">No due requests on this date.</p>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className="border p-4 rounded bg-gray-50 shadow-sm hover:bg-gray-100"
                  >
                    <p className="font-semibold text-lg">Borrower: {req.borrower_name}</p>
                    <p className={statusColor(req.status)}>
                      Status: <span className="capitalize">{req.status}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Due: {dayjs(req.due_date).tz("Asia/Manila").format("MMMM D, YYYY")}
                    </p>

                    <ul className="list-disc list-inside mt-2 text-sm text-gray-700">
                      {req.items.map((item, idx) => (
                        <li key={idx}>
                          {item.item_name}
                          {item.size ? ` (${item.size})` : ""} — x
                          {item.unit_ids?.length || item.borrowed_quantity || 1}
                        </li>
                      ))}
                    </ul>

                    {req.status === "pending_return" && (
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsModalOpen(false);
                        }}
                        className="mt-3 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                      >
                        Process Return
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Return Form Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-3xl w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl"
              onClick={() => setSelectedRequest(null)}
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-4 text-green-600 text-center">
              Return Items for {selectedRequest.borrower_name}
            </h2>

            {message && (
              <p
                className={`mb-3 text-center ${
                  message.startsWith("❌") ? "text-red-500" : "text-green-600"
                }`}
              >
                {message}
              </p>
            )}

            <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
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
                      Borrowed: {borrowed} • Returned: {returned} • Remaining: {remain}
                    </p>

                    {!isDone && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            setReturnQuantities((prev) => ({
                              ...prev,
                              [it.item_id]: Math.max((prev[it.item_id] || 0) - 1, 0),
                            }))
                          }
                          className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold"
                        >
                          −
                        </button>
                        <span className="w-10 text-center">
                          {returnQuantities[it.item_id] || 0}
                        </span>
                        <button
                          onClick={() =>
                            setReturnQuantities((prev) => ({
                              ...prev,
                              [it.item_id]: Math.min(
                                (prev[it.item_id] || 0) + 1,
                                remain
                              ),
                            }))
                          }
                          className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded hover:bg-gray-300 text-lg font-bold"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {isDone && (
                      <p className="text-green-700 text-sm mt-1">
                        Fully returned{" "}
                        {selectedRequest.returned_at &&
                          `(on ${dayjs(selectedRequest.returned_at)
                            .tz("Asia/Manila")
                            .format("MMMM D, YYYY h:mm A")})`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <button
              onClick={handleReturn}
              disabled={processing}
              className={`mt-6 w-full px-4 py-2 rounded text-white ${
                processing ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {processing ? "Processing..." : "Return Selected Items"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
