"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import "antd/dist/reset.css";
import { Grid, Layout } from "antd";
import NavBar from "./layouts/NavBar";
import { ReactNode, useState, useEffect } from "react";
import RootContextProvider from "./store";
import { getCookie } from "./store/Auth";
import { usePathname } from "next/navigation";
import { ProCard } from "@ant-design/pro-components";
import TabNavigation from "./layouts/TabNavigation";

const { useBreakpoint } = Grid;

const { Content } = Layout;
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: ReactNode }) {
  // Sidebar collapse state shared across layout components
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Token state
  const [token, setToken] = useState<string | null>(null);
  const pathname = usePathname();
  const screens = useBreakpoint();
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
            <Layout
              style={{
                minHeight: "100vh",
                background: "black",
                width: "100%",
                height: "100vh",
              }}
            >
              <NavBar
                collapsed={sidebarCollapsed}
                setCollapsed={setSidebarCollapsed}
              />
              {!pathname.split("/").includes("client") ? (
                <Layout
                  style={{
                    marginLeft: screens.lg ? (sidebarCollapsed ? 80 : 200) : 0,
                    transition: "margin-left 0.2s",
                    height: "100vh",
                    padding: "12px 16px",
                  }}
                >
                  <TabNavigation />
                  <ProCard style={{ overflow: "auto" }}>{children}</ProCard>
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
