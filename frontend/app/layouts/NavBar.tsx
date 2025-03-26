"use client";
import Link from "next/link";
import { useEffect, Dispatch, SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { Layout, Menu } from "antd";

import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  HomeOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import { useAuth } from "../store/Auth";
import { permissionsRoutes } from "../../config";
import { ItemType } from "antd/es/menu/interface";

const { Sider } = Layout;

interface NavBarProps {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
}

export default function NavBar({ collapsed, setCollapsed }: NavBarProps) {
  const { token, logout, hasUIPermission, role } = useAuth();
  const pathname = usePathname();

  // Collapse sidebar on small screens
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        if (window.innerWidth < 768) {
          setCollapsed(true);
        }
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, [setCollapsed]);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  if (!token) return null;

  // Map icon string to icon component
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "user":
        return <UserOutlined />;
      case "setting":
        return <SettingOutlined />;
      case "key":
        return <KeyOutlined />;
      default:
        return <SettingOutlined />;
    }
  };

  // Build menu items
  const getMenuItems = (): ItemType[] => {
    const baseItems: ItemType[] = [
      {
        key: "/",
        icon: <HomeOutlined />,
        label: <Link href="/">投票系統</Link>,
      },
    ];

    const adminChildren: ItemType[] = [];

    permissionsRoutes.forEach((route) => {
      if (hasUIPermission(route.path)) {
        adminChildren.push({
          key: route.path,
          icon: getIcon(route.icon),
          label: <Link href={route.path}>{route.name}</Link>,
        });
      }
    });

    if (adminChildren.length > 0) {
      baseItems.push({
        key: "admin",
        icon: <SettingOutlined />,
        label: "管理區",
        children: adminChildren,
      });
    }

    baseItems.push({
      key: "logout",
      icon: <LogoutOutlined />,
      label: <a onClick={logout}>登出</a>,
    });

    return baseItems;
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      style={{
        overflow: "auto",
        height: "100vh",
        position: "fixed",
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
      {/* Logo Area */}
      <div
        className="logo"
        style={{
          height: "64px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          fontWeight: "bold",
          fontSize: collapsed ? "14px" : "18px",
          margin: "16px 0",
        }}
      >
        {collapsed ? "投票" : "投票系統管理"}
      </div>

      {/* Collapse Toggle */}
      <div
        style={{
          padding: "0 16px",
          marginBottom: "16px",
          textAlign: "center",
        }}
      >
        {collapsed ? (
          <MenuUnfoldOutlined
            style={{ color: "white", fontSize: "16px", cursor: "pointer" }}
            onClick={toggleCollapsed}
          />
        ) : (
          <MenuFoldOutlined
            style={{ color: "white", fontSize: "16px", cursor: "pointer" }}
            onClick={toggleCollapsed}
          />
        )}
      </div>

      {/* Main Menu */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        defaultOpenKeys={["admin"]}
        items={getMenuItems()}
      />

      {/* Role Footer */}
      {!collapsed && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            padding: "0 24px",
            width: "100%",
            color: "rgba(255, 255, 255, 0.65)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          {role && <div>角色: {role}</div>}
        </div>
      )}
    </Sider>
  );
}
