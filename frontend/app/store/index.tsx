"use client";
import { GameProvider } from "./GameContext";
import { WalletProvider } from "./Wallet";
import { AuthProvider } from "./Auth";
import { SnackbarProvider } from "notistack";

type RootContextProviderProps = {
  children?: React.ReactNode;
};
const RootContextProvider: React.FC<RootContextProviderProps> = ({
  children,
}) => {
  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <AuthProvider>
        <WalletProvider>
          <GameProvider>{children}</GameProvider>
        </WalletProvider>
      </AuthProvider>
    </SnackbarProvider>
  );
};
export default RootContextProvider;
