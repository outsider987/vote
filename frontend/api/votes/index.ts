import { toBeFormData } from "../../app/utils/other";
import { getToken, request } from "../../app/utils/request";

export function useVotesAPI() {
  return {
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

    GET_VOTE_COUNTS: (eventId: string) => {
      return request({
        method: "GET",
        url: `/votes/counts/${eventId}`,
      });
    },

    ARCHIVE_VOTE_RESULT: (eventId: string, voteResult: any) => {
      return request({
        method: "POST",
        url: `/votes/archive/${eventId}`,
        headers: {
          Authorization: `Bearer ${getToken()}`,
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
  };
} 