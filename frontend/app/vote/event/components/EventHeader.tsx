"use client";

import { Button } from "antd";
import { useState } from "react";
import { SearchForm } from "../../../../components/SearchForm";
import { EventSearchFilters, EventSearchColumn } from "../types";
import CreateVoteModal from "./CreateVoteModal";
import { useGroups } from "@/data/queries/groups";

interface EventHeaderProps {
  updateFilters: (filters: EventSearchFilters) => void;
  refetchEvents: () => void;
}

export default function EventHeader({ updateFilters, refetchEvents }: EventHeaderProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: groups, isLoading: isGroupsLoading } = useGroups();
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
    {
      name: "group_id",
      label: "群組",
      type: "select",
      placeholder: "選擇群組",
      options: groups?.map((group) => ({
        label: group.name,
        value: group.id,
      })),
      width: 200,
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
            group_id: values.group_id || "",
          });
        }}
        onReset={() => {
          updateFilters({
            title: "",
            status: "",
            group_id: "",
            page: 1,
          });
        }}
      >
        {}
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