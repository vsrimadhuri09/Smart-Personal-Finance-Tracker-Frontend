import { useEffect, useState } from "react";
import { transactionsApi, budgetsApi, savingsApi, investmentsApi } from "../services/api";

function Analytics() {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);

  const loadData = async () => {
    // 1. Initial quick load from storage
    const savedTransactions = localStorage.getItem("fintrackTransactions");
    const savedBudgets = localStorage.getItem("fintrackBudgets");
    const savedSavings = localStorage.getItem("fintrackSavings");
    const savedInvestments = localStorage.getItem("fintrackInvestments");

    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    if (savedBudgets) setBudgets(JSON.parse(savedBudgets));
    if (savedSavings) setSavings(JSON.parse(savedSavings));
    if (savedInvestments) setInvestments(JSON.parse(savedInvestments));

    // 2. Fetch fresh live data from database
    try {
      const [tRes, bRes, sRes, iRes] = await Promise.allSettled([
        transactionsApi.getAll(),
        budgetsApi.getAll(),
        savingsApi.getAll(),
        investmentsApi.getAll(),
      ]);

      if (tRes.status === "fulfilled" && tRes.value) {
        const transList = tRes.value.map((t) => ({
          id: t.id,
          title: t.description || "Transaction",
          amount: Number(t.amount || 0),
          type: String(t.type || "EXPENSE").toLowerCase(),
          category: t.category,
          date: t.transactionDate,
        }));
        setTransactions(transList);
        localStorage.setItem("fintrackTransactions", JSON.stringify(transList));
      }

      if (bRes.status === "fulfilled" && bRes.value) {
        const bList = bRes.value.map((b) => ({
          id: b.id,
          category: b.category,
          amount: Number(b.budgetAmount || 0),
          spent: Number(b.spentAmount || 0),
        }));
        setBudgets(bList);
        localStorage.setItem("fintrackBudgets", JSON.stringify(bList));
      }

      if (sRes.status === "fulfilled" && sRes.value) {
        const sList = sRes.value.map((s) => ({
          id: s.id,
          name: s.goalName,
          target: Number(s.targetAmount || 0),
          saved: Number(s.currentAmount || 0),
        }));
        setSavings(sList);
        localStorage.setItem("fintrackSavings", JSON.stringify(sList));
      }

      if (iRes.status === "fulfilled" && iRes.value) {
        const iList = iRes.value.map((i) => ({
          id: i.id,
          name: i.name,
          invested: Number(i.investedAmount || 0),
          current: Number(i.currentAmount || 0),
        }));
        setInvestments(iList);
        localStorage.setItem("fintrackInvestments", JSON.stringify(iList));
      }
    } catch {
      // Fallback to cache already loaded
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener(
      "fintrackTransactionsUpdated",
      handleUpdate
    );

    window.addEventListener(
      "storage",
      handleUpdate
    );

    return () => {
      window.removeEventListener(
        "fintrackTransactionsUpdated",
        handleUpdate
      );

      window.removeEventListener(
        "storage",
        handleUpdate
      );
    };
  }, []);

  // -----------------------------
  // Financial calculations
  // -----------------------------

  const totalIncome = transactions
    .filter(
      (transaction) => transaction.type === "income"
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0
    );

  const totalExpenses = transactions
    .filter(
      (transaction) => transaction.type === "expense"
    )
    .reduce(
      (total, transaction) =>
        total + Number(transaction.amount),
      0
    );

  const balance = totalIncome - totalExpenses;

  const totalBudget = budgets.reduce(
    (total, budget) =>
      total + Number(budget.amount),
    0
  );

  const totalBudgetSpent = budgets.reduce(
    (total, budget) => {
      const spent = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.category === budget.category
        )
        .reduce(
          (sum, transaction) =>
            sum + Number(transaction.amount),
          0
        );

      return total + spent;
    },
    0
  );

  const totalSaved = savings.reduce(
    (total, goal) =>
      total + Number(goal.saved),
    0
  );

  const totalSavingsTarget = savings.reduce(
    (total, goal) =>
      total + Number(goal.target),
    0
  );

  const totalInvested = investments.reduce(
    (total, investment) =>
      total + Number(investment.invested),
    0
  );

  const currentInvestmentValue =
    investments.reduce(
      (total, investment) =>
        total + Number(investment.current),
      0
    );

  const investmentProfit =
    currentInvestmentValue - totalInvested;

  // -----------------------------
  // Expense categories
  // -----------------------------

  const categoryTotals = {};

  transactions
    .filter(
      (transaction) =>
        transaction.type === "expense"
    )
    .forEach((transaction) => {
      const category = transaction.category || "Other";

      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }

      categoryTotals[category] += Number(
        transaction.amount
      );
    });

  const categoryData = Object.entries(
    categoryTotals
  ).sort((a, b) => b[1] - a[1]);

  const highestExpenseCategory =
    categoryData.length > 0
      ? categoryData[0][0]
      : "None";

  // -----------------------------
  // Monthly analysis
  // -----------------------------

  const monthlyData = {};

  transactions.forEach((transaction) => {
    if (!transaction.date) return;

    const date = new Date(transaction.date);

    const month = date.toLocaleDateString(
      "en-IN",
      {
        month: "short",
        year: "numeric",
      }
    );

    if (!monthlyData[month]) {
      monthlyData[month] = {
        income: 0,
        expenses: 0,
      };
    }

    if (transaction.type === "income") {
      monthlyData[month].income += Number(
        transaction.amount
      );
    }

    if (transaction.type === "expense") {
      monthlyData[month].expenses += Number(
        transaction.amount
      );
    }
  });

  const monthlyEntries = Object.entries(
    monthlyData
  );

  const maxMonthlyValue = Math.max(
    ...monthlyEntries.flatMap(([, data]) => [
      data.income,
      data.expenses,
    ]),
    1
  );

  // -----------------------------
  // Helpers
  // -----------------------------

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const getPercentage = (value, total) => {
    if (total <= 0) return 0;

    return (value / total) * 100;
  };

  const savingsPercentage =
    totalSavingsTarget > 0
      ? (totalSaved / totalSavingsTarget) * 100
      : 0;

  const budgetPercentage =
    totalBudget > 0
      ? (totalBudgetSpent / totalBudget) * 100
      : 0;

  const investmentReturn =
    totalInvested > 0
      ? (investmentProfit / totalInvested) * 100
      : 0;

  // -----------------------------
  // Financial health
  // -----------------------------

  let healthScore = 50;

  if (totalIncome > 0) {
    const savingRate =
      ((totalIncome - totalExpenses) /
        totalIncome) *
      100;

    if (savingRate >= 30) {
      healthScore += 25;
    } else if (savingRate >= 15) {
      healthScore += 15;
    } else if (savingRate >= 0) {
      healthScore += 5;
    } else {
      healthScore -= 15;
    }
  }

  if (
    totalBudget > 0 &&
    totalBudgetSpent <= totalBudget
  ) {
    healthScore += 10;
  }

  if (
    totalSavingsTarget > 0 &&
    totalSaved >= totalSavingsTarget * 0.5
  ) {
    healthScore += 10;
  }

  if (
    totalInvested > 0 &&
    investmentProfit >= 0
  ) {
    healthScore += 5;
  }

  healthScore = Math.max(
    0,
    Math.min(100, Math.round(healthScore))
  );

  let healthMessage = "Needs Attention";

  if (healthScore >= 80) {
    healthMessage = "Excellent";
  } else if (healthScore >= 65) {
    healthMessage = "Good";
  } else if (healthScore >= 50) {
    healthMessage = "Fair";
  }

  return (
    <div className="page-container">

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p>
            Understand your financial performance
            and spending patterns
          </p>
        </div>

        <button
          className="secondary-btn"
          onClick={loadData}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Main Summary */}
      <div className="summary-grid">

        <div className="summary-card">
          <div className="summary-icon">
            💰
          </div>

          <div>
            <p>Total Income</p>
            <h2>
              {formatCurrency(totalIncome)}
            </h2>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            💸
          </div>

          <div>
            <p>Total Expenses</p>
            <h2>
              {formatCurrency(totalExpenses)}
            </h2>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            📊
          </div>

          <div>
            <p>Balance</p>

            <h2
              className={
                balance >= 0
                  ? "positive-text"
                  : "negative-text"
              }
            >
              {formatCurrency(balance)}
            </h2>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            📈
          </div>

          <div>
            <p>Investment Value</p>

            <h2>
              {formatCurrency(
                currentInvestmentValue
              )}
            </h2>
          </div>
        </div>

      </div>

      {/* Financial Health */}
      <div className="card financial-health">

        <div className="section-header">
          <div>
            <h2>Financial Health</h2>
            <p>
              Overall view of your financial
              condition
            </p>
          </div>

          <div className="health-score">
            <strong>{healthScore}</strong>
            <span>/100</span>
          </div>
        </div>

        <div className="health-progress">
          <div
            className="health-progress-fill"
            style={{
              width: `${healthScore}%`,
            }}
          ></div>
        </div>

        <div className="health-details">
          <strong>{healthMessage}</strong>

          <span>
            {healthScore >= 80
              ? "Your finances are in a strong position."
              : healthScore >= 65
              ? "Your finances are generally healthy."
              : healthScore >= 50
              ? "There is room to improve your financial habits."
              : "Consider reviewing your spending and savings."}
          </span>
        </div>

      </div>

      {/* Income vs Expenses */}
      <div className="card">

        <div className="section-header">
          <div>
            <h2>Income vs Expenses</h2>
            <p>
              Compare your monthly income and
              spending
            </p>
          </div>
        </div>

        {monthlyEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              📊
            </div>

            <h3>No transaction data</h3>

            <p>
              Add some transactions to see
              your monthly analytics.
            </p>
          </div>
        ) : (
          <div className="analytics-chart">

            {monthlyEntries.map(
              ([month, data]) => (
                <div
                  className="chart-column"
                  key={month}
                >

                  <div className="chart-bars">

                    <div
                      className="chart-bar income-bar"
                      style={{
                        height: `${
                          (data.income /
                            maxMonthlyValue) *
                          180
                        }px`,
                      }}
                      title={`Income: ${formatCurrency(
                        data.income
                      )}`}
                    >
                      {data.income > 0 && (
                        <span>
                          {formatCurrency(
                            data.income
                          )}
                        </span>
                      )}
                    </div>

                    <div
                      className="chart-bar expense-bar"
                      style={{
                        height: `${
                          (data.expenses /
                            maxMonthlyValue) *
                          180
                        }px`,
                      }}
                      title={`Expenses: ${formatCurrency(
                        data.expenses
                      )}`}
                    >
                      {data.expenses > 0 && (
                        <span>
                          {formatCurrency(
                            data.expenses
                          )}
                        </span>
                      )}
                    </div>

                  </div>

                  <div className="chart-label">
                    {month}
                  </div>

                </div>
              )
            )}

          </div>
        )}

        <div className="chart-legend">

          <div>
            <span className="legend-dot income-dot"></span>
            Income
          </div>

          <div>
            <span className="legend-dot expense-dot"></span>
            Expenses
          </div>

        </div>

      </div>

      {/* Two Column Analytics */}
      <div className="analytics-grid">

        {/* Expense Categories */}
        <div className="card">

          <div className="section-header">
            <div>
              <h2>Expenses by Category</h2>
              <p>
                Where your money is going
              </p>
            </div>
          </div>

          {categoryData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                💸
              </div>

              <h3>No expenses</h3>

              <p>
                Add expense transactions to
                see category analysis.
              </p>
            </div>
          ) : (
            <div className="category-analytics">

              {categoryData.map(
                ([category, amount]) => {

                  const percentage =
                    getPercentage(
                      amount,
                      totalExpenses
                    );

                  return (
                    <div
                      className="category-row"
                      key={category}
                    >

                      <div className="category-row-top">

                        <span>
                          {category}
                        </span>

                        <strong>
                          {formatCurrency(
                            amount
                          )}
                        </strong>

                      </div>

                      <div className="progress-bar">

                        <div
                          className="progress-fill"
                          style={{
                            width: `${percentage}%`,
                          }}
                        ></div>

                      </div>

                      <small>
                        {percentage.toFixed(1)}%
                        of total expenses
                      </small>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

        {/* Budget Analysis */}
        <div className="card">

          <div className="section-header">
            <div>
              <h2>Budget Analysis</h2>
              <p>
                How much of your budget is used
              </p>
            </div>
          </div>

          <div className="analytics-stat">

            <div>
              <span>Total Budget</span>
              <strong>
                {formatCurrency(totalBudget)}
              </strong>
            </div>

            <div>
              <span>Spent</span>
              <strong>
                {formatCurrency(totalBudgetSpent)}
              </strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong
                className={
                  totalBudget - totalBudgetSpent >= 0
                    ? "positive-text"
                    : "negative-text"
                }
              >
                {formatCurrency(
                  totalBudget - totalBudgetSpent
                )}
              </strong>
            </div>

          </div>

          <div className="analytics-progress">

            <div className="progress-header">
              <span>Budget Usage</span>

              <strong>
                {budgetPercentage.toFixed(1)}%
              </strong>
            </div>

            <div className="progress-bar">

              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(
                    budgetPercentage,
                    100
                  )}%`,
                }}
              ></div>

            </div>

          </div>

          <div className="analytics-insight">

            {totalBudget === 0 ? (
              <>
                <strong>No budgets created</strong>
                <p>
                  Create budgets to track your
                  spending limits.
                </p>
              </>
            ) : totalBudgetSpent > totalBudget ? (
              <>
                <strong>Budget exceeded</strong>
                <p>
                  Your spending is above the
                  total planned budget.
                </p>
              </>
            ) : budgetPercentage >= 80 ? (
              <>
                <strong>Budget warning</strong>
                <p>
                  You have used most of your
                  available budget.
                </p>
              </>
            ) : (
              <>
                <strong>Budget under control</strong>
                <p>
                  Your current spending is within
                  your planned budget.
                </p>
              </>
            )}

          </div>

        </div>

      </div>

      {/* Savings and Investments */}
      <div className="analytics-grid">

        {/* Savings */}
        <div className="card">

          <div className="section-header">
            <div>
              <h2>Savings Progress</h2>
              <p>
                Progress toward your savings goals
              </p>
            </div>
          </div>

          <div className="analytics-stat">

            <div>
              <span>Total Target</span>
              <strong>
                {formatCurrency(
                  totalSavingsTarget
                )}
              </strong>
            </div>

            <div>
              <span>Total Saved</span>
              <strong>
                {formatCurrency(totalSaved)}
              </strong>
            </div>

            <div>
              <span>Remaining</span>
              <strong>
                {formatCurrency(
                  Math.max(
                    totalSavingsTarget -
                      totalSaved,
                    0
                  )
                )}
              </strong>
            </div>

          </div>

          <div className="analytics-progress">

            <div className="progress-header">
              <span>Overall Progress</span>

              <strong>
                {Math.min(
                  savingsPercentage,
                  100
                ).toFixed(1)}
                %
              </strong>
            </div>

            <div className="progress-bar">

              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(
                    savingsPercentage,
                    100
                  )}%`,
                }}
              ></div>

            </div>

          </div>

        </div>

        {/* Investments */}
        <div className="card">

          <div className="section-header">
            <div>
              <h2>Investment Performance</h2>
              <p>
                Current performance of your
                investments
              </p>
            </div>
          </div>

          <div className="analytics-stat">

            <div>
              <span>Invested</span>
              <strong>
                {formatCurrency(
                  totalInvested
                )}
              </strong>
            </div>

            <div>
              <span>Current Value</span>
              <strong>
                {formatCurrency(
                  currentInvestmentValue
                )}
              </strong>
            </div>

            <div>
              <span>Profit / Loss</span>

              <strong
                className={
                  investmentProfit >= 0
                    ? "positive-text"
                    : "negative-text"
                }
              >
                {investmentProfit >= 0
                  ? "+"
                  : ""}
                {formatCurrency(
                  investmentProfit
                )}
              </strong>
            </div>

          </div>

          <div className="investment-return">

            <span>Overall Return</span>

            <strong
              className={
                investmentReturn >= 0
                  ? "positive-text"
                  : "negative-text"
              }
            >
              {investmentReturn >= 0
                ? "+"
                : ""}
              {investmentReturn.toFixed(2)}%
            </strong>

          </div>

        </div>

      </div>

      {/* Key Insights */}
      <div className="card">

        <div className="section-header">
          <div>
            <h2>Key Insights</h2>
            <p>
              Important observations from your
              financial data
            </p>
          </div>
        </div>

        <div className="insights-grid">

          <div className="insight-card">

            <div className="insight-icon">
              💸
            </div>

            <div>
              <h3>Highest Expense</h3>

              <p>
                Your highest spending category
                is{" "}
                <strong>
                  {highestExpenseCategory}
                </strong>
                .
              </p>
            </div>

          </div>

          <div className="insight-card">

            <div className="insight-icon">
              💰
            </div>

            <div>
              <h3>Balance</h3>

              <p>
                Your current balance is{" "}
                <strong>
                  {formatCurrency(balance)}
                </strong>
                .
              </p>
            </div>

          </div>

          <div className="insight-card">

            <div className="insight-icon">
              🎯
            </div>

            <div>
              <h3>Savings</h3>

              <p>
                You have saved{" "}
                <strong>
                  {savingsPercentage.toFixed(1)}%
                </strong>{" "}
                of your total savings target.
              </p>
            </div>

          </div>

          <div className="insight-card">

            <div className="insight-icon">
              📈
            </div>

            <div>
              <h3>Investments</h3>

              <p>
                Your investments currently show a{" "}
                <strong
                  className={
                    investmentProfit >= 0
                      ? "positive-text"
                      : "negative-text"
                  }
                >
                  {investmentProfit >= 0
                    ? "profit"
                    : "loss"}
                </strong>
                .
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Analytics;