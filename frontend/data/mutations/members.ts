import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMembersAPI } from "../../api/members";

export const useCreateMember = () => {
  const queryClient = useQueryClient();
  const membersApi = useMembersAPI();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await membersApi.CREATE_MEMBER(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();
  const membersApi = useMembersAPI();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await membersApi.UPDATE_MEMBER(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
};

export const useDeleteMember = () => {
  const queryClient = useQueryClient();
  const membersApi = useMembersAPI();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await membersApi.DELETE_MEMBER(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}; 