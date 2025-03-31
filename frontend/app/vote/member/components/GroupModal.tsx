import { Modal, Form, Input, Button, Space } from "antd";
import { GroupFormData } from "../types";

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: GroupFormData) => Promise<void>;
  selectedGroup: any;
  form: any;
}

export const GroupModal = ({
  isOpen,
  onClose,
  onSubmit,
  selectedGroup,
  form,
}: GroupModalProps) => {
  return (
    <Modal
      title={selectedGroup ? "編輯群組" : "新增群組"}
      open={isOpen}
      onCancel={() => {
        onClose();
        form.resetFields();
      }}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
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