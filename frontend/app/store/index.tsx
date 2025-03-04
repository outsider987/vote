"use client";
import { GameProvider } from "./GameContext";
import { WalletProvider } from "./Wallet";
import { AuthProvider } from "./Auth";
// import { SnackbarProvider } from "notistack";
import { VoteProvider } from "./VoteContext";
import MySnackbarProvider from "../Provide/SnackbarProvider";
type RootContextProviderProps = {
  children?: React.ReactNode;
};
const RootContextProvider: React.FC<RootContextProviderProps> = ({
  children,
}) => {
  return (
    <MySnackbarProvider>
      <VoteProvider>
        <AuthProvider>
          <WalletProvider>
            <GameProvider>{children}</GameProvider>
          </WalletProvider>
        </AuthProvider>
      </VoteProvider>
    </MySnackbarProvider>
  );
};
export default RootContextProvider;
