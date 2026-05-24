const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * @param {string} toEmail - recipient email
 * @param {string} userName - recipient name
 * @param {Array} goals - list of saving goals
 */
const sendWeeklyReminderEmail = async (toEmail, userName, goals) => {
  const goalRows = goals
    .map((goal) => {
      const progress = ((goal.currentSaving / goal.targetAmount) * 100).toFixed(
        1,
      );
      const deadline = new Date(goal.deadline);
      const daysLeft = Math.ceil(
        (deadline - new Date()) / (1000 * 60 * 60 * 24),
      );
      const remaining = goal.targetAmount - goal.currentSaving;

      // Calculate weekly savings needed
      const weeksLeft = Math.ceil(daysLeft / 7);
      const weeklyNeeded =
        weeksLeft > 0
          ? (remaining / weeksLeft).toFixed(2)
          : remaining.toFixed(2);

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${goal.goalName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${goal.category}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            <div style="background:#eee; border-radius:4px; height:10px; width:100%;">
              <div style="background:#4CAF50; width:${Math.min(progress, 100)}%; height:10px; border-radius:4px;"></div>
            </div>
            <span>${progress}%</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">$${goal.currentSaving} / $${goal.targetAmount}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${daysLeft > 0 ? `${daysLeft} days` : "Overdue"}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">$${weeklyNeeded}/week</td>
        </tr>
      `;
    })
    .join("");

  await resend.emails.send({
    from: `"Saving Goals App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "📊 Your Weekly Saving Goals Reminder",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: auto; padding: 20px;">
        <h2 style="color: #4CAF50;">Hi ${userName}, here's your weekly savings update!</h2>
        <p style="color: #666;">Stay on track with your saving goals. Here's how you're doing:</p>

        <table style="width:100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align:left;">Goal</th>
              <th style="padding: 12px; text-align:left;">Category</th>
              <th style="padding: 12px; text-align:left;">Progress</th>
              <th style="padding: 12px; text-align:left;">Saved</th>
              <th style="padding: 12px; text-align:left;">Deadline</th>
              <th style="padding: 12px; text-align:left;">Weekly Needed</th>
            </tr>
          </thead>
          <tbody>
            ${goalRows}
          </tbody>
        </table>

        <p style="margin-top: 30px; color: #999; font-size: 12px;">
          You are receiving this because you have active saving goals. 
          You can disable reminders in your app settings.
        </p>
      </div>
    `,
  });
  console.log(`Weekly reminder email sent to ${toEmail}`);
};

/**
 * @param {string} to - recipient email
 * @param {string} subject - email subject
 * @param {string} html - email html body
 */
const sendEmail = async ({ to, subject, html }) => {
  await resend.emails.send({
    from: `"Saving Goals App" <onboarding@resend.dev>`,
    to,
    subject,
    html,
  });
  console.log(`Email sent to ${to}`);
};

module.exports = { sendWeeklyReminderEmail, sendEmail };
