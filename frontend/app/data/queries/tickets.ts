import { useQuery } from '@tanstack/react-query';
import { getVoteInfo } from '@/app/api/vote';
import type { Ticket } from '../types';

export const ticketsKeys = {
  all: ['tickets'] as const,
  list: (eventId: string | undefined) => [...ticketsKeys.all, eventId] as const,
};

export const useTickets = (eventId: string | undefined) => {
  const { GET_TICKETS } = getVoteInfo();

  return useQuery({
    queryKey: ticketsKeys.list(eventId),
    queryFn: async () => {
      if (!eventId) return [];
      const response = await GET_TICKETS(eventId);
      if (response.status !== 200) {
        throw new Error('無法載入票券資訊');
      }
      return response.data as Ticket[];
    },
    enabled: !!eventId,
  });
}; 