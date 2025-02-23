import { GameProvider } from "./GameContext";
import { WalletProvider } from "./Wallet";
type RootContextProviderProps = {
  children?: React.ReactNode;
};
const RootContextProvider: React.FC<RootContextProviderProps> = ({
  children,
}) => {
  return (
    <WalletProvider>
      <GameProvider>{children}</GameProvider>
    </WalletProvider>
  );
};
export default RootContextProvider;
