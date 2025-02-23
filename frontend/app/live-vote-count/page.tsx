
'use client'
import { useEffect, useState } from 'react';

export default function LiveVoteCount() {
  const [voteCounts, setVoteCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/vote-updates');

    ws.onopen = () => {
      console.log('WebSocket 已連線');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setVoteCounts(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket 錯誤:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket 已關閉');
    };

    return () => ws.close();
  }, []);

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">投票結果</h2>
      <ul className="list-disc pl-6">
        {Object.entries(voteCounts).map(([candidate, count]) => (
          <li key={candidate} className="py-1">
            候選人 {candidate}: {count} 票
          </li>
        ))}
      </ul>
    </div>
  );
}
