import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../context/userContext";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ArrowLeft } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);

function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "text-yellow-600";
    case "approved":
      return "text-green-600";
    case "declined":
      return "text-red-600";
    case "returned":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
}

export default function BorrowerHistory() {
  const { user } = useContext(UserContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`/api/borrow/history/${user.id}`);
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid() ? date.format("MMM D, YYYY") : "—";
  };

  if (loading)
    return <div className="text-center mt-10 text-gray-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-blue-600">My Borrow History</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded-lg"
          >
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">You have no borrow requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((request) => (
              <li
                key={request.request_id}
                className="border rounded p-3 sm:p-4 bg-gray-50 shadow-sm text-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-700">Request ID: {request.request_id}</p>
                    <p className={`${getStatusColor(request.status)} capitalize`}>Status: {request.status}</p>
                  </div>

                  <div className="text-right text-xs text-gray-600">
                    <p>Requested: {formatDate(request.request_date || request.created_at)}</p>
                    {request.due_date && <p>Due: {formatDate(request.due_date)}</p>}
                    {request.returned_date && <p>Returned: {formatDate(request.returned_date)}</p>}
                  </div>
                </div>

                <div className="mt-3">
                  <p className="font-medium text-gray-600">Items:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {(request.items || []).map((item, i) => {
                      const remaining = (item.borrowed_quantity || 0) - (item.returned_quantity || 0);
                      return (
                        <li key={i} className="flex justify-between items-center">
                          <div>
                            <span className="font-semibold">{item.item_name}</span> — {item.returned_quantity}/{item.borrowed_quantity} returned
                            {remaining > 0 && (
                              <span className="text-orange-600"> (remaining {remaining})</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
