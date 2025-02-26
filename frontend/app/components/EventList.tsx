"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { getVoteInfo } from "@/app/api/vote";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import moment from "moment";
import QRCode from "react-qr-code";
import { Copy } from "lucide-react";

interface Event {
  id: string;
  title: string;
  eventDate: string;
  createdAt: string;
  isVotingStarted: boolean;
  memberCount: number;
  options: string[];
  showCount: number;
  votesPerUser: number;
}

interface Ticket {
  id: string;
  code: string;
  used: boolean;
  usedAt?: string;
  voteCode: string;
}

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const initialFetchDone = useRef(false);

  const { GET_EVENTS, DELETE_EVENT, GET_TICKETS, POST_TOGGLE_EVENT_VOTING } =
    getVoteInfo();

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (initialFetchDone.current) return;

      try {
        const response = await GET_EVENTS();
        const data = response.data;

        if (!mounted) return;

        if (response.status !== 200) {
          setError(data.message);
          return;
        }

        setEvents(data);
        setError("");
        initialFetchDone.current = true;
        console.log("data", data);
      } catch (err) {
        if (!mounted) return;
        setError(`載入失敗，請稍後再試: ${err}`);
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await DELETE_EVENT(eventId);
      if (response.status !== 200) {
        setError(response.data.message);
        return;
      }

      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    } catch (err) {
      setError("刪除失敗，請稍後再試");
    }
  };

  const getVoteCodeURL = (voteCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/vote?vote_code=${voteCode}`;
    }
    return `/vote?vote_code=${voteCode}`;
  };

  const handleToggleVoting = async (eventId: string, startVoting: boolean) => {
    try {
      const response = await POST_TOGGLE_EVENT_VOTING(eventId, startVoting);
      const data = response.data;

      if (response.status !== 200) {
        setError(data.message);
        return;
      }

      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? { ...event, isVotingStarted: startVoting }
            : event
        )
      );
      setError("");
    } catch (err) {
      setError("操作失敗，請稍後再試");
    }
  };

  const fetchTickets = async (eventId: string) => {
    try {
      const response = await GET_TICKETS(eventId);
      if (response.status === 200) {
        setTickets(response.data);
      } else {
        setError("無法載入票券資訊");
      }
    } catch (err) {
      setError("載入票券失敗，請稍後再試");
    }
  };

  const handleOpenTicketsModal = async (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
    await fetchTickets(event.id);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded">{error}</div>
      )}

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

            <div className="text-sm text-gray-300">
              <p>投票日期: {moment(event.eventDate).format("YYYY-MM-DD")}</p>
              <p>建立時間: {moment(event.createdAt).format("YYYY-MM-DD")}</p>
              <p>會員人數: {event.memberCount}</p>
              <p>每人可投票數: {event.votesPerUser}</p>
              <p>候選人數: {event.options.length}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() =>
                  handleToggleVoting(event.id, !event.isVotingStarted)
                }
                className="mt-2"
                variant={event.isVotingStarted ? "destructive" : "default"}
              >
                {event.isVotingStarted ? "停止投票" : "開始投票"}
              </Button>
              <Button
                onClick={() => handleDeleteEvent(event.id)}
                className="mt-2"
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
            <div className="grid grid-cols-3 gap-4">
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
}
