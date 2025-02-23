import { toBeFormData } from "../utils/other";
import { request } from "../utils/request";

export function getVoteInfo() {
  return {
    CREATE_EVENT: (payload: any) => {
      return request({
        method: "POST",
        url: "/events",
        data: payload,
      });
    },
    GENERATE_TICKET: (payload: any) => {
      return request({
        method: "POST",
        url: "/generate-ticket",
        data: payload,
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
      candidate_ids: string[];
    }) => {
      return request({
        method: "POST",
        url: "/votes",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: toBeFormData(param),
      });
    },
    POST_TOGGLE_EVENT_VOTING: (eventId: string, startVoting: boolean) => {
      return request({
        method: "POST",
        url: `/events/${eventId}/toggle-voting?start_voting=${startVoting}`,
      });
    },
  };
}
