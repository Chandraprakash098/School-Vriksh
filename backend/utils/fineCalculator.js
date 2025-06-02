const calculateFine = (dueDate, fineRate = 5) => {
  const today = new Date();
  if (dueDate >= today) return 0;
  const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
  return daysOverdue * fineRate;
};

module.exports = { calculateFine };