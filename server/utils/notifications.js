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

const notifications = {
    // Borrower -> Staff notifications
    // relatedRequest is optional - pass the borrowing request id so notifications can be correlated
    sendBorrowRequest: async (borrowerId, staffId, items, borrowerName, relatedRequest = null) => {
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

    sendReturnRequest: async (borrowerId, staffId, items) => {
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

    // Staff -> Borrower notifications
    sendBorrowApproved: async (borrowerId, items, relatedRequest = null) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = `/my-borrowed-items?requestId=${relatedRequest || ''}`;
        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Borrow Request Approved',
            message: `Your request to borrow ${itemNames} has been approved!`,
            type: NotificationTypes.REQUEST_APPROVED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id),
                requestId: relatedRequest
            }
        });
    },

    sendBorrowDeclined: async (borrowerId, items, reason, relatedRequest = null) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = `/my-borrowed-items?requestId=${relatedRequest || ''}`;
        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Borrow Request Declined',
            message: `Your request to borrow ${itemNames} was declined. Reason: ${reason}`,
            type: NotificationTypes.REQUEST_DECLINED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id),
                requestId: relatedRequest
            },
            relatedRequest: relatedRequest
        });
    },

    sendReturnApproved: async (borrowerId, items) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/my-borrowed-items';
        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Items Returned',
            message: `${itemNames} ${items.length > 1 ? 'have' : 'has'} been returned. Thank you for returning ${items.length > 1 ? 'them' : 'it'} on time!`,
            type: NotificationTypes.RETURN_APPROVED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id)
            }
        });
    },

    sendReturnDeclined: async (borrowerId, items, reason) => {
        const itemNames = items.map(item => item.name).join(', ');
        const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        const path = '/my-borrowed-items';
        await notificationController.sendPushToUser({
            userId: borrowerId,
            title: 'Return Declined',
            message: `Your return of ${itemNames} was declined. Reason: ${reason}`,
            type: NotificationTypes.RETURN_DECLINED,
            data: {
                url: `${origin}${path}`,
                path,
                items: items.map(i => i.id)
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
    }
};

module.exports = {
    notifications,
    NotificationTypes
};