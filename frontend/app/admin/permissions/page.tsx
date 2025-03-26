"use client";

import { useState, useEffect } from "react";
import { Table, Button, Modal, Form, Input, Space, message, Popconfirm, Select, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { usePermissions } from "../../../api/permissions";
import ProtectedRoute from "../../../components/ProtectedRoute";

interface Permission {
  id: string;
  name: string;
  code: string;
  description: string | null;
  type: string;
  path: string;
  parent_id: string | null;
  order: number;
  children?: Permission[];
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const api = usePermissions();

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.GET_PERMISSION_TREE();
      if (response.status === 200) {
        setPermissions(response.data);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
      message.error("權限資料載入失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleCreate = (row?: Permission) => {
    form.resetFields();
    form.setFieldValue('parent_id', row?.id);
    form.setFieldValue('name', row?.name);
    form.setFieldValue('type', row?.type);
    form.setFieldValue('path', row?.path);
    setEditingId(null);
    setIsModalVisible(true);
  };

  const handleEdit = (record: Permission) => {
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      description: record.description,
      type: record.type,
      path: record.path,
      parent_id: record.parent_id,
      order: record.order
    });
    setEditingId(record.id);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await api.DELETE_PERMISSION(id);
      if (response.status === 200) {
        message.success("權限刪除成功");
        fetchPermissions();
      }
    } catch (error) {
      console.error("Error deleting permission:", error);
      message.error("權限刪除失敗");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingId) {
        const response = await api.UPDATE_PERMISSION(editingId, values);
        if (response.status === 200) {
          message.success("權限更新成功");
          setIsModalVisible(false);
          fetchPermissions();
        }
      } else {
        const response = await api.CREATE_PERMISSION(values);
        if (response.status === 200) {
          message.success("權限建立成功");
          setIsModalVisible(false);
          fetchPermissions();
        }
      }
    } catch (error) {
      console.error("Error submitting permission:", error);
      message.error("操作失敗，請檢查表單內容");
    }
  };

  const columns = [
    {
      title: '權限名稱',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Permission) => (
        <Space>
          {record.children ? '📁' : '📄'} {text}
        </Space>
      ),
    },
   
    {
      title: '路徑',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '類型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'ui' ? 'blue' : 'green'}>
          {type === 'ui' ? '頁面權限' : 'API權限'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      sorter: (a: Permission, b: Permission) => a.order - b.order,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Permission) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<PlusOutlined />}
            onClick={() => handleCreate(record)}
          >
            新增子權限
          </Button>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            編輯
          </Button>
          <Popconfirm
            title="確定要刪除此權限嗎？"
            onConfirm={() => handleDelete(record.id)}
            okText="確定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              刪除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute requiredPermission="/">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">權限管理</h1>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleCreate()}
          >
            新增權限
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="id"
          loading={loading}
          expandable={{
            childrenColumnName: 'children',
            defaultExpandAllRows: true,
            expandRowByClick: true,
          }}
        />

        <Modal
          title={editingId ? "編輯權限" : "新增權限"}
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
              label="權限名稱"
              rules={[{ required: true, message: '請輸入權限名稱' }]}
            >
              <Input placeholder="例如：查看使用者" />
            </Form.Item>
            
           

            <Form.Item
              name="path"
              label="路徑"
              rules={[{ required: true, message: '請輸入路徑' }]}
            >
              <Input placeholder="例如：admin/roles" />
            </Form.Item>
            
            <Form.Item
              name="type"
              label="權限類型"
              rules={[{ required: true, message: '請選擇權限類型' }]}
            >
              <Select placeholder="請選擇權限類型">
                <Select.Option value="ui">頁面權限</Select.Option>
                <Select.Option value="api">API權限</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="parent_id"
              label="父級權限"
            >
              <Select
                placeholder="請選擇父級權限"
                allowClear
                options={permissions.map(p => ({
                  label: p.name,
                  value: p.id
                }))}
              />
            </Form.Item>

            <Form.Item
              name="order"
              label="排序"
            >
              <Input type="number" placeholder="請輸入排序數字" />
            </Form.Item>
            
            <Form.Item
              name="description"
              label="權限描述"
            >
              <Input.TextArea placeholder="請輸入權限描述" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
} 