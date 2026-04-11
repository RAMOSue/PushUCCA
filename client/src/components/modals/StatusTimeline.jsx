import React from "react";

/**
 * StatusTimeline Component
 * 
 * Displays the complete lifecycle of a borrow request with visual timeline
 * showing when each status was reached with dates and times.
 * 
 * Timeline sequence:
 * ○———○———○———○
 * REQUESTED  APPROVED  DUE  RETURNED
 * 
 * Props:
 * - createdAt: ISO date when request was created (REQUESTED status)
 * - requestDate: ISO date when request was submitted to pending
 * - approvedAt: ISO date when request was approved
 * - dueDate: ISO date when items are/were due
 * - returnedAt: ISO date when items were actually returned
 * - status: Current status (pending, approved, pending_return, returned, declined)
 */
export default function StatusTimeline({
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
        year: "2-digit",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const requestedDT = formatDateTime(createdAt || requestDate);
  const approvedDT = formatDateTime(approvedAt);
  const dueDT = formatDateTime(dueDate);
  const returnedDT = formatDateTime(returnedAt);

  // Determine which steps are complete
  const isRequested = !!requestedDT;
  const isApproved = !!approvedDT && (status === "approved" || status === "pending_return" || status === "returned");
  const isDue = !!dueDT && (status === "pending_return" || status === "returned");
  const isReturned = !!returnedDT && status === "returned";
  const isDeclined = status === "declined";

  return (
    <div className="w-full bg-gradient-to-r from-surface-container-low to-surface-container-lowest dark:from-[#222] dark:to-[#1a1a1a] rounded-lg p-4 border border-outline-variant/20 dark:border-gray-700">
      {/* Timeline Title */}
      <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-widest mb-4">
        Status Timeline
      </p>

      {/* Declined Status - Special Case */}
      {isDeclined && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 rounded-full bg-error dark:bg-red-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-error dark:text-red-400">Declined</p>
            {requestedDT && (
              <p className="text-[10px] text-on-surface-variant dark:text-gray-500">
                {requestedDT.date} at {requestedDT.time}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Normal Timeline */}
      {!isDeclined && (
        <div className="space-y-3">
          {/* REQUESTED Status */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                isRequested ? "bg-primary dark:bg-blue-400" : "bg-outline-variant/40 dark:bg-gray-700"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${
                isRequested ? "text-primary dark:text-blue-400" : "text-on-surface-variant/50 dark:text-gray-500"
              }`}>
                Requested
              </p>
              {requestedDT && (
                <p className="text-[10px] text-on-surface-variant dark:text-gray-500">
                  {requestedDT.date} at {requestedDT.time}
                </p>
              )}
            </div>
          </div>

          {/* Connector Line 1 */}
          {isRequested && isApproved && (
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-3 bg-gradient-to-b from-primary/40 to-transparent dark:from-blue-400/40 ml-[5px]" />
            </div>
          )}
          {isRequested && !isApproved && (
            <div className="flex items-center gap-3">
              <div className="w-0.5 h-3 bg-outline-variant/20 dark:bg-gray-700 ml-[5px]" />
            </div>
          )}

          {/* APPROVED Status */}
          {(isApproved || dueDate) && (
            <>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    isApproved ? "bg-primary dark:bg-blue-400" : "bg-outline-variant/40 dark:bg-gray-700"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${
                    isApproved ? "text-primary dark:text-blue-400" : "text-on-surface-variant/50 dark:text-gray-500"
                  }`}>
                    Approved
                  </p>
                  {approvedDT ? (
                    <p className="text-[10px] text-on-surface-variant dark:text-gray-500">
                      {approvedDT.date} at {approvedDT.time}
                    </p>
                  ) : (
                    <p className="text-[10px] text-on-surface-variant/50 dark:text-gray-600">Pending</p>
                  )}
                </div>
              </div>

              {/* Connector Line 2 */}
              {isApproved && (isDue || isReturned) && (
                <div className="flex items-center gap-3">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-primary/40 to-transparent dark:from-blue-400/40 ml-[5px]" />
                </div>
              )}
              {isApproved && !(isDue || isReturned) && (
                <div className="flex items-center gap-3">
                  <div className="w-0.5 h-3 bg-outline-variant/20 dark:bg-gray-700 ml-[5px]" />
                </div>
              )}
            </>
          )}

          {/* DUE Date Status */}
          {dueDT && (
            <>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    isDue ? "bg-warning dark:bg-amber-400" : "bg-outline-variant/40 dark:bg-gray-700"
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${
                    isDue ? "text-warning dark:text-amber-400" : "text-on-surface-variant/50 dark:text-gray-500"
                  }`}>
                    Due Date
                  </p>
                  <p className="text-[10px] text-on-surface-variant dark:text-gray-500">
                    {dueDT.date}
                  </p>
                </div>
              </div>

              {/* Connector Line 3 */}
              {isDue && isReturned && (
                <div className="flex items-center gap-3">
                  <div className="w-0.5 h-3 bg-gradient-to-b from-success/40 to-transparent dark:from-green-400/40 ml-[5px]" />
                </div>
              )}
              {isDue && !isReturned && (
                <div className="flex items-center gap-3">
                  <div className="w-0.5 h-3 bg-outline-variant/20 dark:bg-gray-700 ml-[5px]" />
                </div>
              )}
            </>
          )}

          {/* RETURNED Status */}
          {(isReturned || status === "pending_return") && (
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  isReturned ? "bg-success dark:bg-green-400" : "bg-outline-variant/40 dark:bg-gray-700"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${
                  isReturned ? "text-success dark:text-green-400" : "text-on-surface-variant/50 dark:text-gray-500"
                }`}>
                  Returned
                </p>
                {returnedDT ? (
                  <p className="text-[10px] text-on-surface-variant dark:text-gray-500">
                    {returnedDT.date} at {returnedDT.time}
                  </p>
                ) : (
                  <p className="text-[10px] text-on-surface-variant/50 dark:text-gray-600">In Progress</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
