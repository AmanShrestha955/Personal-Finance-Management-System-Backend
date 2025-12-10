const nodemailer = require("nodemailer");

const sendVerificationEmail = async (email, verifiyUrl) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.USER_EMAIL,
      pass: process.env.USER_PASS,
    },
  });
  const mailOptions = {
    from: '"Smart Finance" <no-reply@smartfinance.com>',
    to: email,
    subject: "Verify your email",
    html: `
      <h2>Email Verification</h2>
      <p>Please click the link below to verify your account:</p>
      <a href="${verifiyUrl}">${verifiyUrl}</a>
      <p>This link will expire in 24 hours.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
