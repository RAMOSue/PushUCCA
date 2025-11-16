const express = require('express');
const router = express.Router();

// Test notification routes have been disabled in production.
// This file remains as a placeholder to avoid import errors in older branches.

router.use((req, res) => {
  res.status(410).json({ error: 'Test notification routes are disabled' });
});

/**
 * ✅ Helper: Send push if user has subscription
 */
const sendPushIfAvailable = async ({ userId, title, message, type, data }) => {
  try {
    const subResult = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    if (subResult.rows.length === 0) {
      console.warn(`⚠️ No push subscription found for user ${userId}`);
      return null;
    }

    // Send the push notification
    await notificationController.sendPushToUser({
      userId,
      title,
      message,
      type,
      data,
    });

    return true;
  } catch (err) {
    console.error('Error sending push:', err);
    return false;
  }
};

/**
 * ✅ Bulk: Subscribe all users with test subscriptions (for testing/demo purposes)
 * Admin only - creates mock subscriptions for all users
 */
router.post('/bulk-subscribe-demo', ensureAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    console.log('🔔 [ADMIN] Starting bulk demo subscription for testing...');

    // Get all users
    const usersResult = await db.query('SELECT id, name, role FROM users ORDER BY role, name');
    const users = usersResult.rows;

    if (users.length === 0) {
      return res.json({ success: false, message: 'No users found' });
    }

    console.log(`✅ Found ${users.length} users to subscribe`);

    // Create mock subscriptions for testing (Windows Push Notification Service)
    const mockEndpoints = [
      'https://wns2-bl2p.notify.windows.com/w/?token=test_endpoint_1',
      'https://fcm.googleapis.com/fcm/send/test_endpoint_2',
      'https://api.push.apple.com/test_endpoint_3',
    ];

    let subscriptionCount = 0;
    const results = [];

    for (const user of users) {
      try {
        // Create a mock subscription
        const mockEndpoint = mockEndpoints[subscriptionCount % mockEndpoints.length];
        const mockP256dh = 'BJFGepkb6DlsokMX5Td_5EKMfWzhBK4MKKxlOQ6P-9Kn1eYhRoRFc2yuWApYW3_U9zmzhZx5PQn7DaBbKhQ_C1U';
        const mockAuth = 'PhF_u_5BZ9fILzJ-SFvCnw';

        // Save subscription
        await db.query(
          `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (endpoint)
           DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, last_seen = CURRENT_TIMESTAMP`,
          [user.id, mockEndpoint, mockP256dh, mockAuth]
        );

        console.log(`  ✅ Subscription created for ${user.name} (${user.role}, ID: ${user.id})`);
        subscriptionCount++;
        results.push({ user_id: user.id, name: user.name, role: user.role, status: 'subscribed' });
      } catch (err) {
        console.error(`  ❌ Failed to subscribe ${user.name}:`, err.message);
        results.push({ user_id: user.id, name: user.name, role: user.role, status: 'failed', error: err.message });
      }
    }

    console.log(`📊 Bulk subscription complete: ${subscriptionCount}/${users.length} successful`);

    res.json({
      success: true,
      message: `Mock subscriptions created for ${subscriptionCount}/${users.length} users`,
      count: subscriptionCount,
      total: users.length,
      results,
    });
  } catch (error) {
    console.error('❌ Bulk subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});
router.get('/debug/subscriptions', ensureAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      'SELECT id, user_id, endpoint, p256dh, auth, created_at, last_seen FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );

    res.json({
      user: {
        id: userId,
        name: req.user.name,
        role: req.user.role,
      },
      subscriptions: result.rows,
      count: result.rowCount,
    });
  } catch (error) {
    console.error('Debug subscriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ✅ Debug: Get all subscriptions (admin only)
 */
router.get('/debug/all-subscriptions', ensureAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const result = await db.query(
      `SELECT ps.id, ps.user_id, u.name, u.role, ps.endpoint, ps.created_at, ps.last_seen 
       FROM push_subscriptions ps 
       JOIN users u ON ps.user_id = u.id
       ORDER BY u.role, u.name`
    );

    const grouped = {};
    result.rows.forEach(row => {
      if (!grouped[row.role]) grouped[row.role] = [];
      grouped[row.role].push({
        user_id: row.user_id,
        name: row.name,
        endpoint: row.endpoint.substring(0, 50) + '...',
        created_at: row.created_at,
        last_seen: row.last_seen,
      });
    });

    res.json({
      total: result.rowCount,
      byRole: grouped,
    });
  } catch (error) {
    console.error('Debug all subscriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ✅ Route: Send cross-role test notification
 * Staff → Borrowers OR Borrower → Staff or Admin
 */
router.post('/test-notification', ensureAuth, async (req, res) => {
  try {
    const sender = req.user;
    const senderRole = sender.role;
    console.log(`📢 ${senderRole} (ID: ${sender.id}) sending test notification`);

    let targetRoles = [];
    if (senderRole === 'staff') {
      targetRoles = ['borrower', 'admin'];
    } else if (senderRole === 'borrower') {
      targetRoles = ['staff', 'admin'];
    } else if (senderRole === 'admin') {
      targetRoles = ['borrower', 'staff'];
    } else {
      return res
        .status(403)
        .json({ error: 'Only staff, admin, or borrower can send test notifications.' });
    }

    // Get all users with the target roles
    const placeholders = targetRoles.map((_, i) => `$${i + 1}`).join(',');
    const result = await db.query(
      `SELECT id, name, role FROM users WHERE role = ANY($1)`,
      [targetRoles]
    );
    const targetUsers = result.rows;

    console.log(`✅ Found ${targetUsers.length} target users:`, targetUsers.map(u => `${u.name}(${u.role})`));

    if (!targetUsers.length) {
      return res.json({
        success: false,
        message: `No users found with roles: ${targetRoles.join(', ')}`,
      });
    }

    // Send push + save notification for each
    const results = await Promise.all(
      targetUsers.map(async (user) => {
        const sent = await sendPushIfAvailable({
          userId: user.id,
          title: '🔔 Test Notification',
          message: `This is a test notification from a ${senderRole} account.`,
          type: 'test',
          data: { url: '/dashboard', senderRole, senderId: sender.id },
        });
        console.log(`  ${sent ? '✅' : '❌'} Notification ${sent ? 'sent' : 'failed'} to ${user.name} (ID: ${user.id})`);
        return sent;
      })
    );

    const successCount = results.filter(Boolean).length;
    console.log(`📊 Test notification result: ${successCount}/${targetUsers.length} successful`);

    res.json({
      success: true,
      message: `Test notification sent to ${successCount}/${targetUsers.length} users.`,
      targetCount: targetUsers.length,
      successCount,
    });
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * ✅ Route: Send "Due Soon" test notification to opposite role
 * Staff → Borrowers (notify them about due items) 
 * Borrower → Staff (alert staff about items due soon)
 * Admin → All (Borrowers and Staff)
 */
router.post('/test-due-soon', ensureAuth, async (req, res) => {
  try {
    const sender = req.user;
    const senderRole = sender.role;
    console.log(`📢 ${senderRole} (ID: ${sender.id}) sending due-soon notification`);

    let targetRoles = [];
    let notificationTitle;
    let notificationMessage;

    if (senderRole === 'staff') {
      targetRoles = ['borrower'];
      notificationTitle = '⚠️ Items Due Soon';
      notificationMessage = 'Your borrowed items are due in 3 days. Please return them on time.';
    } else if (senderRole === 'borrower') {
      targetRoles = ['staff', 'admin'];
      notificationTitle = '⚠️ Borrower Items Due Soon';
      notificationMessage = `${sender.name} has items due in 3 days.`;
    } else if (senderRole === 'admin') {
      targetRoles = ['borrower', 'staff'];
      notificationTitle = '⚠️ Items Due Soon';
      notificationMessage = 'Some items are due in 3 days. Please monitor.';
    } else {
      return res.status(403).json({ error: 'Only staff, borrower, or admin can send this notification.' });
    }

    // Get all users with the target roles
    const result = await db.query(
      `SELECT id, name, role FROM users WHERE role = ANY($1)`,
      [targetRoles]
    );
    const targetUsers = result.rows;

    console.log(`✅ Found ${targetUsers.length} target users:`, targetUsers.map(u => `${u.name}(${u.role})`));

    if (!targetUsers.length) {
      return res.json({
        success: false,
        message: `No users found with roles: ${targetRoles.join(', ')}`,
      });
    }

    // Send push notification to each target user
    const results = await Promise.all(
      targetUsers.map(async (user) => {
        const sent = await sendPushIfAvailable({
          userId: user.id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'due_soon',
          data: { 
            url: senderRole === 'staff' || senderRole === 'admin' ? '/my-borrowed-items' : '/manage-borrow-requests',
          },
        });
        console.log(`  ${sent ? '✅' : '❌'} Notification ${sent ? 'sent' : 'failed'} to ${user.name} (ID: ${user.id})`);
        return sent;
      })
    );

    const successCount = results.filter(Boolean).length;
    console.log(`📊 Due-soon notification result: ${successCount}/${targetUsers.length} successful`);

    res.json({
      success: true,
      message: `Due soon notification sent to ${successCount}/${targetUsers.length} users.`,
      targetCount: targetUsers.length,
      successCount,
    });
  } catch (error) {
    console.error('❌ Due soon notification error:', error);
    res.status(500).json({ error: 'Failed to send due soon notification' });
  }
});

module.exports = router;
