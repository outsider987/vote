import { useQuery } from "@tanstack/react-query";
import { useGroupsAPI } from "../../api/groups";

export const useGroups = () => {
  const groupsApi = useGroupsAPI();

  return useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const response = await groupsApi.GET_GROUPS();
      return response.data;
    },
  });
}; 