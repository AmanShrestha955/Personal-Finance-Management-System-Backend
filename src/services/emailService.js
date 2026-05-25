const Mailjet = require("node-mailjet");

const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY,
  process.env.MAILJET_SECRET_KEY,
);

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
              <div style="background:#4f8ef7; width:${Math.min(progress, 100)}%; height:10px; border-radius:4px;"></div>
            </div>
            <span style="font-size:12px; color:#6b7280;">${progress}%</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">$${goal.currentSaving} / $${goal.targetAmount}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${daysLeft <= 7 ? "#ef4444" : "#374151"};">
            ${daysLeft > 0 ? `${daysLeft} days` : "<span style='color:#ef4444;'>Overdue</span>"}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">$${weeklyNeeded}/week</td>
        </tr>
      `;
    })
    .join("");

  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: "rentalsystem42@gmail.com", Name: "Smart Finance" },
        To: [{ Email: toEmail }],
        Subject: "Your weekly saving goals reminder",
        HTMLPart: `
          <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: #1a1a2e; padding: 28px 40px;">
              <span style="color: white; font-size: 18px; font-weight: 500;">💰 Smart Finance</span>
            </div>
            <div style="padding: 32px 40px; background: #ffffff;">
              <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px;">Hi ${userName}, here's your weekly savings update!</h2>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">Stay on track with your saving goals.</p>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 500;">Goal</th>
                    <th style="padding: 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 500;">Category</th>
                    <th style="padding: 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 500;">Progress</th>
                    <th style="padding: 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 500;">Saved</th>
                    <th style="padding: 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 500;">Deadline</th>
                    <th style="padding: 12px; text-align: left; font-size: 13px; color: #6b7280; font-weight: 500;">Weekly needed</th>
                  </tr>
                </thead>
                <tbody>${goalRows}</tbody>
              </table>
            </div>
            <div style="border-top: 1px solid #f3f4f6; padding: 20px 40px; background: #f9fafb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">You can disable reminders in your app settings.</p>
            </div>
          </div>
        `,
      },
    ],
  });

  console.log(`Weekly reminder email sent to ${toEmail}`);
};

const sendEmail = async ({ to, subject, html }) => {
  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: "rentalsystem42@gmail.com", Name: "Smart Finance" },
        To: [{ Email: to }],
        Subject: subject,
        HTMLPart: html,
      },
    ],
  });

  console.log(`Email sent to ${to}`);
};

module.exports = { sendWeeklyReminderEmail, sendEmail };
