import { useEffect, useMemo, useState } from "react";
import { transactionsApi } from "../services/api";
import "./Transactions.css";

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

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "—";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    type: "expense",
    category: "Food",
    paymentMethod: "UPI",
    date: new Date().toLocaleDateString("en-CA"),
  });

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await transactionsApi.getAll();
      const normalized = (data || []).map((t) => ({
        id: t.id,
        title: t.description || "Transaction",
        amount: Number(t.amount || 0),
        type: String(t.type || "EXPENSE").toLowerCase(),
        category: REVERSE_CATEGORY_MAP[t.category] || t.category || "Other",
        date: t.transactionDate,
        paymentMethod: t.paymentMethod,
      }));
      setTransactions(normalized);
      localStorage.setItem("fintrackTransactions", JSON.stringify(normalized));
    } catch (err) {
      setError(err.message || "Failed to load transactions.");
      const fallback = JSON.parse(localStorage.getItem("fintrackTransactions") || "[]");
      setTransactions(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const notifyDashboard = () => {
    window.dispatchEvent(new Event("fintrackTransactionsUpdated"));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const addTransaction = async (event) => {
    event.preventDefault();
    const title = formData.title.trim();
    const amount = Number(formData.amount);

    if (!title) {
      alert("Please enter a transaction name.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    const payload = {
      amount,
      type: formData.type.toUpperCase(),
      category: CATEGORY_MAP[formData.category] || "OTHER",
      description: title,
      paymentMethod: formData.paymentMethod || "UPI",
      transactionDate: formData.date,
    };

    try {
      setSubmitting(true);
      const created = await transactionsApi.create(payload);
      const newTransaction = {
        id: created.id,
        title: created.description || title,
        amount: Number(created.amount),
        type: String(created.type).toLowerCase(),
        category: REVERSE_CATEGORY_MAP[created.category] || created.category || "Other",
        date: created.transactionDate,
        paymentMethod: created.paymentMethod,
      };

      setTransactions((previous) => [newTransaction, ...previous]);
      notifyDashboard();

      setFormData({
        title: "",
        amount: "",
        type: "expense",
        category: "Food",
        paymentMethod: "UPI",
        date: new Date().toLocaleDateString("en-CA"),
      });
      setShowForm(false);
    } catch (err) {
      alert(`Error creating transaction: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTransaction = async (id) => {
    if (!window.confirm("Delete this transaction permanently?")) {
      return;
    }

    try {
      await transactionsApi.delete(id);
      setTransactions((previous) =>
        previous.filter((transaction) => transaction.id !== id)
      );
      notifyDashboard();
    } catch (err) {
      alert(`Error deleting transaction: ${err.message}`);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterType("all");
    setFilterCategory("all");
  };

  const totalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const totalExpenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const netAmount = totalIncome - totalExpenses;

  const categories = Object.keys(CATEGORY_MAP);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((item) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          String(item.title || "").toLowerCase().includes(query) ||
          String(item.category || "").toLowerCase().includes(query);

        const matchesType =
          filterType === "all" || item.type === filterType;

        const matchesCategory =
          filterCategory === "all" ||
          item.category === filterCategory;

        return matchesSearch && matchesType && matchesCategory;
      })
      .sort((a, b) => {
        const dateCompare = String(b.date || "").localeCompare(
          String(a.date || "")
        );
        return dateCompare || Number(b.id) - Number(a.id);
      });
  }, [transactions, search, filterType, filterCategory]);

  return (
    <main className="transactions-page">
      <header className="transactions-heading">
        <div>
          <span className="transactions-eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Transactions</h1>
          <p>Track, organize and manage every rupee you earn and spend in PostgreSQL.</p>
        </div>

        <button
          className="transaction-primary-btn"
          onClick={() => setShowForm((previous) => !previous)}
        >
          {showForm ? "✕ Cancel" : "+ Add Transaction"}
        </button>
      </header>

      {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <section className="transaction-summary">
        <article className="transaction-stat income-stat">
          <div className="transaction-stat-top">
            <span className="transaction-stat-icon">↗</span>
            <span className="transaction-stat-label">TOTAL INCOME</span>
          </div>
          <strong>{formatCurrency(totalIncome)}</strong>
          <p>Money received</p>
        </article>

        <article className="transaction-stat expense-stat">
          <div className="transaction-stat-top">
            <span className="transaction-stat-icon">↘</span>
            <span className="transaction-stat-label">TOTAL EXPENSES</span>
          </div>
          <strong>{formatCurrency(totalExpenses)}</strong>
          <p>Money spent</p>
        </article>

        <article className="transaction-stat net-stat">
          <div className="transaction-stat-top">
            <span className="transaction-stat-icon">⇄</span>
            <span className="transaction-stat-label">NET BALANCE</span>
          </div>
          <strong className={netAmount >= 0 ? "positive-value" : "negative-value"}>
            {formatCurrency(netAmount)}
          </strong>
          <p>{netAmount >= 0 ? "Net positive savings" : "Net negative savings"}</p>
        </article>
      </section>

      {showForm && (
        <section className="transaction-form-card">
          <div className="transaction-form-header">
            <div>
              <h3>Add New Transaction</h3>
              <p>Store transaction securely in the database</p>
            </div>
            <button
              className="transaction-close-btn"
              onClick={() => setShowForm(false)}
            >
              ✕
            </button>
          </div>

          <form onSubmit={addTransaction} className="transaction-form-grid">
            <div className="form-group">
              <label>Description / Title</label>
              <input
                type="text"
                name="title"
                placeholder="e.g., Grocery Shopping, Monthly Salary"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="amount"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Type</label>
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
              >
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="NET_BANKING">Net Banking</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-actions" style={{ gridColumn: "1 / -1", display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button
                type="submit"
                className="transaction-primary-btn"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save Transaction"}
              </button>
              <button
                type="button"
                className="transaction-clear-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="transaction-list-card">
        <div className="transaction-filters-bar">
          <div className="transaction-search-wrap">
            <input
              type="text"
              placeholder="Search by title or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            aria-label="Filter by transaction type"
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>

          <select
            aria-label="Filter by category"
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          {(search || filterType !== "all" || filterCategory !== "all") && (
            <button className="transaction-clear-btn" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="transaction-empty-state">
            <p>Loading transactions from database...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="transaction-empty-state">
            <div className="transaction-empty-icon">₹</div>
            <h3>
              {transactions.length === 0
                ? "No transactions yet"
                : "No matching transactions"}
            </h3>
            <p>
              {transactions.length === 0
                ? "Add your first transaction to start tracking your money."
                : "Try another search or clear your filters."}
            </p>
            {transactions.length === 0 && (
              <button
                className="transaction-primary-btn"
                onClick={() => setShowForm(true)}
              >
                + Add your first transaction
              </button>
            )}
          </div>
        ) : (
          <div className="transaction-table-wrap">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>TRANSACTION</th>
                  <th>CATEGORY</th>
                  <th>DATE</th>
                  <th>AMOUNT</th>
                  <th className="transaction-action-heading">ACTION</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <div className="transaction-name-cell">
                        <span
                          className={`transaction-type-icon ${
                            transaction.type === "income"
                              ? "transaction-type-icon-income"
                              : "transaction-type-icon-expense"
                          }`}
                        >
                          {transaction.type === "income" ? "↙" : "↗"}
                        </span>
                        <div>
                          <strong>{transaction.title}</strong>
                          <span>
                            {transaction.type === "income" ? "Income" : "Expense"}
                            {transaction.paymentMethod ? ` • ${transaction.paymentMethod}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`transaction-category-badge category-${String(
                          transaction.category || "other"
                        )
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")}`}
                      >
                        {transaction.category || "Other"}
                      </span>
                    </td>

                    <td className="transaction-date-cell">
                      {formatDate(transaction.date)}
                    </td>

                    <td>
                      <strong
                        className={`transaction-amount ${
                          transaction.type === "income"
                            ? "positive-value"
                            : "negative-value"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "−"}
                        {formatCurrency(transaction.amount)}
                      </strong>
                    </td>

                    <td className="transaction-action-cell">
                      <button
                        className="transaction-delete-btn"
                        onClick={() => deleteTransaction(transaction.id)}
                        aria-label={`Delete ${transaction.title}`}
                        title="Delete transaction"
                      >
                        <span aria-hidden="true">⌫</span>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="transaction-list-footer">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </footer>
      </section>
    </main>
  );
}

export default Transactions;