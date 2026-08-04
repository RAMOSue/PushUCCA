import { useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Camera, Music, QrCode, Sparkles } from "lucide-react";
import axios from "axios";
import { SidebarContext } from "../../context/SidebarContext";
import { UserContext } from "../../../context/userContext";

export default function RightSidebarContent({ onClose }) {
  const { setRightSidebarOpen, isMobile } = useContext(SidebarContext);
  const { user } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data } = await axios.get("/api/performances", { withCredentials: true });
        const items = Array.isArray(data) ? data : [];
        setEvents(items.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)).slice(0, 3));
      } catch (error) {
        console.error("Failed to load events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const handleScanner = (path) => {
    setRightSidebarOpen(false);
    onClose?.();
    navigate(path);
  };

  const compactEvents = useMemo(() => events, [events]);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/70">
        <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Quick tools
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleScanner(user?.role === "borrower" ? "/scan" : "/staff/scan")}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <QrCode className="h-3.5 w-3.5" />
            QR
          </button>
          <button
            type="button"
            onClick={() => handleScanner(user?.role === "borrower" ? "/scanner" : "/staff/scanner")}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-2 text-[10px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Camera className="h-3.5 w-3.5" />
            Scan
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Upcoming
          </p>
          {isMobile && <Sparkles className="h-3 w-3 text-amber-500" />}
        </div>

        {loading ? (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Loading…</p>
        ) : compactEvents.length === 0 ? (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">No events yet</p>
        ) : (
          <div className="space-y-1.5">
            {compactEvents.map((event, index) => (
              <div key={event.id || index} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start gap-1.5">
                  <Music className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-semibold text-slate-800 dark:text-slate-100">{event.title || "Performance"}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400">
                      {new Date(event.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
