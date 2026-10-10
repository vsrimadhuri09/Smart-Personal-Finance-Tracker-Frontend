import { useEffect, useState } from "react";
import { savingsApi } from "../services/api";

function Savings() {
  const [goals, setGoals] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    target: "",
    saved: "",
    deadline: "",
  });

  const loadSavingsData = async () => {
    try {
      setLoading(true);
      setError("");
      const [goalsData, suggestionsData] = await Promise.allSettled([
        savingsApi.getAll(),
        savingsApi.getSuggestions(),
      ]);

      if (goalsData.status === "fulfilled") {
        const normalized = (goalsData.value || []).map((g) => ({
          id: g.id,
          name: g.goalName,
          target: Number(g.targetAmount || 0),
          saved: Number(g.currentAmount || 0),
          deadline: g.targetDate,
          progress: Number(g.progressPercentage || 0),
        }));
        setGoals(normalized);
        localStorage.setItem("fintrackSavings", JSON.stringify(normalized));
      }

      if (suggestionsData.status === "fulfilled") {
        setSuggestions(suggestionsData.value || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load savings data.");
      const fallback = JSON.parse(localStorage.getItem("fintrackSavings") || "[]");
      setGoals(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSavingsData();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const addGoal = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Please enter a savings goal.");
      return;
    }

    if (!formData.target || Number(formData.target) <= 0) {
      alert("Please enter a valid target amount.");
      return;
    }

    if (Number(formData.saved) < 0) {
      alert("Saved amount cannot be negative.");
      return;
    }

    const payload = {
      goalName: formData.name.trim(),
      targetAmount: Number(formData.target),
      currentAmount: Number(formData.saved) || 0,
      targetDate: formData.deadline || null,
    };

    try {
      setSubmitting(true);
      await savingsApi.create(payload);
      await loadSavingsData();
      setFormData({
        name: "",
        target: "",
        saved: "",
        deadline: "",
      });
      setShowForm(false);
    } catch (err) {
      alert(err.message || "Error creating savings goal");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteGoal = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this savings goal?"
    );

    if (!confirmDelete) return;

    try {
      await savingsApi.delete(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      localStorage.setItem(
        "fintrackSavings",
        JSON.stringify(goals.filter((g) => g.id !== id))
      );
    } catch (err) {
      alert(err.message || "Error deleting savings goal");
    }
  };

  const updateSavedAmount = async (id) => {
    const amount = window.prompt("Enter the new saved amount:");
    if (amount === null) return;

    const newAmount = Number(amount);
    if (Number.isNaN(newAmount) || newAmount < 0) {
      alert("Please enter a valid amount.");
      return;
    }

    try {
      await savingsApi.updateAmount(id, newAmount);
      await loadSavingsData();
    } catch (err) {
      alert(err.message || "Error updating saved amount");
    }
  };

  const totalTarget = goals.reduce(
    (total, goal) => total + Number(goal.target || 0),
    0
  );

  const totalSaved = goals.reduce(
    (total, goal) => total + Number(goal.saved || 0),
    0
  );

  const totalRemaining = Math.max(totalTarget - totalSaved, 0);

  const overallProgress =
    totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Savings</h1>
          <p>Set goals and build your savings step by step in PostgreSQL</p>
        </div>

        <div className="page-actions">
          <button
            className="primary-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "✕ Close" : "+ Add Goal"}
          </button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="card-icon">🎯</div>
          <div>
            <div className="summary-title">Total Target</div>
            <div className="summary-value">
              ₹{totalTarget.toLocaleString("en-IN")}
            </div>
            <div className="summary-change">
              {goals.length} savings goal{goals.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">💰</div>
          <div>
            <div className="summary-title">Total Saved</div>
            <div className="summary-value">
              ₹{totalSaved.toLocaleString("en-IN")}
            </div>
            <div className="summary-change positive">
              {overallProgress.toFixed(0)}% completed
            </div>
          </div>
        </div>

        <div className="summary-card">
          <div className="card-icon">📈</div>
          <div>
            <div className="summary-title">Remaining</div>
            <div className="summary-value">
              ₹{totalRemaining.toLocaleString("en-IN")}
            </div>
            <div className="summary-change">Amount needed to reach goals</div>
          </div>
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="card" style={{ marginBottom: "20px", background: "#f8fafc", borderLeft: "4px solid #3b82f6" }}>
          <div className="card-header">
            <div>
              <h3>Smart Savings Insights</h3>
              <p>Personalized analysis based on your real transactions</p>
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

      {/* Overall Progress */}
      {goals.length > 0 && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-header">
            <div>
              <h3>Overall Savings Progress</h3>
              <p>Track your progress across all goals</p>
            </div>
            <strong>{overallProgress.toFixed(0)}%</strong>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${overallProgress}%`,
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Add Goal Form */}
      {showForm && (
        <div className="form-card" style={{ marginBottom: "25px" }}>
          <div className="card-header">
            <div>
              <h3>Create Savings Goal</h3>
              <p>Define what you want to save for</p>
            </div>
          </div>

          <form onSubmit={addGoal}>
            <div className="form-row">
              <div className="form-group">
                <label>Goal Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. New Laptop, Emergency Fund"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>Target Amount</label>
                <input
                  type="number"
                  name="target"
                  value={formData.target}
                  onChange={handleChange}
                  placeholder="Enter target amount"
                  className="form-input"
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Already Saved Amount</label>
                <input
                  type="number"
                  name="saved"
                  value={formData.saved}
                  onChange={handleChange}
                  placeholder="Enter saved amount (or 0)"
                  className="form-input"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label>Target Date</label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>

            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? "Saving..." : "Save Goal"}
            </button>
          </form>
        </div>
      )}

      {/* Goals */}
      <div className="table-card">
        <div className="table-header">
          <div>
            <h3 className="table-title">Savings Goals</h3>
            <p className="table-muted">Monitor your progress toward each goal</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading savings goals...</p>
          </div>
        ) : goals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3>No savings goals yet</h3>
            <p>Create your first goal and start building your savings.</p>
            <button className="primary-btn" onClick={() => setShowForm(true)}>
              + Create Goal
            </button>
          </div>
        ) : (
          <div className="savings-goals-list">
            {goals.map((goal) => {
              const progress =
                goal.target > 0
                  ? Math.min((goal.saved / goal.target) * 100, 100)
                  : 0;

              const remaining = Math.max(goal.target - goal.saved, 0);
              const completed = goal.saved >= goal.target;

              return (
                <div className="savings-goal-item" key={goal.id}>
                  <div className="savings-goal-top">
                    <div>
                      <h3>{goal.name}</h3>
                      <p>
                        ₹{goal.saved.toLocaleString("en-IN")} saved of ₹
                        {goal.target.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <span
                      className={`budget-status ${
                        completed ? "good" : "warning"
                      }`}
                    >
                      {completed ? "Completed" : `${progress.toFixed(0)}%`}
                    </span>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progress}%`,
                      }}
                    ></div>
                  </div>

                  <div className="savings-goal-bottom">
                    <span>
                      {completed
                        ? "🎉 Goal achieved!"
                        : `₹${remaining.toLocaleString("en-IN")} remaining`}
                    </span>

                    {goal.deadline && (
                      <span>
                        Target:{" "}
                        {new Date(goal.deadline).toLocaleDateString("en-IN")}
                      </span>
                    )}

                    <div className="savings-actions">
                      <button
                        className="secondary-btn"
                        onClick={() => updateSavedAmount(goal.id)}
                      >
                        Update
                      </button>

                      <button
                        className="delete-btn"
                        onClick={() => deleteGoal(goal.id)}
                      >
                        Delete
                      </button>
                    </div>
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

export default Savings;