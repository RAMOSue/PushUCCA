import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { UserContext } from "../../context/userContext";
import { ArrowLeft } from "lucide-react";

export default function MyBorrowedItems() {
  const { user } = useContext(UserContext);
  const [borrowHistory, setBorrowHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Format date like "October 7, 2025"
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date)) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const todayDate = formatDate(new Date());

  const formatRelativeDays = (dueDateStr) => {
    if (!dueDateStr) return "";
    const due = new Date(dueDateStr);
    const today = new Date();
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)} day(s) overdue`;
    if (diff === 0) return `Due today`;
    if (diff === 1) return `Due tomorrow`;
    return `Due in ${diff} day(s)`;
  };

  useEffect(() => {
    const fetchBorrowHistory = async () => {
      try {
        const res = await axios.get(`/api/borrow/history/${user.id}`);
        // ✅ Group by request_id to avoid duplicate entries
        const grouped = [];
        const map = new Map();

        res.data.forEach((req) => {
          if (!map.has(req.request_id)) {
            map.set(req.request_id, { ...req, items: req.items || [] });
            grouped.push(map.get(req.request_id));
          } else if (req.items && req.items.length) {
            const existing = map.get(req.request_id);
            existing.items = [...existing.items, ...req.items];
          }
        });

        setBorrowHistory(grouped);
      } catch (err) {
        console.error("Failed to fetch borrow history:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchBorrowHistory();
  }, [user]);

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === "returned") return false;
    const today = new Date();
    return new Date(dueDate) < today;
  };

  if (loading)
    return <div className="text-center mt-10 text-gray-500">Loading...</div>;

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Header */}
      <div className="p-3 flex justify-between items-center sticky top-0 bg-white z-10 shadow-sm">
        <h1 className="text-lg font-bold text-blue-600">My Borrowed Items</h1>
        <Link
          to="/available-items"
          className="flex items-center gap-1 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft size={18} /> Back
        </Link>
      </div>

      {/* Today’s Date */}
      <div className="max-w-4xl mx-auto mt-4 px-3 sm:px-6">
        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-3 rounded-lg text-center shadow-sm">
          <p className="font-semibold text-sm sm:text-base">
            📅 Today is <span className="text-blue-800">{todayDate}</span>
          </p>
        </div>
      </div>

      {/* Borrow History */}
      <div className="max-w-4xl mx-auto mt-6 p-3 sm:p-6">
        {(() => {
          // Do not show requests in 'reserved' state yet
          const visible = borrowHistory.filter((r) => r.status !== "reserved");
          if (visible.length === 0) {
            return (
              <div className="text-center mt-10 text-gray-600">
                You have no active requests. Reserved items are saved in your cart and
                will appear here after you submit them. 
                <div className="mt-3 text-sm text-gray-500">If you already submitted, please refresh or check back shortly.</div>
              </div>
            );
          }

          return visible.map((request, index) => (
            <div
              key={request.request_id || `req-${index}`}
              className="mb-6 border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm bg-white"
            >
              {/* Header: status badge + dates */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  {/* Status badge */}
                  <div>
                    {request.status === "pending" && (
                      <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Pending — waiting for approval
                      </span>
                    )}
                    {request.status === "approved" && (
                      <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Approved — please return by {formatDate(request.due_date)}
                      </span>
                    )}
                    {request.status === "returned" && (
                      <span className="inline-block bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Returned
                      </span>
                    )}
                    {request.status === "pending_return" && (
                      <span className="inline-block bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">
                        Pending return
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600">
                    <div className="font-medium">Requested: {formatDate(request.request_date)}</div>
                    {request.status !== "returned" && (
                      <div className="text-xs text-gray-500">{formatRelativeDays(request.due_date)}</div>
                    )}
                  </div>
                </div>

                {/* Friendly note area */}
                <div className="text-sm text-right text-gray-600">
                  {request.status === "pending" && (
                    <div>
                      We'll notify you when a staff member reviews your request. No further action is needed.
                    </div>
                  )}
                  {request.status === "approved" && (
                    <div>
                      Your request is approved. Please return the items on or before the due date to avoid penalties.
                    </div>
                  )}
                  {request.status === "returned" && (
                    <div>
                      Thank You! This request has been marked returned.
                      {request.returned_at && (
                        <div className="text-xs text-gray-500">Returned: {formatDate(request.returned_at)}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Borrowed Items: mobile-first cards (sm) + table for md+ */}
              {request.items && request.items.length > 0 ? (
                <div className="mt-4">
                  {/* Mobile: stacked cards */}
                  <div className="block md:hidden space-y-3">
                    {request.items.map((item, i) => (
                      <div
                        key={`${request.request_id}-item-mobile-${i}`}
                        className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">
                              {item.item_name || item.name || "N/A"}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Size: <span className="capitalize">{item.size || "N/A"}</span>
                              {' • '}
                              Condition: <span className="capitalize">{item.condition || "N/A"}</span>
                            </div>
                          </div>

                          <div className="text-right text-xs text-gray-500 w-28 flex-shrink-0">
                            {request.status === "approved" && (
                              <div>Return by<br/><span className="font-medium text-gray-800">{formatDate(request.due_date)}</span></div>
                            )}
                            {request.status === "pending" && <div>Waiting<br/>for approval</div>}
                            {request.status === "returned" && <div className="text-green-600">Returned</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table view */}
                  <div className="hidden md:block mt-2 overflow-x-auto">
                    <table className="w-full border-t border-gray-200 text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700">
                          <th className="py-2 px-2 text-left w-2/6">Item(s)</th>
                          <th className="py-2 px-2 text-left w-1/6">Size</th>
                          <th className="py-2 px-2 text-left w-1/6">Condition</th>
                          <th className="py-2 px-2 text-left w-1/6">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {request.items.map((item, i) => (
                          <tr key={`${request.request_id}-item-${i}`} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="py-2 px-2 truncate">{item.item_name || item.name || "N/A"}</td>
                            <td className="py-2 px-2 capitalize">{item.size || "N/A"}</td>
                            <td className="py-2 px-2 capitalize">{item.condition || "N/A"}</td>
                            <td className="py-2 px-2 text-xs text-gray-500">
                              {request.status === "approved" && <span>Return by {formatDate(request.due_date)}</span>}
                              {request.status === "pending" && <span>Waiting for approval</span>}
                              {request.status === "returned" && <span>Item returned</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 italic mt-3 text-sm sm:text-base">No item details available.</p>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
