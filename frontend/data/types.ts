export interface Event {
  id: string;
  title: string;
  eventDate: string;
  createdAt: string;
  isVotingStarted: boolean;
  memberCount: number;
  options: Array<{
    number: number;
    text: string;
  }>;
  requiredCount: number;
  backupCount: number;
  showCount: number;
  votesPerUser: number;
  isArchived: boolean;
  group: {
    id: number;
    name: string;
  };
}

export interface Ticket {
  id: string;
  code: string;
  used: boolean;
  usedAt?: string;
  voteCode: string;
}

export interface ToggleVotingParams {
  eventId: string;
  startVoting: boolean;
}

export interface Vote {
  vote_id: string;
  vote_code: string;
  candidate: {
    text: string;
    number: number;
  };
  created_at: string;
  event: {
    id: string;
    title: string;
  };
  ticket: {
    vote_code: string;
    used: boolean;
  };
}

export interface VoteListResponse {
  votes: Vote[];
} 