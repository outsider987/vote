import { useQuery } from "@tanstack/react-query";
import { useVotesAPI } from "@/api/votes";

export const useVoteList = (eventId: string) => {
  const { GET_VOTE_LIST } = useVotesAPI();
  return useQuery({
    queryKey: ["votes", eventId],
    queryFn: async () => {
      const response = await GET_VOTE_LIST(eventId);
      return response.data;
    },
    enabled: !!eventId,
  });
};
