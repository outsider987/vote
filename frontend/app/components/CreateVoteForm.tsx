"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DynamicOptionsInput from "@/app/components/DynamicOptionsInput";
import { DatePicker } from "@/components/ui/date-picker";

export default function CreateVoteForm() {
  const [formData, setFormData] = useState({
    eventDate: "",
    memberCount: "",
    title: "",
    votesPerUser: "",
    showCount: "",
  });
  const [options, setOptions] = useState<string[]>([]);
  const [response, setResponse] = useState<any>(null);

  const handleDateChange = (date: Date | null) => {
    setFormData({
      ...formData,
      eventDate: date ? date.toISOString() : "",
    });
  };

  const formFields = [
    { name: "memberCount", label: "會員人數", type: "number" },
    { name: "title", label: "投票標題", type: "text" },
    { name: "votesPerUser", label: "每人可投票數", type: "number" },
    { name: "showCount", label: "結果顯示人數", type: "number" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, options };
    console.log("送出資料:", payload);
    setResponse({ event_id: "123456", message: "活動建立成功" });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold mb-6">建立投票事件</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-medium pb-2 w-full">活動日期:</label>
          <DatePicker
            date={formData.eventDate ? new Date(formData.eventDate) : null}
            onChange={handleDateChange}
          />
        </div>
        {formFields.map((field) => (
          <div key={field.name}>
            <label className="block font-medium pb-2">
              {field.label}:
            </label>
            <Input
              type={field.type}
              name={field.name}
              value={formData[field.name as keyof typeof formData]}
              onChange={handleChange}
              required
            />
          </div>
        ))}
        <div>
          <label className="block font-medium">投票選項:</label>
          <DynamicOptionsInput value={options} onChange={setOptions} />
        </div>
        <div className="flex justify-end">
          <Button type="submit">建立活動</Button>
        </div>
      </form>
      {response && (
        <div className="mt-6 p-4 bg-green-50 border rounded">
          <h3 className="font-bold">回應:</h3>
          <p>活動ID: {response.event_id}</p>
          <p>{response.message}</p>
        </div>
      )}
    </div>
  );
} 