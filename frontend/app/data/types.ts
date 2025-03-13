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