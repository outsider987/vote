"use client";

import { AuthProvider } from "./Auth";
// import { SnackbarProvider } from "notistack";
import { VoteProvider } from "./VoteContext";
import MySnackbarProvider from "../Provide/SnackbarProvider";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import { useState } from "react";
type RootContextProviderProps = {
  children?: React.ReactNode;
};
const RootContextProvider: React.FC<RootContextProviderProps> = ({
  children,
}) => {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <MySnackbarProvider>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#1677ff",
            },
            components: {
              Layout: {
                bodyBg: "#f5f5f5",
              },
            },
          }}
        >
          <VoteProvider>
            <AuthProvider>{children}</AuthProvider>
          </VoteProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </MySnackbarProvider>
  );
};
export default RootContextProvider;
