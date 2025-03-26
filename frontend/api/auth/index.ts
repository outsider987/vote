import { toBeFormData } from "../../app/utils/other";
import { request } from "../../app/utils/request";

export function useAuthAPI() {
  return {
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
  };
} 