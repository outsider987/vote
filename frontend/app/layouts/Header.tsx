"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const Header = ({ className, ...props }) => {
  const pathname = usePathname() || null;
  const [show, setShow] = useState(false);
  const router = useRouter();
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  return (
    <>
      <header
        className={`flex items-center justify-between opacity-100 h-[86px] sm:h-[64px] md:h-[64px] fixed left-0 right-0 top-0 z-10 px-12 sm:px-[18px] md:px-[18px] border-b border-solid border-[rgba(255,255,255,0.2)] ${className}`}
      ></header>
    </>
  );
};

export default Header;
