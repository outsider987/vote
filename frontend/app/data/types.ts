export interface Event {
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