import { getToken, request } from "../../app/utils/request";

export function useEventsAPI() {
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

    POST_TOGGLE_EVENT_VOTING: (eventId: string, startVoting: boolean) => {
      return request({
        method: "POST",
        url: `/events/${eventId}/toggle-voting?start_voting=${startVoting}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
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
  };
} 