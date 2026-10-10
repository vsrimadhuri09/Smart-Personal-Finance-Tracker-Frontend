import { useEffect, useState } from "react";
import { investmentsApi } from "../services/api";

function Investments() {
  const [investments, setInvestments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "Stocks",
    invested: "",
    current: "",
    date: new Date().toLocaleDateString("en-CA"),
  });

  const loadInvestments = async () => {
    try {
      setLoading(true);
      setError("");
      const [invData, suggData] = await Promise.allSettled([
        investmentsApi.getAll(),
        investmentsApi.getSuggestions("MODERATE", "WEALTH_CREATION"),
      ]);

      if (invData.status === "fulfilled") {
        const normalized = (invData.value || []).map((inv) => ({
          id: inv.id,
          name: inv.name,
          type: inv.type,
          invested: Number(inv.investedAmount || 0),
          current: Number(inv.currentAmount || 0),
          date: inv.investmentDate,
          profitLoss: Number(inv.profitLoss || 0),
          returnPercentage: Number(inv.returnPercentage || 0),
        }));
        setInvestments(normalized);
        localStorage.setItem("fintrackInvestments", JSON.stringify(normalized));
      }

      if (suggData.status === "fulfilled") {
        setSuggestions((suggData.value || []).filter(Boolean));
      }
    } catch (err) {
      setError(err.message || "Failed to load investments.");
      const fallback = JSON.parse(localStorage.getItem("fintrackInvestments") || "[]");
      setInvestments(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestments();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.invested ||
      !formData.date
    ) {
      alert("Please fill all required fields.");
      return;
    }

    const investedAmount = Number(formData.invested);
    const currentAmount = formData.current ? Number(formData.current) : investedAmount;

    if (investedAmount <= 0 || currentAmount < 0) {
      alert("Please enter valid investment amounts.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      investedAmount,
      currentAmount,
      investmentDate: formData.date,
    };

    try {
      setSubmitting(true);
      await investmentsApi.create(payload);
      await loadInvestments();
      setFormData({
        name: "",
        type: "Stocks",
        invested: "",
        current: "",
        date: new Date().toLocaleDateString("en-CA"),
      });
      setShowForm(false);
    } catch (err) {
      alert(err.message || "Error creating investment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this investment?"
    );

    if (!confirmDelete) return;

    try {
      await investmentsApi.delete(id);
      setInvestments((prev) => prev.filter((investment) => investment.id !== id));
      localStorage.setItem(
        "fintrackInvestments",
        JSON.stringify(investments.filter((investment) => investment.id !== id))
      );
    } catch (err) {
      alert(err.message || "Error deleting investment");
    }
  };

  const totalInvested = investments.reduce(
    (total, investment) => total + Number(investment.invested || 0),
    0
  );

  const totalCurrentValue = investments.reduce(
    (total, investment) => total + Number(investment.current || 0),
    0
  );

  const totalProfitLoss = totalCurrentValue - totalInvested;

  const overallReturn =
    totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>Investments</h1>
          <p>Track and manage your investment portfolio in PostgreSQL</p>
        </div>

        <button
          className="primary-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ Add Investment"}
        </button>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon">💰</div>
          <div>
            <p>Total Invested</p>
            <h2>{formatCurrency(totalInvested)}</h2>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📈</div>
          <div>
            <p>Current Value</p>
            <h2>{formatCurrency(totalCurrentValue)}</h2>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">
            {totalProfitLoss >= 0 ? "🟢" : "🔴"}
          </div>
          <div>
            <p>Profit / Loss</p>
            <h2
              className={
                totalProfitLoss >= 0 ? "positive-text" : "negative-text"
              }
            >
              {totalProfitLoss >= 0 ? "+" : ""}
              {formatCurrency(totalProfitLoss)}
            </h2>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon">📊</div>
          <div>
            <p>Overall Return</p>
            <h2
              className={
                overallReturn >= 0 ? "positive-text" : "negative-text"
              }
            >
              {overallReturn >= 0 ? "+" : ""}
              {overallReturn.toFixed(2)}%
            </h2>
          </div>
        </div>
      </div>

      {/* Smart Investment Suggestions */}
      {suggestions.length > 0 && (
        <div className="card" style={{ marginBottom: "20px", background: "#f8fafc", borderLeft: "4px solid #10b981" }}>
          <div className="card-header">
            <div>
              <h3>Smart Investment Advisor</h3>
              <p>Tailored financial growth options for your profile</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 0" }}>
            {suggestions.map((suggestion, idx) => (
              <div key={idx} style={{ fontSize: "14px", color: "#334155" }}>
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Investment Form */}
      {showForm && (
        <div className="card form-card">
          <div className="section-header">
            <div>
              <h2>Add Investment</h2>
              <p>Enter your investment details</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Investment Name</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Example: Reliance Industries, Nifty 50 ETF"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Investment Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="Stocks">Stocks</option>
                  <option value="Mutual Funds">Mutual Funds</option>
                  <option value="Fixed Deposit">Fixed Deposit</option>
                  <option value="Gold">Gold</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Bonds">Bonds</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Invested Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="invested"
                  placeholder="Amount invested"
                  value={formData.invested}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Current Value (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="current"
                  placeholder="Current market valuation"
                  value={formData.current}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Investment Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-actions" style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? "Saving..." : "Save Investment"}
              </button>
              <button
                type="button"
                className="delete-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Investments List */}
      <div className="card">
        <div className="section-header">
          <div>
            <h2>Your Investments</h2>
            <p>Portfolio overview</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading investment portfolio...</p>
          </div>
        ) : investments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No investments yet</h3>
            <p>Start tracking your investments by clicking "Add Investment".</p>
            <button
              className="primary-btn"
              onClick={() => setShowForm(true)}
            >
              + Add Investment
            </button>
          </div>
        ) : (
          <div className="investment-list">
            {investments.map((investment) => {
              const profitLoss =
                Number(investment.current) - Number(investment.invested);
              const returnPercentage =
                Number(investment.invested) > 0
                  ? (profitLoss / Number(investment.invested)) * 100
                  : 0;

              return (
                <div className="investment-item" key={investment.id}>
                  <div className="investment-main">
                    <div className="investment-icon">📊</div>
                    <div className="investment-info">
                      <h3>{investment.name}</h3>
                      <span className="badge">{investment.type}</span>
                      <p>Invested on {formatDate(investment.date)}</p>
                    </div>
                  </div>

                  <div className="investment-values">
                    <div>
                      <span>Invested</span>
                      <strong>{formatCurrency(investment.invested)}</strong>
                    </div>

                    <div>
                      <span>Current Value</span>
                      <strong>{formatCurrency(investment.current)}</strong>
                    </div>

                    <div>
                      <span>Profit / Loss</span>
                      <strong
                        className={
                          profitLoss >= 0 ? "positive-text" : "negative-text"
                        }
                      >
                        {profitLoss >= 0 ? "+" : ""}
                        {formatCurrency(profitLoss)}
                      </strong>

                      <small
                        className={
                          profitLoss >= 0 ? "positive-text" : "negative-text"
                        }
                      >
                        {returnPercentage >= 0 ? "+" : ""}
                        {returnPercentage.toFixed(2)}%
                      </small>
                    </div>
                  </div>

                  <div className="investment-actions">
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(investment.id)}
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

export default Investments;