import { useContext, useState, useEffect } from "react";
import { Clock, CheckCircle, AlertCircle, Package, ArrowLeft, ArrowRight, Loader, Music, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import { SidebarContext } from "../../context/SidebarContext";
import { UserContext } from "../../../context/userContext";
import axios from "axios";
import "react-calendar/dist/Calendar.css";

export default function RightNavbar() {
  const { rightSidebarOpen, isMobile } = useContext(SidebarContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingApproval, setPendingApproval] = useState(0);
  const [activeBorrows, setActiveBorrows] = useState(0);
  const [returnedItems, setReturnedItems] = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [allPerformances, setAllPerformances] = useState([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch statistics
  const fetchStats = async () => {
    // ✅ Only fetch if user is authenticated
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 🎯 STAFF: Fetch pending borrow requests (staff-only)
      if (user.role === "staff" || user.role === "admin") {
        const requestsRes = await axios.get("/api/borrow/requests", {
          withCredentials: true,
        });
        const pendingCount = requestsRes.data.filter((r) => r.status === "pending").length;
        setPendingApproval(pendingCount);
      }

      // 👤 BORROWER: Fetch borrower-specific stats
      if (user.role === "borrower") {
        const historyRes = await axios.get(`/api/borrow/history/${user.id}`, {
          withCredentials: true,
        });
        const history = Array.isArray(historyRes.data) ? historyRes.data : [];
        const active = history.filter((h) => h.status === "approved").length;
        const returned = history.filter((h) => h.status === "returned").length;
        setActiveBorrows(active);
        setReturnedItems(returned);
      }

      // Fetch all performances for calendar
      const performancesRes = await axios.get("/api/performances", {
        withCredentials: true,
      });
      const now = new Date();
      const upcomingPerfs = performancesRes.data
        .filter((p) => new Date(p.start_time) > now)
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
        .slice(0, 5); // Show top 5 upcoming events

      // Store all performances for calendar
      setAllPerformances(performancesRes.data || []);
      setUpcomingEvents(upcomingPerfs);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      // ✅ Handle 401 Unauthorized gracefully (user logged out)
      if (error.response?.status === 401) {
        setLoading(false);
      } else {
        console.error("Failed to fetch stats:", error.message);
        setLoading(false);
      }
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStats();
    // Refresh every 30 seconds (only if authenticated)
    if (user && user.id) {
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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

  // ✅ Calendar function: Handle date click to filter performances
  const handleCalendarDateClick = (date) => {
    setSelectedCalendarDate(date);
  };

  // ✅ Calendar function: Get set of dates with performances
  const performanceDates = new Set(
    allPerformances.map((p) => new Date(p.start_time).toDateString())
  );

  // ✅ Calendar function: Get performances for selected date
  const getPerformancesForDate = (date) => {
    const dateString = date.toDateString();
    return allPerformances.filter((p) => new Date(p.start_time).toDateString() === dateString);
  };

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
          padding: 0.25rem 0;
          background: transparent;
          border: none;
          color: inherit;
          font-size: 0.7rem;
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
          margin-bottom: 0.5rem;
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
        className={`right-navbar hidden lg:flex sticky right-0 top-0 h-screen shrink-0 border-l border-outline-variant/10 bg-surface-container-low dark:border-[#2a2a2a] dark:bg-[#1f1f1f] shadow-2xl dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] z-30 transition-all duration-250 ease-in-out ${
          rightSidebarOpen ? "w-56 opacity-100" : "w-12 opacity-100"
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
            width: rightSidebarOpen ? "224px" : "48px",
            flexShrink: 0,
            pointerEvents: "auto",
          }}
        >
          {rightSidebarOpen && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="sticky top-0 z-10 mb-4 mt-1 border-b border-outline-variant/10 bg-surface-container-low p-4 dark:border-[#2a2a2a] dark:bg-[#1f1f1f] transition-colors duration-300">
                <div className="text-center">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-400">
                    Current Time
                  </p>
                  <p className="text-3xl font-mono font-bold text-on-surface dark:text-white">{formattedTime}</p>
                  <p className="mt-1 text-xs text-on-surface-variant dark:text-gray-400">{formattedDate}</p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {(user?.role === "staff" || user?.role === "admin") && (
                  <button
                    onClick={() => navigate("/staff/manage-requests")}
                    className="w-full rounded-lg border border-orange/20 bg-orange/10 p-4 text-left transition-all duration-300 hover:border-orange/40 hover:bg-orange/20 dark:border-orange/20 dark:bg-orange/5 dark:hover:bg-orange/10 group"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant transition-colors group-hover:text-orange dark:text-gray-400">
                        Pending Requests
                      </p>
                      <div>
                        {loading ? (
                          <Loader className="h-4 w-4 animate-spin text-orange" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange transition-transform group-hover:scale-110" />
                        )}
                      </div>
                    </div>
                    <p className="text-3xl font-serif font-bold text-orange">{pendingApproval}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant transition-colors group-hover:text-orange/70 dark:text-gray-400">
                      Borrow requests awaiting approval
                    </p>
                  </button>
                )}

                <div className="flex min-h-0 flex-1 flex-col border-t border-outline-variant/10 pt-3 dark:border-[#2a2a2a]">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-on-surface dark:text-white">Event Calendar</h3>
                  <div className="calendar-wrapper flex flex-1 flex-col overflow-hidden rounded border border-outline-variant/10 bg-surface-container-lowest p-2 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] transition-colors duration-300">
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

                  {selectedCalendarDate && getPerformancesForDate(selectedCalendarDate).length > 0 && (
                    <div className="mt-2 max-h-16 overflow-y-auto border-t border-outline-variant/10 pt-2 transition-colors duration-300 dark:border-[#2a2a2a]">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-400">
                        {selectedCalendarDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <div className="space-y-1">
                        {getPerformancesForDate(selectedCalendarDate).map((perf) => (
                          <div
                            key={perf.id}
                            className="cursor-pointer rounded border border-outline-variant/10 bg-surface-container-low px-2 py-1 transition-colors hover:border-primary/30 dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:hover:border-blue-500/30"
                          >
                            <p className="truncate text-[8px] font-semibold text-on-surface dark:text-white">{perf.title}</p>
                            <p className="text-[7px] text-on-surface-variant dark:text-gray-400">
                              {new Date(perf.start_time).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-outline-variant/10 pt-2 transition-colors duration-300 dark:border-[#2a2a2a]">
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-on-surface dark:text-white">
                    <Music className="h-3 w-3 text-primary dark:text-blue-400" />
                    Upcoming Events
                  </h3>

                  {upcomingEvents.length === 0 ? (
                    <div className="rounded border border-outline-variant/10 bg-surface-container-lowest p-2 text-center transition-colors duration-300 dark:border-[#3a3a3a] dark:bg-[#2a2a2a]">
                      <CalendarIcon className="mx-auto mb-1 h-5 w-5 text-on-surface-variant dark:text-gray-500/30" />
                      <p className="text-[10px] text-on-surface-variant dark:text-gray-400">No upcoming events</p>
                    </div>
                  ) : (
                    <div className="max-h-20 space-y-1 overflow-y-auto">
                      {upcomingEvents.slice(0, 3).map((event, idx) => (
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
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {lastUpdated && (
                <div className="border-t border-outline-variant/10 bg-surface-container-low p-3 text-center text-[10px] text-on-surface-variant dark:border-[#2a2a2a] dark:bg-[#1f1f1f] dark:text-gray-400 transition-colors duration-300">
                  Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          )}

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
        </div>
      </aside>
    </>
  );
}
