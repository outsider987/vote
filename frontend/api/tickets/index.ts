import { request } from "../../app/utils/request";

export function useTicketsAPI() {
  return {
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
  };
} 