import { toBeFormData } from "../utils/other";
import { getToken, request } from "../utils/request";

export function useVote() {
  return {
    CREATE_EVENT: (payload: any) => {
      return request({
        method: "POST",
        url: "/events",
        data: {data: payload},
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    TOGGLE_VOTING: (payload: any) => {
      return request({
        method: "POST",
        url: "/toggle-voting",
        data: payload,
      });
    },
    SUBMIT_VOTE: (payload: any) => {
      return request({
        method: "POST",
        url: "/vote",
        data: payload,
      });
    },
    GET_VOTE_INFO: (payload: any) => {
      return request({
        method: "GET",
        url: "/vote-info",
        data: payload,
      });
    },
    GET_EVENTS: () => {
      return request({
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        url: "/events",
      });
    },
    DELETE_EVENT: (id: string) => {
      return request({
        method: "DELETE",
        url: `/events/${id}`,
      });
    },

    GET_TICKETS: (eventId: string) => {
      return request({
        method: "GET",
        url: `/tickets/event/${eventId}/tickets`,
      });
    },
    GET_TICKET_INFO: (eventId: string) => {
      return request({
        method: "GET",
        url: `/tickets/event/${eventId}`,
      });
    },
    GET_TICKET_VOTE_INFO: (voteCode: string) => {
      return request({
        method: "GET",
        url: `/tickets/${voteCode}`,
      });
    },
    POST_VOTE: (param: {
      vote_code: string;
      candidate: any;
      event_id: string;
    }) => {
      return request({
        method: "POST",
        url: "/votes",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },

        data: toBeFormData(param, true),
      });
    },
    POST_TOGGLE_EVENT_VOTING: (eventId: string, startVoting: boolean) => {
      return request({
        method: "POST",
        url: `/events/${eventId}/toggle-voting?start_voting=${startVoting}`,
      });
    },
    GET_VOTE_COUNTS: (eventId: string) => {
      return request({
        method: "GET",
        url: `/votes/counts/${eventId}`,
      });
    },
    LOGIN: (payload: { username: string; password: string }) => {
      return request({
        method: "POST",
        url: "/auth/login",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: toBeFormData(payload),
      });
    },
    GET_EXCEL_TEMPLATE: () => {
      return request({
        method: "GET",
        url: "/events/template",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        responseType: "blob",
      });
    },
    UPLOAD_EXCEL: (payload: any) => {
      return request({
        method: "POST",
        url: "/events/upload",
        data: payload,
      });
    },
    ARCHIVE_VOTE_RESULT: (eventId: string, voteResult: any) => {
      return request({
        method: "POST",
        url: `/votes/archive/${eventId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
          // "Content-Type": "application/x-www-form-urlencoded",
        },
        data: voteResult,
      });
    },
    GET_ARCHIVED_RESULT: (eventId: string) => {
      return request({
        method: "GET",
        url: `/votes/archive/${eventId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
    UPDATE_EVENT: (eventId: string, data: any) => {
      return request({
        method: "PUT",
        url: `/events/${eventId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data,
      });
    },
    GET_VOTE_LIST: (eventId: string) => {
      return request({
        method: "GET",
        url: `/votes/candidates/${eventId}`,
      });
    },
    EXPORT_VOTE_DATA: (eventId: string) => {
      return request({
        method: "GET",
        url: `/votes/export/${eventId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        responseType: "blob",
      });
    },

    // Permission Management API
    GET_PERMISSIONS: () => {
      return request({
        method: "GET",
        url: "/permissions",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
    GET_PERMISSION_TREE: () => {
      return request({
        method: "GET",
        url: "/permissions/tree",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
    CREATE_PERMISSION: (data: {
      name: string;
      code: string;
      description?: string;
      type: string;
      path: string;
      parent_id?: string;
      order?: number;
    }) => {
      return request({
        method: "POST",
        url: "/permissions",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data: data,
      });
    },
    UPDATE_PERMISSION: (
      id: string,
      data: {
        name?: string;
        description?: string;
        type?: string;
        path?: string;
        parent_id?: string;
        order?: number;
      }
    ) => {
      return request({
        method: "PUT",
        url: `/permissions/${id}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data,
      });
    },
    DELETE_PERMISSION: (id: string) => {
      return request({
        method: "DELETE",
        url: `/permissions/${id}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    // Role Management API
    GET_ROLES: () => {
      return request({
        method: "GET",
        url: "/permissions/roles",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
    CREATE_ROLE: (data: {
      name: string;
      description?: string;
      permission_ids?: string[];
    }) => {
      return request({
        method: "POST",
        url: "/permissions/roles",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data: { role: data },
      });
    },
    UPDATE_ROLE: (
      id: string,
      data: { name?: string; description?: string; permission_ids?: string[] }
    ) => {
      return request({
        method: "PUT",
        url: `/permissions/roles/${id}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data:{
          role_update: data
        },
      });
    },
    DELETE_ROLE: (id: string) => {
      return request({
        method: "DELETE",
        url: `/permissions/roles/${id}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },

    // Admin Management API
    GET_ADMINS: () => {
      return request({
        method: "GET",
        url: "/permissions/admins",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
    CREATE_ADMIN: (data: {
      username: string;
      password: string;
      role_id?: string;
    }) => {
      return request({
        method: "POST",
        url: "/permissions/admins",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data:{
          admin: data
        },
      });
    },
    DELETE_ADMIN: (adminId: string) => {
      return request({
        method: "DELETE",
        url: `/permissions/admins/${adminId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
    },
    ASSIGN_ROLE: (
      adminId: string,
      data: {
        admin_id?: string;
        role_id?: string;
        username?: string;
        password?: string;
      }
    ) => {
      return request({
        method: "PUT",
        url: `/permissions/assign/${adminId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        data: { admin_id: data.admin_id, admin_update: data },
      });
    },
  };
}
