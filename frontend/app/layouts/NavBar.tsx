// components/Navbar.tsx
'use client'
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button'; // 根據 shadcn/ui 設定引入 Button
import { X, Menu } from 'lucide-react'; // 使用 lucide-react 做圖示，可自行替換
import clsx from "clsx";
export default function Navbar({className = ""}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <nav className={clsx("bg-gray-800 bg-opacity-30 text-white fixed top-0 left-0 right-0 z-20", className)}>
      <div className="container mx-auto flex items-center justify-between p-4">
        <Link className="text-xl font-bold hover:text-gray-300" href="/">
          後臺系統
        </Link>
        {/* 桌機版選單 */}
        <div className="hidden md:flex space-x-4">
          <Link href="/">
            <Button  className="hover:bg-gray-700">
              建立投票事件
            </Button>
          </Link>
          <Link href="/generate-tickets">
            <Button    className="hover:bg-gray-700">
              票券產生
            </Button>
          </Link>
          <Link href="/live-vote-count">
            <Button  className="hover:bg-gray-700">
              投票結果
            </Button>
          </Link>
        </div>
        {/* 手機版漢堡按鈕 */}
        <div className="md:hidden">
          <button onClick={toggleMenu} className="focus:outline-none">
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
      {/* 手機版選單內容 */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gray-800 ">
          <div className="flex flex-col space-y-2 p-4">
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full text-left">
                建立投票事件
              </Button>
            </Link>
            <Link href="/generate-tickets" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full text-left">
                票券產生
              </Button>
            </Link>
            <Link href="/live-vote-count" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full text-left">
                投票結果
              </Button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
