const Papa = require("papaparse");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default; // .default is the actual function in Node.js

const Transaction = require("../models/transactionModels");
const Account = require("../models/accountModels");
const Budget = require("../models/budgetModels");
const SavingGoal = require("../models/savingGoalModels");
const RecurringTransaction = require("../models/Recurringtransactionmodel");

// ─── Helper: fix floating point precision on currency values ──
const fmt = (n) => Math.round((n || 0) * 100) / 100;

// ─── Helper: resolve date range ───────────────────────
// Defaults to rolling 12 months (same date last year → today).
// Accepts optional ?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD query params.
const resolveDateRange = (query) => {
  const today = new Date();
  const toDate = query.toDate ? new Date(query.toDate) : today;

  const defaultFromDate = new Date(toDate);
  defaultFromDate.setFullYear(defaultFromDate.getFullYear() - 1);

  const fromDate = query.fromDate ? new Date(query.fromDate) : defaultFromDate;

  // End of day so today's records are fully included
  toDate.setHours(23, 59, 59, 999);

  return {
    from: fromDate,
    to: toDate,
    label: `${fromDate.toLocaleDateString()} – ${toDate.toLocaleDateString()}`,
  };
};

const buildMongoRange = (from, to) => ({ $gte: from, $lte: to });

// ─── Helper: fetch all models for a user ─────────────
const fetchUserData = async (userId, from, to) => {
  const range = buildMongoRange(from, to);
  const [accounts, transactions, budgets, savingGoals, recurringTransactions] =
    await Promise.all([
      Account.find({ userId }).lean(),
      Transaction.find({ userId, transactionDate: range }).lean(),
      Budget.find({ userId, month: range }).lean(),
      SavingGoal.find({ userId }).lean(),
      RecurringTransaction.find({ userId }).lean(),
    ]);
  return {
    accounts,
    transactions,
    budgets,
    savingGoals,
    recurringTransactions,
  };
};

// ─── Helper: unparse one section with its own headers ─
const toCSVSection = (title, rows) => {
  if (!rows.length) return `\n${title} (no data)\n`;
  const block = Papa.unparse(rows, { header: true });
  return `\n${title}\n${block}\n`;
};

