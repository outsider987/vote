import { GameProvider } from "./GameContext";
import { WalletProvider } from "./Wallet";
import { AuthProvider } from "./Auth";
type RootContextProviderProps = {
  children?: React.ReactNode;
};
const RootContextProvider: React.FC<RootContextProviderProps> = ({
  children,
}) => {
  return (
    <AuthProvider>
      <WalletProvider>
        <GameProvider>{children}</GameProvider>
      </WalletProvider>
    </AuthProvider>
  );
};
export default RootContextProvider;
