"use client";

import { Button } from "antd";
import { useState } from "react";
import { SearchForm } from "../../../../components/SearchForm";
import { EventSearchFilters, EventSearchColumn } from "../types";
import CreateVoteModal from "../../../../components/CreateVoteModal";

interface EventHeaderProps {
  updateFilters: (filters: EventSearchFilters) => void;
  refetchEvents: () => void;
}

export default function EventHeader({ updateFilters, refetchEvents }: EventHeaderProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Search columns definition
  const searchColumns: EventSearchColumn[] = [
    {
      name: "title",
      label: "活動名稱",
      type: "input",
      placeholder: "請輸入活動名稱",
    },
    {
      name: "status",
      label: "狀態",
      type: "select",
      placeholder: "選擇狀態",
      width: 200,
      options: [
        { label: "全部", value: "" },
        { label: "投票中", value: "active" },
        { label: "未開始", value: "inactive" },
        { label: "已封存", value: "archived" },
      ],
    },
  ];

  return (
    <>
      <SearchForm
        columns={searchColumns}
        onSearch={(values) => {
          updateFilters({
            title: values.title || "",
            status: values.status || "",
          });
        }}
        onReset={() => {
          updateFilters({
            title: "",
            status: "",
            page: 1,
          });
        }}
      >
        <Button type="primary" onClick={() => setIsCreateModalOpen(true)}>
          新增活動
        </Button>
      </SearchForm>

      <CreateVoteModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        mode="create"
        onSuccess={() => {
          refetchEvents();
        }}
      />
    </>
  );
} 