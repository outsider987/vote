"use client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getVoteInfo } from "../../api/vote";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "notistack";

interface VoteFormProps {
  voteInfo: {
    event: {
      options: { text: string; number: number }[];
      votesPerUser: number;
      id: string; // Used when navigating to live vote count
    };
  };
  voteCode: string;
  onMessage: (message: string) => void;
}

interface VoteFormData {
  candidates: { text: string; number: number }[];
}

export function VoteForm({
  voteInfo,
  voteCode: vote_code,
  onMessage,
}: VoteFormProps) {
  const { POST_VOTE } = getVoteInfo();
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const { register, handleSubmit, watch, setValue } = useForm<VoteFormData>({
    defaultValues: {
      candidates: [],
    },
  });
  const { enqueueSnackbar } = useSnackbar();
  const selectedCount = watch("candidates").length;

  const toggleCandidate = (candidate: { text: string; number: number }) => {
    if (isSuccess) return; // Prevent changes after submission
    const currentCandidates = watch("candidates");

    const isAlreadySelected = currentCandidates.some(
      (c) => c.number === candidate.number
    );

    if (isAlreadySelected) {
      setValue(
        "candidates",
        currentCandidates.filter((c) => c.number !== candidate.number)
      );
    } else if (currentCandidates.length < voteInfo.event.votesPerUser) {
      setValue("candidates", [...currentCandidates, candidate]);
    } else {
      enqueueSnackbar(`最多只能選擇 ${voteInfo.event.votesPerUser} 人`, {
        variant: "error",
      });
    }
  };

  const onSubmit = async (data: VoteFormData) => {
    // Ensure exactly votesPerUser candidates are selected
    if (
      data.candidates.length !== voteInfo.event.votesPerUser ||
      voteInfo.event.votesPerUser != data.candidates.length
    ) {
      enqueueSnackbar(`請選擇 ${voteInfo.event.votesPerUser} 人`, {
        variant: "error",
      });
      return;
    }

    const res = await POST_VOTE({ vote_code, candidate: data.candidates });
    enqueueSnackbar(res.data.message, {
      variant: res.status === 200 ? "success" : "error",
    });
    if (res.status === 200) {
      setIsSuccess(true); // Disable further interactions
      // router.push(`/client/live-vote-count?eventId=${voteInfo.event.id}`);
    }
  };

  return !isSuccess ? (
    <div className="shadow-lg p-4">
      <p className="mb-4 text-gray-100">
        請選擇候選人 (最多 {voteInfo.event.votesPerUser} 人):
      </p>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {voteInfo.event.options
            .sort((a, b) => a.number - b.number)
            .map((option, index) => (
              <CandidateCard
                key={index}
                option={option}
                isSelected={watch("candidates").some(
                  (c) => c.number === option.number
                )} // Compare by number
                onToggle={toggleCandidate}
                register={register}
                disabled={isSuccess}
              />
            ))}
        </div>
        <CardFooter className="flex justify-center mt-4">
          <Button
            type="submit"
            className="w-full py-2 text-lg"
            disabled={
              selectedCount !== voteInfo.event.votesPerUser || isSuccess
            }
          >
            送出投票
          </Button>
        </CardFooter>
      </form>
      <div className="fixed right-3 bottom-3 text-primary flex flex-col gap-2">
        <span className="text-primary">
          可投 {voteInfo.event.votesPerUser - selectedCount} 人
        </span>
        <span className="text-primary">已選擇 {selectedCount} 人</span>
      </div>
    </div>
  ) : (
    <div className="shadow-lg p-4">
      <p className="mb-4 text-gray-100 font-bold text-2xl">已完成投票</p>
    </div>
  );
}

const CandidateCard = ({
  option,
  isSelected,
  onToggle,
  register,
  disabled = false,
}: {
  option: { text: string; number: number };
  isSelected: boolean;
  onToggle: (option: { text: string; number: number }) => void;
  register: any;
  disabled?: boolean;
}) => (
  <Card
    className={`cursor-pointer transition-all p-3  ${
      isSelected
        ? "border-2 border-solid border-orange-800 bg-orange-400  "
        : "hover:bg-gray-100"
    } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    onClick={() => {
      if (!disabled) onToggle(option); // Pass the whole object instead of just text
    }}
  >
    <CardContent className="flex  items-center gap-3 ">
      <input
        type="checkbox"
        {...register("candidates")}
        value={JSON.stringify(option)} // Store as JSON string to avoid React warnings
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          if (!disabled) onToggle(option);
        }}
        className="w-5 h-5 hidden"
      />
      <div className="flex flex-col items-center gap-2 m-auto">
        <span className="text-lg min-w-[50px] min-h-[50px] flex items-center justify-center font-medium rounded-full border-2 border-solid border-red p-1">
          {option.number}
        </span>
        <span className="text-lg font-medium">{option.text}</span>
      </div>
    </CardContent>
  </Card>
);
