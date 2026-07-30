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

  // ✅ NEW: Notify borrowers about performances (1 day before and on performance day)
  // Send at 9:00 AM daily
  cron.schedule('0 9 * * *', async () => {
    try {
      // Get performances happening today or tomorrow
      const result = await db.query(
        `SELECT 
            p.id,
            p.title,
            p.start_time,
            pb.borrower_user_id,
            u.name as borrower_name,
            json_agg(json_build_object(
                'id', ii.uuid,
                'name', ii.name,
                'category', ii.category
            )) as items
         FROM performances p
         JOIN performance_borrowers pb ON p.id = pb.performance_id
         JOIN users u ON pb.borrower_user_id = u.id
         JOIN performance_items pi ON p.id = pi.performance_id
         JOIN inventory_items ii ON pi.inventory_item_id = ii.uuid
         WHERE (
           -- Today's performances
           p.start_time::date = NOW()::date
           OR
           -- Tomorrow's performances (1 day before)
           p.start_time::date = (NOW() + INTERVAL '1 day')::date
         )
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = pb.borrower_user_id
           AND n.type = 'performance_reminder'
           AND n.data->>'performanceId' = p.id::text
           AND n.created_at > NOW() - INTERVAL '20 hours'
         )
         GROUP BY p.id, p.title, p.start_time, pb.borrower_user_id, u.name`
      );

      // Send notifications for each borrower
      for (const row of result.rows) {
        const performanceDate = new Date(row.start_time);
        const isTodayPerformance = performanceDate.toDateString() === new Date().toDateString();
        
        let title, message;
        if (isTodayPerformance) {
          title = `Performance Today: ${row.title}`;
          message = `You have a performance today at ${performanceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Don't forget to borrow the items!`;
        } else {
          title = `Performance Tomorrow: ${row.title}`;
          message = `You have a performance tomorrow at ${performanceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Remember to borrow the items!`;
        }

        // List the items they need
        const itemNames = row.items.map(item => item.name).join(', ');
        const fullMessage = `${message} Items needed: ${itemNames}`;

        await notificationController.sendPushToUser({
          userId: row.borrower_user_id,
          title: title,
          message: fullMessage,
          type: 'performance_reminder',
          data: {
            performanceId: row.id,
            performanceTitle: row.title,
            performanceDate: row.start_time,
            items: row.items,
            url: '/performances'
          }
        });
      }
    } catch (error) {
      console.error('Performance reminder scheduler error:', error);
    }
  });

  // ✅ NEW: Publish scheduled announcements that are due
  // Run every minute to ensure timely publishing of scheduled announcements
  cron.schedule('*/1 * * * *', async () => {
    try {
      const res = await db.query(
        `UPDATE announcements
         SET is_published = TRUE, published_at = CASE WHEN published_at IS NULL THEN NOW() ELSE published_at END, updated_at = NOW()
         WHERE is_published = FALSE AND published_at IS NOT NULL AND published_at <= NOW()
         RETURNING id, title, published_at`
      );

      if (res.rows && res.rows.length > 0) {
        console.log(`Published ${res.rows.length} scheduled announcements`);
        // Optionally: emit notifications to staff/borrowers here
      }
    } catch (err) {
      console.error('Error publishing scheduled announcements:', err && err.message ? err.message : err);
    }
  });
}

module.exports = startNotificationScheduler;