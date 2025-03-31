"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Typography,
  Upload,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
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
import type { ColumnsType } from "antd/es/table";
import * as XLSX from "xlsx";
import { useMembersAPI } from "@/api/members";

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

interface ExcelMemberData {
  name: string;
  email: string;
  phone?: string;
  group_id: number;
}

export default function MemberPage() {
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [excelData, setExcelData] = useState<ExcelMemberData[]>([]);
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [previewForm] = Form.useForm();

  const { data: groups = [], refetch: refetchGroups } = useGroups();
  const { data: members = [], refetch: refetchMembers } = useMembers();
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const membersApi = useMembersAPI();

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
    Modal.confirm({
      title: '確認刪除',
      content: '確定要刪除此成員嗎？',
      okText: '確定',
      cancelText: '取消',
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
      title: '確認刪除',
      content: '確定要刪除此群組嗎？',
      okText: '確定',
      cancelText: '取消',
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
      // Validate Excel format
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(
            worksheet
          ) as ExcelMemberData[];

          // Validate data
          const requiredFields = ["name", "email", "group_id"];
          const missingFields = requiredFields.filter(
            (field) => !jsonData[0] || !(field in jsonData[0])
          );
          if (missingFields.length > 0) {
            message.error(
              `Excel 檔案缺少必要欄位: ${missingFields.join(", ")}`
            );
            return false;
          }

          // Set preview data and show modal
          setExcelData(
            jsonData
              .filter((item) => item.group_id)
              .map((item) => ({ ...item, group_id: Number(item.group_id) }))
          );
          setIsPreviewModalOpen(true);
          return false; // Prevent default upload behavior
        } catch (error) {
          message.error("Excel 檔案上傳失敗，請確認格式是否正確");
          return false;
        }
      };

      reader.onerror = () => {
        message.error("Excel 檔案讀取失敗");
        return false;
      };

      reader.readAsArrayBuffer(file);
      return false;
    } catch (error) {
      message.error("Excel 檔案處理失敗");
      return false;
    }
  };

  const handleBatchSubmit = async (values: any) => {
    try {
      // Convert the data back to Excel format
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      // Convert to blob
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Create a File object
      const file = new File([blob], "members.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Upload the file
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
      dataIndex: "groupId",
      key: "groupId",
      render: (groupId) => {
        const group = groups.find((g) => g.id === groupId);
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
              form.setFieldsValue({...record, group_id: record.groupId});
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

  const previewColumns: ColumnsType<ExcelMemberData> = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => {
            const newData = [...excelData];
            newData[index] = { ...newData[index], name: e.target.value };
            setExcelData(newData);
          }}
        />
      ),
    },
    {
      title: "電子郵件",
      dataIndex: "email",
      key: "email",
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => {
            const newData = [...excelData];
            newData[index] = { ...newData[index], email: e.target.value };
            setExcelData(newData);
          }}
        />
      ),
    },
    {
      title: "電話",
      dataIndex: "phone",
      key: "phone",
      render: (text, record, index) => (
        <Input
          value={text}
          onChange={(e) => {
            const newData = [...excelData];
            newData[index] = { ...newData[index], phone: e.target.value };
            setExcelData(newData);
          }}
        />
      ),
    },
    {
      title: "群組",
      dataIndex: "groupId",
      key: "groupId",
      render: (text, record, index) => (
        <Select
          value={text}
          style={{ width: "100%" }}
          onChange={(value) => {
            const newData = [...excelData];
            newData[index] = { ...newData[index], group_id: Number(value) };
            setExcelData(newData);
          }}
          placeholder="請選擇群組"
        >
          {groups.length > 0 ? (
            groups.map((group) => (
              <Select.Option key={group.id} value={group.id}>
                {group.name} (ID: {group.id})
              </Select.Option>
            ))
          ) : (
            <Select.Option disabled>目前沒有可用的群組</Select.Option>
          )}
        </Select>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record, index) => (
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => {
            Modal.confirm({
              title: '確認刪除',
              content: '確定要刪除此成員嗎？',
              okText: '確定',
              cancelText: '取消',
              onOk: () => {
                const newData = [...excelData];
                newData.splice(index, 1);
                setExcelData(newData);
              },
            });
          }}
        >
          刪除
        </Button>
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
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
            >
              下載範本
            </Button>
            <Upload
              beforeUpload={handleExcelUpload}
              accept=".xlsx,.xls"
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>上傳 Excel</Button>
            </Upload>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedMember(null);
                form.resetFields();
                setIsPreviewModalOpen(true);
              }}
            >
              新增成員
            </Button>
          </Space>
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
          width={800}
        >
          <Form form={form} layout="vertical" onFinish={handleMemberSubmit}>
            {!selectedMember && (
              <Form.Item label="Excel 上傳">
                <div className="flex gap-2">
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadTemplate}
                  >
                    下載範本
                  </Button>
                  <Upload
                    beforeUpload={handleExcelUpload}
                    accept=".xlsx,.xls"
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />}>上傳 Excel</Button>
                  </Upload>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  請先下載範本，填寫後再上傳
                </div>
              </Form.Item>
            )}

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
          <Form form={groupForm} layout="vertical" onFinish={handleGroupSubmit}>
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

        <Modal
          title="預覽 Excel 資料"
          open={isPreviewModalOpen}
          onCancel={() => {
            setIsPreviewModalOpen(false);
            setExcelData([]);
            previewForm.resetFields();
          }}
          width={1000}
          footer={null}
        >
          <Form
            form={previewForm}
            layout="vertical"
            onFinish={handleBatchSubmit}
          >
            <div className="mb-4">
              <div className="flex justify-between items-center mb-4">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setExcelData([
                      ...excelData,
                      {
                        name: "",
                        email: "",
                        phone: "",
                        group_id: groups[0]?.id || "",
                      },
                    ]);
                  }}
                >
                  新增成員
                </Button>
              </div>
              <Table
                columns={previewColumns}
                dataSource={excelData}
                rowKey={(_, index) => index}
                pagination={{ pageSize: 10 }}
              />
            </div>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  確認上傳
                </Button>
                <Button
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setExcelData([]);
                    previewForm.resetFields();
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
