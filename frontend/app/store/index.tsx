"use client";
import { GameProvider } from "./GameContext";
import { WalletProvider } from "./Wallet";
import { AuthProvider } from "./Auth";
// import { SnackbarProvider } from "notistack";
import { VoteProvider } from "./VoteContext";
import MySnackbarProvider from "../Provide/SnackbarProvider";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
type RootContextProviderProps = {
  children?: React.ReactNode;
};
const RootContextProvider: React.FC<RootContextProviderProps> = ({
  children,
}) => {
  const queryClient = new QueryClient();
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
            <AuthProvider>
              <WalletProvider>
                <GameProvider>{children}</GameProvider>
              </WalletProvider>
            </AuthProvider>
          </VoteProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </MySnackbarProvider>
  );
};
export default RootContextProvider;
