"use client";

import { useState } from "react";
import { Table, Space, Typography, Tag, Pagination } from "antd";
import type { ColumnsType } from "antd/es/table";
import moment from "moment";
import type { Event } from "../../../../data/types";
import EventActions from "./EventActions";

const { Text } = Typography;

interface EventTableProps {
  events: Event[];
  isLoading: boolean;
  error: Error | null;
  screenWidth: number;
  filters: {
    page?: number;
    pageSize?: number;
  };
  total: number;
  handlePageChange: (page: number, pageSize: number) => void;
  onToggleVoting: (eventId: string, startVoting: boolean) => Promise<void>;
  onPrint: (event: Event) => Promise<void>;
  onOpenTicketsModal: (event: Event) => Promise<void>;
  onOpenVoteModal: (event?: Event) => void;
  onExportVoteData: (event: Event) => Promise<void>;
  setEventToDelete: (event: Event) => void;
  setIsDeleteModalOpen: (isOpen: boolean) => void;
}

export default function EventTable({
  events,
  isLoading,
  error,
  screenWidth,
  filters,
  total,
  handlePageChange,
  onToggleVoting,
  onPrint,
  onOpenTicketsModal,
  onOpenVoteModal,
  onExportVoteData,
  setEventToDelete,
  setIsDeleteModalOpen,
}: EventTableProps) {
  // Define columns based on screen width
  const getColumns = (): ColumnsType<Event> => {
    // Base columns for all screen sizes
    const baseColumns: ColumnsType<Event> = [
      {
        title: "投票標題",
        dataIndex: "title",
        key: "title",
        sorter: (a, b) => a.title.localeCompare(b.title),
        render: (text, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{text}</Text>
            <Space>
              <Tag color={record.isVotingStarted ? "green" : "default"}>
                {record.isVotingStarted ? "投票中" : "未開始"}
              </Tag>
              <Tag color={record.isArchived ? "red" : "default"}>
                {record.isArchived ? "已封存" : "未封存"}
              </Tag>
            </Space>
          </Space>
        ),
      },
    ];
    baseColumns.push({
      title: "群組",
      dataIndex: "group",
      key: "group",
      // sorter: (a, b) => a.group.name.localeCompare(b.group.name),
      render: (text, record) =>
        record?.group?.name ? (
          <Tag color="blue">{record?.group?.name}</Tag>
        ) : null,
    });

    // Medium screen columns
    if (screenWidth > 768) {
      baseColumns.push(
        {
          title: "投票日期",
          dataIndex: "eventDate",
          key: "eventDate",
          sorter: (a, b) =>
            moment(a.eventDate).unix() - moment(b.eventDate).unix(),
          render: (date) => moment(date).format("YYYY-MM-DD HH:mm:ss"),
        },
        {
          title: "會員人數",
          dataIndex: "memberCount",
          key: "memberCount",
          responsive: ["md"],
          sorter: (a, b) => a.memberCount - b.memberCount,
        },
        {
          title: "候選數",
          dataIndex: "options",
          key: "candidateCount",
          responsive: ["md"],
          sorter: (a, b) => a.options.length - b.options.length,
          render: (options) => options.length,
        }
      );
    }

    // Ticket tools column
    baseColumns.push({
      title: "票卷工具",
      key: "ticketTools",
      dataIndex: "id",
      render: (_, record) => {
        const eventActions = EventActions({
          record,
          screenWidth,
          onToggleVoting,
          onPrint,
          onOpenTicketsModal,
          onOpenVoteModal,
          onExportVoteData,
          setEventToDelete,
          setIsDeleteModalOpen,
        });
        return eventActions.ticketTools;
      },
    });

    // Actions column
    baseColumns.push({
      title: "操作",
      key: "action",
      dataIndex: "id",
      render: (_, record) => {
        const eventActions = EventActions({
          record,
          screenWidth,
          onToggleVoting,
          onPrint,
          onOpenTicketsModal,
          onOpenVoteModal,
          onExportVoteData,
          setEventToDelete,
          setIsDeleteModalOpen,
        });
        return eventActions.actions;
      },
    });

    return baseColumns;
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded">
        {error instanceof Error ? error.message : "載入失敗，請稍後再試"}
      </div>
    );
  }

  return (
    <>
      <Table
        columns={getColumns()}
        dataSource={events}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        scroll={{ x: "max-content" }}
        sortDirections={["ascend", "descend"]}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: 16 }}>
              {screenWidth <= 768 && (
                <>
                  <p>
                    <Text type="secondary">投票日期: </Text>
                    {moment(record.eventDate).format("YYYY-MM-DD HH:mm:ss")}
                  </p>
                  <p>
                    <Text type="secondary">會員人數: </Text>
                    {record.memberCount}
                  </p>
                  <p>
                    <Text type="secondary">候選人數: </Text>
                    {record.options.length}
                  </p>
                </>
              )}
              <p>
                <Text type="secondary">建立時間: </Text>
                {moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss")}
              </p>
              <p>
                <Text type="secondary">每人可投票數: </Text>
                {record.votesPerUser}
              </p>
              <p>
                <Text type="secondary">應選數: </Text>
                {record.requiredCount}
              </p>
              <p>
                <Text type="secondary">備選數: </Text>
                {record.backupCount}
              </p>
              <p>
                <Text type="secondary">事件 ID: </Text>
                {record.id}
              </p>
              <p>
                <Text type="secondary">候選人: </Text>
                {record.options
                  .map((option) => `${option.number} - ${option.text}`)
                  .join(", ")}
              </p>
            </div>
          ),
        }}
      />

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Pagination
          current={filters.page || 1}
          pageSize={filters.pageSize || 10}
          total={total}
          onChange={handlePageChange}
          showSizeChanger
          showTotal={(total) => `共 ${total} 筆`}
        />
      </div>
    </>
  );
}
