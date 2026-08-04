import { useContext, useState, useEffect } from "react";
import { Music, QrCode, Camera, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import Calendar from "react-calendar";
import { SidebarContext } from "../../context/SidebarContext";
import { UserContext } from "../../../context/userContext";
import axios from "axios";
import "react-calendar/dist/Calendar.css";

export default function RightSidebarContent({ isMobile = false, onClose }) {
  const { rightSidebarOpen, setRightSidebarOpen, isMobile: contextIsMobile } = useContext(SidebarContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingApproval, setPendingApproval] = useState(0);
  const [activeBorrows, setActiveBorrows] = useState(0);
  const [returnedItems, setReturnedItems] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [allPerformances, setAllPerformances] = useState([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const responsiveMobile = isMobile || contextIsMobile;

  const fetchStats = async () => {
    try {
      setLoading(true);

      if (user?.role === "staff" || user?.role === "admin") {
        const requestsRes = await axios.get("/api/borrow/requests", {
          withCredentials: true,
        });
        const pendingCount = requestsRes.data.filter((r) => r.status === "pending").length;
        setPendingApproval(pendingCount);
      }

      if (user?.role === "borrower") {
        const historyRes = await axios.get(`/api/borrow/history/${user.id}`, {
          withCredentials: true,
        });
        const history = Array.isArray(historyRes.data) ? historyRes.data : [];
        const active = history.filter((h) => h.status === "approved").length;
        const returned = history.filter((h) => h.status === "returned").length;
        setActiveBorrows(active);
        setReturnedItems(returned);
      }

      const performancesRes = await axios.get("/api/performances", {
        withCredentials: true,
      });
      const data = Array.isArray(performancesRes.data) ? performancesRes.data : [];
      const sortedData = [...data].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      setAllPerformances(sortedData);
      setUpcomingEvents(sortedData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch stats:", error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }).toUpperCase();
  };

  const formatEventTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleCalendarDateClick = (date) => {
    setSelectedCalendarDate(date);
  };

  const performanceDates = new Set(
    allPerformances.map((p) => new Date(p.start_time).toDateString())
  );

  const getOrderedEvents = () => {
    const baseEvents = allPerformances.length > 0 ? allPerformances : upcomingEvents;

    if (!selectedCalendarDate) return baseEvents;

    const selectedDateString = selectedCalendarDate.toDateString();
    const selectedEvents = baseEvents.filter(
      (event) => new Date(event.start_time).toDateString() === selectedDateString
    );

    if (selectedEvents.length === 0) return baseEvents;

    const otherEvents = baseEvents.filter(
      (event) => !selectedEvents.some((selectedEvent) => selectedEvent.id === event.id)
    );

    return [...selectedEvents, ...otherEvents];
  };

  const orderedEvents = getOrderedEvents();

  const isBorrowerScannerOpen = location.pathname === "/scan" || location.pathname === "/scanner";
  const isStaffScannerOpen = location.pathname === "/staff/scan" || location.pathname === "/staff/scanner";

  const handleQRScannerClick = () => {
    if (user?.role === "borrower") {
      if (isBorrowerScannerOpen) {
        setRightSidebarOpen(true);
        onClose?.();
        navigate(-1);
        return;
      }

      setRightSidebarOpen(false);
      onClose?.();
      navigate("/scan");
      return;
    }

    if (user?.role === "staff") {
      if (isStaffScannerOpen) {
        setRightSidebarOpen(true);
        onClose?.();
        navigate("/staff");
        return;
      }

      setRightSidebarOpen(false);
      onClose?.();
      navigate("/staff/scan");
    }
  };

  const handleInstrumentScannerClick = () => {
    if (user?.role === "borrower") {
      if (isBorrowerScannerOpen) {
        setRightSidebarOpen(true);
        onClose?.();
        navigate(-1);
        return;
      }

      setRightSidebarOpen(false);
      onClose?.();
      navigate("/scanner");
      return;
    }

    if (user?.role === "staff") {
      if (isStaffScannerOpen) {
        setRightSidebarOpen(true);
        onClose?.();
        navigate("/staff");
        return;
      }

      setRightSidebarOpen(false);
      onClose?.();
      navigate("/staff/scanner");
    }
  };

  const scannerButtons = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        title="QR Scanner"
        aria-label="QR Scanner"
        onClick={handleQRScannerClick}
        className="group flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <QrCode className="h-4 w-4 transition-transform duration-200 ease-in-out group-hover:scale-110" />
      </button>

      <button
        type="button"
        title="AI Scanner"
        aria-label="AI Scanner"
        onClick={handleInstrumentScannerClick}
        className="group flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
      >
        <Camera className="h-4 w-4 transition-transform duration-200 ease-in-out group-hover:scale-110" />
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          aside.right-navbar {
            transition: width 250ms ease-in-out,
                        opacity 250ms ease-in-out;
            background-color: var(--bg-dark, transparent);
          }

          aside.right-navbar::-webkit-scrollbar {
            width: 6px;
          }

          aside.right-navbar::-webkit-scrollbar-track {
            background: transparent;
          }

          aside.right-navbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }

          aside.right-navbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        }

        .calendar-wrapper .react-calendar {
          background: transparent;
          border: none;
          font-family: inherit;
          width: 100%;
        }
        .calendar-wrapper .react-calendar__tile {
          padding: 0.2rem 0;
          background: transparent;
          border: none;
          color: inherit;
          font-size: 0.68rem;
          min-height: 1.7rem;
        }
        .calendar-wrapper .react-calendar__tile:hover {
          background-color: rgba(59, 130, 246, 0.1);
          border-radius: 0.25rem;
        }
        .calendar-wrapper .react-calendar__tile--active {
          background-color: rgba(59, 130, 246, 0.2);
          border-radius: 0.25rem;
          color: rgb(59, 130, 246);
          font-weight: 600;
        }
        .calendar-wrapper .react-calendar__tile--now {
          background-color: rgba(59, 130, 246, 0.1);
          border-radius: 0.25rem;
        }
        .calendar-wrapper .react-calendar__month-view__days__day--weekend {
          color: rgb(107, 114, 128);
        }
        .calendar-wrapper .react-calendar__navigation {
          display: grid;
          grid-template-columns: 36px 1fr 36px;
          align-items: center;
          margin-bottom: 0.5rem;
          gap: 0.25rem;
        }
        .calendar-wrapper .react-calendar__navigation__label {
          grid-column: 2;
          justify-self: center;
          text-align: center;
        }
        .calendar-wrapper .react-calendar__navigation button:first-child {
          grid-column: 1;
          justify-self: start;
        }
        .calendar-wrapper .react-calendar__navigation button:last-child {
          grid-column: 3;
          justify-self: end;
        }
        .calendar-wrapper .react-calendar__navigation button {
          background: transparent;
          border: none;
          color: rgb(55, 65, 81);
          font-size: 0.7rem;
          padding: 0.125rem 0.25rem;
        }
        .calendar-wrapper .react-calendar__navigation button:hover {
          background-color: rgba(59, 130, 246, 0.1);
          border-radius: 0.25rem;
        }
      `}</style>

      <aside
        className={`right-navbar ${responsiveMobile ? "flex h-full w-full border-l-0 bg-surface-container-low shadow-none dark:bg-[#1f1f1f]" : "hidden lg:flex h-full shrink-0 border-l border-outline-variant/10 bg-surface-container-low dark:border-[#2a2a2a] dark:bg-[#1f1f1f] shadow-2xl dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] z-30"} transition-all duration-300 ease-in-out ${responsiveMobile ? "" : rightSidebarOpen ? "w-64 opacity-100" : "w-14 opacity-100"}`}
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          willChange: "width",
          backfaceVisibility: "hidden",
          perspective: 1000,
          transform: "translateZ(0)",
        }}
      >
        <div className="flex h-full flex-col transition-all duration-250 ease-in-out">
          {responsiveMobile && (
            <div className="flex items-center justify-between border-b border-outline-variant/10 px-4 py-3 dark:border-[#3a3a3a]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant dark:text-gray-400">Quick Access</p>
              <button
                type="button"
                onClick={() => (onClose ? onClose() : setRightSidebarOpen(false))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!responsiveMobile && !rightSidebarOpen ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-3 transition-all duration-300 ease-in-out">
              {scannerButtons}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col transition-all duration-300 ease-in-out">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant dark:text-gray-400">Quick actions</p>
                    <div className="mt-3 flex flex-wrap gap-2">{scannerButtons}</div>
                  </div>

                  <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-3 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]">
                    <h3 className="text-center text-xs font-bold uppercase tracking-widest text-on-surface dark:text-white">Upcoming Events</h3>
                    <div className="calendar-wrapper mt-3 flex flex-1 flex-col overflow-hidden rounded border border-outline-variant/10 bg-surface-container-lowest p-2 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] transition-colors duration-300">
                      <Calendar
                        onClickDay={handleCalendarDateClick}
                        tileContent={({ date }) =>
                          performanceDates.has(date.toDateString()) ? (
                            <div className="mt-0.5 flex justify-center">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                            </div>
                          ) : null
                        }
                        tileClassName={({ date }) =>
                          performanceDates.has(date.toDateString()) ? "bg-primary/10" : null
                        }
                        className="w-full text-xs [&_.react-calendar]:text-xs [&_.react-calendar__tile]:p-0.5"
                      />
                    </div>

                    <div className="mt-3 max-h-[14rem] space-y-1 overflow-y-auto">
                      {orderedEvents.length === 0 ? (
                        <div className="rounded border border-outline-variant/10 bg-surface-container-lowest p-2 text-center transition-colors duration-300 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]">
                          <p className="text-[10px] text-on-surface-variant dark:text-gray-400">
                            {loading ? "Loading events..." : "No scheduled performances"}
                          </p>
                        </div>
                      ) : (
                        orderedEvents.map((event, idx) => (
                          <div
                            key={event.id || idx}
                            className="rounded border border-outline-variant/10 bg-surface-container-lowest p-2 transition-colors hover:border-primary/30 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:hover:border-blue-500/30"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-primary/10 dark:bg-blue-900/30">
                                <Music className="h-3 w-3 text-primary dark:text-blue-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-primary dark:text-blue-400">
                                  {formatEventDate(event.start_time)}
                                </p>
                                <p className="truncate text-[10px] font-semibold text-on-surface dark:text-white">
                                  {event.title || "Performance"}
                                </p>
                                <p className="text-[9px] text-on-surface-variant dark:text-gray-400">
                                  {formatEventTime(event.start_time)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!responsiveMobile && (
            <div className="mt-auto flex justify-end p-2">
              <button
                type="button"
                onClick={() => setRightSidebarOpen((prev) => !prev)}
                className="group flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
                aria-label={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 transition-transform duration-200 ease-in-out ${rightSidebarOpen ? "group-hover:translate-x-1.5" : "group-hover:-translate-x-1.5"} ${rightSidebarOpen ? "translate-x-1" : "-translate-x-1"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {rightSidebarOpen ? (
                    <path d="M9 6l6 6-6 6" />
                  ) : (
                    <path d="M15 6l-6 6 6 6" />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
