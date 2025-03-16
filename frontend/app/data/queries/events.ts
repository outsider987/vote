import { useQuery } from '@tanstack/react-query';
import { useVote } from '@/app/api/vote';
import type { Event } from '../types';

export const eventsKeys = {
  all: ['events'] as const,
  list: () => [...eventsKeys.all] as const,
  detail: (id: string) => [...eventsKeys.all, id] as const,
};

export const useEvents = () => {
  const { GET_EVENTS } = useVote();

  return useQuery({
    queryKey: eventsKeys.list(),
    queryFn: async () => {
      const response = await GET_EVENTS();
      if (response.status !== 200) {
        throw new Error(response.data.message);
      }
      return response.data as Event[];
    },
  });
}; 