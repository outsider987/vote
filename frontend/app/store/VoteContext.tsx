"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface VoteState {
  elected: Record<string, Record<number, boolean>>;
  backup: Record<string, Record<number, boolean>>;
}

interface VoteContextType {
  elected: Record<number, boolean>;
  backup: Record<number, boolean>;
  setElected: (eventId: string, candidateNumber: number, value: boolean) => void;
  setBackup: (eventId: string, candidateNumber: number, value: boolean) => void;
  currentEventId: string | null;
  setCurrentEventId: (eventId: string | null) => void;
}

const VoteContext = createContext<VoteContextType | null>(null);

export function useVoteContext() {
  const context = useContext(VoteContext);
  if (!context) {
    throw new Error("useVoteContext must be used within a VoteProvider");
  }
  return context;
}

export function VoteProvider({ children }: { children: React.ReactNode }) {
  const [voteState, setVoteState] = useState<VoteState>({
    elected: {},
    backup: {},
  });
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem("voteState");
    if (savedState) {
      setVoteState(JSON.parse(savedState));
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("voteState", JSON.stringify(voteState));
  }, [voteState]);

  const setElected = (eventId: string, candidateNumber: number, value: boolean) => {
    setVoteState((prev) => ({
      ...prev,
      elected: {
        ...prev.elected,
        [eventId]: {
          ...(prev.elected[eventId] || {}),
          [candidateNumber]: value,
        },
      },
    }));
  };

  const setBackup = (eventId: string, candidateNumber: number, value: boolean) => {
    setVoteState((prev) => ({
      ...prev,
      backup: {
        ...prev.backup,
        [eventId]: {
          ...(prev.backup[eventId] || {}),
          [candidateNumber]: value,
        },
      },
    }));
  };

  return (
    <VoteContext.Provider
      value={{
        elected: currentEventId ? (voteState.elected[currentEventId] || {}) : {},
        backup: currentEventId ? (voteState.backup[currentEventId] || {}) : {},
        setElected,
        setBackup,
        currentEventId,
        setCurrentEventId,
      }}
    >
      {children}
    </VoteContext.Provider>
  );
} 