"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Table, Button, Modal, Tag, Space, message, Typography, Dropdown, MenuProps } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { 
  EditOutlined, 
  DeleteOutlined, 
  PrinterOutlined, 
  PlayCircleOutlined, 
  StopOutlined, 
  BarChartOutlined,
  DownloadOutlined,
  QrcodeOutlined,
  MoreOutlined,
  EllipsisOutlined
} from "@ant-design/icons";
import moment from "moment";
import QRCode from "react-qr-code";
import { useRouter } from "next/navigation";
import type { Event } from "../data/types";
import { useEvents } from "../data/queries/events";
import { useTickets } from "../data/queries/tickets";
import { useDeleteEvent, useToggleVoting } from "../data/mutations/events";
import ReactDOM from "react-dom/client";
import Link from "next/link";
import CreateVoteModal from "./CreateVoteModal";
import VoteListModal from "./VoteListModal";
import { useVote } from "../api/vote";

const { Text } = Typography;

export interface EventListRef {
  fetchEvents: () => Promise<void>;
}

// Define interface for ticket data
interface Ticket {
  id: string;
  voteCode: string;
  used: boolean;
  usedAt?: string;
}

const EventList = forwardRef<EventListRef>((props, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [printEvent, setPrintEvent] = useState<Event | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [screenWidth, setScreenWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  const router = useRouter();

  const { data: events = [], error, refetch } = useEvents();
  const { data: tickets = [], refetch: refetchTickets } = useTickets(
    selectedEvent?.id
  );
  const deleteMutation = useDeleteEvent();
  const toggleVotingMutation = useToggleVoting();
  const { EXPORT_VOTE_DATA } = useVote();

  const [isVoteListModalOpen, setIsVoteListModalOpen] = useState(false);

  // Track window resize for responsive design
  useEffect(() => {
    if (typeof window !== "undefined") {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const getVoteCodeURL = (voteCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/client/vote?vote_code=${voteCode}`;
    }
    return `/client/vote?vote_code=${voteCode}`;
  };

  useImperativeHandle(ref, () => ({
    fetchEvents: async () => {
      await refetch();
    },
  }));

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteMutation.mutateAsync(eventId);
      message.success("活動已成功刪除");
    } catch (err) {
      message.error("刪除失敗，請稍後再試");
      console.error(err);
    }
  };

  const handleToggleVoting = async (eventId: string, startVoting: boolean) => {
    try {
      await toggleVotingMutation.mutateAsync({ eventId, startVoting });
      message.success(startVoting ? "投票已開始" : "投票已停止");
    } catch (err) {
      message.error("操作失敗，請稍後再試");
      console.error(err);
    }
  };

  const handleOpenTicketsModal = async (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
    await refetchTickets();
  };

  const handleOpenVoteModal = (event?: Event) => {
    setSelectedEvent(event || null);
    setIsVoteModalOpen(true);
  };

  const handleOpenVoteList = (event: Event) => {
    setSelectedEvent(event);
    setIsVoteListModalOpen(true);
  };

  const handleExportVoteData = async (event: Event) => {
    try {
      const response = await EXPORT_VOTE_DATA(event.id);
      const blob = new Blob([response.data], { type: response.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${event.title}_投票資料.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("投票資料已下載");
    } catch (error) {
      console.error("下載失敗", error);
      message.error("下載失敗，請稍後再試");
    }
  };

  // Generate action menu items for dropdown
  const getActionMenuItems = (record: Event): MenuProps['items'] => [
    {
      key: 'viewResult',
      label: '查看結果',
      icon: <BarChartOutlined />,
      onClick: () => router.push(`/client/live-vote-count?eventId=${record.id}`)
    },
    ...(record.isArchived ? [{
      key: 'download',
      label: '下載資料',
      icon: <DownloadOutlined />,
      onClick: () => handleExportVoteData(record)
    }] : []),
    ...(!record.isVotingStarted && !record.isArchived ? [{
      key: 'edit',
      label: '編輯',
      icon: <EditOutlined />,
      onClick: () => handleOpenVoteModal(record)
    }] : []),
    ...(!record.isArchived ? [{
      key: 'toggleVoting',
      label: record.isVotingStarted ? '停止投票' : '開始投票',
      icon: record.isVotingStarted ? <StopOutlined /> : <PlayCircleOutlined />,
      onClick: () => handleToggleVoting(record.id, !record.isVotingStarted)
    }] : []),
    {
      key: 'delete',
      label: '刪除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        setEventToDelete(record);
        setIsDeleteModalOpen(true);
      }
    }
  ];

  // Printing logic moved into a separate function.
  const doPrint = (event: Event, currentTickets: typeof tickets) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      <style>
        @media print {
          @page { size: A4; margin: 0.5cm; }
          body { margin: 0; padding: 0; }
          .page { break-after: page; padding: 0.5cm; }
          .page:last-child { break-after: auto; }
          .qr-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 0.3cm;
          }
          .qr-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0.3cm;
            border: 1px solid #ccc;
            background: white;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .qr-code {
            width: 3cm;
            height: 3cm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code svg { width: 100%; height: 100%; }
          .vote-code {
            margin-top: 0.2cm;
            font-size: 8pt;
            font-family: monospace;
          }
          .page-header {
            text-align: center;
            margin-bottom: 0.5cm;
            font-size: 12pt;
            font-weight: bold;
          }
        }
      </style>
    `;

    // Create a temporary container to render QR codes and capture their SVG markup.
    const tempDiv = document.createElement("div");
    const root = ReactDOM.createRoot(tempDiv);
    root.render(
      <div style={{ display: "none" }}>
        {currentTickets.map((ticket) => (
          <div key={ticket.voteCode} id={`qr-${ticket.voteCode}`}>
            <QRCode
              value={getVoteCodeURL(ticket.voteCode)}
              size={256}
              level="M"
            />
          </div>
        ))}
      </div>
    );

    // Wait briefly to allow QR codes to render.
    setTimeout(() => {
      const itemsPerPage = 25;
      const pages = Math.ceil(currentTickets.length / itemsPerPage);

      const content = `
        <html>
          <head>
            <title>Print QR Codes - ${event.title}</title>
            ${styles}
          </head>
          <body>
            ${Array.from({ length: pages }, (_, pageIndex) => {
              const pageTickets = currentTickets.slice(
                pageIndex * itemsPerPage,
                (pageIndex + 1) * itemsPerPage
              );
              return `
                <div class="page">
                  <div class="page-header">
                    ${event.title} - 投票券 (第 ${
                pageIndex + 1
              } 頁，共 ${pages} 頁)
                  </div>
                  <div class="qr-grid">
                    ${pageTickets
                      .map((ticket) => {
                        const qrElement = tempDiv.querySelector(
                          `#qr-${ticket.voteCode}`
                        );
                        const qrSvg = qrElement?.innerHTML || "";
                        return `
                        <div class="qr-item">
                          <div class="qr-code">${qrSvg}</div>
                          <div class="vote-code">${ticket.voteCode}</div>
                        </div>
                      `;
                      })
                      .join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </body>
        </html>
      `;

      root.unmount();

      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }, 100);
  };

  // When the print button is clicked, set printing state and trigger a refetch.
  const handlePrint = async (event: Event) => {
    setPrintEvent(event);
    setSelectedEvent(event);
    setIsPrinting(true);
    await refetchTickets();
  };

  // Watch for changes to tickets while printing.
  useEffect(() => {
    if (isPrinting && printEvent) {
      if (tickets && tickets.length > 0) {
        doPrint(printEvent, tickets);
        setIsPrinting(false);
      } else {
        // If tickets are still empty after 1 second, alert the user.
        const timeoutId = setTimeout(() => {
          if (tickets.length === 0) {
            message.warning("目前沒有票券可列印");
            setIsPrinting(false);
          }
        }, 1000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [tickets, isPrinting, printEvent]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded">
        {error instanceof Error ? error.message : "載入失敗，請稍後再試"}
      </div>
    );
  }

  // Define columns based on screen width
  const getColumns = (): ColumnsType<Event> => {
    // Base columns for all screen sizes
    const baseColumns: ColumnsType<Event> = [
      {
        title: '投票標題',
        dataIndex: 'title',
        key: 'title',
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
      }
    ];

    // Medium screen columns
    if (screenWidth > 768) {
      baseColumns.push(
        {
          title: '投票日期',
          dataIndex: 'eventDate',
          key: 'eventDate',
          render: (date) => moment(date).format("YYYY-MM-DD HH:mm:ss"),
        },
        {
          title: '會員人數',
          dataIndex: 'memberCount',
          key: 'memberCount',
          responsive: ['md'],
        },
        {
          title: '候選數',
          dataIndex: 'options',
          key: 'candidateCount',
          responsive: ['md'],
          render: (options) => options.length,
        }
      );
    }

    // Ticket tools column
    baseColumns.push({
      title: '票卷工具',
      key: 'ticketTools',
      dataIndex: 'id',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
            size={screenWidth < 768 ? 'small' : 'middle'}
          >
            {screenWidth > 768 ? '列印' : ''}
          </Button>
          <Button 
            icon={<QrcodeOutlined />}
            onClick={() => handleOpenTicketsModal(record)}
            size={screenWidth < 768 ? 'small' : 'middle'}
          >
            {screenWidth > 768 ? '查看票券' : ''}
          </Button>
        </Space>
      ),
    });

    // Actions column
    if (screenWidth > 768) {
      // For larger screens, show all action buttons
      baseColumns.push({
        title: '操作',
        key: 'action',
        dataIndex: 'id',
        render: (_, record) => (
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
                onClick={() => handleExportVoteData(record)}
              >
                下載資料
              </Button>
            )}
            
            {!record.isVotingStarted && !record.isArchived && (
              <Button
                icon={<EditOutlined />}
                onClick={() => handleOpenVoteModal(record)}
              >
                編輯
              </Button>
            )}
            
            {!record.isArchived && (
              <Button
                type={record.isVotingStarted ? "default" : "primary"}
                danger={record.isVotingStarted}
                icon={record.isVotingStarted ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={() => handleToggleVoting(record.id, !record.isVotingStarted)}
              >
                {record.isVotingStarted ? "停止" : "開始"}
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
        ),
      });
    } else {
      // For mobile screens, use a dropdown menu for actions
      baseColumns.push({
        title: '操作',
        key: 'action',
        dataIndex: 'id',
        render: (_, record) => (
          <Dropdown 
            menu={{ items: getActionMenuItems(record) }} 
            trigger={['click']}
          >
            <Button icon={<EllipsisOutlined />} />
          </Dropdown>
        ),
      });
    }

    return baseColumns;
  };

  // Configure responsive layouts for Tickets table
  const ticketColumns: ColumnsType<Ticket> = [
    {
      title: 'QR Code',
      key: 'qrcode',
      dataIndex: 'voteCode',
      responsive: ['md'],
      render: (_, record) => (
        <QRCode
          value={getVoteCodeURL(record.voteCode)}
          size={80}
        />
      )
    },
    {
      title: '票券代碼',
      dataIndex: 'voteCode',
      key: 'voteCode',
    },
    {
      title: '狀態',
      key: 'status',
      dataIndex: 'used',
      render: (_, record) => (
        <Tag color={record.used ? 'red' : 'green'}>
          {record.used ? "已使用" : "未使用"}
        </Tag>
      ),
    },
    {
      title: '使用時間',
      key: 'usedAt',
      dataIndex: 'usedAt',
      responsive: ['md'],
      render: (_, record) => (
        record.usedAt ? moment(record.usedAt).format("YYYY-MM-DD HH:mm") : '-'
      ),
    },
    {
      title: '操作',
      key: 'action',
      dataIndex: 'voteCode',
      render: (_, record) => (
        <Link href={getVoteCodeURL(record.voteCode)} target="_blank">
          連結
        </Link>
      ),
    },
  ];

  return (
    <div>
      <Table 
        columns={getColumns()} 
        dataSource={events}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: 16 }}>
              {screenWidth <= 768 && (
                <>
                  <p><Text type="secondary">投票日期: </Text>{moment(record.eventDate).format("YYYY-MM-DD HH:mm:ss")}</p>
                  <p><Text type="secondary">會員人數: </Text>{record.memberCount}</p>
                  <p><Text type="secondary">候選人數: </Text>{record.options.length}</p>
                </>
              )}
              <p><Text type="secondary">建立時間: </Text>{moment(record.createdAt).format("YYYY-MM-DD HH:mm:ss")}</p>
              <p><Text type="secondary">每人可投票數: </Text>{record.votesPerUser}</p>
              <p><Text type="secondary">應選數: </Text>{record.requiredCount}</p>
              <p><Text type="secondary">備選數: </Text>{record.backupCount}</p>
              <p><Text type="secondary">事件 ID: </Text>{record.id}</p>
              <p><Text type="secondary">候選人: </Text>
                {record.options.map(option => `${option.number} - ${option.text}`).join(', ')}
              </p>
            </div>
          ),
        }}
      />

      {/* Tickets Modal */}
      <Modal
        title={
          <div>
            <div>{selectedEvent?.title} - 票券列表</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              <Space>
                <Tag color="red">已使用票券: {tickets?.filter((ticket) => ticket.used).length}</Tag>
                <Tag color="green">未使用票券: {tickets?.filter((ticket) => !ticket.used).length}</Tag>
                <Tag>總票券數: {tickets.length}</Tag>
              </Space>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={screenWidth < 768 ? '95%' : 1000}
        footer={null}
      >
        <div style={{ marginTop: '20px' }}>
          {tickets && tickets.length > 0 ? (
            <Table
              dataSource={tickets}
              rowKey="id"
              pagination={{ pageSize: screenWidth < 768 ? 5 : 8 }}
              columns={ticketColumns}
              scroll={{ x: 'max-content' }}
              size={screenWidth < 768 ? 'small' : 'middle'}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              無票券資料
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="確認刪除"
        open={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsDeleteModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="delete"
            danger
            type="primary"
            onClick={async () => {
              if (eventToDelete) {
                await handleDeleteEvent(eventToDelete.id);
                setIsDeleteModalOpen(false);
              }
            }}
          >
            確認刪除
          </Button>,
        ]}
      >
        <p>
          確定要刪除事件 "{eventToDelete?.title}" 嗎？此操作無法恢復。
        </p>
      </Modal>

      <CreateVoteModal
        event={selectedEvent || undefined}
        isOpen={isVoteModalOpen}
        onClose={() => {
          setIsVoteModalOpen(false);
          setSelectedEvent(null);
        }}
        onSuccess={refetch}
        mode={selectedEvent ? "edit" : "create"}
      />

      {selectedEvent && (
        <VoteListModal
          isOpen={isVoteListModalOpen}
          onOpenChange={setIsVoteListModalOpen}
          eventId={selectedEvent.id}
        />
      )}
    </div>
  );
});

export default EventList;
