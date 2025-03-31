import * as XLSX from "xlsx";
import { ExcelMemberData } from "../types";
import { message } from "antd";

export const validateExcelData = (jsonData: any[]): boolean => {
  const requiredFields = ["name", "email", "group_id"];
  const missingFields = requiredFields.filter(
    (field) => !jsonData[0] || !(field in jsonData[0])
  );
  if (missingFields.length > 0) {
    message.error(`Excel 檔案缺少必要欄位: ${missingFields.join(", ")}`);
    return false;
  }
  return true;
};

export const processExcelFile = (file: File): Promise<ExcelMemberData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelMemberData[];

        if (!validateExcelData(jsonData)) {
          reject(new Error("Invalid Excel format"));
          return;
        }

        const processedData = jsonData
          .filter((item) => item.group_id)
          .map((item) => ({ ...item, group_id: Number(item.group_id) }));

        resolve(processedData);
      } catch (error) {
        message.error("Excel 檔案處理失敗，請確認格式是否正確");
        reject(error);
      }
    };

    reader.onerror = () => {
      message.error("Excel 檔案讀取失敗");
      reject(new Error("File read error"));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const createExcelFile = (data: ExcelMemberData[]): File => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new File([blob], "members.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}; 