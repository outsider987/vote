/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Button from "../components/Button";
import { useWalletContext } from "../store/Wallet";
import TitleImage from "@/public/svgs/title.svg";
import { useRouter, usePathname } from "next/navigation";

const Header = ({ className, ...props }) => {
  const {
    connect,
    address,
    isConnected,
    connectionStatus,
    isConnecting,
  } = useWalletContext();

  const pathname = usePathname() || null;
  const [show, setShow] = useState(false);
  const router = useRouter();
  const [showMobileWarning, setShowMobileWarning] = useState(false);





  useEffect(() => {
    // If there's an address but not connected, try to connect
    const autoConnect = async () => {
      if (address && !isConnected && !isConnecting) {
        try {
          await connect();
        } catch (error) {
          console.error("Auto-connect failed:", error);
        }
      }
    };

    autoConnect();
  }, [address, isConnecting, connect]);

  useEffect(() => {
    if (isConnected) {
      setShow(false);
    }
  }, [isConnected]);

  const getButtonContent = () => {
    if (isConnecting)
      return (
        <div className="flex items-center ml-5">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Connecting...
        </div>
      );
    if (connectionStatus === "error") return "Connection Failed";
    if (pathname === "/") return "Launch DApp";
    return "Connect";
  };

  return (
    <>
      <header
        className={`flex items-center justify-between opacity-100 h-[86px] sm:h-[64px] md:h-[64px] fixed left-0 right-0 top-0 z-10 px-12 sm:px-[18px] md:px-[18px] border-b border-solid border-[rgba(255,255,255,0.2)] ${className}`}
      >
        
      </header>
    </>
  );
};

export default Header;
