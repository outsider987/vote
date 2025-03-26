import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEventsAPI } from "@/api/events";
import { eventsKeys } from "../queries/events";
import type { ToggleVotingParams } from "../types";
import { useSnackbar } from "notistack";

export const useDeleteEvent = () => {
  const queryClient = useQueryClient();
  const { DELETE_EVENT } = useEventsAPI();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await DELETE_EVENT(eventId);
      if (response.status !== 200) {
        throw new Error(response.data?.message || "操作失敗");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.list() });
      enqueueSnackbar("活動已刪除", { variant: "success" });
    },
  });
};

export const useToggleVoting = () => {
  const queryClient = useQueryClient();
  const { POST_TOGGLE_EVENT_VOTING } = useEventsAPI();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation({
    mutationFn: async ({ eventId, startVoting }: ToggleVotingParams) => {
      try {
        const response = await POST_TOGGLE_EVENT_VOTING(eventId, startVoting);
        if (response.status !== 200) {
          throw new Error(response.data?.message || "操作失敗");
        }
        return response;
      } catch (error) {
        console.error("Toggle voting error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventsKeys.list() });
      enqueueSnackbar("投票狀態已更新", { variant: "success" });
    },
    onError: (error: any) => {
      console.error("Toggle voting mutation error:", error);
      enqueueSnackbar(error.message || "操作失敗，請稍後再試", {
        variant: "error",
      });
    },
  });
};
