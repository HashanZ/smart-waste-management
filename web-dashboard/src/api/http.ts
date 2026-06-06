import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

// Use proxy (relative /api) in dev when API is localhost - avoids CORS and connection issues
const apiBase = process.env.REACT_APP_API_URL || '';
const useProxy = !apiBase || apiBase.includes('localhost') || apiBase.includes('127.0.0.1');
const baseURL = useProxy ? '/api' : apiBase + (apiBase.endsWith('/api') ? '' : '/api');

export const http = axios.create({
  baseURL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    const responseData = error.response?.data as { message?: string } | undefined;
    let message = responseData?.message || error.message || 'Request failed';
    // Show helpful message for network/connection errors (backend not running)
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      message =
        'Cannot connect to server. Make sure the backend is running on port 3000 (run: npm run dev in backend folder).';
    }
    if (!axios.isCancel(error)) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export type ApiSuccess<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiError = {
  success: false;
  message: string;
};

















