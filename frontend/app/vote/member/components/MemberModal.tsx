import { Modal, Form, Input, Select, Button, Space, Upload } from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { MemberFormData, Group } from "../types";

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: MemberFormData) => Promise<void>;
  selectedMember: any;
  groups: Group[];
  form: any;
  onExcelUpload: (file: File) => Promise<boolean>;
  onDownloadTemplate: () => void;
}

export const MemberModal = ({
  isOpen,
  onClose,
  onSubmit,
  selectedMember,
  groups,
  form,
  onExcelUpload,
  onDownloadTemplate,
}: MemberModalProps) => {
  return (
    <Modal
      title={selectedMember ? "編輯成員" : "新增成員"}
      open={isOpen}
      onCancel={() => {
        onClose();
        form.resetFields();
      }}
      footer={null}
      width={800}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        {!selectedMember && (
          <Form.Item label="Excel 上傳">
            <div className="flex gap-2">
              <Button
                icon={<DownloadOutlined />}
                onClick={onDownloadTemplate}
              >
                下載範本
              </Button>
              <Upload
                beforeUpload={onExcelUpload}
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
                onClose();
                form.resetFields();
              }}
            >
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}; 