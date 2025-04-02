"use client";

import { useState } from "react";
import { Button, Table, Modal, Form, message, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGroups } from "@/data/queries/groups";
import {
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from "@/data/mutations/groups";
import { GroupModal } from "../member/components/GroupModal";
import { getGroupColumns } from "../member/components/tableConfigs";
import { Group } from "../member/types";

const { Title } = Typography;

export default function GroupPage() {
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupForm] = Form.useForm();

  const { data: groups = [], refetch: refetchGroups } = useGroups();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const handleGroupSubmit = async (values: any) => {
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

  const handleDeleteGroup = async (id: string) => {
    Modal.confirm({
      title: "確認刪除",
      content: "確定要刪除此群組嗎？",
      okText: "確定",
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteGroup.mutateAsync(id);
          message.success("群組刪除成功");
          refetchGroups();
        } catch (error) {
          message.error("刪除失敗，請稍後再試");
        }
      },
    });
  };

  return (
    <ProtectedRoute requiredPermission="/vote/group">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
        
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
          columns={getGroupColumns(
            (record) => {
              setSelectedGroup(record);
              groupForm.setFieldsValue(record);
              setIsGroupModalOpen(true);
            },
            handleDeleteGroup
          )}
          dataSource={groups}
          rowKey="id"
          scroll={{ x: true }}
          pagination={{ pageSize: 10 }}
        />

        <GroupModal
          isOpen={isGroupModalOpen}
          onClose={() => {
            setIsGroupModalOpen(false);
            groupForm.resetFields();
          }}
          onSubmit={handleGroupSubmit}
          selectedGroup={selectedGroup}
          form={groupForm}
        />
      </div>
    </ProtectedRoute>
  );
} 