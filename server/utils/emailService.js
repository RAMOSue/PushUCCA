// server/utils/emailService.js
const nodemailer = require("nodemailer");

console.log("📧 Email Service Initializing...");
console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email Service Error:", error.message);
  } else {
    console.log("✅ Email Service Ready - SMTP connection verified");
  }
});

/**
 * Send verification code email
 */
async function sendVerificationEmail(to, verificationCode) {
  try {
    console.log(`📧 Attempting to send verification email to: ${to}`);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #166534 0%, #0d9488 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .code-box { background: white; border: 2px solid #10b981; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .code-box .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
          .code-box .code { font-size: 36px; font-weight: bold; color: #166534; letter-spacing: 5px; margin: 10px 0; font-family: 'Courier New', monospace; }
          .code-box .expires { font-size: 12px; color: #999; margin-top: 10px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; border-top: 1px solid #e5e7eb; margin-top: 20px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Verification</h1>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            
            <p>Welcome to CARSU Instruments System! Your verification code is:</p>
            
            <div class="code-box">
              <div class="label">Verification Code</div>
              <div class="code">${verificationCode}</div>
              <div class="expires">This code expires in 15 minutes</div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. We will never ask for this code via email or phone.
            </div>
            
            <p>If you didn't create this account, please ignore this email.</p>
            
            <p>Best regards,<br><strong>CARSU Instruments System</strong></p>
          </div>
          
          <div class="footer">
            <p>© 2024 Caraga State University. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await transporter.sendMail({
      from: `"CARSU Instruments System" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Email Verification - CARSU Instruments System",
      html: htmlContent,
    });
    
    console.log(`✅ Verification email successfully sent to ${to}`);
    console.log(`   Message ID: ${result.messageId}`);
    return true;
  } catch (err) {
    console.error("❌ Verification email error:", err.message);
    console.error("   Error code:", err.code);
    console.error("   Recipient:", to);
    throw err;
  }
}

module.exports = { sendVerificationEmail };
