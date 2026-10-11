const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "https://smart-personal-finance-tracker-backend.onrender.com"
).replace(/\/+$/, "");

const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const response = await fetch(
    `${API_BASE_URL}/api${normalizedEndpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || `Request failed: ${response.status}`
    );
  }

  return data;
};

export default api;
