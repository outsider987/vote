import { getToken, request } from "../../app/utils/request";

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

export function useMembersAPI() {
  return {
    GET_MEMBERS: (group_id?: string) => {
      return request({
        method: "GET",
        url: "/members",
        params: group_id ? { group_id } : undefined,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    CREATE_MEMBER: (payload: any) => {
      return request({
        method: "POST",
        url: "/members",
        data: payload,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    UPDATE_MEMBER: (id: string, data: any) => {
      return request({
        method: "PUT",
        url: `/members/${id}`,
        data,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    DELETE_MEMBER: (id: string) => {
      return request({
        method: "DELETE",
        url: `/members/${id}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    GET_EXCEL_TEMPLATE: () => {
      return request({
        method: "GET",
        url: "/members/template",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        responseType: "blob",
      });
    },

    UPLOAD_EXCEL: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return request({
        method: "POST",
        url: "/members/upload",
        data: formData,
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });
    },
  };
} 