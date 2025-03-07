"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface VoteState {
  selected: Record<string, Record<number, boolean>>;
  backup: Record<string, Record<number, boolean>>;
}

interface VoteContextType {
  selected: Record<number, boolean>;
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
    selected: {},
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
    setVoteState((prev) => {
      // Copy current candidates for the event (or start with an empty object)
      const eventCandidates = { ...(prev.selected[eventId] || {}) };
  
      if (value === false) {
        // Remove the candidate if value is false
        delete eventCandidates[candidateNumber];
      } else {
        // Otherwise, set the candidate value
        eventCandidates[candidateNumber] = value;
      }
  
      return {
        ...prev,
        selected: {
          ...prev.selected,
          [eventId]: eventCandidates,
        },
      };
    });
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
        selected: currentEventId ? (voteState.selected[currentEventId] || {}) : {},
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