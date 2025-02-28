"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getVoteInfo } from "../api/vote";

interface AuthContextType {
  token: string | null;
  setToken: (token: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within a AuthProvider");
  }
  return context;
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const api = getVoteInfo();
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const logout = () => {
    setToken(null);
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  useEffect(() => {
    const storedToken = document.cookie.split("; ").find(row => row.startsWith("token="))?.split("=")[1];
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.LOGIN({ username, password });
    if (response.status === 200) {
      setToken(response.data.access_token);
      document.cookie = `token=${response.data.access_token}; path=/`;
    }
  };

  return (
    <AuthContext.Provider value={{ login, token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
