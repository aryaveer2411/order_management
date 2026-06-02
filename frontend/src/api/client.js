import axios from "axios";
import { getAccessToken, setTokens, clearTokens } from "../utils/tokenStore";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

// ── Token refresh queue ──────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

export async function refreshTokens() {
  const res = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
  setTokens(res.data.access_token);
  return res.data.access_token;
}

// ── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch(Promise.reject);
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshTokens();
      processQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (err) {
      processQueue(err);
      clearTokens();
      window.dispatchEvent(new Event("auth:logout"));
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function login(username, password) {
  const params = new URLSearchParams({ username, password });
  const res = await axios.post(`${BASE_URL}/auth/login`, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    withCredentials: true,
  });
  setTokens(res.data.access_token);
  return res.data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch {}
  clearTokens();
}

// ── Products ─────────────────────────────────────────────────────────────────
export const getProducts = (page = 1, size = 10) => api.get("/products", { params: { page, size } });
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post("/products", data);
export const updateProduct = (id, data) => api.patch(`/products/${id}`, data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// ── Customers ────────────────────────────────────────────────────────────────
export const getCustomers = (page = 1, size = 10) => api.get("/customers", { params: { page, size } });
export const getCustomer = (id) => api.get(`/customers/${id}`);
export const createCustomer = (data) => api.post("/customers", data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// ── Orders ───────────────────────────────────────────────────────────────────
export const getOrders = (page = 1, size = 10) => api.get("/orders", { params: { page, size } });
export const getOrder = (id) => api.get(`/orders/${id}`);
export const createOrder = (data) => api.post("/orders", data);
export const deleteOrder = (id) => api.delete(`/orders/${id}`);

// ── Dashboard ────────────────────────────────────────────────────────────────
export const getDashboard = () => api.get("/dashboard");
