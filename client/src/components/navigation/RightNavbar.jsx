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
      {/* Global Animation Styles */}
      <style>{`
        @media (min-width: 1024px) {
          aside.right-navbar {
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

      {/* Right Navbar - Synchronized with Sidebar (Desktop Only) */}
      <aside
        className={`right-navbar hidden lg:flex fixed right-0 top-16 h-[calc(100vh-64px)] bg-surface-container-low dark:bg-[#1f1f1f] shadow-2xl dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] border-l border-outline-variant/10 dark:border-[#2a2a2a] z-30 transition-all duration-300 ease-in-out ${
          rightSidebarOpen ? "translate-x-0 w-72 opacity-100" : "translate-x-full w-0 opacity-0"
        }`}
        style={{
          overflowY: rightSidebarOpen ? "auto" : "hidden",
          overflowX: "hidden",
          willChange: "transform, width",
          backfaceVisibility: "hidden",
          perspective: 1000,
          transform: rightSidebarOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Inner Content Wrapper - Fixed width prevents distortion */}
        <div
          className="w-72 flex flex-col h-full mt-2"
          style={{
            flexShrink: 0,
            pointerEvents: rightSidebarOpen ? "auto" : "none",
          }}
        >
          {/* Clock Section - Sticky Top */}
          
          <div className="sticky top-0  dark:bg-[#1f1f1f] z-10 p-4 border-b border-outline-variant/10 dark:border-[#2a2a2a] flex-shrink-0 transition-colors duration-300 mt-1 mb-4">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold mb-2">
                Current Time
              </p>
              <p className="text-3xl font-mono font-bold text-on-surface dark:text-white">{formattedTime}</p>
              <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-1">{formattedDate}</p>
            </div>
          </div>

          {/* Status Section - Scrollable Part */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* STAFF/ADMIN: Pending Approval Card */}
            {(user?.role === "staff" || user?.role === "admin") && (
              <button
                onClick={() => navigate("/staff/manage-requests")}
                className="w-full bg-orange/10 dark:bg-orange/5 border border-orange/20 dark:border-orange/20 rounded-lg p-4 flex-shrink-0 transition-all duration-300 hover:bg-orange/20 dark:hover:bg-orange/10 hover:border-orange/40 dark:hover:border-orange/30 active:scale-95 text-left group"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold group-hover:text-orange transition-colors">
                    Pending Requests
                  </p>
                  <div>
                    {loading ? (
                      <Loader className="w-4 h-4 text-orange animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 text-orange group-hover:scale-110 transition-transform" />
                    )}
                  </div>
                </div>
                <p className="text-3xl font-serif font-bold text-orange">{pendingApproval}</p>
                <p className="text-[11px] text-on-surface-variant dark:text-gray-400 mt-1 group-hover:text-orange/70 transition-colors">
                  Borrow requests awaiting approval
                </p>
              </button>
            )}

          

            {/* Request Calendar Section */}
            <div className="border-t border-outline-variant/10 dark:border-[#2a2a2a] pt-3 flex-shrink-0 flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface dark:text-white mb-2">Event Calendar</h3>
              <div className="calendar-wrapper bg-surface-container-lowest dark:bg-[#2a2a2a] border border-outline-variant/10 dark:border-[#3a3a3a] rounded p-2 flex-1 overflow-hidden flex flex-col transition-colors duration-300">
                <Calendar
                  onClickDay={handleCalendarDateClick}
                  tileContent={({ date }) =>
                    performanceDates.has(date.toDateString()) ? (
                      <div className="flex justify-center mt-0.5">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      </div>
                    ) : null
                  }
                  tileClassName={({ date }) =>
                    performanceDates.has(date.toDateString()) ? 'bg-primary/10' : null
                  }
                  className="w-full text-xs [&_.react-calendar]:text-xs [&_.react-calendar__tile]:p-0.5"
                />
              </div>

              {/* Show performances for selected date */}
              {selectedCalendarDate && getPerformancesForDate(selectedCalendarDate).length > 0 && (
                <div className="border-t border-outline-variant/10 dark:border-[#2a2a2a] mt-2 pt-2 flex-shrink-0 max-h-16 overflow-y-auto transition-colors duration-300">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-400 mb-1">
                    {selectedCalendarDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <div className="space-y-1">
                    {getPerformancesForDate(selectedCalendarDate).map((perf) => (
                      <div
                        key={perf.id}
                        className="bg-surface-container-low dark:bg-[#2a2a2a] border border-outline-variant/10 dark:border-[#3a3a3a] rounded px-2 py-1 hover:border-primary/30 dark:hover:border-blue-500/30 transition-colors cursor-pointer"
                      >
                        <p className="text-[8px] font-semibold text-on-surface dark:text-white truncate">{perf.title}</p>
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

             {/* Upcoming Events Section */}
            <div className="border-t border-outline-variant/10 dark:border-[#2a2a2a] pt-2 flex-shrink-0 transition-colors duration-300">
              <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface dark:text-white mb-2 flex items-center gap-2">
                <Music className="w-3 h-3 text-primary dark:text-blue-400" />
                Upcoming Events
              </h3>

              {upcomingEvents.length === 0 ? (
                <div className="bg-surface-container-lowest dark:bg-[#2a2a2a] border border-outline-variant/10 dark:border-[#3a3a3a] rounded p-2 text-center transition-colors duration-300">
                  <CalendarIcon className="w-5 h-5 text-on-surface-variant dark:text-gray-500/30 mx-auto mb-1" />
                  <p className="text-[10px] text-on-surface-variant dark:text-gray-400">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {upcomingEvents.slice(0, 3).map((event, idx) => (
                    <div
                      key={event.id || idx}
                      className="bg-surface-container-lowest dark:bg-[#2a2a2a] border border-outline-variant/10 dark:border-[#3a3a3a] rounded p-2 hover:border-primary/30 dark:hover:border-blue-500/30 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 dark:bg-blue-900/30 rounded flex items-center justify-center">
                          <Music className="w-3 h-3 text-primary dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] uppercase tracking-widest font-bold text-primary dark:text-blue-400">
                            {formatEventDate(event.start_time)}
                          </p>
                          <p className="text-[10px] font-semibold text-on-surface dark:text-white truncate">
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

          {/* Last Updated - Footer */}
          {lastUpdated && (
            <div className="border-t border-outline-variant/10 dark:border-[#2a2a2a] p-3 text-[10px] text-on-surface-variant dark:text-gray-400 text-center flex-shrink-0 bg-surface-container-low dark:bg-[#1f1f1f] transition-colors duration-300">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
