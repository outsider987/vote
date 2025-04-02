"use client";

import { Button, Space, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PrinterOutlined,
  PlayCircleOutlined,
  StopOutlined,
  BarChartOutlined,
  DownloadOutlined,
  QrcodeOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import type { Event } from "../../../../data/types";

interface EventActionsProps {
  record: Event;
  screenWidth: number;
  onToggleVoting: (eventId: string, startVoting: boolean) => Promise<void>;
  onPrint: (event: Event) => Promise<void>;
  onOpenTicketsModal: (event: Event) => Promise<void>;
  onOpenVoteModal: (event?: Event) => void;
  onExportVoteData: (event: Event) => Promise<void>;
  setEventToDelete: (event: Event) => void;
  setIsDeleteModalOpen: (isOpen: boolean) => void;
}

export default function EventActions({
  record,
  screenWidth,
  onToggleVoting,
  onPrint,
  onOpenTicketsModal,
  onOpenVoteModal,
  onExportVoteData,
  setEventToDelete,
  setIsDeleteModalOpen,
}: EventActionsProps) {
  const router = useRouter();

  // Generate action menu items for dropdown
  const getActionMenuItems = (): MenuProps["items"] => [
    {
      key: "viewResult",
      label: "查看結果",
      icon: <BarChartOutlined />,
      onClick: () => router.push(`/client/live-vote-count?eventId=${record.id}`),
    },
    ...(record.isArchived
      ? [
          {
            key: "download",
            label: "下載資料",
            icon: <DownloadOutlined />,
            onClick: () => onExportVoteData(record),
          },
        ]
      : []),
    ...(!record.isVotingStarted && !record.isArchived
      ? [
          {
            key: "edit",
            label: "編輯",
            icon: <EditOutlined />,
            onClick: () => onOpenVoteModal(record),
          },
        ]
      : []),
    ...(!record.isArchived
      ? [
          {
            key: "toggleVoting",
            label: record.isVotingStarted ? "停止投票" : "開始投票",
            icon: record.isVotingStarted ? (
              <StopOutlined />
            ) : (
              <PlayCircleOutlined />
            ),
            onClick: () => onToggleVoting(record.id, !record.isVotingStarted),
          },
        ]
      : []),
    {
      key: "delete",
      label: "刪除",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        setEventToDelete(record);
        setIsDeleteModalOpen(true);
      },
    },
  ];

  // Render ticket tools
  const renderTicketTools = () => (
    <Space>
      <Button
        type="primary"
        icon={<PrinterOutlined />}
        onClick={() => onPrint(record)}
        size={screenWidth < 768 ? "small" : "middle"}
      >
        {screenWidth > 768 ? "列印" : ""}
      </Button>
      <Button
        icon={<QrcodeOutlined />}
        onClick={() => onOpenTicketsModal(record)}
        size={screenWidth < 768 ? "small" : "middle"}
      >
        {screenWidth > 768 ? "查看票券" : ""}
      </Button>
    </Space>
  );

  // Render all action buttons for larger screens
  const renderActions = () => {
    if (screenWidth <= 768) {
      return (
        <Dropdown menu={{ items: getActionMenuItems() }} trigger={["click"]}>
          <Button icon={<EllipsisOutlined />} />
        </Dropdown>
      );
    }
    
    return (
      <Space wrap>
        <Button
          icon={<BarChartOutlined />}
          onClick={() => router.push(`/client/live-vote-count?eventId=${record.id}`)}
        >
          查看結果
        </Button>

        {record.isArchived && (
          <Button
            icon={<DownloadOutlined />}
            onClick={() => onExportVoteData(record)}
          >
            下載資料
          </Button>
        )}

        {!record.isVotingStarted && !record.isArchived && (
          <Button
            icon={<EditOutlined />}
            onClick={() => onOpenVoteModal(record)}
          >
            編輯
          </Button>
        )}

        {!record.isArchived && (
          <Button
            type={record.isVotingStarted ? "default" : "primary"}
            danger={record.isVotingStarted}
            icon={
              record.isVotingStarted ? (
                <StopOutlined />
              ) : (
                <PlayCircleOutlined />
              )
            }
            onClick={() => onToggleVoting(record.id, !record.isVotingStarted)}
          >
            {record.isVotingStarted ? "停止投票" : "開始投票"}
          </Button>
        )}

        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            setEventToDelete(record);
            setIsDeleteModalOpen(true);
          }}
        >
          刪除
        </Button>
      </Space>
    );
  };

  return {
    ticketTools: renderTicketTools(),
    actions: renderActions(),
  };
} 