import { toBeFormData } from "../utils/other";
import { getToken, request } from "../utils/request";

export function getVoteInfo() {
  return {
    CREATE_EVENT: (payload: any) => {
      return request({
        method: "POST",
        url: "/events",
        data: payload,
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
    POST_VOTE: (param: { vote_code: string; candidate: any; event_id: string }) => {
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
        data: { vote_result: voteResult },
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
  };
}
