"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface VoteInfo {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  is_voting_started?: boolean;
  // Add other fields as needed
}

export default function VoteInfoList() {
  const [voteCode, setVoteCode] = useState("");
  const [voteInfoList, setVoteInfoList] = useState<VoteInfo[]>([]);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    try {
      const response = await fetch(`/api/vote-info?vote_code=${voteCode}`);
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message);
        return;
      }

      setVoteInfoList(prev => [...prev, data]);
      setVoteCode("");
      setError("");
    } catch (err) {
      setError("查詢失敗，請稍後再試");
    }
  };

  const handleToggleVoting = async (eventId: string, startVoting: boolean) => {
    try {
      const response = await fetch('/api/toggle-voting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_id: eventId, start_voting: startVoting }),
      });
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message);
        return;
      }

      // Update the local state to reflect the new voting status
      setVoteInfoList(prev => prev.map(vote => 
        vote.id === eventId 
          ? { ...vote, is_voting_started: startVoting }
          : vote
      ));
      setError("");
    } catch (err) {
      setError("操作失敗，請稍後再試");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="輸入票券代碼"
          value={voteCode}
          onChange={(e) => setVoteCode(e.target.value)}
        />
        <Button onClick={handleSearch}>查詢</Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {voteInfoList.map((vote) => (
          <div 
            key={vote.id} 
            className="p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-semibold mb-2">{vote.title}</h3>
            <p className="text-gray-600 mb-2">{vote.description}</p>
            <div className="text-sm text-gray-500">
              <p>開始時間: {new Date(vote.startDate).toLocaleDateString()}</p>
              <p>結束時間: {new Date(vote.endDate).toLocaleDateString()}</p>
            </div>
            <Button 
              onClick={() => handleToggleVoting(vote.id, !vote.is_voting_started)}
              className="mt-2"
            >
              {vote.is_voting_started ? '停止投票' : '開始投票'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
} 