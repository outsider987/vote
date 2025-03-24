"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import "antd/dist/reset.css";
import { Layout } from "antd";
import { QueryClient } from "@tanstack/react-query";
import NavBar from "./layouts/NavBar";
import { ReactNode, useState, useEffect } from "react";
import RootContextProvider from "./store";

import { useAuth } from "./store/Auth";
import { usePathname } from "next/navigation";
const { Content } = Layout;
const inter = Inter({ subsets: ["latin"] });
const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: ReactNode }) {
  // Create a state for sidebar collapse that can be shared
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // Effect to detect screen size and set initial state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        setSidebarCollapsed(window.innerWidth < 768);
      };

      if (typeof window !== "undefined") {
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      }
    }
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        <RootContextProvider>
          <Layout style={{ minHeight: "100vh", background: "black" }}>
            <NavBar
              collapsed={sidebarCollapsed}
              setCollapsed={setSidebarCollapsed}
            />
            {!window.location.pathname.split("/").includes("client") ? (
              <Layout
                style={{
                  marginLeft: sidebarCollapsed ? 80 : 200,
                  transition: "margin-left 0.2s",
                }}
              >
                <Content
                  style={{
                    margin: "24px 16px",
                    overflow: "initial",
                    padding: 24,
                    minHeight: "calc(100vh - 48px)",
                    background: "#fff",
                    borderRadius: 4,
                  }}
                >
                  {children}
                </Content>
              </Layout>
            ) : (
              children
            )}
          </Layout>
        </RootContextProvider>
      </body>
    </html>
  );
}
