import { ColumnsType } from "antd/es/table";
import { Button, Space, Input, Select } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Member, Group, ExcelMemberData } from "../types";

export const getMemberColumns = (
  groups: Group[],
  onEdit: (record: Member) => void,
  onDelete: (id: string) => void
): ColumnsType<Member> => [
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
          onClick={() => onEdit(record)}
        >
          編輯
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(record.id)}
        >
          刪除
        </Button>
      </Space>
    ),
  },
];

export const getGroupColumns = (
  onEdit: (record: Group) => void,
  onDelete: (id: string) => void
): ColumnsType<Group> => [
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
          onClick={() => onEdit(record)}
        >
          編輯
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(record.id)}
        >
          刪除
        </Button>
      </Space>
    ),
  },
];

export const getPreviewColumns = (
  groups: Group[],
  excelData: ExcelMemberData[],
  setExcelData: (data: ExcelMemberData[]) => void
): ColumnsType<ExcelMemberData> => [
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
    dataIndex: "group_id",
    key: "group_id",
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
          const newData = [...excelData];
          newData.splice(index, 1);
          setExcelData(newData);
        }}
      >
        刪除
      </Button>
    ),
  },
]; 