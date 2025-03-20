"use client";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useVote } from "../../api/vote";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "notistack";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
  const { POST_VOTE } = useVote();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [inputError, setInputError] = useState("");
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
    
    if (data.candidates.length === 0) {
      enqueueSnackbar("請至少選擇 1 人", {
        variant: "error",
      });
      return;
    }

    const res = await POST_VOTE({
      vote_code,
      candidate: data.candidates,
      event_id: voteInfo.event.id,
    });
    enqueueSnackbar(res.data.message, {
      variant: res.status === 200 ? "success" : "error",
    });
    if (res.status === 200) {
      setIsSuccess(true); // Disable further interactions
    
    }
  };

  const handleManualInput = () => {
    setInputError("");
    const numberValue = parseInt(manualNumber);
    
    // Validate input is a number
    if (isNaN(numberValue)) {
      setInputError("請輸入有效的數字");
      return;
    }
    
    // Check if candidate exists
    const candidate = voteInfo.event.options.find(option => option.number === numberValue);
    if (!candidate) {
      setInputError(`編號 ${numberValue} 不存在於候選人名單中`);
      return;
    }
    
    // Check if already selected
    const currentCandidates = watch("candidates");
    const isAlreadySelected = currentCandidates.some(c => c.number === numberValue);
    
    if (isAlreadySelected) {
      // If already selected, remove it
      setValue(
        "candidates",
        currentCandidates.filter(c => c.number !== numberValue)
      );
      setIsModalOpen(false);
      setManualNumber("");
      enqueueSnackbar(`已移除編號 ${numberValue} 的候選人`, { variant: "info" });
    } else if (currentCandidates.length < voteInfo.event.votesPerUser) {
      // Add if not at max selection
      setValue("candidates", [...currentCandidates, candidate]);
      setIsModalOpen(false);
      setManualNumber("");
      enqueueSnackbar(`已選擇編號 ${numberValue} 的候選人`, { variant: "success" });
    } else {
      setInputError(`最多只能選擇 ${voteInfo.event.votesPerUser} 人`);
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
        <CardFooter className="flex justify-center gap-4 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="w-1/3 py-2 text-lg"
            disabled={isSuccess}
          >
            手動輸入編號
          </Button>
          <Button
            type="submit"
            className="w-2/3 py-2 text-lg"
            disabled={isSuccess}
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

      {/* Manual Input Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手動輸入候選人編號</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              placeholder="請輸入候選人編號"
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              className="w-full"
            />
            {inputError && <p className="text-red-500 mt-2">{inputError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleManualInput}>確認</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
