"use client";

import VoteInfoList from "./components/VoteInfoList";
import CreateVoteModal from "./components/CreateVoteModal";
import EventList from "./components/EventList";

export default function Home() {
  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">投票系統</h2>
        <CreateVoteModal />
      </div>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-2xl font-bold mb-6">所有投票活動</h3>
          <EventList />
        </div>

        {/* <div>
          <h3 className="text-2xl font-bold mb-6">查詢投票資訊</h3>
          <VoteInfoList />
        </div> */}
      </div>
      
    </div>
  );
}
