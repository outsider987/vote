import { api } from "../../data/api";

export interface Member {
  id: string;
  name: string;
  email: string;
  phone?: string;
  groupId: string;
  createdAt: string;
}

export interface CreateMemberRequest {
  name: string;
  email: string;
  phone?: string;
  group_id: string;
}

export interface UpdateMemberRequest {
  name?: string;
  email?: string;
  phone?: string;
  group_id?: string;
}

export const useMembersAPI = () => {
  const GET_MEMBERS = async (group_id?: string) => {
    return await api.get<Member[]>("/members", {
      params: { group_id },
    });
  };

  const CREATE_MEMBER = async (data: CreateMemberRequest) => {
    return await api.post<{ message: string; member_id: string }>("/members", data);
  };

  const UPDATE_MEMBER = async (id: string, data: UpdateMemberRequest) => {
    return await api.put<{ message: string }>(`/members/${id}`, data);
  };

  const DELETE_MEMBER = async (id: string) => {
    return await api.delete<{ message: string }>(`/members/${id}`);
  };

  return {
    GET_MEMBERS,
    CREATE_MEMBER,
    UPDATE_MEMBER,
    DELETE_MEMBER,
  };
}; 