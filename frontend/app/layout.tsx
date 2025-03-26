"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import "antd/dist/reset.css";
import { Layout } from "antd";
import NavBar from "./layouts/NavBar";
import { ReactNode, useState, useEffect } from "react";
import RootContextProvider from "./store";
import { getCookie } from "./store/Auth";
import { usePathname } from "next/navigation";

const { Content } = Layout;
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: ReactNode }) {
  // Sidebar collapse state shared across layout components
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Token state
  const [token, setToken] = useState<string | null>(null);
  const pathname = usePathname();

  // Adjust sidebar collapse based on window width
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        setSidebarCollapsed(window.innerWidth < 768);
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // Retrieve the token from cookies
  useEffect(() => {
    const token = getCookie("token");
    setToken(token);
  }, [pathname]);

  return (
    <html lang="en">
      <body className="h-screen">
        <RootContextProvider>
          {token ? (
            // Render the Layout only when a token is available
            <Layout style={{ minHeight: "100vh", background: "black", width: "100%", height: "100vh" }}>
              <NavBar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
              {!pathname.split("/").includes("client") ? (
                <Layout
                  style={{
                    marginLeft: sidebarCollapsed ? 80 : 200,
                    transition: "margin-left 0.2s",
                    height: "100vh",
                    padding: "24px 16px",
                  }}
                >
                  <div className="max-w-[calc(100%-24px)]">
                    <Content
                      style={{
                        overflow: "initial",
                        padding: "8px 16px",
                        minHeight: "calc(100vh - 48px)",
                        background: "#fff",
                        borderRadius: 4,
                      }}
                    >
                      {children}
                    </Content>
                  </div>
                </Layout>
              ) : (
                children
              )}
            </Layout>
          ) : (
            // Render children directly if no token is present
            children
          )}
        </RootContextProvider>
      </body>
    </html>
  );
}
