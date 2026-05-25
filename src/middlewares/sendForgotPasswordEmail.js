// ✅ correct
const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const sendForgotPasswordEmail = async (email, resetUrl) => {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  await apiInstance.sendTransacEmail({
    sender: { name: "Smart Finance", email: "rentalsystem42@gmail.com" },
    to: [{ email }],
    subject: "Password Reset Request",
    htmlContent: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: #1a1a2e; padding: 32px 40px; text-align: center;">
          <span style="color: white; font-size: 18px; font-weight: 500;">💰 Smart Finance</span>
        </div>
        <div style="padding: 40px 40px 32px; background: #ffffff;">
          <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 12px;">Password Reset Request</h1>
          <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 32px;">
            We received a request to reset your password. Click the button below to create a new password. This link expires in <strong>15 minutes</strong>.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #4f8ef7; color: white; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 500; margin-bottom: 32px;">
            Reset password
          </a>
          <div style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
            <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px;">Or copy and paste this link:</p>
            <p style="font-size: 12px; color: #4f8ef7; word-break: break-all; background: #f9fafb; padding: 10px 12px; border-radius: 6px; margin: 0; font-family: monospace;">
              ${resetUrl}
            </p>
          </div>
        </div>
        <div style="border-top: 1px solid #f3f4f6; padding: 20px 40px; background: #f9fafb;">
          <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.7;">
            If you didn't request a password reset, you can safely ignore this email.
            © ${new Date().getFullYear()} Smart Finance.
          </p>
        </div>
      </div>
    `,
  });

  console.log(`Forgot password email sent to ${email}`);
};

module.exports = { sendForgotPasswordEmail };
