"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthAPI } from "../../api/auth";

interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  uiPermissions: string[];
  apiPermissions: string[];
  role: string | null;
  userId: string | null;
  username: string | null;
  hasUIPermission: (permission: string) => boolean;
  hasAPIPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Helper function to set a cookie
const setCookie = (name: string, value: string, days: number = 7) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  // We encode the value here to ensure special characters are safely stored
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
};

// Helper function to get a cookie
const getCookie = (name: string): string | undefined => {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
};

// Helper function to delete a cookie
const deleteCookie = (name: string) => {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useAuthAPI();
  const [token, setToken] = useState<string | null>(null);
  const [uiPermissions, setUIPermissions] = useState<string[]>([]);
  const [apiPermissions, setAPIPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const logout = () => {
    setToken(null);
    setUIPermissions([]);
    setAPIPermissions([]);
    setRole(null);
    setUserId(null);
    setUsername(null);

    // Clear all auth cookies
    deleteCookie("token");
    deleteCookie("ui_permissions");
    deleteCookie("api_permissions");
    deleteCookie("role");
    deleteCookie("user_id");
    deleteCookie("username");

    router.push("/login");
  };

  // Function to check if user has a specific UI permission
  const hasUIPermission = (permission: string): boolean => {
    return uiPermissions.includes(permission);
  };

  // Function to check if user has a specific API permission
  const hasAPIPermission = (permission: string): boolean => {
    return apiPermissions.includes(permission);
  };

  useEffect(() => {
    // Get auth data from cookies
    const storedToken = getCookie("token");
    const storedUIPermissions = getCookie("ui_permissions");
    const storedAPIPermissions = getCookie("api_permissions");
    const storedRole = getCookie("role");
    const storedUserId = getCookie("user_id");
    const storedUsername = getCookie("username");

    if (storedToken) {
      setToken(storedToken);

      try {
        if (storedUIPermissions) {
          // First decode the cookie value
          let decodedUIPermissions = decodeURIComponent(storedUIPermissions);
          // If the result still appears encoded (starts with '%'), decode again
          if (decodedUIPermissions.startsWith("%")) {
            decodedUIPermissions = decodeURIComponent(decodedUIPermissions);
          }
          setUIPermissions(JSON.parse(decodedUIPermissions));
        }

        if (storedAPIPermissions) {
          let decodedAPIPermissions = decodeURIComponent(storedAPIPermissions);
          if (decodedAPIPermissions.startsWith("%")) {
            decodedAPIPermissions = decodeURIComponent(decodedAPIPermissions);
          }
          setAPIPermissions(JSON.parse(decodedAPIPermissions));
        }

        if (storedRole) {
          setRole(decodeURIComponent(storedRole));
        }

        if (storedUserId) {
          setUserId(decodeURIComponent(storedUserId));
        }

        if (storedUsername) {
          setUsername(decodeURIComponent(storedUsername));
        }
      } catch (error) {
        console.error("Failed to parse stored permissions:", error);
        // Fallback: Try to parse from the JWT if cookie parsing fails
        try {
          const payload = JSON.parse(atob(storedToken.split('.')[1]));
          if (payload) {
            setUIPermissions(payload.ui_permissions || []);
            setAPIPermissions(payload.api_permissions || []);
            setRole(payload.role || null);
            setUserId(payload.user_id || null);
            setUsername(payload.sub || null);
          }
        } catch (jwtError) {
          console.error("Failed to parse token:", jwtError);
        }
      }
    }
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.LOGIN({ username, password });
    if (response.status === 200) {
      const { 
        access_token, 
        ui_permissions = [], 
        api_permissions = [], 
        role = null, 
        user_id = null, 
        username: user = null 
      } = response.data;

      // Set state
      setToken(access_token);
      setUIPermissions(ui_permissions);
      setAPIPermissions(api_permissions);
      setRole(role);
      setUserId(user_id);
      setUsername(user);

      // Store in cookies
      setCookie("token", access_token);
      // Note: We're encoding the JSON string when setting the cookie
      setCookie("ui_permissions", JSON.stringify(ui_permissions));
      setCookie("api_permissions", JSON.stringify(api_permissions));
      if (role) setCookie("role", role);
      if (user_id) setCookie("user_id", user_id);
      if (user) setCookie("username", user);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      login, 
      token, 
      setToken, 
      logout, 
      uiPermissions, 
      apiPermissions,
      role, 
      userId, 
      username, 
      hasUIPermission,
      hasAPIPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};
