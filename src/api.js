const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `请求失败(${response.status})`);
    }
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请检查后端服务是否可访问');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  createAnonymousUser: () => request('/api/auth/anonymous', { method: 'POST' }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getStars: () => request('/api/stars'),
  getLightCurve: (starId) => request(`/api/stars/${starId}/light-curve`),
  submitClassification: (payload) => request('/api/classifications', { method: 'POST', body: JSON.stringify(payload) }),
  getValidation: (starId) => request(`/api/stars/${starId}/validation`),
  generateReport: (payload) => request('/api/reports', { method: 'POST', body: JSON.stringify(payload) }),
  getReportHistory: (userId) => request(`/api/reports?userId=${encodeURIComponent(userId)}`),
};
