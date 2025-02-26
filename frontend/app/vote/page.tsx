"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getVoteInfo } from "../api/vote";
import { useForm } from "react-hook-form";
import { VoteForm } from "./VoteForm";
import { Alert } from "@/components/ui/alert";

interface VoteInfo {
  eventId: string;
  title: string;

  used: boolean;
  event: {
    options: string[];
    isVotingStarted: boolean;
    votesPerUser: number;
  };
}

interface VoteFormData {
  candidates: string[];
}

export default function VotePage() {
  const router = useRouter();
  const [voteCode, setVoteCode] = useState<string | null>(null);
  const [voteInfo, setVoteInfo] = useState<VoteInfo | null>(null);
  const [message, setMessage] = useState("");
  const { GET_TICKET_VOTE_INFO } = getVoteInfo();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("vote_code");
    setVoteCode(code);
  }, []);

  useEffect(() => {
    const fetchVoteInfo = async () => {
      if (!voteCode) return;
      const res = await GET_TICKET_VOTE_INFO(voteCode);
      if (res.status !== 200) {
        setMessage(res.data.message);
        return;
      }
      setVoteInfo(res.data);
    };
    fetchVoteInfo();
  }, [voteCode]);

  const renderVoteStatus = () => {
    if (!voteInfo) return null;

    if (voteInfo.used) {
      return <VoteStatusMessage message="投票已使用" />;
    }

    if (!voteInfo.event.isVotingStarted) {
      return <VoteStatusMessage message="投票尚未開始" />;
    }

    return (
      <VoteForm 
        voteInfo={voteInfo} 
        voteCode={voteCode!} 
        onMessage={setMessage} 
      />
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 w-full">
      <h2 className="text-3xl font-bold text-center mb-6">投票頁面</h2>
      {message && <Alert variant="destructive">{message}</Alert>}
      {renderVoteStatus()}
    </div>
  );
}

const VoteStatusMessage = ({ message }: { message: string }) => (
  <div className="shadow-lg p-4">
    <p className="mb-4 text-gray-100">{message}</p>
  </div>
);
