const notificationController = require('../controllers/notificationController');
const db = require('../db');

const NotificationTypes = {
    BORROW_REQUEST: 'borrow_request',
    REQUEST_APPROVED: 'request_approved',
    REQUEST_DECLINED: 'request_declined',
    DUE_SOON: 'due_soon',
    OVERDUE: 'overdue',
    RETURN_APPROVED: 'return_approved',
    RETURN_DECLINED: 'return_declined',
    RETURN_REQUEST: 'return_request'
};

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';

function toFullUrl(filePath) {
    if (!filePath) return null;
    if (typeof filePath !== 'string') return null;
    if (filePath.startsWith('http')) return filePath;
    if (!filePath.startsWith('/')) {
        filePath = `/${filePath}`;
    }
    return `${SERVER_URL}${filePath}`;
}

async function getNotificationActorMeta(actorUserId) {
    if (!actorUserId) {
        return {};
    }

    try {
        const result = await db.query(
            `SELECT u.id, u.name, p.profile_pic_url
             FROM users u
             LEFT JOIN user_profiles p ON u.id = p.user_id
             WHERE u.id = $1`,
            [actorUserId]
        );

        const row = result.rows[0];
        if (!row) {
            return {};
        }

        const profileUrl = toFullUrl(row.profile_pic_url);
        return {
            actorId: row.id,
            staffName: row.name || null,
            senderName: row.name || null,
            staffProfileUrl: profileUrl,
            senderProfileUrl: profileUrl,
        };
    } catch (err) {
        console.warn('⚠️ Failed to load notification actor metadata:', err.message || err);
        return {};
    }
}

