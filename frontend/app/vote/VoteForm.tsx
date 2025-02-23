import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getVoteInfo } from "../api/vote";


interface VoteFormProps {
  voteInfo: {
    event: {
      options: string[];
    };
    votes_per_user: number;
  };
  vote_code: string;
  onMessage: (message: string) => void;
}

interface VoteFormData {
  candidates: string[];
}

export function VoteForm({ voteInfo, vote_code, onMessage }: VoteFormProps) {
  const { POST_VOTE } = getVoteInfo();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<VoteFormData>({
    defaultValues: {
      candidates: [],
    },
  });

  const toggleCandidate = (candidate: string) => {
    const currentCandidates = watch("candidates");

    if (currentCandidates.includes(candidate)) {
      setValue(
        "candidates",
        currentCandidates.filter((c) => c !== candidate)
      );
    } else if (currentCandidates.length < voteInfo.votes_per_user) {
      setValue("candidates", [...currentCandidates, candidate]);
    }
  };

  const onSubmit = async (data: VoteFormData) => {
    if (data.candidates.length > voteInfo.votes_per_user) {
      onMessage(`最多只能選擇 ${voteInfo.votes_per_user} 人`);
      return;
    }

    const res = await POST_VOTE({ vote_code, candidate_ids: data.candidates });
    onMessage(res.data.message);
  };

  return (
    <div className="shadow-lg p-4">
      <p className="mb-4 text-gray-100">
        請選擇候選人 (最多 {voteInfo.votes_per_user} 人):
      </p>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {voteInfo.event.options.map((option, index) => (
            <CandidateCard
              key={index}
              option={option}
              isSelected={watch("candidates").includes(option)}
              onToggle={toggleCandidate}
              register={register}
            />
          ))}
        </div>
        <CardFooter className="flex justify-center mt-4">
          <Button type="submit" className="w-full py-2 text-lg">
            送出投票
          </Button>
        </CardFooter>
      </form>
    </div>
  );
}

const CandidateCard = ({ 
  option, 
  isSelected, 
  onToggle, 
  register 
}: { 
  option: string;
  isSelected: boolean;
  onToggle: (option: string) => void;
  register: any;
}) => (
  <Card
    className={`cursor-pointer transition-all p-3 xl: ${
      isSelected
        ? "border-2 border-solid border-orange-500 bg-orange-50"
        : "hover:bg-gray-100"
    }`}
    onClick={() => onToggle(option)}
  >
    <CardContent className="flex items-center gap-3">
      <input
        type="checkbox"
        {...register("candidates")}
        value={option}
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(option);
        }}
        className="w-5 h-5 hidden"
      />
      <div className="text-lg font-medium">{option}</div>
    </CardContent>
  </Card>
); 