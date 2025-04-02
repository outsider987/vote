"use client";
import Link from "next/link";
import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { usePathname } from "next/navigation";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Grid,
  Drawer,
  Button,
} from "antd";
import type { MenuProps } from "antd";
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  HomeOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
  KeyOutlined,
  DownOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { useAuth } from "../store/Auth";
import { permissionsRoutes } from "../../config";
import { ItemType } from "antd/es/menu/interface";

const { Sider, Header } = Layout;
const { useBreakpoint } = Grid;

interface NavBarProps {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
}

export default function NavBar({ collapsed, setCollapsed }: NavBarProps) {
  const { token, logout, hasUIPermission, role, user } = useAuth();
  const pathname = usePathname();
  const screens = useBreakpoint();
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Collapse sidebar on smaller screens if needed
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

  useEffect(() => {
    setDrawerVisible(false);
  }, [pathname]);

  if (!token) return null;

  // User dropdown menu items
  const userMenuItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "個人資料",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "設定",
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "登出",
      onClick: logout,
    },
  ];

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

  // Build menu items for both layouts
  const getMenuItems = (): ItemType[] => {
    const baseItems: ItemType[] = [
      {
        key: "/vote",
        icon: <HomeOutlined />,
        label: "投票系統",
        children: [
          {
            key: "/vote/member",
            icon: <UserOutlined />,
            label: <Link href="/vote/member">成員管理</Link>,
          },
          {
            key: "/vote/group",
            icon: <UserOutlined />,
            label: <Link href="/vote/group">群組管理</Link>,
          },
          {
            key: "/vote/event",
            icon: <UserOutlined />,
            label: <Link href="/vote/event">活動管理</Link>,
          },
        ],
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

    return baseItems;
  };

  // Desktop layout with Sider
  const renderDesktop = () => (
    <Layout>
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

      {/* Header with User Info */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : 200,
          transition: "margin-left 0.2s",
        }}
      >
        <Header
        
          style={{
            padding: "0 24px",
            background: "#fff",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            position: "sticky",
            top: 0,
            zIndex: 9,
            
            boxShadow: "0 1px 4px rgba(0,21,41,.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: "pointer" }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.username || "User"}</span>
                <DownOutlined />
              </Space>
            </Dropdown>
          </div>
        </Header>
      </Layout>
    </Layout>
  );

  // Mobile/Tablet layout with top menu and Drawer fallback
  const renderMobile = () => (
    <>
      <Header
        style={{
          padding: "0 24px",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 1px 4px rgba(0,21,41,.08)",
          
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "64px",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: "18px" }}>投票系統</div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: "20px" }} />}
              onClick={() => setDrawerVisible(true)}
            />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: "pointer" }}>
                <Avatar icon={<UserOutlined />} />
              </Space>
            </Dropdown>
          </div>
        </div>
        {/* Horizontal Menu */}
        {/* <Menu mode="horizontal" selectedKeys={[pathname]} items={getMenuItems()} /> */}
      </Header>
      {/* Optional Drawer for additional navigation if needed */}
      <Drawer
        title="Menu"
        placement="left"
        onClose={() => setDrawerVisible(false)}
        visible={drawerVisible}
        bodyStyle={{ padding: 0 }}
      >
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          defaultOpenKeys={["admin"]}
          items={getMenuItems()}
          style={{ height: "100%" }}
        />
      </Drawer>
    </>
  );

  // Render desktop layout if viewport is medium or larger; otherwise, use mobile layout
  return screens.md ? renderDesktop() : renderMobile();
}
