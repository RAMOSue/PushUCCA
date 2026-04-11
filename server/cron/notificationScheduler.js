const cron = require('node-cron');
const db = require('../db');
const notificationController = require('../controllers/notificationController');

function startNotificationScheduler() {
  // Check for due soon items every day at 9:00 AM and 5:00 PM
  cron.schedule('0 9,17 * * *', async () => {
    try {
      // Get items due in the next 3 days
      const result = await db.query(
        `SELECT 
            br.id, 
            br.user_id, 
            br.due_date, 
            u.name,
            json_agg(json_build_object(
                'id', ii.uuid,
                'name', ii.name,
                'unit_id', iu.id
            )) as items
         FROM borrowing_requests br
         JOIN users u ON u.id = br.user_id
         JOIN borrowing_items bi ON bi.borrowing_id = br.id
         JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         WHERE br.status = 'approved'
         AND br.returned_at IS NULL
         AND br.due_date IS NOT NULL
         AND br.due_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.related_request = br.id
           AND n.type = 'due_soon'
           AND n.created_at > NOW() - INTERVAL '12 hours'
         )
         GROUP BY br.id, u.name`
      );

      // Send notifications for each due soon item
      for (const row of result.rows) {
        const dueDate = new Date(row.due_date).toLocaleDateString();
        
        // Notify borrower
        await notificationController.sendPushToUser({
          userId: row.user_id,
          title: 'Items Due Soon',
          message: `Your borrowed items are due on ${dueDate}. Please return them on time.`,
          type: 'due_soon',
          data: { requestId: row.id },
          relatedRequest: row.id
        });

        // Notify staff
        const staffResult = await db.query(
          "SELECT id FROM users WHERE role IN ('staff', 'admin')"
        );
        
        for (const staff of staffResult.rows) {
          await notificationController.sendPushToUser({
            userId: staff.id,
            title: 'Borrowing Due Soon',
            message: `${row.name}'s items are due on ${dueDate}`,
            type: 'due_soon',
            data: { requestId: row.id, borrowerId: row.user_id },
            relatedRequest: row.id
          });
        }
      }

      // Check for overdue items
      const overdueResult = await db.query(
        `SELECT 
            br.id, 
            br.user_id, 
            br.due_date, 
            u.name,
            EXTRACT(DAY FROM NOW() - br.due_date) as days_overdue,
            json_agg(json_build_object(
                'id', ii.uuid,
                'name', ii.name,
                'unit_id', iu.id
            )) as items
         FROM borrowing_requests br
         JOIN users u ON u.id = br.user_id
         JOIN borrowing_items bi ON bi.borrowing_id = br.id
         JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         WHERE br.status = 'approved'
         AND br.returned_at IS NULL
         AND br.due_date < NOW()
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.related_request = br.id
           AND n.type = 'overdue'
           AND n.created_at > NOW() - INTERVAL '24 hours'
         )
         GROUP BY br.id, u.name`
      );

      // Send notifications for overdue items
      for (const row of overdueResult.rows) {
        const dueDate = new Date(row.due_date).toLocaleDateString();
        
        // Notify borrower
        await notificationController.sendPushToUser({
          userId: row.user_id,
          title: 'Items Overdue',
          message: `Your items were due on ${dueDate}. Please return them immediately.`,
          type: 'overdue',
          data: { requestId: row.id },
          relatedRequest: row.id
        });

        // Notify staff
        const staffResult = await db.query(
          "SELECT id FROM users WHERE role IN ('staff', 'admin')"
        );
        
        for (const staff of staffResult.rows) {
          await notificationController.sendPushToUser({
            userId: staff.id,
            title: 'Borrowing Overdue',
            message: `${row.name}'s items are overdue since ${dueDate}`,
            type: 'overdue',
            data: { requestId: row.id, borrowerId: row.user_id },
            relatedRequest: row.id
          });
        }
      }
    } catch (error) {
      console.error('Notification scheduler error:', error);
    }
  });

  // Additionally: notify borrowers whose items are due TODAY, repeat every 3 hours
  cron.schedule('0 */3 * * *', async () => {
    try {
      const dueTodayRes = await db.query(
        `SELECT 
            br.id, br.user_id, br.due_date, u.name,
            json_agg(json_build_object('id', ii.uuid, 'name', ii.name, 'unit_id', iu.id)) as items
         FROM borrowing_requests br
         JOIN users u ON u.id = br.user_id
         JOIN borrowing_items bi ON bi.borrowing_id = br.id
         JOIN inventory_units iu ON bi.inventory_unit_id = iu.id
         JOIN inventory_items ii ON iu.inventory_item_id = ii.uuid
         WHERE br.status = 'approved'
           AND br.returned_at IS NULL
           AND br.due_date::date = NOW()::date
           AND NOT EXISTS (
             SELECT 1 FROM notifications n
             WHERE n.related_request = br.id
               AND n.type = 'due_today'
               AND n.created_at > NOW() - INTERVAL '3 hours'
           )
         GROUP BY br.id, u.name`
      );

      for (const row of dueTodayRes.rows) {
        const dueDateStr = new Date(row.due_date).toLocaleDateString();
        // Notify borrower
        await notificationController.sendPushToUser({
          userId: row.user_id,
          title: 'Items Due Today',
          message: `Your borrowed items are due today (${dueDateStr}). Please return them now.`,
          type: 'due_today',
          data: { requestId: row.id },
          relatedRequest: row.id
        });
      }
    } catch (err) {
      console.error('Due-today scheduler error:', err && err.message ? err.message : err);
    }
  });
}

module.exports = startNotificationScheduler;