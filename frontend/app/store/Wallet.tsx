"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import detectEthereumProvider from "@metamask/detect-provider";
import { useRouter } from "next/navigation";
import { isMobileDevice } from "../utils/deviceDetector";

const STORAGE_KEY = "walletData";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type Transaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
};

type Wallet = {
  connect: () => Promise<void>;
  disconnect: () => void;
  accounts: string[];
  address: string;
  balance: string;
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  transactions: Transaction[];
  fetchTransactions: () => Promise<void>;
  switchAccount: () => Promise<void>;
};

const WalletContext = createContext<Wallet>({
  connect: async () => {},
  disconnect: () => {},
  accounts: [],
  address: "",
  balance: "",
  isConnected: false,
  isConnecting: true,
  connectionStatus: "disconnected",
  connectionError: null,
  transactions: [],
  fetchTransactions: async () => {},
  switchAccount: async () => {},
});

const WalletProvider = ({ children }) => {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [address, setAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const router = useRouter();
  const isConnected = Boolean(address);

  // Load wallet data from localStorage
  useEffect(() => {
    const loadStoredData = () => {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const { address, accounts } = JSON.parse(storedData);
        setAddress(address || "");
        setAccounts(accounts || []);
      }
      setIsConnecting(false);
    };

    loadStoredData();
  }, []);

  // Handle account changes from MetaMask
  useEffect(() => {
    const handleAccountsChanged = (newAccounts: string[]) => {
      if (newAccounts.length === 0) {
        disconnect();
      } else {
        setAccounts(newAccounts);
        setAddress(newAccounts[0]);
      }
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
      }
    };
  }, []);

  // Persist wallet data to localStorage
  useEffect(() => {
    if (address) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address, accounts }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [address, accounts]);

  // Redirect after successful connection
  useEffect(() => {
    if (isConnected) {
      // router.push("/seeds");
    }
  }, [isConnected, router]);

  const connect = useCallback(async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus("connecting");
      setConnectionError(null);

      if (isMobileDevice()) {
        throw new Error(
          "Please use a desktop browser with MetaMask plugin installed."
        );
      }

      const provider = (await detectEthereumProvider()) as any;
      if (!provider) {
        throw new Error(
          "MetaMask is not installed. Please install MetaMask to continue."
        );
      }

      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) {
        throw new Error(
          "No accounts found. Please check your MetaMask configuration."
        );
      }

      setAccounts(accounts);
      setAddress(accounts[0]);
      setConnectionStatus("connected");
    } catch (error: any) {
      console.error("Error connecting to MetaMask:", error.message);
      setConnectionError(error.message);
      setConnectionStatus("error");
      throw error; // Propagate error to be handled by UI
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccounts([]);
    setAddress("");
    setBalance("");
    setConnectionStatus("disconnected");
    setConnectionError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!window.ethereum || !address) return;

    try {
      // This is a basic example using Ethereum JSON-RPC
      const provider = (await detectEthereumProvider()) as any;
      const response = await provider.request({
        method: "eth_getTransactionsByAddress",
        params: [address, "latest"],
      });

      // Transform and set transactions
      const formattedTransactions = response.map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        timestamp: parseInt(tx.timeStamp) * 1000, // Convert to milliseconds
      }));

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  }, [address]);

  const switchAccount = useCallback(async () => {
    try {
      const provider = (await detectEthereumProvider()) as any;
      if (!provider) {
        throw new Error("Please install MetaMask!");
      }

      // This will prompt the user to select an account in MetaMask
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (error: any) {
      console.error("Error switching account:", error.message);
      setConnectionError(error.message);
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        connect,
        disconnect,
        accounts,
        address,
        balance,
        isConnected,
        isConnecting,
        connectionStatus,
        connectionError,
        transactions,
        fetchTransactions,
        switchAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = () => useContext(WalletContext);
export { WalletProvider, WalletContext };