// ─── CSV Export ───────────────────────────────────────
// GET /export/csv
// GET /export/csv?fromDate=2024-01-01&toDate=2025-03-21
const exportCSV = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, label } = resolveDateRange(req.query);

    const {
      accounts,
      transactions,
      budgets,
      savingGoals,
      recurringTransactions,
    } = await fetchUserData(userId, from, to);

    const accountRows = accounts.map((a) => ({
      Balance: fmt(a.balance),
      Income: fmt(a.income),
      Expenses: fmt(a.expenses),
      "Created At": new Date(a.createdAt).toLocaleDateString(),
    }));

    const transactionRows = transactions.map((t) => ({
      Title: t.title,
      Amount: fmt(t.amount),
      Type: t.type,
      Category: t.category,
      "Payment Method": t.paymentMethod,
      Date: new Date(t.transactionDate).toLocaleDateString(),
      Description: t.description || "",
      Note: t.note || "",
      Tags: (t.tags || []).join(", "),
    }));

    const budgetRows = budgets.map((b) => ({
      Category: b.category,
      "Budget Amount": fmt(b.budgetAmount),
      "Spent Amount": fmt(b.spentAmount),
      "Alert Threshold (%)": b.alertThreshold,
      Month: new Date(b.month).toLocaleDateString(),
      Active: b.isActive ? "Yes" : "No",
    }));

    const savingGoalRows = savingGoals.map((s) => ({
      "Goal Name": s.goalName,
      "Target Amount": fmt(s.targetAmount),
      "Current Saving": fmt(s.currentSaving),
      Deadline: new Date(s.deadline).toLocaleDateString(),
      Category: s.category,
      Completed: s.isCompleted ? "Yes" : "No",
    }));

    const recurringRows = recurringTransactions.map((r) => ({
      Title: r.title,
      Amount: fmt(r.amount),
      Type: r.type,
      Category: r.category,
      "Payment Method": r.paymentMethod,
      Frequency: r.frequency,
      "Start Date": new Date(r.startDate).toLocaleDateString(),
      "End Date": r.endDate
        ? new Date(r.endDate).toLocaleDateString()
        : "Ongoing",
      "Next Run": new Date(r.nextRunDate).toLocaleDateString(),
      Active: r.isActive ? "Yes" : "No",
    }));

    const reportHeader = `Financial Report\nPeriod: ${label}\n`;
    const csv =
      reportHeader +
      toCSVSection("Accounts", accountRows) +
      toCSVSection("Transactions", transactionRows) +
      toCSVSection("Budgets", budgetRows) +
      toCSVSection("Saving Goals", savingGoalRows) +
      toCSVSection("Recurring Transactions", recurringRows);

    const filename = `financial-report_${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "CSV export failed" });
  }
};

// ─── PDF Export ───────────────────────────────────────
// GET /export/pdf
// GET /export/pdf?fromDate=2024-01-01&toDate=2025-03-21
const exportPDF = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, label } = resolveDateRange(req.query);

    const {
      accounts,
      transactions,
      budgets,
      savingGoals,
      recurringTransactions,
    } = await fetchUserData(userId, from, to);

    const doc = new jsPDF();
    let currentY = 15;

    const addSectionTitle = (title) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 15;
      }
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, currentY);
      currentY += 6;
    };

    // ── Report Header ──
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Report", 14, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Period: ${label}`, 14, currentY);
    currentY += 10;

    // ── 1. Accounts ──
    addSectionTitle("Accounts");
    autoTable(doc, {
      startY: currentY,
      head: [["Balance", "Income", "Expenses", "Created At"]],
      body: accounts.map((a) => [
        fmt(a.balance),
        fmt(a.income),
        fmt(a.expenses),
        new Date(a.createdAt).toLocaleDateString(),
      ]),
    });
    currentY = doc.lastAutoTable.finalY + 10;

    // ── 2. Transactions ──
    addSectionTitle("Transactions");
    autoTable(doc, {
      startY: currentY,
      head: [["Title", "Amount", "Type", "Category", "Payment Method", "Date"]],
      body: transactions.map((t) => [
        t.title,
        fmt(t.amount),
        t.type,
        t.category,
        t.paymentMethod,
        new Date(t.transactionDate).toLocaleDateString(),
      ]),
    });
    currentY = doc.lastAutoTable.finalY + 10;

    // ── 3. Budgets ──
    addSectionTitle("Budgets");
    autoTable(doc, {
      startY: currentY,
      head: [
        [
          "Category",
          "Budget Amount",
          "Spent Amount",
          "Alert (%)",
          "Month",
          "Active",
        ],
      ],
      body: budgets.map((b) => [
        b.category,
        fmt(b.budgetAmount),
        fmt(b.spentAmount),
        b.alertThreshold,
        new Date(b.month).toLocaleDateString(),
        b.isActive ? "Yes" : "No",
      ]),
    });
    currentY = doc.lastAutoTable.finalY + 10;

    // ── 4. Saving Goals ──
    addSectionTitle("Saving Goals");
    autoTable(doc, {
      startY: currentY,
      head: [
        [
          "Goal Name",
          "Target",
          "Current Saving",
          "Deadline",
          "Category",
          "Completed",
        ],
      ],
      body: savingGoals.map((s) => [
        s.goalName,
        fmt(s.targetAmount),
        fmt(s.currentSaving),
        new Date(s.deadline).toLocaleDateString(),
        s.category,
        s.isCompleted ? "Yes" : "No",
      ]),
    });
    currentY = doc.lastAutoTable.finalY + 10;

    // ── 5. Recurring Transactions ──
    addSectionTitle("Recurring Transactions");
    autoTable(doc, {
      startY: currentY,
      head: [
        [
          "Title",
          "Amount",
          "Type",
          "Frequency",
          "Start Date",
          "End Date",
          "Next Run",
          "Active",
        ],
      ],
      body: recurringTransactions.map((r) => [
        r.title,
        fmt(r.amount),
        r.type,
        r.frequency,
        new Date(r.startDate).toLocaleDateString(),
        r.endDate ? new Date(r.endDate).toLocaleDateString() : "Ongoing",
        new Date(r.nextRunDate).toLocaleDateString(),
        r.isActive ? "Yes" : "No",
      ]),
    });

    // "nodebuffer" returns null in this jsPDF version — "arraybuffer" works and
    // Buffer.from() accepts ArrayBuffer natively so the conversion is safe
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const filename = `financial-report_${from.toISOString().slice(0, 10)}_to_${to.toISOString().slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("PDF export error:", err);
    res.status(500).json({ message: "PDF export failed" });
  }
};

module.exports = { exportCSV, exportPDF };
