import { useEffect, useState, useContext } from "react";
import axios from "axios";
import { UserContext } from "../../context/userContext";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "text-yellow-600";
    case "approved":
      return "text-green-600";
    case "rejected":
      return "text-red-600";
    case "returned":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
}

export default function DashboardBorrower() {
  const { user } = useContext(UserContext);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!user || !user.db_id) return; // use integer ID

    const fetchHistory = async () => {
      try {
        const res = await axios.get(`/api/borrow/history/${user.db_id}`);
        setHistory(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      }
    };

    fetchHistory();
  }, [user]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid() ? date.format("MMMM D, YYYY") : "—";
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-blue-500">
        Your Borrow History
      </h2>
      {history.length === 0 ? (
        <p className="text-gray-500">You have no borrow requests yet.</p>
      ) : (
        <ul className="space-y-4">
          {history.map((request) => (
            <li
              key={request.request_id}
              className="border rounded p-4 shadow-sm bg-gray-50"
            >
              <p className="font-semibold text-gray-700">
                Request ID: {request.request_id}
              </p>
              <p className={getStatusColor(request.status)}>
                Status: <span className="capitalize">{request.status}</span>
              </p>
              <div className="mt-2">
                <p className="font-medium text-gray-600">Items:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  {(request.items || []).map((item, i) => {
                    const borrowed = item.quantity_borrowed || 0;
                    const returned = item.returned_quantity || 0;
                    const remain = borrowed - returned;
                    return (
                      <li key={i}>
                        {item.item_name} — {returned}/{borrowed} returned
                        {remain > 0 && (
                          <span className="text-orange-600">
                            {" "}
                            (remaining {remain})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p>
                Requested:{" "}
                {formatDate(request.request_date || request.created_at)}
              </p>
              {request.due_date && <p>Due: {formatDate(request.due_date)}</p>}
              {request.returned_date && (
                <p>Returned: {formatDate(request.returned_date)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
