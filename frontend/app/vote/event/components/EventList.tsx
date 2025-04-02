"use client";

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { message } from "antd";
import { useRouter } from "next/navigation";
import type { Event } from "../../../../data/types";
import { useEvents } from "../../../../data/queries/events";
import { useTickets } from "../../../../data/queries/tickets";
import { useDeleteEvent, useToggleVoting } from "../../../../data/mutations/events";
import { useVotesAPI } from "../../../../api/votes";
import CreateVoteModal from "./CreateVoteModal";
import VoteListModal from "../../../../components/VoteListModal";
import { EventSearchFilters } from "../types";
import EventHeader from "./EventHeader";
import EventTable from "./EventTable";
import TicketModal from "./TicketModal";
import DeleteModal from "./DeleteModal";
import QRCodePrinter from "./QRCodePrinter";

export interface EventListRef {
  fetchEvents: () => Promise<void>;
}

const EventList = forwardRef<EventListRef>((props, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [printEvent, setPrintEvent] = useState<Event | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [screenWidth, setScreenWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const router = useRouter();

  const [searchFilters, setSearchFilters] = useState<EventSearchFilters>({
    title: "",
    status: "",
  });

  const { 
    data: { data: events = [], total = 0, page = 1, pageSize = 10 }, 
    isLoading, 
    error, 
    filters,
    updateFilters,
    handlePageChange,
    refetch: refetchEvents
  } = useEvents(searchFilters);

  const { data: tickets = [], refetch: refetchTickets } = useTickets(
    selectedEvent?.id
  );
  const deleteMutation = useDeleteEvent();
  const toggleVotingMutation = useToggleVoting();
  const { EXPORT_VOTE_DATA } = useVotesAPI();

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

  useImperativeHandle(ref, () => ({
    fetchEvents: async () => {
      await refetchTickets();
    },
  }));

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteMutation.mutateAsync(eventId);
      message.success("活動已成功刪除");
      refetchEvents();
    } catch (err) {
      message.error("刪除失敗，請稍後再試");
      console.error(err);
    }
  };

  const handleToggleVoting = async (eventId: string, startVoting: boolean) => {
    try {
      await toggleVotingMutation.mutateAsync({ eventId, startVoting });
      message.success(startVoting ? "投票已開始" : "投票已停止");
      refetchEvents();
    } catch (err) {
      console.error("Toggle voting error in handler:", err);
      // Error message will be shown by the mutation's onError handler
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
      const blob = new Blob([response.data], {
        type: response.headers["content-type"],
      });
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

  // When the print button is clicked, set printing state and trigger a refetch.
  const handlePrint = async (event: Event) => {
    setPrintEvent(event);
    setSelectedEvent(event);
    setIsPrinting(true);
    await refetchTickets();
  };

  return (
    <>
      <EventHeader 
        updateFilters={updateFilters} 
        refetchEvents={refetchEvents} 
      />
      
      <EventTable 
        events={events}
        isLoading={isLoading}
        error={error}
        screenWidth={screenWidth}
        filters={filters}
        total={total}
        handlePageChange={handlePageChange}
        onToggleVoting={handleToggleVoting}
        onPrint={handlePrint}
        onOpenTicketsModal={handleOpenTicketsModal}
        onOpenVoteModal={handleOpenVoteModal}
        onExportVoteData={handleExportVoteData}
        setEventToDelete={setEventToDelete}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
      />

      <TicketModal 
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        selectedEvent={selectedEvent}
        tickets={tickets}
        screenWidth={screenWidth}
      />

      <DeleteModal 
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        eventToDelete={eventToDelete}
        onDelete={handleDeleteEvent}
      />

      <QRCodePrinter
        tickets={tickets}
        event={printEvent}
        isPrinting={isPrinting}
        onPrintComplete={() => setIsPrinting(false)}
      />

      <CreateVoteModal
        event={selectedEvent || undefined}
        isOpen={isVoteModalOpen}
        onClose={() => {
          setIsVoteModalOpen(false);
          setSelectedEvent(null);
        }}
        onSuccess={() => {
          refetchEvents();
          refetchTickets();
        }}
        mode={selectedEvent ? "edit" : "create"}
      />

      {selectedEvent && (
        <VoteListModal
          isOpen={isVoteListModalOpen}
          onOpenChange={setIsVoteListModalOpen}
          eventId={selectedEvent.id}
        />
      )}
    </>
  );
});

export default EventList;
