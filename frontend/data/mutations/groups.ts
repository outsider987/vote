import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGroupsAPI } from "../../api/groups";

export const useCreateGroup = () => {
  const queryClient = useQueryClient();
  const groupsApi = useGroupsAPI();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await groupsApi.CREATE_GROUP(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();
  const groupsApi = useGroupsAPI();

  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await groupsApi.UPDATE_GROUP(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();
  const groupsApi = useGroupsAPI();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await groupsApi.DELETE_GROUP(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
}; 