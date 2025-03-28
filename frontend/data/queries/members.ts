import { useQuery } from "@tanstack/react-query";
import { useMembersAPI } from "../../api/members";

export const useMembers = (group_id?: string) => {
  const membersApi = useMembersAPI();

  return useQuery({
    queryKey: ["members", group_id],
    queryFn: async () => {
      const response = await membersApi.GET_MEMBERS(group_id);
      return response.data;
    },
  });
}; 