import { useContext, useState, useEffect } from "react";
import { Music, QrCode, Camera } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import Calendar from "react-calendar";
import { SidebarContext } from "../../context/SidebarContext";
import { UserContext } from "../../../context/userContext";
import axios from "axios";
import "react-calendar/dist/Calendar.css";

export default function RightNavbar() {
  const { rightSidebarOpen, setRightSidebarOpen, setSidebarOpen, isMobile } = useContext(SidebarContext);
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

  // Fetch performance data using the same source as the Performance page
  const fetchStats = async () => {
    try {
      setLoading(true);

      // Keep the existing borrow/request stats for the current user when available
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

  // Initial fetch
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

  // ✅ Calendar function: Handle date click to prioritize performances
  const handleCalendarDateClick = (date) => {
    setSelectedCalendarDate(date);
  };

  // ✅ Calendar function: Get set of dates with performances
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
        navigate(-1);
        return;
      }

      setRightSidebarOpen(false);
      navigate("/scan");
      return;
    }

    if (user?.role === "staff") {
      if (isStaffScannerOpen) {
        setRightSidebarOpen(true);
        navigate("/staff");
        return;
      }

      setRightSidebarOpen(false);
      navigate("/staff/scan");
    }
  };

  const handleInstrumentScannerClick = () => {
    if (user?.role === "borrower") {
      if (isBorrowerScannerOpen) {
        setRightSidebarOpen(true);
        navigate(-1);
        return;
      }

      setRightSidebarOpen(false);
      navigate("/scanner");
      return;
    }

    if (user?.role === "staff") {
      if (isStaffScannerOpen) {
        setRightSidebarOpen(true);
        navigate("/staff");
        return;
      }

      setRightSidebarOpen(false);
      navigate("/staff/scanner");
    }
  };

  const scannerButtons = (
    <div className={`flex flex-1 flex-col items-center gap-2 px-2 pt-3 transition-all duration-300 ease-in-out ${rightSidebarOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <button
        type="button"
        title="QR Scanner"
        aria-label="QR Scanner"
        onClick={handleQRScannerClick}
        className="group flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white sm:h-8 sm:w-8"
      >
        <QrCode className="h-3 w-3 transition-transform duration-200 ease-in-out group-hover:scale-110 sm:h-3.5 sm:w-3.5" />
      </button>

      <button
        type="button"
        title="AI Scanner"
        aria-label="AI Scanner"
        onClick={handleInstrumentScannerClick}
        className="group flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white sm:h-8 sm:w-8"
      >
        <Camera className="h-3 w-3 transition-transform duration-200 ease-in-out group-hover:scale-110 sm:h-3.5 sm:w-3.5" />
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
        @media (max-width: 390px) {
          aside.right-navbar.right-navbar-open {
            width: 180px !important;
          }
        }
        @media (max-width: 360px) {
          aside.right-navbar.right-navbar-open {
            width: 170px !important;
          }
        }
        @media (max-width: 330px) {
          aside.right-navbar.right-navbar-open {
            width: 160px !important;
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
        className={`right-navbar flex h-full shrink-0 border-l border-outline-variant/10 bg-surface-container-low dark:border-[#2a2a2a] dark:bg-[#1f1f1f] shadow-2xl dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] z-30 transition-all duration-250 ease-in-out ${
          isMobile
            ? rightSidebarOpen ? "w-[190px] opacity-100 right-navbar-open" : "w-10 sm:w-12 opacity-100"
            : rightSidebarOpen ? "w-64 opacity-100" : "w-14 opacity-100"
        }`}
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          willChange: "width",
          backfaceVisibility: "hidden",
          perspective: 1000,
          transform: "translateZ(0)",
        }}
      >
        <div
          className="flex h-full flex-col transition-all duration-250 ease-in-out"
          style={{
            width: rightSidebarOpen ? (isMobile ? "190px" : "256px") : (isMobile ? "40px" : "56px"),
            flexShrink: 0,
            pointerEvents: "auto",
          }}
        >
          {!rightSidebarOpen ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 transition-all duration-300 ease-in-out sm:gap-2.5 sm:py-3">
              {scannerButtons}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col transition-all duration-300 ease-in-out">
              <div className="flex-1 space-y-2 overflow-y-auto p-2 sm:space-y-3 sm:p-3">
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <h3 className="text-center text-[10px] font-bold uppercase tracking-widest text-on-surface dark:text-white sm:text-xs">Upcoming Events</h3>
                  <div className="calendar-wrapper flex flex-1 flex-col overflow-hidden rounded border border-outline-variant/10 bg-surface-container-lowest p-1.5 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] transition-colors duration-300 sm:p-2">
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

                  <div className="max-h-[16rem] space-y-1 overflow-y-auto">
                    {orderedEvents.length === 0 ? (
                      <div className="rounded border border-outline-variant/10 bg-surface-container-lowest p-1.5 text-center transition-colors duration-300 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] sm:p-2">
                        <p className="text-[9px] text-on-surface-variant dark:text-gray-400 sm:text-[10px]">
                          {loading ? "Loading events..." : "No scheduled performances"}
                        </p>
                      </div>
                    ) : (
                      orderedEvents.map((event, idx) => (
                        <div
                          key={event.id || idx}
                          className="rounded border border-outline-variant/10 bg-surface-container-lowest p-1.5 transition-colors hover:border-primary/30 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:hover:border-blue-500/30 sm:p-2"
                        >
                          <div className="flex items-start gap-1.5 sm:gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-primary/10 dark:bg-blue-900/30 sm:h-8 sm:w-8">
                              <Music className="h-3 w-3 text-primary dark:text-blue-400 sm:h-3.5 sm:w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[7px] font-bold uppercase tracking-widest text-primary dark:text-blue-400 sm:text-[8px]">
                                {formatEventDate(event.start_time)}
                              </p>
                              <p className="truncate text-[9px] font-semibold text-on-surface dark:text-white sm:text-[10px]">
                                {event.title || "Performance"}
                              </p>
                              <p className="text-[8px] text-on-surface-variant dark:text-gray-400 sm:text-[9px]">
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
          )}

          <div className="mt-auto flex justify-end p-2">
            <button
              type="button"
              onClick={() => {
                setRightSidebarOpen((prev) => !prev);
                if (isMobile) {
                  setSidebarOpen(false);
                }
              }}
              className="group flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition-all duration-200 ease-in-out hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:h-8 sm:w-8"
              title={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
              aria-label={rightSidebarOpen ? "Collapse right sidebar" : "Expand right sidebar"}
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-3.5 w-3.5 transition-transform duration-200 ease-in-out sm:h-4 sm:w-4 ${rightSidebarOpen ? "group-hover:translate-x-1.5" : "group-hover:-translate-x-1.5"} ${rightSidebarOpen ? "translate-x-1" : "-translate-x-1"}`}
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
        </div>
      </aside>
    </>
  );
}
