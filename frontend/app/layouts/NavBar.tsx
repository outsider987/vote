"use client";
import Link from "next/link";
import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { Layout, Menu } from 'antd';
import { 
  MenuUnfoldOutlined, 
  MenuFoldOutlined, 
  HomeOutlined, 
  LogoutOutlined 
} from '@ant-design/icons';
import { useAuth } from "../store/Auth";

const { Sider } = Layout;

interface NavBarProps {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
}

export default function NavBar({ collapsed, setCollapsed }: NavBarProps) {
  const { token, logout } = useAuth();
  const pathname = usePathname();

  // Effect to handle window resize and set collapsed state for mobile screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };

    // Initial check
    handleResize();

    // Listen for window resize
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [setCollapsed]);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  if (!token) {
    return null;
  }

  const menuItems = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: <Link href="/">投票系統</Link>,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: <a onClick={logout}>登出</a>,
    }
  ];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
      }}
      trigger={null}
      width={200}
      collapsedWidth={80}
      breakpoint="lg"
    >
      <div className="logo" style={{ 
        height: '64px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        color: 'white',
        fontWeight: 'bold',
        fontSize: collapsed ? '14px' : '18px',
        margin: '16px 0'
      }}>
        {collapsed ? '投票' : '投票系統管理'}
      </div>
      
      <div style={{ 
        padding: '0 16px', 
        marginBottom: '16px', 
        textAlign: 'center' 
      }}>
        {collapsed ? (
          <MenuUnfoldOutlined 
            style={{ color: 'white', fontSize: '16px', cursor: 'pointer' }} 
            onClick={toggleCollapsed} 
          />
        ) : (
          <MenuFoldOutlined 
            style={{ color: 'white', fontSize: '16px', cursor: 'pointer' }} 
            onClick={toggleCollapsed} 
          />
        )}
      </div>
      
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname === '/' ? 'home' : '']}
        items={menuItems}
      />
    </Sider>
  );
}
