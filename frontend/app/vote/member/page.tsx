"use client";

import { useEffect, useState } from "react";
import { Button, Table, Modal, Form, message, Space, Typography } from "antd";
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGroups } from "@/data/queries/groups";
import { useMembers } from "@/data/queries/members";
import {
  useCreateMember,
  useUpdateMember,
  useDeleteMember,
} from "@/data/mutations/members";
import {
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from "@/data/mutations/groups";
import { useMembersAPI } from "@/api/members";
import { MemberModal } from "./components/MemberModal";
import { GroupModal } from "./components/GroupModal";
import { PreviewModal } from "./components/PreviewModal";
import { SearchForm } from "../../../components/SearchForm";
import { getMemberColumns, getGroupColumns } from "./components/tableConfigs";
import { processExcelFile, createExcelFile } from "./utils/excel";
import {
  Member,
  Group,
  ExcelMemberData,
  SearchFilters,
  SearchColumn,
} from "./types";

const { Title } = Typography;

export default function MemberPage() {
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [excelData, setExcelData] = useState<ExcelMemberData[]>([]);
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [previewForm] = Form.useForm();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<SearchFilters>({
    name: "",
    email: "",
    phone: "",
  });

  const { data: groups = [], refetch: refetchGroups } = useGroups();
  const { data: members = [], refetch: refetchMembers } = useMembers(
    selectedGroupId || undefined
  );
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const membersApi = useMembersAPI();

  const searchColumns: SearchColumn[] = [
    {
      name: "name",
      label: "姓名",
      type: "input",
      placeholder: "請輸入姓名",
    },
    {
      name: "email",
      label: "電子郵件",
      type: "input",
      placeholder: "請輸入電子郵件",
    },
    {
      name: "phone",
      label: "電話",
      type: "input",
      placeholder: "請輸入電話",
    },
    {
      name: "group_id",
      label: "群組",
      type: "select",
      placeholder: "選擇群組",
      width: 200,
      options: groups.map((group) => ({
        label: group.name,
        value: group.id,
      })),
      onChange: setSelectedGroupId,
    },
  ];

  const handleMemberSubmit = async (values: any) => {
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

  const handleDeleteMember = async (id: string) => {
    Modal.confirm({
      title: "確認刪除",
      content: "確定要刪除此成員嗎？",
      okText: "確定",
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteMember.mutateAsync(id);
          message.success("成員刪除成功");
          refetchMembers();
        } catch (error) {
          message.error("刪除失敗，請稍後再試");
        }
      },
    });
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

  const handleExcelUpload = async (file: File) => {
    try {
      const data = await processExcelFile(file);
      setExcelData(data);
      setIsPreviewModalOpen(true);
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleBatchSubmit = async (values: any) => {
    try {
      const file = createExcelFile(excelData);
      const response = await membersApi.UPLOAD_EXCEL(file);
      message.success(response.data.message);
      setIsPreviewModalOpen(false);
      setExcelData([]);
      previewForm.resetFields();
      refetchMembers();
    } catch (error) {
      message.error("批次上傳失敗，請稍後再試");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await membersApi.GET_EXCEL_TEMPLATE();
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "member_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      message.error("範本下載失敗，請稍後再試");
    }
  };

  return (
    <ProtectedRoute requiredPermission="/vote/member">
      <div className="space-y-2">
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
          columns={getGroupColumns((record) => {
            setSelectedGroup(record);
            groupForm.setFieldsValue(record);
            setIsGroupModalOpen(true);
          }, handleDeleteGroup)}
          dataSource={groups}
          rowKey="id"
          scroll={{ x: true }}
          pagination={{ pageSize: 10 }}
        />

        <div className="flex justify-between items-center ">
          <Title level={2}>成員管理</Title>
          <Space>
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
          </Space>
        </div>

        <SearchForm
          columns={searchColumns}
          onSearch={(values) =>
            setSearchText({
              name: values.name || "",
              email: values.email || "",
              phone: values.phone || "",
            })
          }
          onReset={() => {
            setSearchText({ name: "", email: "", phone: "" });
            setSelectedGroupId(null);
          }}
        />

        <Table
          columns={getMemberColumns(
            groups,
            (record) => {
              setSelectedMember(record);
              form.setFieldsValue({ ...record, group_id: record.groupId });
              setIsMemberModalOpen(true);
            },
            handleDeleteMember
          )}
          scroll={{ x: true }}
          dataSource={members.filter((member) => {
            const nameMatch =
              !searchText.name ||
              member.name.toLowerCase().includes(searchText.name.toLowerCase());
            const emailMatch =
              !searchText.email ||
              member.email
                .toLowerCase()
                .includes(searchText.email.toLowerCase());
            const phoneMatch =
              !searchText.phone ||
              (member.phone && member.phone.includes(searchText.phone));
            return nameMatch && emailMatch && phoneMatch;
          })}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />

        <MemberModal
          isOpen={isMemberModalOpen}
          onClose={() => {
            setIsMemberModalOpen(false);
            form.resetFields();
          }}
          onSubmit={handleMemberSubmit}
          selectedMember={selectedMember}
          groups={groups}
          form={form}
          onExcelUpload={handleExcelUpload}
          onDownloadTemplate={handleDownloadTemplate}
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

        <PreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => {
            setIsPreviewModalOpen(false);
            setExcelData([]);
            previewForm.resetFields();
          }}
          onSubmit={handleBatchSubmit}
          excelData={excelData}
          setExcelData={setExcelData}
          groups={groups}
          form={previewForm}
        />
      </div>
    </ProtectedRoute>
  );
}
