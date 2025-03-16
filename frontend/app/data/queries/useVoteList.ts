import { useQuery } from "@tanstack/react-query";
import type { Vote, VoteListResponse } from "../types";
import axios from "axios";
import { useVote } from "@/app/api/vote";

export const useVoteList = (eventId: string) => {
  const { GET_VOTE_LIST } = useVote();
  return useQuery({
    queryKey: ["votes", eventId],
    queryFn: async () => {
      const response = await GET_VOTE_LIST(eventId);
      return response.data;
    },
    enabled: !!eventId,
  });
};
