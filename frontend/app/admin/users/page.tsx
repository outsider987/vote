"use client";

import { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Space, message, Select, Tag } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useVote } from "../../api/vote";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from "@/app/store/Auth";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface Admin {
  id: string;
  username: string;
  role: Role | null;
}

export default function UsersPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { userId } = useAuth();
  const api = useVote();

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await api.GET_ADMINS();
      if (response.status === 200) {
        setAdmins(response.data);
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
      message.error("管理員資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.GET_ROLES();
      if (response.status === 200) {
        setRoles(response.data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      message.error("角色資料載入失敗");
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchRoles();
  }, []);

  const handleEdit = (record: Admin) => {
    form.setFieldsValue({
      username: record.username,
      role_id: record.role?.id || undefined,
      password: "", // Clear password field
    });
    setEditingId(record.id);
    setIsModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingId) {
        // Only send values that have been changed
        const dataToUpdate: any = {};
        
        if (values.username) {
          dataToUpdate.username = values.username;
        }
        
        if (values.password) {
          dataToUpdate.password = values.password;
        }
        
        if (values.role_id !== undefined) {
          dataToUpdate.role_id = values.role_id;
        }
        if (userId) {
          dataToUpdate.admin_id = userId;
        }
        const response = await api.ASSIGN_ROLE(editingId, dataToUpdate);
        
        if (response.status === 200) {
          message.success("管理員更新成功");
          setIsModalVisible(false);
          fetchAdmins();
        }
      }
    } catch (error) {
      console.error("Error updating admin:", error);
      message.error("操作失敗，請檢查表單內容");
    }
  };

  const columns = [
    {
      title: '使用者名稱',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: Role | null) => (
        role ? <Tag color="blue">{role.name}</Tag> : <Tag color="red">未分配</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Admin) => (
        <Button 
          icon={<EditOutlined />} 
          onClick={() => handleEdit(record)}
        >
          編輯
        </Button>
      ),
    },
  ];

  return (
    <ProtectedRoute requiredPermission="/admin/users">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">使用者管理</h1>
        </div>

        <Table
          columns={columns}
          dataSource={admins}
          rowKey="id"
          loading={loading}
        />

        <Modal
          title="編輯使用者"
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          onOk={handleSubmit}
          okText="更新"
          cancelText="取消"
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="username"
              label="使用者名稱"
              rules={[{ required: true, message: '請輸入使用者名稱' }]}
            >
              <Input placeholder="請輸入使用者名稱" />
            </Form.Item>
            
            <Form.Item
              name="password"
              label="密碼"
              extra="如果不需要更改密碼，請留空"
            >
              <Input.Password placeholder="請輸入新密碼" />
            </Form.Item>
            
            <Form.Item
              name="role_id"
              label="角色"
            >
              <Select
                placeholder="請選擇角色"
                allowClear
                style={{ width: '100%' }}
              >
                {roles.map(role => (
                  <Select.Option key={role.id} value={role.id}>
                    {role.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
} 