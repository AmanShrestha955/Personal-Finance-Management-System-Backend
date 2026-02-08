/**
 * Get complete dashboard data
 * GET /api/dashboard?period=This Month
 * @param {string} period - "This Week" | "This Month" | "Last 3 Months" | "Last 6 Months" | "This Year"
 */
// Calculate date ranges based on period
const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate, previousStartDate, previousEndDate;

  switch (period) {
    case "This Week":
      // Current week (Monday to Sunday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(now);
      startDate.setDate(now.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      // Previous week
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(startDate.getDate() - 7);
      previousEndDate = new Date(endDate);
      previousEndDate.setDate(endDate.getDate() - 7);
      break;

    case "This Month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // Previous month
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      break;

    case "Last 3 Months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // Previous 3 months
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      previousEndDate = new Date(
        now.getFullYear(),
        now.getMonth() - 2,
        0,
        23,
        59,
        59,
        999,
      );
      break;

    case "Last 6 Months":
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // Previous 6 months
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      previousEndDate = new Date(
        now.getFullYear(),
        now.getMonth() - 5,
        0,
        23,
        59,
        59,
        999,
      );
      break;

    case "This Year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

      // Previous year
      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(
        now.getFullYear() - 1,
        11,
        31,
        23,
        59,
        59,
        999,
      );
      break;

    default:
      // Default to This Month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
  }

  return { startDate, endDate, previousStartDate, previousEndDate };
};

module.exports = { getDateRange };
