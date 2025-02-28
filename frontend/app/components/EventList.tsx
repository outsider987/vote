"use client";

import { useState, forwardRef, useImperativeHandle } from "react";
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

export interface EventListRef {
  fetchEvents: () => Promise<void>;
}

const EventList = forwardRef<EventListRef>((props, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const router = useRouter();

  const { data: events = [], error, refetch } = useEvents();
  const { data: tickets = [], refetch: refetchTickets } = useTickets(selectedEvent?.id);
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
    }
  }));

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteMutation.mutateAsync(eventId);
    } catch (err) {
      console.error('刪除失敗，請稍後再試', err);
    }
  };

  const handleToggleVoting = async (eventId: string, startVoting: boolean) => {
    try {
      await toggleVotingMutation.mutateAsync({ eventId, startVoting });
    } catch (err) {
      console.error('操作失敗，請稍後再試', err);
    }
  };

  const handleOpenTicketsModal = async (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
    await refetchTickets();
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded">
        {error instanceof Error ? error.message : '載入失敗，請稍後再試'}
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
                <p>事件 ID: {event.id}</p>
              </div>
              <Button  className="min-h-[80px]" >列印票卷</Button>
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
              <Button
                onClick={() =>
                  handleToggleVoting(event.id, !event.isVotingStarted)
                }
                className=""
                variant={event.isVotingStarted ? "destructive" : "default"}
              >
                {event.isVotingStarted ? "停止投票" : "開始投票"}
              </Button>
              <Button
                onClick={() => handleDeleteEvent(event.id)}
                className=""
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
                        <p className="font-mono text-sm text-gray-900">
                          {ticket.voteCode.length > 12
                            ? `${ticket.voteCode.substring(0, 12)}...`
                            : ticket.voteCode}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              getVoteCodeURL(ticket.voteCode)
                            )
                          }
                        >
                          <Copy className="h-4 w-4 text-blue" />
                        </Button>
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
    </div>
  );
});

export default EventList;
