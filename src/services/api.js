const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const getAuthToken = () => {
  return localStorage.getItem('token');
};

export const setAuthSession = (authData) => {
  if (authData.token) {
    localStorage.setItem('token', authData.token);
  }
  localStorage.setItem('isLoggedIn', 'true');
  if (authData.name) {
    localStorage.setItem('fintrackUser', authData.name);
  }
  if (authData.email) {
    localStorage.setItem('fintrackEmail', authData.email);
  }
  if (authData.userId) {
    localStorage.setItem('fintrackUserId', String(authData.userId));
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('fintrackUser');
  localStorage.removeItem('fintrackEmail');
  localStorage.removeItem('fintrackUserId');
};

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    // If unauthorized or token expired, redirect to login
    if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      clearAuthSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage =
      (data && typeof data === 'object' && (data.message || Object.values(data)[0])) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
};

// API Services
export const authApi = {
  login: (credentials) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  register: (userData) =>
    apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
};

export const userApi = {
  getDashboard: () => apiFetch('/user/dashboard'),
  getProfile: () => apiFetch('/user/profile'),
  updateProfile: (profile) =>
    apiFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profile),
    }),
  changePassword: (passwordData) =>
    apiFetch('/user/change-password', {
      method: 'PUT',
      body: JSON.stringify(passwordData),
    }),
};

export const transactionsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.category) query.append('category', params.category);
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);
    if (params.keyword) query.append('keyword', params.keyword);
    const queryString = query.toString();
    return apiFetch(`/transactions${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id) => apiFetch(`/transactions/${id}`),
  create: (data) =>
    apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/transactions/${id}`, {
      method: 'DELETE',
    }),
};

export const budgetsApi = {
  getAll: (month, year) => {
    const query = new URLSearchParams();
    if (month) query.append('month', month);
    if (year) query.append('year', year);
    const queryString = query.toString();
    return apiFetch(`/budgets${queryString ? `?${queryString}` : ''}`);
  },
  create: (data) =>
    apiFetch('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/budgets/${id}`, {
      method: 'DELETE',
    }),
};

export const savingsApi = {
  getAll: () => apiFetch('/savings'),
  create: (data) =>
    apiFetch('/savings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/savings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateAmount: (id, currentAmount) =>
    apiFetch(`/savings/${id}/amount`, {
      method: 'PATCH',
      body: JSON.stringify({ currentAmount }),
    }),
  delete: (id) =>
    apiFetch(`/savings/${id}`, {
      method: 'DELETE',
    }),
  getSuggestions: () => apiFetch('/savings/suggestions'),
};

export const investmentsApi = {
  getAll: () => apiFetch('/investments'),
  create: (data) =>
    apiFetch('/investments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    apiFetch(`/investments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    apiFetch(`/investments/${id}`, {
      method: 'DELETE',
    }),
  getSuggestions: (riskLevel = 'MODERATE', goal = 'WEALTH_CREATION') =>
    apiFetch(`/investments/suggestions?riskLevel=${riskLevel}&investmentGoal=${goal}`),
};

export const analyticsApi = {
  getMonthly: () => apiFetch('/analytics/monthly'),
  getCategories: () => apiFetch('/analytics/categories'),
  getSavings: () => apiFetch('/analytics/savings'),
};
