"use client";

import { Tabs } from "antd";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseOutlined } from "@ant-design/icons";

interface TabItem {
  key: string;
  label: string;
  closable: boolean;
}

export default function TabNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeKey, setActiveKey] = useState(pathname);
  const [items, setItems] = useState<TabItem[]>([]);

  // Get page title from pathname
  const getPageTitle = (path: string) => {
    const pathSegments = path.split("/").filter(Boolean);
    if (pathSegments.length === 0) return "Dashboard";
    return pathSegments[pathSegments.length - 1]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Add new tab when pathname changes
  useEffect(() => {
    if (!pathname) return;

    setActiveKey(pathname);
    setItems((prevItems) => {
      // Check if tab already exists
      const existingTab = prevItems.find((item) => item.key === pathname);
      if (existingTab) return prevItems;

      // Add new tab
      return [
        ...prevItems,
        {
          key: pathname,
          label: getPageTitle(pathname),
          closable: pathname !== "/", // Dashboard tab cannot be closed
        },
      ];
    });
  }, [pathname]);

  const onChange = (key: string) => {
    setActiveKey(key);
    router.push(key);
  };

  const onEdit = (targetKey: string | React.MouseEvent | React.KeyboardEvent, action: "add" | "remove") => {
    if (action === "remove" && typeof targetKey === "string") {
      setItems((prevItems) => {
        const newItems = prevItems.filter((item) => item.key !== targetKey);
        // If closing active tab, switch to the previous tab
        if (targetKey === activeKey && newItems.length > 0) {
          const lastTab = newItems[newItems.length - 1];
          setActiveKey(lastTab.key);
          router.push(lastTab.key);
        }
        return newItems;
      });
    }
  };

  return (
    <Tabs
      hideAdd
      className="[&_.ant-tabs-nav]:m-0 [&_.ant-tabs-tab]:!px-3 [&_.ant-tabs-tab]:!py-1 [&_.ant-tabs-tab]:text-sm"
      onChange={onChange}
      activeKey={activeKey}
      type="editable-card"
      onEdit={onEdit}
      items={items}
    />
  );
} 