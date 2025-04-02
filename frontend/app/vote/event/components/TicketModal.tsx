"use client";

import { Modal, Table, Tag, Space } from "antd";
import type { ColumnsType } from "antd/es/table";
import QRCode from "react-qr-code";
import Link from "next/link";
import moment from "moment";
import type { Event, Ticket } from "../../../../data/types";

interface TicketModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  selectedEvent: Event | null;
  tickets: Ticket[];
  screenWidth: number;
}

export default function TicketModal({
  isModalOpen,
  setIsModalOpen,
  selectedEvent,
  tickets,
  screenWidth,
}: TicketModalProps) {
  
  const getVoteCodeURL = (voteCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/client/vote?vote_code=${voteCode}`;
    }
    return `/client/vote?vote_code=${voteCode}`;
  };
  
  // Configure responsive layouts for Tickets table
  const ticketColumns: ColumnsType<Ticket> = [
    {
      title: "QR Code",
      key: "qrcode",
      dataIndex: "voteCode",
      responsive: ["md"],
      render: (_, record) => (
        <QRCode value={getVoteCodeURL(record.voteCode)} size={80} />
      ),
    },
    {
      title: "票券代碼",
      dataIndex: "voteCode",
      key: "voteCode",
    },
    {
      title: "狀態",
      key: "status",
      dataIndex: "used",
      render: (_, record) => (
        <Tag color={record.used ? "red" : "green"}>
          {record.used ? "已使用" : "未使用"}
        </Tag>
      ),
    },
    {
      title: "使用時間",
      key: "usedAt",
      dataIndex: "usedAt",
      responsive: ["md"],
      render: (_, record) =>
        record.usedAt ? moment(record.usedAt).format("YYYY-MM-DD HH:mm") : "-",
    },
    {
      title: "操作",
      key: "action",
      dataIndex: "voteCode",
      render: (_, record) => (
        <Link href={getVoteCodeURL(record.voteCode)} target="_blank">
          連結
        </Link>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div>
          <div>{selectedEvent?.title} - 票券列表</div>
          <div style={{ fontSize: "14px", marginTop: "8px" }}>
            <Space>
              <Tag color="red">
                已使用票券: {tickets?.filter((ticket) => ticket.used).length}
              </Tag>
              <Tag color="green">
                未使用票券: {tickets?.filter((ticket) => !ticket.used).length}
              </Tag>
              <Tag>總票券數: {tickets.length}</Tag>
            </Space>
          </div>
        </div>
      }
      open={isModalOpen}
      onCancel={() => setIsModalOpen(false)}
      width={screenWidth < 768 ? "95%" : 1000}
      footer={null}
    >
      <div style={{ marginTop: "20px" }}>
        {tickets && tickets.length > 0 ? (
          <Table
            dataSource={tickets}
            rowKey="id"
            pagination={{ pageSize: screenWidth < 768 ? 5 : 8 }}
            columns={ticketColumns}
            scroll={{ x: "max-content" }}
            size={screenWidth < 768 ? "small" : "middle"}
          />
        ) : (
          <div
            style={{ textAlign: "center", padding: "40px", color: "#999" }}
          >
            無票券資料
          </div>
        )}
      </div>
    </Modal>
  );
} 