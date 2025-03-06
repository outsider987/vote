"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import moment from "moment";
import QRCode from "react-qr-code";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Event } from "../data/types";
import { useEvents } from "../data/queries/events";
import { useTickets } from "../data/queries/tickets";
import { useDeleteEvent, useToggleVoting } from "../data/mutations/events";
import ReactDOM from "react-dom/client";
import Link from "next/link";
import CreateVoteModal from "./CreateVoteModal";

export interface EventListRef {
  fetchEvents: () => Promise<void>;
}

const EventList = forwardRef<EventListRef>((props, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  // States for printing
  const [printEvent, setPrintEvent] = useState<Event | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const router = useRouter();

  const { data: events = [], error, refetch } = useEvents();
  // Note: useTickets depends on selectedEvent?.id so it updates when selectedEvent changes.
  const { data: tickets = [], refetch: refetchTickets } = useTickets(
    selectedEvent?.id
  );
  const deleteMutation = useDeleteEvent();
  const toggleVotingMutation = useToggleVoting();

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
    } catch (err) {
      console.error("刪除失敗，請稍後再試", err);
    }
  };

  const handleToggleVoting = async (eventId: string, startVoting: boolean) => {
    try {
      await toggleVotingMutation.mutateAsync({ eventId, startVoting });
    } catch (err) {
      console.error("操作失敗，請稍後再試", err);
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
            alert("目前沒有票券可列印");
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

  return (
    <div className="space-y-4">
   
      <div className="space-y-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="p-4 border border-solid rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start gpa-2">
              <h3 className="text-xl font-semibold mb-2">{event.title}</h3>
              <Button
                onClick={() => handleOpenTicketsModal(event)}
                variant="secondary"
              >
                查看票券
              </Button>
            </div>

            <div className="flex justify-between gap-2">
              <div className="text-sm text-gray-300">
                <p>
                  投票日期:{" "}
                  {moment(event.eventDate).format("YYYY-MM-DD HH:mm:ss")}
                </p>
                <p>
                  建立時間:{" "}
                  {moment(event.createdAt).format("YYYY-MM-DD HH:mm:ss")}
                </p>
                <p>會員人數: {event.memberCount}</p>
                <p>每人可投票數: {event.votesPerUser}</p>
                <p>候選人數: {event.options.length}</p>
                <p>應選數: {event.requiredCount}</p>
                <p>備選數: {event.backupCount}</p>
                <p>事件 ID: {event.id}</p>
              </div>
              <Button
                className="min-h-[80px]"
                onClick={() => handlePrint(event)}
                type="button"
              >
                列印票卷
              </Button>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                onClick={() =>
                  router.push(`/client/live-vote-count?eventId=${event.id}`)
                }
              >
                查看投票結果
              </Button>
              {!event.isVotingStarted && (
                <Button
                  variant="secondary"
                  onClick={() => handleOpenVoteModal(event)}
                >
                  編輯
                </Button>
              )}
              <Button
                onClick={() =>
                  handleToggleVoting(event.id, !event.isVotingStarted)
                }
                variant={event.isVotingStarted ? "destructive" : "default"}
              >
                {event.isVotingStarted ? "停止投票" : "開始投票"}
              </Button>
              <Button
                onClick={() => handleDeleteEvent(event.id)}
                variant="destructive"
              >
                刪除
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title} - 票券列表</DialogTitle>
            <div className="flex gap-4 mt-2 text-sm text-gray-500">
              <p className="text-red">
                已使用票券: {tickets?.filter((ticket) => ticket.used).length}
              </p>
              <p className="text-green">
                未使用票券: {tickets?.filter((ticket) => !ticket.used).length}
              </p>
              <p className="text-gray-100">總票券數: {tickets.length}</p>
            </div>
          </DialogHeader>
          <div className="mt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tickets && tickets.length > 0 ? (
                tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-4 border rounded ${
                      ticket.used ? "bg-gray-100" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <QRCode
                        value={getVoteCodeURL(ticket.voteCode)}
                        size={128}
                        className="mb-2"
                      />
                      <div className="flex items-center gap-2">
                        <p className=" w-1/2 font-mono text-sm text-gray-900">
                          {ticket.voteCode.length > 12
                            ? `${ticket.voteCode.substring(0, 12)}...`
                            : ticket.voteCode}
                        </p>
                        <Link
                          className="w-1/2 bg-blue text-center text-white text-xs rounded-full p-1"
                          // onClick={() =>
                          //   window.open(
                          //     getVoteCodeURL(ticket.voteCode),
                          //     "_blank"
                          //   )
                          // }
                          target="_blank"
                          href={getVoteCodeURL(ticket.voteCode)}
                        >
                          連結
                        </Link>
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          ticket.used ? "text-red" : "text-green"
                        }`}
                      >
                        {ticket.used ? "已使用" : "未使用"}
                      </p>
                      {ticket.usedAt && (
                        <p className="text-xs text-gray-400">
                          使用時間:{" "}
                          {moment(ticket.usedAt).format("YYYY-MM-DD HH:mm")}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-500">
                  無票券資料
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateVoteModal
        event={selectedEvent || undefined}
        isOpen={isVoteModalOpen}
        onClose={() => {
          setIsVoteModalOpen(false);
          setSelectedEvent(null);
        }}
        onSuccess={refetch}
        mode={selectedEvent ? 'edit' : 'create'}
      />
    </div>
  );
});

export default EventList;
