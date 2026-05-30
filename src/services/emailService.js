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
          <td style="padding: 12px; border-bottom: 1px solid #eee;">Rs. ${goal.currentSaving} / Rs. ${goal.targetAmount}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; color: ${daysLeft <= 7 ? "#ef4444" : "#374151"};">
            ${daysLeft > 0 ? `${daysLeft} days` : "<span style='color:#ef4444;'>Overdue</span>"}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">Rs. ${weeklyNeeded}/week</td>
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
              <span style="color: white; font-size: 18px; font-weight: 500;">Smart Finance</span>
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

const sendBudgetAlertEmail = async (toEmail, userName, budgetData) => {
  const {
    category,
    spentAmount,
    budgetAmount,
    spentPercentage,
    alertThreshold,
  } = budgetData;

  const statusColor = spentPercentage >= 100 ? "#ef4444" : "#f59e0b";
  const statusText = spentPercentage >= 100 ? "Exceeded" : "Alert";

  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: "rentalsystem42@gmail.com", Name: "Smart Finance" },
        To: [{ Email: toEmail }],
        Subject: `Budget Alert: ${category} budget ${statusText}`,
        HTMLPart: `
          <div style="font-family: sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
            <div style="background: #1a1a2e; padding: 28px 40px;">
              <span style="color: white; font-size: 18px; font-weight: 500;">Smart Finance - Budget Alert</span>
            </div>
            <div style="padding: 32px 40px; background: #ffffff;">
              <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px;">Hi ${userName},</h2>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px;">Your <strong>${category}</strong> budget has ${spentPercentage >= 100 ? "been exceeded" : "reached its alert threshold"}.</p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                  <div>
                    <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px;">Current Spending</p>
                    <p style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">Rs. ${spentAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p style="font-size: 12px; color: #6b7280; margin: 0 0 8px;">Budget Limit</p>
                    <p style="font-size: 24px; font-weight: 600; color: #111827; margin: 0;">Rs. ${budgetAmount.toFixed(2)}</p>
                  </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 13px; font-weight: 500; color: #374151;">Spending Progress</span>
                    <span style="font-size: 13px; font-weight: 600; color: ${statusColor};">${spentPercentage.toFixed(0)}%</span>
                  </div>
                  <div style="background: #e5e7eb; border-radius: 4px; height: 12px; width: 100%;">
                    <div style="background: ${statusColor}; width: ${Math.min(spentPercentage, 100)}%; height: 12px; border-radius: 4px;"></div>
                  </div>
                </div>
                
                <div style="font-size: 12px; color: #6b7280; margin-top: 12px;">
                  <p style="margin: 0;">Alert Threshold: ${alertThreshold}%</p>
                </div>
              </div>

              <p style="font-size: 13px; color: #374151; margin: 0;">
                ${
                  spentPercentage >= 100
                    ? "You have exceeded your budget limit. Consider reducing spending in this category."
                    : "You are approaching your budget limit. Be mindful of your spending."
                }
              </p>
            </div>
            <div style="border-top: 1px solid #f3f4f6; padding: 20px 40px; background: #f9fafb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">Manage your budgets and spending in your Smart Finance app.</p>
            </div>
          </div>
        `,
      },
    ],
  });

  console.log(`Budget alert email sent to ${toEmail} for ${category}`);
};

module.exports = { sendWeeklyReminderEmail, sendEmail, sendBudgetAlertEmail };
