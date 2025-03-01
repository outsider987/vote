"use client";

import { useRef, useState } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DynamicOptionsInput from "@/app/components/DynamicOptionsInput";
import moment from "moment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getVoteInfo } from "../api/vote";
import { mockVoteData } from "../mock/voteData";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useSnackbar } from "notistack";
import * as XLSX from "xlsx";

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
  options: any;
};

interface CreateVoteModalProps {
  onSuccess?: () => void;
}

export default function CreateVoteModal({ onSuccess }: CreateVoteModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      event_date: moment().toDate(),
      member_count: 0,
      title: "",
      votes_per_user: 0,
      show_count: 0,
      options: [],
    },
  });

  const [isOpen, setIsOpen] = useState(false);
  const voteApi = getVoteInfo();
  const { enqueueSnackbar } = useSnackbar();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      const res = await voteApi.CREATE_EVENT(data);

      // Close modal after successful submission
      setIsOpen(false);

      // Show success message
      enqueueSnackbar("活動建立成功", { variant: "success" });

      // Call onSuccess callback if provided
      onSuccess?.();

      // Reset form when reopening
      reset();
    } catch (error) {
      enqueueSnackbar("活動建立失敗，請重試", { variant: "error" });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset(); // Reset form when closing
    }
    setIsOpen(open);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      // Assuming data is in the first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // Convert the worksheet to JSON (assuming first row is header)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      // Parse the JSON data into options
      // For example, if each row is: [number, text] and the first row is headers
      const parsedOptions = jsonData.slice(1).map((row: any) => ({
        number: row[0],
        text: row[1],
      }));
      // Update the DynamicOptionsInput with parsed options
      setValue("options", parsedOptions);
      enqueueSnackbar("Excel 檔案上傳成功", { variant: "success" });
    };

    reader.onerror = () => {
      enqueueSnackbar("Excel 檔案上傳失敗，請確認格式是否正確", {
        variant: "error",
      });
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await voteApi.GET_EXCEL_TEMPLATE();
      if (response.status !== 200) {
        throw new Error("Download failed");
      }

      // Create a blob from the response
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
      enqueueSnackbar("範本下載失敗，請稍後再試", { variant: "error" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>建立新投票</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>建立投票事件</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const submitter = (e.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            if (submitter?.type === "button") return;
            handleSubmit(onSubmit)(e);
          }}
          className="space-y-4"
        >
          {/* Event Date */}
          <div>
            <label className="block font-medium pb-2 w-full">活動日期:</label>
            <Controller
              control={control}
              name="event_date"
              rules={{ required: "請選擇活動日期" }}
              render={({ field }) => (
                <DateTimePicker
                  value={field.value ? new Date(field.value) : undefined}
                  onChange={(date) =>
                    field.onChange(
                      date ? moment(date).format("YYYY-MM-DD HH:mm:ss") : ""
                    )
                  }
                />
              )}
            />
            {errors.event_date && (
              <p className="text-red">{errors.event_date.message}</p>
            )}
          </div>

          {/* Member Count */}
          <div>
            <label className="block font-medium pb-2">會員人數:</label>
            <Input
              type="number"
              {...register("member_count", {
                required: "請輸入會員人數",
                valueAsNumber: true,
              })}
            />
            {errors.member_count && (
              <p className="text-red">{errors.member_count.message}</p>
            )}
          </div>

          {/* Vote Title */}
          <div>
            <label className="block font-medium pb-2">投票標題:</label>
            <Input
              type="text"
              {...register("title", { required: "請輸入投票標題" })}
            />
            {errors.title && (
              <p className="text-red">{errors.title.message}</p>
            )}
          </div>

          {/* Votes Per User */}
          <div>
            <label className="block font-medium pb-2">每人可投票數:</label>
            <Input
              type="number"
              {...register("votes_per_user", {
                required: "請輸入每人可投票數",
                valueAsNumber: true,
              })}
            />
            {errors.votes_per_user && (
              <p className="text-red">{errors.votes_per_user.message}</p>
            )}
          </div>

          {/* Show Count */}
          <div>
            <label className="block font-medium pb-2">結果顯示人數:</label>
            <Input
              type="number"
              {...register("show_count", {
                required: "請輸入結果顯示人數",
                valueAsNumber: true,
              })}
            />
            {errors.show_count && (
              <p className="text-red">{errors.show_count.message}</p>
            )}
          </div>

          {/* Excel Upload Section */}
          <div className="space-y-2">
            <label className="block font-medium">Excel 上傳:</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="success"
                onClick={handleDownloadTemplate}
              >
                下載範本
              </Button>
              <label className="cursor-pointer">
                <Input
                  ref={uploadInputRef as React.RefObject<HTMLInputElement>}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => uploadInputRef.current?.click()}
                  type="button"
                  className=""
                  variant="success"
                >
                  上傳 Excel
                </Button>
              </label>
            </div>
            <p className="text-sm text-gray-500">請先下載範本，填寫後再上傳</p>
          </div>

          {/* Dynamic Options */}
          <div>
            <label className="block font-medium">投票選項:</label>
            <Controller
              control={control}
              name="options"
              rules={{ required: "請至少添加一個選項" }}
              render={({ field }) => (
                <DynamicOptionsInput
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.options && (
              <p className="text-red">
                {errors.options.message?.toString()}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              取消
            </Button>
            <Button type="submit">建立活動</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
