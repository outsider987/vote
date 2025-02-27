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
    localStorage.removeItem("token");
    router.push("/login");
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.LOGIN({ username, password });
    if (response.status === 200) {
      setToken(response.data.token);
      document.cookie = `token=${response.data.token}; path=/`;
      localStorage.setItem("token", response.data.token);
    }
  };

  return (
    <AuthContext.Provider value={{ login, token, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
