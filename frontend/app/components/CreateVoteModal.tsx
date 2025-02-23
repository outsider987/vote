"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import DynamicOptionsInput from "@/app/components/DynamicOptionsInput";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getVoteInfo } from "../api/vote";
import { mockVoteData } from "../mock/voteData";

type FormValues = {
  event_date: string;
  member_count: number;
  title: string;
  votes_per_user: number;
  show_count: number;
  options: string[];
};

export default function CreateVoteModal() {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      event_date: mockVoteData.eventBasicInfo.eventDate,
      member_count: mockVoteData.memberStats.totalMembers,
      title: mockVoteData.eventBasicInfo.eventTitle,
      votes_per_user: mockVoteData.sampleVoteEvents[0].votesPerUser,
      show_count: mockVoteData.sampleVoteEvents[0].showCount,
      options: mockVoteData.sampleVoteEvents[0].options,
    },
  });

  const [response, setResponse] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const voteApi = getVoteInfo();

  const onSubmit = async (data: FormValues) => {
    // Only submits when validation passes.
    const res = await voteApi.CREATE_EVENT(data);
    setResponse({ event_id: res.data.event_id, message: "活動建立成功" });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset the form and clear any response when closing the modal.
      reset();
      setResponse(null);
    }
    setIsOpen(open);
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Event Date */}
          <div>
            <label className="block font-medium pb-2 w-full">活動日期:</label>
            <Controller
              control={control}
              name="event_date"
              rules={{ required: "請選擇活動日期" }}
              render={({ field }) => (
                <DatePicker
                  date={field.value ? new Date(field.value) : null}
                  onChange={(date) =>
                    field.onChange(date ? date.toISOString() : "")
                  }
                />
              )}
            />
            {errors.event_date && (
              <p className="text-red-600">{errors.event_date.message}</p>
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
              <p className="text-red-600">{errors.member_count.message}</p>
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
              <p className="text-red-600">{errors.title.message}</p>
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
              <p className="text-red-600">{errors.votes_per_user.message}</p>
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
              <p className="text-red-600">{errors.show_count.message}</p>
            )}
          </div>

          {/* Dynamic Options */}
          <div>
            <label className="block font-medium">投票選項:</label>
            <Controller
              control={control}
              name="options"
              rules={{ required: "請至少添加一個選項" }}
              render={({ field }) => (
                <DynamicOptionsInput value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.options && (
              <p className="text-red-600">{errors.options.message}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
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
      </DialogContent>
    </Dialog>
  );
}
