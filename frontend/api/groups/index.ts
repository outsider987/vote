import { api } from "../../data/api";

export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
}

export const useGroupsAPI = () => {
  const GET_GROUPS = async () => {
    return await api.get<Group[]>("/members/groups");
  };

  const CREATE_GROUP = async (data: CreateGroupRequest) => {
    return await api.post<{ message: string; group_id: string }>("/members/groups", data);
  };

  const UPDATE_GROUP = async (id: string, data: UpdateGroupRequest) => {
    return await api.put<{ message: string }>(`/members/groups/${id}`, data);
  };

  const DELETE_GROUP = async (id: string) => {
    return await api.delete<{ message: string }>(`/members/groups/${id}`);
  };

  return {
    GET_GROUPS,
    CREATE_GROUP,
    UPDATE_GROUP,
    DELETE_GROUP,
  };
}; 