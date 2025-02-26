'use client'
import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getVoteInfo } from '../api/vote';
import { useSearchParams } from 'next/navigation';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function LiveVoteCount() {
  const [voteCounts, setVoteCounts] = useState<{ [key: string]: number }>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const voteApi = getVoteInfo();

  // Function to fetch current vote counts
  const fetchVoteCounts = async () => {
    if (!eventId) return;
    try {
      const response = await voteApi.GET_VOTE_COUNTS(eventId);
      setVoteCounts(response.data);
    } catch (error) {
      console.error('Failed to fetch vote counts:', error);
    }
  };

  // Function to setup WebSocket connection
  const setupWebSocket = () => {
    if (!eventId || isConnecting) return;

    setIsConnecting(true);
    const ws = new WebSocket(`ws://localhost:8000/ws/vote-updates`);

    ws.onopen = () => {
      console.log('WebSocket 已連線');
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setVoteCounts(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket 錯誤:', error);
      setIsConnecting(false);
    };

    ws.onclose = () => {
      console.log('WebSocket 已關閉');
      setIsConnecting(false);
      // Try to reconnect after 5 seconds
      setTimeout(() => setupWebSocket(), 5000);
    };

    return () => {
      ws.close();
      setIsConnecting(false);
    };
  };

  useEffect(() => {
    if (!eventId) return;

    // Fetch initial data
    fetchVoteCounts();

    // Setup WebSocket connection
    const cleanup = setupWebSocket();

    // Cleanup function
    return () => {
      if (cleanup) cleanup();
    };
  }, [eventId]);

  // Prepare data for the chart
  const chartData = {
    labels: Object.keys(voteCounts),
    datasets: [
      {
        label: '得票數',
        data: Object.values(voteCounts),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '即時投票結果',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {!eventId ? (
        <div className="text-center text-red-600">
          請提供活動ID以查看投票結果
        </div>
      ) : (
        <>
          <h2 className="text-3xl font-bold mb-6">投票結果</h2>
          
          {/* Chart display */}
          <div className="mb-8 bg-white p-4 rounded-lg shadow">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Table display */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4">詳細票數</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(voteCounts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([candidate, count]) => (
                  <div key={candidate} className="flex justify-between items-center p-2 bg-primary rounded">
                    <span className="font-medium">候選人 {candidate}</span>
                    <span className="text-lg font-bold text-blue-600">{count} 票</span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
