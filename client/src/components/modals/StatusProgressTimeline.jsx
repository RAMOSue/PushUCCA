import React from "react";

/**
 * StatusProgressTimeline Component
 * 
 * Integrates timeline visualization directly into the progress bar.
 * Shows status progression dots positioned along the timeline with dates below.
 * 
 * Example:
 * ●————————●————————●————————●
 * REQ     APPR     DUE      RET
 * Oct 7   Oct 8    Oct 11   Oct 11
 * 2:45PM  10:20AM          3:15PM
 */
export default function StatusProgressTimeline({
  createdAt,
  requestDate,
  approvedAt,
  dueDate,
  returnedAt,
  status,
}) {
  // Format date/time for display
  const formatDateTime = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  // Determine which steps are complete
  const isRequested = !!createdAt;
  const isApproved = !!approvedAt && (status === "approved" || status === "pending_return" || status === "returned");
  const isDue = !!dueDate && (status === "pending_return" || status === "returned");
  const isReturned = !!returnedAt && status === "returned";
  const isDeclined = status === "declined";

  // Calculate percentage positions for dots along timeline
  const getStagePercentage = (index, totalStages) => {
    return (index / (totalStages - 1)) * 100;
  };

  // For normal timeline (not declined)
  const stages = [];
  if (isRequested) {
    const dt = formatDateTime(createdAt || requestDate);
    stages.push({
      label: "REQ",
      date: dt?.date || "",
      time: dt?.time || "",
      completed: true,
      percentage: 0,
    });
  }

  if (approvedAt || dueDate) {
    const dt = formatDateTime(approvedAt);
    stages.push({
      label: "APPR",
      date: dt?.date || "",
      time: dt?.time || "",
      completed: isApproved,
      percentage: 33,
    });
  }

  if (dueDate) {
    const dt = formatDateTime(dueDate);
    stages.push({
      label: "DUE",
      date: dt?.date || "",
      time: "",
      completed: isDue,
      percentage: 66,
    });
  }

  if (returnedAt || status === "pending_return" || dueDate) {
    const dt = formatDateTime(returnedAt);
    stages.push({
      label: "RET",
      date: dt?.date || "",
      time: dt?.time || "",
      completed: isReturned,
      percentage: 100,
    });
  }

  // Get progress color
  const getProgressColor = () => {
    if (isDeclined) return "#ef4444"; // red
    if (isReturned) return "#22c55e"; // green
    if (isDue && returnedAt === null) {
      const due = new Date(dueDate);
      const today = new Date();
      if (due < today) return "#ef4444"; // overdue red
      return "#f59e0b"; // orange
    }
    if (isDue) return "#f59e0b"; // orange
    if (isApproved) return "#3b82f6"; // blue
    return "#f59e0b"; // orange for pending
  };

  const progressColor = getProgressColor();
  const progressPercentage = isReturned ? 100 : isDue ? 66 : isApproved ? 33 : 25;

  if (isDeclined) {
    // Special layout for declined
    return (
      <div className="px-3 py-3 bg-surface-container-low dark:bg-[#222]">
        <div className="flex items-end gap-2">
          {/* Declined Dot */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 mb-1"
              style={{ backgroundColor: "#ef4444" }}
            />
            <p className="text-[8px] font-bold text-error dark:text-red-400 uppercase whitespace-nowrap">
              Declined
            </p>
          </div>

          {/* Date below */}
          <div className="text-[9px] text-on-surface-variant dark:text-gray-500">
            <p>{formatDateTime(createdAt || requestDate)?.date}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 bg-surface-container-low dark:bg-[#222]">
      {/* Progress Bar with Timeline Dots */}
      <div className="relative mb-4">
        {/* Background track */}
        <div className="h-1.5 w-full bg-outline-variant/20 dark:bg-gray-700 rounded-full overflow-hidden">
          {/* Filled progress */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercentage}%`,
              backgroundColor: progressColor,
            }}
          />
        </div>

        {/* Dots positioned along timeline */}
        <div className="relative h-12 mt-1">
          {stages.map((stage, idx) => (
            <div
              key={idx}
              className="absolute flex flex-col items-center"
              style={{
                left: `${stage.percentage}%`,
                transform: "translateX(-50%)",
                top: "-8px",
              }}
            >
              {/* Dot */}
              <div
                className={`w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 border-surface-container-low dark:border-[#222] mb-1.5 transition-all ${
                  stage.completed
                    ? "shadow-sm"
                    : "opacity-50"
                }`}
                style={{
                  backgroundColor: stage.completed ? progressColor : "#d1d5db",
                }}
              />

              {/* Label and date below dot */}
              <div className="text-center">
                <p className={`text-[8px] font-bold uppercase whitespace-nowrap ${
                  stage.completed
                    ? "text-on-surface dark:text-white"
                    : "text-on-surface-variant/60 dark:text-gray-600"
                }`}>
                  {stage.label}
                </p>
                {stage.date && (
                  <p className={`text-[7px] whitespace-nowrap ${
                    stage.completed
                      ? "text-on-surface-variant dark:text-gray-400"
                      : "text-on-surface-variant/50 dark:text-gray-600"
                  }`}>
                    {stage.date}
                  </p>
                )}
                {stage.time && (
                  <p className={`text-[7px] whitespace-nowrap ${
                    stage.completed
                      ? "text-on-surface-variant dark:text-gray-400"
                      : "text-on-surface-variant/50 dark:text-gray-600"
                  }`}>
                    {stage.time}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
