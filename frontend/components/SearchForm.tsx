import { Form, Input, Select, Button, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { SearchFormProps, SearchColumn } from "../app/vote/member/types";
import clsx from "clsx";
import {
  ProCard,
  ProFormGroup,
  ProFormSwitch,
} from "@ant-design/pro-components";
export const SearchForm = ({
  columns,
  onSearch,
  onReset,
  className = "bg-white p-4 rounded-lg shadow-sm",
  children,
}: SearchFormProps) => {
  const renderFormItem = (column: SearchColumn) => {
    const commonProps = {
      name: column.name,
      label: column.label,
    };

    switch (column.type) {
      case "select":
        return (
          <Form.Item key={column.name} {...commonProps}>
            <Select
              style={{ width: column.width || 200 }}
              placeholder={column.placeholder || `請選擇${column.label}`}
              allowClear={column.allowClear ?? true}
              onChange={column.onChange}
            >
              {column.options?.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  {option.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      case "input":
      default:
        return (
          <Form.Item key={column.name} {...commonProps}>
            <Input
              placeholder={column.placeholder || `請輸入${column.label}`}
              allowClear={column.allowClear ?? true}
            />
          </Form.Item>
        );
    }
  };

  return (
    <ProCard boxShadow>
      <Form
        layout="inline"
        onFinish={onSearch}
        className={clsx(className, "gap-2 flex")}
      >
        {columns.map(renderFormItem)}
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜尋
            </Button>
            <Button onClick={onReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
      {children}
    </ProCard>
  );
};
