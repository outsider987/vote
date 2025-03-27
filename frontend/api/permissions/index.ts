import { getToken, request } from "../../app/utils/request";

export function usePermissions() {
  return {
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
          "Content-Type": "application/json",
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
        data,
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
          "Content-Type": "application/json",
        },
        data,
      });
    },
  };
} 