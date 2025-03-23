"use client";

import { useRef, useState, useEffect } from "react";
import { Form, Input, Button, Modal, DatePicker, InputNumber, Upload, message } from "antd";
import { UploadOutlined, DownloadOutlined } from "@ant-design/icons";
import DynamicOptionsInput from "@/app/components/DynamicOptionsInput";
import moment from "moment";
import { useVote } from "../api/vote";
import * as XLSX from "xlsx";
import type { Event } from "../data/types";

interface Option {
  number: number;
  text: string;
}

type FormValues = {
  event_date: string;
  member_count: number;
  title: string;
  votes_per_user: number;
  show_count: number;
  required_count: number;
  backup_count: number;
  options: Option[];
};

interface CreateVoteModalProps {
  onSuccess?: () => void;
  event?: Event;
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
}

export default function CreateVoteModal({
  onSuccess,
  event,
  isOpen,
  onClose,
  mode,
}: CreateVoteModalProps) {
  const [form] = Form.useForm();
  const voteApi = useVote();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && event) {
        form.setFieldsValue({
          title: event.title,
          votes_per_user: event.votesPerUser,
          required_count: event.requiredCount,
          backup_count: event.backupCount,
          options: event.options.map((option) => ({
            number: option.number,
            text: option.text,
          })),
          event_date: moment(event.eventDate),
          member_count: event.memberCount,
          show_count: event.showCount,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          event_date: moment(),
          options: [],
        });
      }
    }
  }, [isOpen, event, form, mode]);

  const onSubmit = async (values: FormValues) => {
    try {
      const formData = {
        ...values,
        event_date: moment(values.event_date).format("YYYY-MM-DD HH:mm:ss"),
      };

      if (mode === "edit" && event) {
        // For edit mode, only send the fields that can be edited
        const editData = {
          title: values.title,
          votes_per_user: values.votes_per_user,
          required_count: values.required_count,
          backup_count: values.backup_count,
          options: values.options,
        };
        await voteApi.UPDATE_EVENT(event.id, editData);
        message.success("活動更新成功");
      } else {
        await voteApi.CREATE_EVENT(formData);
        message.success("活動建立成功");
      }

      // Close modal after successful submission
      onClose();

      // Call onSuccess callback if provided
      onSuccess?.();

      // Reset form
      form.resetFields();
    } catch (error) {
      message.error(mode === "edit" ? "活動更新失敗，請重試" : "活動建立失敗，請重試");
    }
  };

  const handleFileUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const parsedOptions = jsonData.slice(1).map((row: any) => ({
        number: row[0],
        text: row[1],
      }));
      form.setFieldsValue({ options: parsedOptions });
      message.success("Excel 檔案上傳成功");
    };

    reader.onerror = () => {
      message.error("Excel 檔案上傳失敗，請確認格式是否正確");
    };

    reader.readAsArrayBuffer(file);
    
    // Return false to prevent default upload behavior
    return false;
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await voteApi.GET_EXCEL_TEMPLATE();
      if (response.status !== 200) {
        throw new Error("Download failed");
      }

      const blob = await response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vote_template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      message.error("範本下載失敗，請稍後再試");
    }
  };

  return (
    <Modal
      title={mode === "edit" ? "編輯投票事件" : "建立投票事件"}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={{
          event_date: moment(),
          member_count: 0,
          title: "",
          votes_per_user: 0,
          show_count: 0,
          required_count: 0,
          backup_count: 0,
          options: [],
        }}
      >
        {/* Event Date */}
        {mode === "create" && (
          <Form.Item
            name="event_date"
            label="活動日期"
            rules={[{ required: true, message: "請選擇活動日期" }]}
          >
            <DatePicker 
              showTime 
              format="YYYY-MM-DD HH:mm:ss" 
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}

        {/* Member Count */}
        {mode === "create" && (
          <Form.Item
            name="member_count"
            label="會員人數"
            rules={[{ required: true, message: "請輸入會員人數" }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}

        {/* Vote Title */}
        <Form.Item
          name="title"
          label="投票標題"
          rules={[{ required: true, message: "請輸入投票標題" }]}
        >
          <Input />
        </Form.Item>

        {/* Votes Per User */}
        <Form.Item
          name="votes_per_user"
          label="每人可投票數"
          rules={[{ required: true, message: "請輸入每人可投票數" }]}
        >
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        {/* Required Count */}
        <Form.Item
          name="required_count"
          label="應選數"
          rules={[
            { required: true, message: "請輸入應選數" },
            { type: "number", min: 1, message: "應選數必須大於0" }
          ]}
        >
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        {/* Backup Count */}
        <Form.Item
          name="backup_count"
          label="備選數"
          rules={[
            { required: true, message: "請輸入備選數" },
            { type: "number", min: 0, message: "備選數必須大於或等於0" }
          ]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        {/* Excel Upload Section */}
        {mode === "create" && (
          <Form.Item label="Excel 上傳">
            <div className="flex gap-2">
              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleDownloadTemplate}
              >
                下載範本
              </Button>
              <Upload
                beforeUpload={handleFileUpload}
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

        {/* Dynamic Options */}
        {mode === "create" && (
          <Form.Item
            name="options"
            label="投票選項"
            rules={[{ required: true, message: "請至少添加一個選項" }]}
          >
            <DynamicOptionsInput />
          </Form.Item>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={onClose}>
            取消
          </Button>
          <Button type="primary" htmlType="submit">
            {mode === "edit" ? "更新活動" : "建立活動"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
