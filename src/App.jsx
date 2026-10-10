import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useNavigate,
} from "react-router-dom";

import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Savings from "./pages/Savings";
import Investments from "./pages/Investments";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { transactionsApi, budgetsApi, savingsApi, investmentsApi, clearAuthSession } from "./services/api";

// =========================
// PROTECTED ROUTE
// =========================
function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

  return isLoggedIn ? children : <Navigate to="/login" replace />;
}


// =========================
// DASHBOARD
// =========================
function Dashboard() {
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [savings, setSavings] = useState([]);
  const [investments, setInvestments] = useState([]);

  const [userName, setUserName] = useState(
    localStorage.getItem("fintrackUser") || "User"
  );

  const loadDashboardData = async () => {
    // Immediate load from local storage
    const storedTransactions =
      JSON.parse(localStorage.getItem("fintrackTransactions")) || [];
    const storedBudgets =
      JSON.parse(localStorage.getItem("fintrackBudgets")) || [];
    const storedSavings =
      JSON.parse(localStorage.getItem("fintrackSavings")) || [];
    const storedInvestments =
      JSON.parse(localStorage.getItem("fintrackInvestments")) || [];

    setTransactions(storedTransactions);
    setBudgets(storedBudgets);
    setSavings(storedSavings);
    setInvestments(storedInvestments);
    setUserName(localStorage.getItem("fintrackUser") || "User");

    // Fetch fresh synchronized state from backend API
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
          paymentMethod: t.paymentMethod,
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
      // Offline / fallback to cached data
    }
  };

  useEffect(() => {
    loadDashboardData();

    window.addEventListener(
      "fintrackTransactionsUpdated",
      loadDashboardData
    );

    window.addEventListener("storage", loadDashboardData);

    return () => {
      window.removeEventListener(
        "fintrackTransactionsUpdated",
        loadDashboardData
      );

      window.removeEventListener("storage", loadDashboardData);
    };
  }, []);


  // =========================
  // FINANCIAL CALCULATIONS
  // =========================

  const totalIncome = useMemo(() => {
    return transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions]);

  const balance = totalIncome - totalExpenses;

  const totalBudget = budgets.reduce(
    (sum, budget) => sum + Number(budget.amount || 0),
    0
  );

  const totalBudgetSpent = budgets.reduce((sum, budget) => {
    const spent = transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.category === budget.category
      )
      .reduce((value, transaction) => value + Number(transaction.amount || 0), 0);

    return sum + spent;
  }, 0);

  const totalSaved = savings.reduce(
    (sum, goal) => sum + Number(goal.saved || 0),
    0
  );

  const totalSavingsTarget = savings.reduce(
    (sum, goal) => sum + Number(goal.target || 0),
    0
  );

  const totalInvested = investments.reduce(
    (sum, investment) => sum + Number(investment.invested || 0),
    0
  );

  const currentInvestmentValue = investments.reduce(
    (sum, investment) => sum + Number(investment.current || 0),
    0
  );

  const investmentProfit = currentInvestmentValue - totalInvested;

  const savingsProgress =
    totalSavingsTarget > 0
      ? Math.min((totalSaved / totalSavingsTarget) * 100, 100)
      : 0;

  const budgetProgress =
    totalBudget > 0
      ? Math.min((totalBudgetSpent / totalBudget) * 100, 100)
      : 0;

  const investmentReturn =
    totalInvested > 0
      ? ((currentInvestmentValue - totalInvested) / totalInvested) * 100
      : 0;


  // =========================
  // FINANCIAL HEALTH
  // =========================

  let healthScore = 50;

  if (balance > 0) healthScore += 15;

  if (totalIncome > 0 && totalExpenses < totalIncome * 0.7) {
    healthScore += 15;
  }

  if (savingsProgress >= 50) {
    healthScore += 10;
  }

  if (budgetProgress <= 80) {
    healthScore += 10;
  }

  healthScore = Math.min(healthScore, 100);

  let healthLabel = "Needs Attention";

  if (healthScore >= 80) {
    healthLabel = "Excellent";
  } else if (healthScore >= 65) {
    healthLabel = "Good";
  }


  // =========================
  // GREETING
  // =========================

  const hour = new Date().getHours();

  let greeting = "Good evening";

  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 17) {
    greeting = "Good afternoon";
  }


  // =========================
  // RECENT TRANSACTIONS
  // =========================

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);


  // =========================
  // MONTHLY DATA
  // =========================

  const monthlyData = useMemo(() => {
    const months = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();

      date.setMonth(date.getMonth() - i);

      const month = date.toLocaleString("en-IN", {
        month: "short",
      });

      const year = date.getFullYear();
      const monthNumber = date.getMonth();

      const income = transactions
        .filter((transaction) => {
          const transactionDate = new Date(transaction.date);

          return (
            transaction.type === "income" &&
            transactionDate.getMonth() === monthNumber &&
            transactionDate.getFullYear() === year
          );
        })
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      const expense = transactions
        .filter((transaction) => {
          const transactionDate = new Date(transaction.date);

          return (
            transaction.type === "expense" &&
            transactionDate.getMonth() === monthNumber &&
            transactionDate.getFullYear() === year
          );
        })
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      months.push({
        month,
        income,
        expense,
      });
    }

    return months;
  }, [transactions]);


  const maxMonthlyValue = Math.max(
    ...monthlyData.flatMap((item) => [item.income, item.expense]),
    1
  );


  // =========================
  // CATEGORY SPENDING
  // =========================

  const categorySpending = useMemo(() => {
    const categoryMap = {};

    transactions
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const category = transaction.category || "Other";

        categoryMap[category] =
          (categoryMap[category] || 0) + Number(transaction.amount || 0);
      });

    return Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions]);


  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };


  return (
    <div className="dashboard-page">

      {/* =========================
          HEADER
      ========================= */}
      <div className="dashboard-header">

        <div>
          <div className="dashboard-greeting">
            {greeting}, {userName} 👋
          </div>

          <h1>Financial Overview</h1>

          <p>
            Here’s a clear picture of your money, spending and financial goals.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadDashboardData}
        >
          ↻ Refresh
        </button>

      </div>


      {/* =========================
          HERO BALANCE
      ========================= */}
      <div className="dashboard-hero">

        <div className="hero-content">

          <div className="hero-label">
            TOTAL BALANCE
          </div>

          <div className="hero-balance">
            {formatMoney(balance)}
          </div>

          <div className="hero-description">
            Available balance based on your recorded income and expenses.
          </div>

          <div className="hero-mini-stats">

            <div className="hero-mini-item">
              <span className="hero-mini-icon income">
                ↑
              </span>

              <div>
                <small>Total Income</small>
                <strong>{formatMoney(totalIncome)}</strong>
              </div>
            </div>


            <div className="hero-mini-item">
              <span className="hero-mini-icon expense">
                ↓
              </span>

              <div>
                <small>Total Expenses</small>
                <strong>{formatMoney(totalExpenses)}</strong>
              </div>
            </div>


            <div className="hero-mini-item">
              <span className="hero-mini-icon investment">
                ◈
              </span>

              <div>
                <small>Investments</small>
                <strong>{formatMoney(currentInvestmentValue)}</strong>
              </div>
            </div>

          </div>

        </div>


        <div className="hero-health">

          <div className="health-circle">
            <div>
              <strong>{healthScore}</strong>
              <span>/100</span>
            </div>
          </div>

          <span className="health-title">
            Financial Health
          </span>

          <span className="health-status">
            {healthLabel}
          </span>

        </div>

      </div>


      {/* =========================
          KPI CARDS
      ========================= */}
      <div className="dashboard-kpi-grid">

        <div className="dashboard-kpi-card">

          <div className="kpi-icon income-icon">
            ↑
          </div>

          <div>
            <span>Total Income</span>
            <strong>{formatMoney(totalIncome)}</strong>
            <small>Money received</small>
          </div>

        </div>


        <div className="dashboard-kpi-card">

          <div className="kpi-icon expense-icon">
            ↓
          </div>

          <div>
            <span>Total Expenses</span>
            <strong>{formatMoney(totalExpenses)}</strong>
            <small>Money spent</small>
          </div>

        </div>


        <div className="dashboard-kpi-card">

          <div className="kpi-icon savings-icon">
            $
          </div>

          <div>
            <span>Total Savings</span>
            <strong>{formatMoney(totalSaved)}</strong>
            <small>
              {Math.round(savingsProgress)}% of target
            </small>
          </div>

        </div>


        <div className="dashboard-kpi-card">

          <div className="kpi-icon investment-icon">
            ◈
          </div>

          <div>
            <span>Portfolio Value</span>
            <strong>{formatMoney(currentInvestmentValue)}</strong>

            <small className={investmentProfit >= 0 ? "positive" : "negative"}>
              {investmentProfit >= 0 ? "+" : ""}
              {formatMoney(investmentProfit)}
            </small>
          </div>

        </div>

      </div>


      {/* =========================
          MAIN GRID
      ========================= */}
      <div className="dashboard-main-grid">


        {/* CASHFLOW */}
        <div className="dashboard-card cashflow-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Cash Flow</h2>
              <p>Income vs expenses over the last 6 months</p>
            </div>

            <button
              className="text-button"
              onClick={() => navigate("/analytics")}
            >
              View Analytics →
            </button>

          </div>


          <div className="cashflow-chart">

            {monthlyData.map((item, index) => {

              const incomeHeight =
                (item.income / maxMonthlyValue) * 100;

              const expenseHeight =
                (item.expense / maxMonthlyValue) * 100;

              return (
                <div
                  className="cashflow-column"
                  key={index}
                >

                  <div className="cashflow-bars">

                    <div
                      className="cashflow-bar income-bar"
                      style={{
                        height: `${Math.max(incomeHeight, 4)}%`,
                      }}
                      title={`Income: ${formatMoney(item.income)}`}
                    />

                    <div
                      className="cashflow-bar expense-bar"
                      style={{
                        height: `${Math.max(expenseHeight, 4)}%`,
                      }}
                      title={`Expenses: ${formatMoney(item.expense)}`}
                    />

                  </div>

                  <span>{item.month}</span>

                </div>
              );
            })}

          </div>


          <div className="cashflow-legend">

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


        {/* BUDGET */}
        <div className="dashboard-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Budget Overview</h2>
              <p>Your current spending progress</p>
            </div>

            <button
              className="text-button"
              onClick={() => navigate("/budgets")}
            >
              Manage →
            </button>

          </div>


          <div className="budget-summary-number">
            <strong>{formatMoney(totalBudgetSpent)}</strong>
            <span>
              of {formatMoney(totalBudget)} spent
            </span>
          </div>


          <div className="dashboard-progress">

            <div
              className="dashboard-progress-fill"
              style={{
                width: `${budgetProgress}%`,
              }}
            />

          </div>


          <div className="dashboard-progress-footer">

            <span>
              {Math.round(budgetProgress)}% used
            </span>

            <span
              className={
                totalBudget - totalBudgetSpent >= 0
                  ? "positive"
                  : "negative"
              }
            >
              {formatMoney(totalBudget - totalBudgetSpent)} remaining
            </span>

          </div>


          {budgets.length === 0 ? (
            <div className="dashboard-empty-small">
              No budgets created yet.
            </div>
          ) : (
            <div className="mini-budget-list">

              {budgets.slice(0, 4).map((budget) => {

                const spent = transactions
                  .filter(
                    (transaction) =>
                      transaction.type === "expense" &&
                      transaction.category === budget.category
                  )
                  .reduce(
                    (sum, transaction) =>
                      sum + Number(transaction.amount || 0),
                    0
                  );

                const progress =
                  budget.amount > 0
                    ? Math.min((spent / budget.amount) * 100, 100)
                    : 0;

                return (
                  <div
                    className="mini-budget-item"
                    key={budget.id}
                  >

                    <div>
                      <span>{budget.category}</span>
                      <small>
                        {formatMoney(spent)} / {formatMoney(budget.amount)}
                      </small>
                    </div>

                    <div className="mini-budget-progress">
                      <div
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>

      </div>


      {/* =========================
          SECOND ROW
      ========================= */}
      <div className="dashboard-three-grid">


        {/* SAVINGS */}
        <div className="dashboard-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Savings Goals</h2>
              <p>Track your financial goals</p>
            </div>

            <button
              className="text-button"
              onClick={() => navigate("/savings")}
            >
              View All →
            </button>

          </div>


          {savings.length === 0 ? (
            <div className="dashboard-empty-small">
              No savings goals yet.
            </div>
          ) : (
            <div className="dashboard-savings-list">

              {savings.slice(0, 3).map((goal) => {

                const progress =
                  goal.target > 0
                    ? Math.min(
                        (Number(goal.saved) / Number(goal.target)) * 100,
                        100
                      )
                    : 0;

                return (
                  <div
                    className="dashboard-savings-item"
                    key={goal.id}
                  >

                    <div className="saving-item-top">

                      <div>
                        <strong>{goal.name}</strong>
                        <span>
                          {formatMoney(goal.saved)} saved
                        </span>
                      </div>

                      <strong>
                        {Math.round(progress)}%
                      </strong>

                    </div>

                    <div className="dashboard-progress">

                      <div
                        className="dashboard-progress-fill savings-fill"
                        style={{
                          width: `${progress}%`,
                        }}
                      />

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>


        {/* RECENT TRANSACTIONS */}
        <div className="dashboard-card recent-dashboard-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Recent Transactions</h2>
              <p>Your latest financial activity</p>
            </div>

            <button
              className="text-button"
              onClick={() => navigate("/transactions")}
            >
              View All →
            </button>

          </div>


          {recentTransactions.length === 0 ? (
            <div className="dashboard-empty-small">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="dashboard-transactions">

              {recentTransactions.map((transaction) => (

                <div
                  className="dashboard-transaction"
                  key={transaction.id}
                >

                  <div className="transaction-left">

                    <div
                      className={`dashboard-transaction-icon ${
                        transaction.type === "income"
                          ? "transaction-income"
                          : "transaction-expense"
                      }`}
                    >
                      {transaction.type === "income" ? "↑" : "↓"}
                    </div>

                    <div>

                      <strong>
                        {transaction.title}
                      </strong>

                      <span>
                        {transaction.category} •{" "}
                        {transaction.date}
                      </span>

                    </div>

                  </div>


                  <strong
                    className={
                      transaction.type === "income"
                        ? "positive"
                        : "negative"
                    }
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatMoney(transaction.amount)}
                  </strong>

                </div>

              ))}

            </div>
          )}

        </div>


        {/* INVESTMENTS */}
        <div className="dashboard-card">

          <div className="dashboard-card-header">

            <div>
              <h2>Investment Portfolio</h2>
              <p>Current portfolio performance</p>
            </div>

            <button
              className="text-button"
              onClick={() => navigate("/investments")}
            >
              Manage →
            </button>

          </div>


          <div className="investment-summary-main">

            <span>Current Value</span>

            <strong>
              {formatMoney(currentInvestmentValue)}
            </strong>

            <span
              className={
                investmentProfit >= 0
                  ? "positive investment-return"
                  : "negative investment-return"
              }
            >
              {investmentProfit >= 0 ? "+" : ""}
              {formatMoney(investmentProfit)}
              {" "}
              ({investmentReturn.toFixed(2)}%)
            </span>

          </div>


          <div className="investment-mini-stats">

            <div>
              <span>Invested</span>
              <strong>
                {formatMoney(totalInvested)}
              </strong>
            </div>

            <div>
              <span>Profit/Loss</span>
              <strong
                className={
                  investmentProfit >= 0
                    ? "positive"
                    : "negative"
                }
              >
                {formatMoney(investmentProfit)}
              </strong>
            </div>

          </div>


          {investments.length === 0 && (
            <div className="dashboard-empty-small">
              Add investments to track your portfolio.
            </div>
          )}

        </div>

      </div>


      {/* =========================
          SPENDING INSIGHTS
      ========================= */}
      <div className="dashboard-card insights-dashboard">

        <div className="dashboard-card-header">

          <div>
            <h2>Spending Insights</h2>
            <p>Where most of your money is going</p>
          </div>

          <button
            className="text-button"
            onClick={() => navigate("/analytics")}
          >
            Full Analysis →
          </button>

        </div>


        {categorySpending.length === 0 ? (
          <div className="dashboard-empty-small">
            Add expense transactions to see spending insights.
          </div>
        ) : (
          <div className="spending-insights-grid">

            {categorySpending.map((item, index) => {

              const percentage =
                totalExpenses > 0
                  ? (item.amount / totalExpenses) * 100
                  : 0;

              return (
                <div
                  className="spending-insight-item"
                  key={item.category}
                >

                  <div className="insight-category">

                    <div className="insight-number">
                      {index + 1}
                    </div>

                    <div>
                      <strong>{item.category}</strong>
                      <span>
                        {percentage.toFixed(1)}% of expenses
                      </span>
                    </div>

                  </div>

                  <strong>
                    {formatMoney(item.amount)}
                  </strong>

                </div>
              );
            })}

          </div>
        )}

      </div>

    </div>
  );
}


// =========================
// LAYOUT
// =========================
function Layout() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState(
    localStorage.getItem("fintrackUser") || "User"
  );

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login");
  };

  const navItems = [
    {
      path: "/",
      label: "Dashboard",
      icon: "▦",
    },
    {
      path: "/transactions",
      label: "Transactions",
      icon: "↕",
    },
    {
      path: "/budgets",
      label: "Budgets",
      icon: "◫",
    },
    {
      path: "/savings",
      label: "Savings",
      icon: "$",
    },
    {
      path: "/investments",
      label: "Investments",
      icon: "◈",
    },
    {
      path: "/analytics",
      label: "Analytics",
      icon: "◒",
    },
  ];

  useEffect(() => {
    const updateUser = () => {
      setUserName(localStorage.getItem("fintrackUser") || "User");
    };

    window.addEventListener("storage", updateUser);

    return () => {
      window.removeEventListener("storage", updateUser);
    };
  }, []);

  return (
    <div className="app-container">

      <aside className="sidebar">

        <div className="sidebar-logo">

          <div className="logo-icon">
            ₹
          </div>

          <div>
            <h2>FinTrack</h2>
            <span>Personal Finance</span>
          </div>

        </div>


        <nav className="sidebar-nav">

          <div className="nav-section-title">
            MENU
          </div>

          {navItems.map((item) => (

            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >

              <span className="nav-icon">
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>

            </NavLink>

          ))}

        </nav>


        <div className="sidebar-bottom">

          <div className="sidebar-user">

            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{userName}</strong>
              <span>Personal Account</span>
            </div>

          </div>


          <button
            className="logout-button"
            onClick={handleLogout}
          >
            <span>⇥</span>
            Logout
          </button>

        </div>

      </aside>


      <main className="main-content">
        <Routes>

          <Route
            path="/"
            element={<Dashboard />}
          />

          <Route
            path="/transactions"
            element={<Transactions />}
          />

          <Route
            path="/budgets"
            element={<Budgets />}
          />

          <Route
            path="/savings"
            element={<Savings />}
          />

          <Route
            path="/investments"
            element={<Investments />}
          />

          <Route
            path="/analytics"
            element={<Analytics />}
          />

        </Routes>
      </main>

    </div>
  );
}


// =========================
// APP
// =========================
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;