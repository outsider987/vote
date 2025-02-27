"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Option {
  number: number;
  text: string;
}

interface DynamicOptionsInputProps {
  value: Option[];
  onChange: (options: Option[]) => void;
}

export default function DynamicOptionsInput({
  value,
  onChange,
}: DynamicOptionsInputProps) {
  const [optionText, setOptionText] = useState("");
  const [optionNumber, setOptionNumber] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const handleAddOption = () => {
    if (optionText.trim() === "" || optionNumber.trim() === "") return;
    const numberValue = parseInt(optionNumber, 10);
    if (isNaN(numberValue) || numberValue <= 0) return;
    // Check for duplicate number
    if (value.some(option => option.number === numberValue)) {
      alert("Number is already used.");
      return;
    }
    const newOption: Option = { number: numberValue, text: optionText.trim() };
    const newOptions = [...value, newOption].sort((a, b) => b.number - a.number);
    onChange(newOptions);
    setOptionText("");
    setOptionNumber("");
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = value.filter((_, i) => i !== index);
    onChange(newOptions);
  };

  const handleEditOption = (index: number) => {
    setEditingIndex(index);
    setEditText(value[index].text);
    setEditNumber(value[index].number.toString());
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || editText.trim() === "" || editNumber.trim() === "") return;
    const newNumber = parseInt(editNumber, 10);
    if (isNaN(newNumber) || newNumber <= 0) return;
    // Check for duplicate number excluding the option currently being edited
    if (value.some((option, idx) => idx !== editingIndex && option.number === newNumber)) {
      alert("Number is already used.");
      return;
    }
    const newOptions = [...value];
    newOptions[editingIndex] = { number: newNumber, text: editText.trim() };
    newOptions.sort((a, b) => b.number - a.number);
    onChange(newOptions);
    setEditingIndex(null);
    setEditText("");
    setEditNumber("");
  };

  return (
    <div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          <Input
            className="flex-[1]"
            type="number"
            min={1}
            placeholder="編號"
            value={optionNumber}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) {
                setOptionNumber(val);
              }
            }}
          />
          <Input
            className="flex-[4]"
            type="text"
            placeholder="名子"
            value={optionText}
            onChange={(e) => setOptionText(e.target.value)}
          />
        </div>
        <Button type="button" onClick={handleAddOption}>新增</Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 space-y-2">
          {value.sort((a, b) => b.number - a.number).map((option, index) => (
            <li
              key={index}
              className="flex items-center justify-between border rounded py-2 gap-2"
            >
              {editingIndex === index ? (
                <>
                  <Input
                    className="flex-[1]"
                    type="number"
                    min={1}
                    placeholder="編號"
                    value={editNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) {
                        setEditNumber(val);
                      }
                    }}
                  />
                  <Input
                    className="flex-[4]"
                    type="text"
                    placeholder="名子"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <Button variant="secondary" type="button" size="sm" onClick={handleSaveEdit}>
                    儲存
                  </Button>
                </>
              ) : (
                <>
                  <span>
                    {`${option.number} - ${option.text}`}
                    {/* {JSON.stringify(option)} */}
                  </span>
                  <div className="flex space-x-2">
                    <Button type="button" size="sm" onClick={() => handleEditOption(index)}>
                      編輯
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveOption(index)}
                    >
                      刪除
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
