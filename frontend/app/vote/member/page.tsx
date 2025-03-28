"use client";

import { useEffect, useState } from "react";
import { Button, Table, Modal, Form, Input, Select, message, Space, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGroups } from "@/data/queries/groups";
import { useMembers } from "@/data/queries/members";
import { useCreateMember, useUpdateMember, useDeleteMember } from "@/data/mutations/members";
import { useCreateGroup, useUpdateGroup, useDeleteGroup } from "@/data/mutations/groups";
import type { ColumnsType } from "antd/es/table";

const { Title } = Typography;

interface MemberFormData {
  name: string;
  email: string;
  phone?: string;
  group_id: string;
}

interface GroupFormData {
  name: string;
  description?: string;
}

export default function MemberPage() {
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();

  const { data: groups = [], refetch: refetchGroups } = useGroups();
  const { data: members = [], refetch: refetchMembers } = useMembers();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const handleMemberSubmit = async (values: MemberFormData) => {
    try {
      if (selectedMember) {
        await updateMember.mutateAsync({ id: selectedMember.id, ...values });
        message.success("成員更新成功");
      } else {
        await createMember.mutateAsync(values);
        message.success("成員建立成功");
      }
      setIsMemberModalOpen(false);
      form.resetFields();
      refetchMembers();
    } catch (error) {
      message.error("操作失敗，請稍後再試");
    }
  };

  const handleGroupSubmit = async (values: GroupFormData) => {
    try {
      if (selectedGroup) {
        await updateGroup.mutateAsync({ id: selectedGroup.id, ...values });
        message.success("群組更新成功");
      } else {
        await createGroup.mutateAsync(values);
        message.success("群組建立成功");
      }
      setIsGroupModalOpen(false);
      groupForm.resetFields();
      refetchGroups();
    } catch (error) {
      message.error("操作失敗，請稍後再試");
    }
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember.mutateAsync(id);
      message.success("成員刪除成功");
      refetchMembers();
    } catch (error) {
      message.error("刪除失敗，請稍後再試");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteGroup.mutateAsync(id);
      message.success("群組刪除成功");
      refetchGroups();
    } catch (error) {
      message.error("刪除失敗，請稍後再試");
    }
  };

  const memberColumns: ColumnsType<any> = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "電子郵件",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "電話",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "群組",
      dataIndex: "group_id",
      key: "group_id",
      render: (group_id) => {
        const group = groups.find((g) => g.id === group_id);
        return group ? group.name : "-";
      },
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedMember(record);
              form.setFieldsValue(record);
              setIsMemberModalOpen(true);
            }}
          >
            編輯
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteMember(record.id)}
          >
            刪除
          </Button>
        </Space>
      ),
    },
  ];

  const groupColumns: ColumnsType<any> = [
    {
      title: "群組名稱",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedGroup(record);
              groupForm.setFieldsValue(record);
              setIsGroupModalOpen(true);
            }}
          >
            編輯
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteGroup(record.id)}
          >
            刪除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ProtectedRoute requiredPermission="/vote/member">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Title level={2}>群組管理</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedGroup(null);
              groupForm.resetFields();
              setIsGroupModalOpen(true);
            }}
          >
            新增群組
          </Button>
        </div>

        <Table
          columns={groupColumns}
          dataSource={groups}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />

        <div className="flex justify-between items-center mt-8">
          <Title level={2}>成員管理</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedMember(null);
              form.resetFields();
              setIsMemberModalOpen(true);
            }}
          >
            新增成員
          </Button>
        </div>

        <Table
          columns={memberColumns}
          dataSource={members}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />

        <Modal
          title={selectedMember ? "編輯成員" : "新增成員"}
          open={isMemberModalOpen}
          onCancel={() => {
            setIsMemberModalOpen(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleMemberSubmit}
          >
            <Form.Item
              name="name"
              label="姓名"
              rules={[{ required: true, message: "請輸入姓名" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label="電子郵件"
              rules={[
                { required: true, message: "請輸入電子郵件" },
                { type: "email", message: "請輸入有效的電子郵件" },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="電話">
              <Input />
            </Form.Item>
            <Form.Item
              name="group_id"
              label="群組"
              rules={[{ required: true, message: "請選擇群組" }]}
            >
              <Select>
                {groups.map((group) => (
                  <Select.Option key={group.id} value={group.id}>
                    {group.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  確定
                </Button>
                <Button
                  onClick={() => {
                    setIsMemberModalOpen(false);
                    form.resetFields();
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={selectedGroup ? "編輯群組" : "新增群組"}
          open={isGroupModalOpen}
          onCancel={() => {
            setIsGroupModalOpen(false);
            groupForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={groupForm}
            layout="vertical"
            onFinish={handleGroupSubmit}
          >
            <Form.Item
              name="name"
              label="群組名稱"
              rules={[{ required: true, message: "請輸入群組名稱" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  確定
                </Button>
                <Button
                  onClick={() => {
                    setIsGroupModalOpen(false);
                    groupForm.resetFields();
                  }}
                >
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
} 