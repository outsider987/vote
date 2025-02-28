import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getVoteInfo } from '@/app/api/vote';
import { eventsKeys } from '../queries/events';
import type { ToggleVotingParams } from '../types';

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  const { DELETE_EVENT } = getVoteInfo();

  return useMutation({
    mutationFn: (eventId: string) => DELETE_EVENT(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
};

export const useToggleVoting = () => {
  const queryClient = useQueryClient();
  const { POST_TOGGLE_EVENT_VOTING } = getVoteInfo();

  return useMutation({
    mutationFn: ({ eventId, startVoting }: ToggleVotingParams) =>
      POST_TOGGLE_EVENT_VOTING(eventId, startVoting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.all });
    },
  });
}; 