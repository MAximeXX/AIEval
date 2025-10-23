import axios from "axios";

import { useAuthStore } from "../store/auth";
import { toastError } from "../components/toast";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? "/api",
  withCredentials: false,
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    // eslint-disable-next-line no-param-reassign
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.detail || "请求失败，请稍后再试";
    if ((error as any)?.config?.skipErrorToast) {
      return Promise.reject(error);
    }
    if (error?.response?.status === 401) {
      toastError(message);
      useAuthStore.getState().clear();
      window.location.href = "/login";
    } else {
      toastError(message);
    }
    return Promise.reject(error);
  },
);

export default client;