const notifications = {
    // Borrower -> Staff notifications
    // relatedRequest is optional - pass the borrowing request id so notifications can be correlated
    sendBorrowRequest: async (borrowerId, staffId, items, borrowerName, relatedRequest = null, borrowerRole = null) => {
        // ✅ Don't send borrow request notifications when the borrower is staff
        // Staff borrowing is an internal operation and should not trigger notifications
        if (borrowerRole === 'staff') {
            console.log(`⏭️ Skipping borrow request notification - borrower is staff member`);
            return;
        }
        
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = `/staff/manage-requests?openRequestId=${relatedRequest || ''}`;
        await notificationController.sendPushToUser({
            userId: staffId,
            title: 'New Borrow Request',
            message: `${borrowerName} has requested to borrow: ${itemNames}`,
            type: NotificationTypes.BORROW_REQUEST,
            data: { 
                // Provide both absolute URL and relative path for clients/service worker
                url: `${origin}${path}`,
                path,
                borrowerId,
                items: items.map(i => i.id),
                borrowerName,
                requestId: relatedRequest
            },
            relatedRequest: relatedRequest
        });
    },

    sendReturnRequest: async (borrowerId, staffId, items, borrowerRole = null) => {
        // ✅ Don't send return notifications when the borrower is staff
        if (borrowerRole === 'staff') {
            console.log(`⏭️ Skipping return notification - borrower is staff member`);
            return;
        }

        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/staff/return-items';
        await notificationController.sendPushToUser({
            userId: staffId,
            title: 'New Return Request',
            message: `A borrower wants to return: ${itemNames}`,
            type: NotificationTypes.RETURN_REQUEST,
            data: {
                url: `${origin}${path}`,
                path,
                borrowerId,
                items: items.map(i => i.id)
            }
        });
    },

    // Send notification to all staff when borrower submits return
    sendReturnSubmitted: async (borrowerId, borrowerName, items, borrowerRole = null) => {
        // ✅ Don't send return submitted notifications when the borrower is staff
        if (borrowerRole === 'staff') {
            console.log(`⏭️ Skipping return submitted notification - borrower is staff member`);
            return;
        }

        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/staff/manage-returns';
        
        try {
            // Get all staff and admin users
            const staffResult = await db.query(
                "SELECT id FROM users WHERE role IN ('staff', 'admin')"
            );
            
            // Send notification to each staff member
            for (const staff of staffResult.rows) {
                await notificationController.sendPushToUser({
                    userId: staff.id,
                    title: '📦 Return Submitted',
                    message: `${borrowerName} wants to return: ${itemNames}`,
                    type: NotificationTypes.RETURN_REQUEST,
                    data: {
                        url: `${origin}${path}`,
                        path,
                        borrowerId,
                        borrowerName,
                        items: items.map(i => i.id),
                        itemNames
                    }
                });
            }
        } catch (err) {
            console.error("Error sending return submitted notification:", err.message);
        }
    },

    // Staff -> Borrower notifications
    sendBorrowApproved: async (borrowerId, items, relatedRequest = null, actorUserId = null) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = `/my-borrowed-items?requestId=${relatedRequest || ''}`;
        const actorMeta = await getNotificationActorMeta(actorUserId);

        // Return the send result so callers can inspect success/failure
        return await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Borrow Request Approved',
            message: `Your request to borrow ${itemNames} has been approved!`,
            type: NotificationTypes.REQUEST_APPROVED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id),
                requestId: relatedRequest,
                ...actorMeta,
            }
        });
    },

    sendBorrowDeclined: async (borrowerId, items, reason, relatedRequest = null, actorUserId = null) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = `/my-borrowed-items?requestId=${relatedRequest || ''}`;
        const actorMeta = await getNotificationActorMeta(actorUserId);

        return await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Borrow Request Declined',
            message: `Your request to borrow ${itemNames} was declined. Reason: ${reason}`,
            type: NotificationTypes.REQUEST_DECLINED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id),
                requestId: relatedRequest,
                ...actorMeta,
            },
            relatedRequest: relatedRequest
        });
    },

    sendReturnApproved: async (borrowerId, items, actorUserId = null) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/my-borrowed-items';
        const actorMeta = await getNotificationActorMeta(actorUserId);

        return await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Items Returned',
            message: `${itemNames} ${items.length > 1 ? 'have' : 'has'} been returned. Thank you for returning ${items.length > 1 ? 'them' : 'it'} on time!`,
            type: NotificationTypes.RETURN_APPROVED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id),
                ...actorMeta,
            }
        });
    },

    sendReturnDeclined: async (borrowerId, items, reason, actorUserId = null) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/my-borrowed-items';
        const actorMeta = await getNotificationActorMeta(actorUserId);

        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Return Declined',
            message: `Your return of ${itemNames} was declined. Reason: ${reason}`,
            type: NotificationTypes.RETURN_DECLINED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id),
                ...actorMeta,
            }
        });
    },

    // Automated reminders
    sendDueSoonReminder: async (borrowerId, items, daysUntilDue) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        
        // Notify borrower
        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Items Due Soon',
            message: `${itemNames} ${items.length > 1 ? 'are' : 'is'} due in ${daysUntilDue} days.`,
            type: NotificationTypes.DUE_SOON,
            data: {
                url: `${origin}/my-borrowed-items`,
                path: '/my-borrowed-items',
                items: items.map(i => i.id),
                daysUntilDue
            }
        });

        // Notify staff (if item is due very soon - 1 day)
        if (daysUntilDue <= 1) {
            const staffResult = await db.query(
                "SELECT id FROM users WHERE role IN ('staff', 'admin')"
            );
            
            // Get borrower name
            const borrowerResult = await db.query(
                'SELECT name FROM users WHERE id = $1',
                [borrowerId]
            );
            const borrowerName = borrowerResult.rows[0]?.name || 'A borrower';

            for (const staff of staffResult.rows) {
                await notificationController.sendPushToUser({
                    userId: staff.id,
                    title: 'Items Due Tomorrow',
                    message: `${borrowerName}'s items (${itemNames}) are due tomorrow.`,
                    type: NotificationTypes.DUE_SOON,
                    data: {
                        url: `${origin}/staff/manage-requests`,
                        path: '/staff/manage-requests',
                        items: items.map(i => i.id),
                        borrowerId,
                        borrowerName,
                        daysUntilDue
                    }
                });
            }
        }
    },

    sendOverdueNotification: async (borrowerId, items, dueDate) => {
        const itemNames = items.map(item => item.name).join(', ');
        const daysOverdue = Math.ceil((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24));
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        
        // Notify borrower
        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Items Overdue',
            message: `${itemNames} ${items.length > 1 ? 'are' : 'is'} overdue by ${daysOverdue} days. Please return them immediately.`,
            type: NotificationTypes.OVERDUE,
            data: {
                url: `${origin}/my-borrowed-items`,
                path: '/my-borrowed-items',
                items: items.map(i => i.id),
                daysOverdue,
                dueDate
            }
        });

        // Notify staff
        const staffResult = await db.query(
            "SELECT id FROM users WHERE role IN ('staff', 'admin')"
        );
        
        // Get borrower name
        const borrowerResult = await db.query(
            'SELECT name FROM users WHERE id = $1',
            [borrowerId]
        );
        const borrowerName = borrowerResult.rows[0]?.name || 'A borrower';

        for (const staff of staffResult.rows) {
            await notificationController.sendPushToUser({
                userId: staff.id,
                title: 'Items Overdue',
                message: `${borrowerName}'s items (${itemNames}) are overdue by ${daysOverdue} days.`,
                type: NotificationTypes.OVERDUE,
                data: {
                    url: `${origin}/staff/manage-requests`,
                    path: '/staff/manage-requests',
                    items: items.map(i => i.id),
                    borrowerId,
                    borrowerName,
                    daysOverdue,
                    dueDate
                }
            });
        }
    },

    // Staff manually processed return (no photos needed)
    sendReturnManuallyProcessed: async (borrowerId, items) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/my-borrowed-items';
        return await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Items Received',
            message: `${itemNames} ${items.length > 1 ? 'have' : 'has'} been received and processed. Thank you!`,
            type: NotificationTypes.RETURN_APPROVED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id)
            }
        });
    }
};

module.exports = {
    notifications,
    NotificationTypes
};