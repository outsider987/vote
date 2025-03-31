import { Modal, Form, Button, Space, Table } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ExcelMemberData, Group } from "../types";
import { getPreviewColumns } from "@/app/vote/member/components/tableConfigs";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
  excelData: ExcelMemberData[];
  setExcelData: (data: ExcelMemberData[]) => void;
  groups: Group[];
  form: any;
}

export const PreviewModal = ({
  isOpen,
  onClose,
  onSubmit,
  excelData,
  setExcelData,
  groups,
  form,
}: PreviewModalProps) => {
  return (
    <Modal
      title="預覽 Excel 資料"
      open={isOpen}
      onCancel={() => {
        onClose();
        form.resetFields();
      }}
      width={1000}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
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
                    group_id: groups[0]?.id ? Number(groups[0].id) : 0,
                  },
                ]);
              }}
            >
              新增成員
            </Button>
          </div>
          <Table
            columns={getPreviewColumns(groups, excelData, setExcelData)}
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