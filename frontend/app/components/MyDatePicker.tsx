"use client";

import React from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface MyDatePickerProps {
  label: string;
  selectedDate: Date;
  onChange: (date: Date) => void;
}

const MyDatePicker: React.FC<MyDatePickerProps> = ({ label, selectedDate, onChange }) => {
  return (
    <div className="flex flex-col">
      <label className="block font-medium pb-2">{label}:</label>
      <DatePicker
        selected={selectedDate}
        onChange={(date: Date) => onChange(date)}
        dateFormat="yyyy-MM-dd"
        className="px-3 py-2 border rounded-md"
      />
    </div>
  );
};

export default MyDatePicker;
