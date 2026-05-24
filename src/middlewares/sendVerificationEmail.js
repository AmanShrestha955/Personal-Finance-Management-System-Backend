const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (email, verifiyUrl) => {
  await resend.emails.send({
    from: '"Smart Finance" <onboarding@resend.dev>',
    to: email,
    subject: "Verify your email",
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <div style="background: #1a1a2e; padding: 32px 40px; text-align: center;">
        <span style="color: white; font-size: 18px; font-weight: 500;">💰 Smart Finance</span>
      </div>

      <!-- Body -->
      <div style="padding: 40px 40px 32px; background: #ffffff;">
        <h1 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 12px;">Verify your email address</h1>
        <p style="font-size: 15px; color: #6b7280; line-height: 1.7; margin: 0 0 32px;">
          Thanks for signing up! Click the button below to verify your email and get started with Smart Finance.
        </p>

        <a href="${verifyUrl}" style="display: inline-block; background: #4f8ef7; color: white; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-size: 15px; font-weight: 500; margin-bottom: 32px;">
          Verify email address
        </a>

        <div style="border-top: 1px solid #f3f4f6; padding-top: 24px;">
          <p style="font-size: 13px; color: #9ca3af; margin: 0 0 8px;">Or copy and paste this link:</p>
          <p style="font-size: 12px; color: #4f8ef7; word-break: break-all; background: #f9fafb; padding: 10px 12px; border-radius: 6px; margin: 0; font-family: monospace;">
            ${verifyUrl}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #f3f4f6; padding: 20px 40px; background: #f9fafb;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.7;">
          This link expires in <strong style="color: #6b7280;">24 hours</strong>. If you didn't create an account, you can safely ignore this email.
        </p>
      </div>

    </div>
    `,
  });
};

module.exports = { sendVerificationEmail };
