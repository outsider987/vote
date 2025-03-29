import { request } from "../../app/utils/request";

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
    return await request({
      method: "GET",
      url: "/members/groups",
    });
  };

  const CREATE_GROUP = async (data: CreateGroupRequest) => {
    return await request({
      method: "POST",
      url: "/members/groups",
      data,
    });
  };

  const UPDATE_GROUP = async (id: string, data: UpdateGroupRequest) => {
    return await request({
      method: "PUT",
      url: `/members/groups/${id}`,
      data,
    });
  };

  const DELETE_GROUP = async (id: string) => {
    return await request({
      method: "DELETE",
      url: `/members/groups/${id}`,
    });
  };

  return {
    GET_GROUPS,
    CREATE_GROUP,
    UPDATE_GROUP,
    DELETE_GROUP,
  };
}; 