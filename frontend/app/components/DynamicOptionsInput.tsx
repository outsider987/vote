"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DynamicOptionsInputProps {
  value: string[];
  onChange: (options: string[]) => void;
}

export default function DynamicOptionsInput({
  value,
  onChange,
}: DynamicOptionsInputProps) {
  const [optionText, setOptionText] = useState("");

  const handleAddOption = () => {
    if (optionText.trim() === "") return;
    const newOptions = [...value, optionText.trim()];
    onChange(newOptions);
    setOptionText("");
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = value.filter((_, i) => i !== index);
    onChange(newOptions);
  };

  return (
    <div>
      <div className="flex items-center space-x-2">
        <Input
          type="text"
          placeholder="新增選項..."
          value={optionText}
          onChange={(e) => setOptionText(e.target.value)}
        />
        <Button onClick={handleAddOption}>新增</Button>
      </div>
      {value.length > 0 && (
        <ul className="mt-2 space-y-2">
          {value.map((option, index) => (
            <li key={index} className="flex items-center justify-between border rounded p-2">
              <span>{option}</span>
              <Button variant="destructive" size="sm" onClick={() => handleRemoveOption(index)}>
                刪除
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
