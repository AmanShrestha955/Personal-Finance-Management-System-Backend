const nodemailer = require("nodemailer");

const sendForgotPasswordEmail = async (email, resetUrl) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.USER_EMAIL,
      pass: process.env.USER_PASS,
    },
  });
  const mailOptions = {
    from: '"Smart Finance" <' + process.env.USER_EMAIL + ">",
    to: email,
    subject: "Password Reset Request",
    html: `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 30px; text-align: center; background-color: #4F46E5;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px;">Smart Finance</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Password Reset Request</h2>
                    <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                      We received a request to reset your password. Click the button below to create a new password:
                    </p>
                    
                    <!-- Button -->
                    <table role="presentation" style="margin: 30px 0;">
                      <tr>
                        <td style="border-radius: 4px; background-color: #4F46E5;">
                          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="margin: 0 0 20px 0; color: #4F46E5; font-size: 14px; word-break: break-all;">
                      ${resetUrl}
                    </p>
                    
                    <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      <strong>This link will expire in 1 hour for security reasons.</strong>
                    </p>
                    
                    <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                      If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="margin: 0; color: #999999; font-size: 12px;">
                      © ${new Date().getFullYear()} Smart Finance. All rights reserved.
                    </p>
                    <p style="margin: 10px 0 0 0; color: #999999; font-size: 12px;">
                      This is an automated message, please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>`,
  };
  await transporter.sendMail(mailOptions);
};

module.exports = { sendForgotPasswordEmail };
