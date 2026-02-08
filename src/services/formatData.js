// Format the response
const formatCurrency = (amount) => {
  return `Rs. ${amount.toLocaleString("en-NP", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const formatPercentage = (value, isPositive = true) => {
  const sign = value >= 0 ? "+" : "-";
  const color = isPositive
    ? value >= 0
      ? "green"
      : "red"
    : value >= 0
      ? "red"
      : "green";

  return {
    value: `${sign}${Math.abs(value).toFixed(0)}%`,
    color,
    rawValue: value,
  };
};

module.exports = { formatCurrency, formatPercentage };
