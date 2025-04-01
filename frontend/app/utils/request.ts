import axios from "axios";

// Token management utilities
export const getToken = () => {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';');
    const tokenCookie = cookies.find(cookie => cookie.trim().startsWith('token='));
    return tokenCookie ? tokenCookie.split('=')[1].trim() : null;
  }
  return null;
};

export const setToken = (token: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = `token=${token}; path=/`;
  }
};

export const removeToken = () => {
  if (typeof document !== 'undefined') {
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
  }
};

// Create axios instance with default config
export const request = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}`,
});

// Add request interceptor to automatically add token to headers only if it exists
request.interceptors.request.use(
  (config) => {
    const token = getToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token expiration
request.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response.data?.error === 'TokenExpired') {
      removeToken();
      window.location.href = "/login";
    }
 
    return Promise.reject(error);
  }
);

