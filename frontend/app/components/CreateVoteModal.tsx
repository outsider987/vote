"use client";

import { useRef, useState, useEffect } from "react";
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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useSnackbar } from "notistack";
import * as XLSX from "xlsx";
import type { Event } from "../data/types";

interface Option {
  number: number;
  text: string;
}

type FormValues = {
  event_date: Date;
  member_count: number;
  title: string;
  votes_per_user: number;
  show_count: number;
  required_count: number;
  backup_count: number;
  options: any;
};

interface CreateVoteModalProps {
  onSuccess?: () => void;
  event?: Event;
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
}

export default function CreateVoteModal({ onSuccess, event, isOpen, onClose, mode }: CreateVoteModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: mode === 'edit' && event ? {
      title: event.title,
      votes_per_user: event.votesPerUser,
      required_count: event.requiredCount,
      backup_count: event.backupCount,
      options: event.options.map(option => ({
        number: option.number,
        text: option.text
      })),
      event_date: moment(event.eventDate).toDate(),
      member_count: event.memberCount,
      show_count: event.showCount,
    } : {
      event_date: moment().toDate(),
      member_count: 0,
      title: "",
      votes_per_user: 0,
      show_count: 0,
      required_count: 0,
      backup_count: 0,
      options: [],
    },
  });

  // Reset form when event or mode changes
  useEffect(() => {
    if (mode === 'edit' && event) {
      reset({
        title: event.title,
        votes_per_user: event.votesPerUser,
        required_count: event.requiredCount,
        backup_count: event.backupCount,
        options: event.options.map(option => ({
          number: option.number,
          text: option.text
        })),
        event_date: moment(event.eventDate).toDate(),
        member_count: event.memberCount,
        show_count: event.showCount,
      });
    } else {
      reset({
        event_date: moment().toDate(),
        member_count: 0,
        title: "",
        votes_per_user: 0,
        show_count: 0,
        required_count: 0,
        backup_count: 0,
        options: [],
      });
    }
  }, [event, mode, reset]);

  const voteApi = getVoteInfo();
  const { enqueueSnackbar } = useSnackbar();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      if (mode === 'edit' && event) {
        // For edit mode, only send the fields that can be edited
        const editData = {
          title: data.title,
          votes_per_user: data.votes_per_user,
          required_count: data.required_count,
          backup_count: data.backup_count,
          options: data.options,
        };
        await voteApi.UPDATE_EVENT(event.id, editData);
        enqueueSnackbar("活動更新成功", { variant: "success" });
      } else {
        await voteApi.CREATE_EVENT(data);
        enqueueSnackbar("活動建立成功", { variant: "success" });
      }

      // Close modal after successful submission
      onClose();

      // Call onSuccess callback if provided
      onSuccess?.();

      // Reset form when reopening
      reset();
    } catch (error) {
      enqueueSnackbar(mode === 'edit' ? "活動更新失敗，請重試" : "活動建立失敗，請重試", { variant: "error" });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset(); // Reset form when closing
    }
    onClose();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '編輯投票事件' : '建立投票事件'}</DialogTitle>
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
          {mode === 'create' && (
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
          )}

          {/* Member Count */}
          {mode === 'create' && (
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
          )}

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

          

          {/* Required Count */}
          <div>
            <label className="block font-medium pb-2">應選數:</label>
            <Input
              type="number"
              {...register("required_count", {
                required: "請輸入應選數",
                valueAsNumber: true,
                min: { value: 1, message: "應選數必須大於0" }
              })}
            />
            {errors.required_count && (
              <p className="text-red">{errors.required_count.message}</p>
            )}
          </div>

          {/* Backup Count */}
          <div>
            <label className="block font-medium pb-2">備選數:</label>
            <Input
              type="number"
              {...register("backup_count", {
                required: "請輸入備選數",
                valueAsNumber: true,
                min: { value: 0, message: "備選數必須大於或等於0" }
              })}
            />
            {errors.backup_count && (
              <p className="text-red">{errors.backup_count.message}</p>
            )}
          </div>

          {/* Excel Upload Section */}
          {mode === 'create' && (
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
          )}

          {/* Dynamic Options */}
          
            {mode === 'create' && (
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
            )
          }
        

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              取消
            </Button>
            <Button type="submit">{mode === 'edit' ? '更新活動' : '建立活動'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
