"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VoteInfo {
  event_id: string;
  title: string;
  options: string[];
  votes_per_user: number;
}

interface VoteInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  voteInfo: VoteInfo | null;
}

export default function VoteInfoModal({
  isOpen,
  onClose,
  voteInfo,
}: VoteInfoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>投票資訊</DialogTitle>
        </DialogHeader>
        {voteInfo && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium">活動 ID:</h4>
              <p className="text-sm text-gray-500">{voteInfo.event_id}</p>
            </div>
            <div>
              <h4 className="font-medium">活動標題:</h4>
              <p className="text-sm text-gray-500">{voteInfo.title}</p>
            </div>
            <div>
              <h4 className="font-medium">每人可投票數:</h4>
              <p className="text-sm text-gray-500">{voteInfo.votes_per_user}</p>
            </div>
            <div>
              <h4 className="font-medium">投票選項:</h4>
              <ul className="list-disc list-inside text-sm text-gray-500">
                {voteInfo.options.map((option, index) => (
                  <li key={index}>{option}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 