"use client";
import { useState, useEffect } from "react";
import { Input, Button, List, Space, Form } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";

interface Option {
  number: number;
  text: string;
}

interface DynamicOptionsInputProps {
  value?: Option[];
  onChange?: (options: Option[]) => void;
}

export default function DynamicOptionsInput({
  value = [],
  onChange,
}: DynamicOptionsInputProps) {
  const [options, setOptions] = useState<Option[]>(value);
  const [optionText, setOptionText] = useState("");
  const [optionNumber, setOptionNumber] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editNumber, setEditNumber] = useState("");

  // Sync internal state with form values when they change externally
  useEffect(() => {
    setOptions(value);
  }, [value]);

  const triggerChange = (newOptions: Option[]) => {
    // Update internal state
    setOptions(newOptions);
    
    // Notify Form.Item through onChange if provided
    if (onChange) {
      onChange(newOptions);
    }
  };

  const handleAddOption = () => {
    if (optionText.trim() === "" || optionNumber.trim() === "") return;
    const numberValue = parseInt(optionNumber, 10);
    if (isNaN(numberValue) || numberValue <= 0) return;
    // Check for duplicate number
    if (options.some(option => option.number === numberValue)) {
      alert("Number is already used.");
      return;
    }
    const newOption: Option = { number: numberValue, text: optionText.trim() };
    const newOptions = [...options, newOption].sort((a, b) => b.number - a.number);
    triggerChange(newOptions);
    setOptionText("");
    setOptionNumber("");
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    triggerChange(newOptions);
  };

  const handleEditOption = (index: number) => {
    setEditingIndex(index);
    setEditText(options[index].text);
    setEditNumber(options[index].number.toString());
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || editText.trim() === "" || editNumber.trim() === "") return;
    const newNumber = parseInt(editNumber, 10);
    if (isNaN(newNumber) || newNumber <= 0) return;
    // Check for duplicate number excluding the option currently being edited
    if (options.some((option, idx) => idx !== editingIndex && option.number === newNumber)) {
      alert("Number is already used.");
      return;
    }
    const newOptions = [...options];
    newOptions[editingIndex] = { number: newNumber, text: editText.trim() };
    newOptions.sort((a, b) => b.number - a.number);
    triggerChange(newOptions);
    setEditingIndex(null);
    setEditText("");
    setEditNumber("");
  };

  return (
    <div>
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          type="number"
          min={1}
          placeholder="編號"
          value={optionNumber}
          style={{ width: '25%' }}
          onChange={(e) => {
            const val = e.target.value;
            if (/^\d*$/.test(val)) {
              setOptionNumber(val);
            }
          }}
        />
        <Input
          placeholder="名子"
          value={optionText}
          style={{ width: '60%' }}
          onChange={(e) => setOptionText(e.target.value)}
        />
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAddOption}
          style={{ width: '15%' }}
        >
          新增
        </Button>
      </Space.Compact>

      <List
        dataSource={options.sort((a, b) => b.number - a.number)}
        bordered
        renderItem={(option, index) => (
          <List.Item
            actions={
              editingIndex === index 
                ? [
                    <Button key="save" type="primary" onClick={handleSaveEdit}>
                      儲存
                    </Button>
                  ]
                : [
                    <Button key="edit" icon={<EditOutlined />} onClick={() => handleEditOption(index)}>
                      編輯
                    </Button>,
                    <Button key="delete" danger icon={<DeleteOutlined />} onClick={() => handleRemoveOption(index)}>
                      刪除
                    </Button>
                  ]
            }
          >
            {editingIndex === index ? (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  type="number"
                  min={1}
                  placeholder="編號"
                  value={editNumber}
                  style={{ width: '30%' }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      setEditNumber(val);
                    }
                  }}
                />
                <Input
                  placeholder="名子"
                  value={editText}
                  style={{ width: '70%' }}
                  onChange={(e) => setEditText(e.target.value)}
                />
              </Space.Compact>
            ) : (
              <span>{`${option.number} - ${option.text}`}</span>
            )}
          </List.Item>
        )}
      />
    </div>
  );
}
