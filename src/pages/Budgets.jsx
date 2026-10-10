import { useEffect, useState } from "react";
import { budgetsApi } from "../services/api";

const CATEGORY_MAP = {
  Food: "FOOD",
  Shopping: "SHOPPING",
  Transport: "TRANSPORT",
  Bills: "BILLS",
  Entertainment: "ENTERTAINMENT",
  Education: "EDUCATION",
  Healthcare: "HEALTHCARE",
  Rent: "RENT",
  Salary: "SALARY",
  Other: "OTHER",
};

const REVERSE_CATEGORY_MAP = {
  FOOD: "Food",
  SHOPPING: "Shopping",
  TRANSPORT: "Transport",
  BILLS: "Bills",
  ENTERTAINMENT: "Entertainment",
  EDUCATION: "Education",
  HEALTHCARE: "Healthcare",
  RENT: "Rent",
  SALARY: "Salary",
  OTHER: "Other",
};

function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    category: "Food",
    amount: "",
  });

  const categories = [
    "Food",
    "Shopping",
    "Transport",
    "Bills",
    "Entertainment",
    "Education",
    "Healthcare",
    "Rent",
    "Other",
  ];

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const loadBudgets = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await budgetsApi.getAll(currentMonth, currentYear);
      const normalized = (data || []).map((b) => ({
        id: b.id,
        category: REVERSE_CATEGORY_MAP[b.category] || b.category,
        amount: Number(b.budgetAmount || 0),
        spent: Number(b.spentAmount || 0),
        remaining: Number(b.remainingAmount || 0),
        percentage: Number(b.percentageUsed || 0),
        exceeded: b.exceeded,
      }));
      setBudgets(normalized);
      localStorage.setItem("fintrackBudgets", JSON.stringify(normalized));
    } catch (err) {
      setError(err.message || "Failed to load budgets.");
      const fallback = JSON.parse(localStorage.getItem("fintrackBudgets") || "[]");
      setBudgets(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addBudget = async (e) => {
    e.preventDefault();

    if (!formData.amount || Number(formData.amount) <= 0) {
      alert("Please enter a valid budget amount.");
      return;
    }

    const payload = {
      category: CATEGORY_MAP[formData.category] || "OTHER",
      budgetAmount: Number(formData.amount),
      month: currentMonth,
      year: currentYear,
    };

    try {
      setSubmitting(true);
      await budgetsApi.create(payload);
      await loadBudgets();
      setFormData({
        category: "Food",
        amount: "",
      });
      setShowForm(false);
    } catch (err) {
      alert(err.message || "Error creating budget");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBudget = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this budget?"
    );

    if (!confirmDelete) return;

    try {
      await budgetsApi.delete(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      localStorage.setItem(
        "fintrackBudgets",
        JSON.stringify(budgets.filter((b) => b.id !== id))
      );
    } catch (err) {
      alert(err.message || "Error deleting budget");
    }
  };

  const totalBudget = budgets.reduce(
    (total, budget) => total + Number(budget.amount || 0),
    0
  );

  const totalSpent = budgets.reduce(
    (total, budget) => total + Number(budget.spent || 0),
    0
  );

  const totalRemaining = totalBudget - totalSpent;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Budgets</h1>
          <p>Set spending limits and control your expenses in PostgreSQL</p>
        </div>

        <div className="page-actions">
          <button
            className="primary-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "✕ Close" : "+ Add Budget"}
          </button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-icon">🎯</div>
          <div>
            <div className="summary-title">Total Budget</div>
            <div className="summary-value">
              ₹{totalBudget.toLocaleString("en-IN")}
            </div>
            <div className="summary-change">
              Across {budgets.length} categories
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">💸</div>
          <div>
            <div className="summary-title">Total Spent</div>
            <div className="summary-value">
              ₹{totalSpent.toLocaleString("en-IN")}
            </div>
            <div className="summary-change negative">
              Current spending
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">💰</div>
          <div>
            <div className="summary-title">Remaining</div>
            <div className="summary-value">
              ₹{Math.max(totalRemaining, 0).toLocaleString("en-IN")}
            </div>
            <div
              className={`summary-change ${
                totalRemaining >= 0 ? "positive" : "negative"
              }`}
            >
              {totalRemaining >= 0 ? "Within budget" : "Budget exceeded"}
            </div>
          </div>
        </div>
      </div>

      {/* Add Budget Form */}
      {showForm && (
        <div className="form-card" style={{ marginBottom: "25px" }}>
          <div className="card-header">
            <div>
              <h3>Add New Budget</h3>
              <p>Set a spending limit for a category ({currentMonth}/{currentYear})</p>
            </div>
          </div>

          <form onSubmit={addBudget}>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="form-select"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Budget Amount</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="Enter amount"
                  className="form-input"
                  min="1"
                  required
                />
              </div>
            </div>

            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? "Saving..." : "Save Budget"}
            </button>
          </form>
        </div>
      )}

      {/* Budget Cards */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Your Budgets</h3>
            <p className="table-muted">Track your spending against each limit</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading budgets...</p>
          </div>
        ) : budgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No budgets yet</h3>
            <p>Create your first budget to start tracking your spending.</p>
            <button className="primary-btn" onClick={() => setShowForm(true)}>
              + Create Budget
            </button>
          </div>
        ) : (
          <div className="budget-list">
            {budgets.map((budget) => {
              const spent = Number(budget.spent || 0);
              const percentage = Number(budget.percentage || 0);
              const progress = Math.min(percentage, 100);
              const remaining = Number(budget.remaining != null ? budget.remaining : (budget.amount - spent));

              let status = "Good";
              if (percentage >= 100) {
                status = "Exceeded";
              } else if (percentage >= 80) {
                status = "Warning";
              }

              return (
                <div className="budget-item" key={budget.id}>
                  <div className="budget-top">
                    <div>
                      <h3>{budget.category}</h3>
                      <p>
                        ₹{spent.toLocaleString("en-IN")} spent of ₹
                        {Number(budget.amount).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <span
                      className={`budget-status ${
                        status === "Exceeded"
                          ? "danger"
                          : status === "Warning"
                          ? "warning"
                          : "good"
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${
                        status === "Exceeded"
                          ? "danger-fill"
                          : status === "Warning"
                          ? "warning-fill"
                          : ""
                      }`}
                      style={{
                        width: `${progress}%`,
                      }}
                    ></div>
                  </div>

                  <div className="budget-bottom">
                    <span>{percentage.toFixed(0)}% used</span>
                    <span className={remaining >= 0 ? "positive" : "negative"}>
                      {remaining >= 0
                        ? `₹${remaining.toLocaleString("en-IN")} remaining`
                        : `₹${Math.abs(remaining).toLocaleString("en-IN")} over budget`}
                    </span>
                    <button
                      className="delete-btn"
                      onClick={() => deleteBudget(budget.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Budgets;