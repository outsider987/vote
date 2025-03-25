"use client";

import { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Tree, Tag } from "antd";
import type { TreeDataNode, TreeProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useVote } from "../../api/vote";
import ProtectedRoute from "../../components/ProtectedRoute";

interface PermissionTree {
  id: string;
  name: string;
  description: string | null;
  type: string;
  path: string;
  parent_id: string | null;
  order: number;
  children?: PermissionTree[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionTree[];
  created_at: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionTree[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const api = useVote();

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await api.GET_ROLES();
      if (response.status === 200) {
        setRoles(response.data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      message.error("角色資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await api.GET_PERMISSION_TREE();
      if (response.status === 200) {
        setPermissions(response.data);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      message.error("權限資料載入失敗");
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const handleCreate = () => {
    form.resetFields();
    setEditingId(null);
    setIsModalVisible(true);
  };

  const handleEdit = (record: Role) => {
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      permission_ids: record.permissions.map(p => p.id),
    });
    setCheckedKeys(record.permissions.map(p => p.id));
    setEditingId(record.id);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await api.DELETE_ROLE(id);
      if (response.status === 200) {
        message.success("角色刪除成功");
        fetchRoles();
      }
    } catch (error) {
      console.error("Error deleting role:", error);
      message.error("角色刪除失敗");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingId) {
        // Update existing role
        const response = await api.UPDATE_ROLE(editingId, {
          
          name: values.name,
          description: values.description,
          permission_ids: values.permission_ids,
        });
        
        if (response.status === 200) {
          message.success("角色更新成功");
          setIsModalVisible(false);
          fetchRoles();
        }
      } else {
        // Create new role
        const response = await api.CREATE_ROLE({
          name: values.name,
          description: values.description,
          permission_ids: values.permission_ids,
        });
        
        if (response.status === 200) {
          message.success("角色建立成功");
          setIsModalVisible(false);
          fetchRoles();
        }
      }
    } catch (error) {
      console.error("Error submitting role:", error);
      message.error("操作失敗，請檢查表單內容");
    }
  };

  const transformToTreeData = (permissions: PermissionTree[]): TreeDataNode[] => {
    return permissions.map(permission => ({
      key: permission.id,
      title: (
        <div>
          <div>{permission.name}</div>
          {permission.description && (
            <div style={{ fontSize: '12px', color: '#888' }}>
              {permission.description}
            </div>
          )}
        </div>
      ),
      disabled: false,
      children: permission.children ? transformToTreeData(permission.children) : undefined
    }));
  };

  const onCheck: TreeProps['onCheck'] = (checkedKeys, info) => {
    setCheckedKeys(checkedKeys as React.Key[]);
    form.setFieldValue('permission_ids', checkedKeys);
  };

  const columns = [
    {
      title: '角色名稱',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: '權限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: PermissionTree[]) => (
        <div style={{ maxWidth: '400px', overflowX: 'auto' }}>
          {permissions?.length > 0 ? (
            <Space wrap>
              {permissions.map(perm => (
                <Tag color="blue" key={perm.id}>{perm.name}</Tag>
              ))}
            </Space>
          ) : (
            <span>無權限</span>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Role) => (
        <Space size="middle">
          <Button 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            編輯
          </Button>
          <Popconfirm
            title="確定要刪除此角色嗎？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute requiredPermission="/admin/roles">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">角色管理</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新增角色
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
        />

        <Modal
          title={editingId ? "編輯角色" : "新增角色"}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          onOk={handleSubmit}
          okText={editingId ? "更新" : "創建"}
          cancelText="取消"
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="name"
              label="角色名稱"
              rules={[{ required: true, message: '請輸入角色名稱' }]}
            >
              <Input placeholder="例如：管理員" />
            </Form.Item>
            
            <Form.Item
              name="description"
              label="角色描述"
            >
              <Input.TextArea placeholder="請輸入角色描述" />
            </Form.Item>
            
            <Form.Item
              name="permission_ids"
              label="權限"
              rules={[{ required: true, message: '請選擇至少一個權限' }]}
            >
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                <Tree
                  checkable
                  treeData={transformToTreeData(permissions)}
                  checkedKeys={checkedKeys}
                  onCheck={onCheck}
                  defaultExpandAll
                />
              </div>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
} 