"use client";
import { Suspense, useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { getVoteInfo } from "@/app/api/vote";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";

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
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LiveVoteContent />
    </Suspense>
  );
}

function LiveVoteContent() {
  const [voteCounts, setVoteCounts] = useState([]);
  const [event, setEvent] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  // State to track which candidate is marked as "當選"
  const [elected, setElected] = useState({});
  // New state to track which candidate is marked as "備選"
  const [backup, setBackup] = useState({});
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const voteApi = getVoteInfo();

  // Fetch current vote counts
  const fetchVoteCounts = async () => {
    if (!eventId) return;
    try {
      const response = await voteApi.GET_VOTE_COUNTS(eventId);
      setVoteCounts(response.data.vote_counts);
      setEvent(response.data.event);
    } catch (error) {
      console.error("Failed to fetch vote counts:", error);
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    if (!eventId || isConnecting) return;

    setIsConnecting(true);
    const ws = new WebSocket(`ws://localhost:8000/ws/vote-updates`);

    ws.onopen = () => {
      console.log("WebSocket 已連線");
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setVoteCounts(data);
    };

    ws.onerror = (error) => {
      console.error("WebSocket 錯誤:", error);
      setIsConnecting(false);
    };

    ws.onclose = () => {
      console.log("WebSocket 已關閉");
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

    // Fetch initial data and setup WebSocket
    fetchVoteCounts();
    const cleanup = setupWebSocket();
    return () => {
      if (cleanup) cleanup();
    };
  }, [eventId]);

  // Prepare data for the chart
  const chartData = {
    labels: voteCounts.map((v) => v.candidate.number),
    datasets: [
      {
        label: "得票數",
        data: voteCounts.map((v) => v.count),
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "即時投票結果",
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

  // Build a frequency map of vote counts to detect ties.
  const countFrequency = {};
  voteCounts.forEach((v) => {
    countFrequency[v.count] = (countFrequency[v.count] || 0) + 1;
  });

  // Toggle elected status for a candidate
  const handleElectedChange = (candidateNumber: number) => {
    setElected((prev) => ({
      ...prev,
      [candidateNumber]: !prev[candidateNumber],
    }));
  };

  // Toggle backup status for a candidate
  const handleBackupChange = (candidateNumber: number) => {
    setBackup((prev) => ({
      ...prev,
      [candidateNumber]: !prev[candidateNumber],
    }));
  };

  // Calculate total counts for elected and backup candidates.
  const electedCount = Object.values(elected).filter(Boolean).length;
  const backupCount = Object.values(backup).filter(Boolean).length;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {!eventId ? (
        <div className="text-center text-red-600">
          請提供活動ID以查看投票結果
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-6">{event?.title}</h1>
          <h2 className="text-3xl font-bold mb-6">投票結果</h2>

          {/* Chart display */}
          <div className="mb-8 bg-white p-4 rounded-lg shadow">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Display selected and backup counts */}
          <div className="mb-4 p-4 bg-primary rounded shadow">
            <p className="text-lg font-semibold ">
              當選數: {electedCount} | 備選數: {backupCount}
            </p>
          </div>

          {/* Table display */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-black">詳細票數</h3>
            <div className="grid grid-cols-2 gap-4">
              {voteCounts
                .sort((a, b) => {
                  // First, sort descending by count.
                  if (b.count !== a.count) {
                    return b.count - a.count;
                  }
                  // If counts are equal, sort ascending by candidate number.
                  return a.candidate.number - b.candidate.number;
                })
                .map((v) => {
                  // Check if the candidate's vote count is tied with another candidate.
                  const isTie = countFrequency[v.count] > 1;
                  let rowClass =
                    "flex justify-between items-center p-2 rounded transition-colors duration-200";
                  if (elected[v.candidate.number]) {
                    rowClass += " bg-green text-black";
                  } else if (backup[v.candidate.number]) {
                    rowClass += " bg-yellow text-black";
                  } else {
                    rowClass += " bg-gray-200 text-black";
                  }
                  return (
                    <div
                      key={v.candidate.text}
                      className={clsx(
                        rowClass,
                        "flex justify-between items-center p-2 rounded transition-colors duration-200 gap-2"
                      )}
                    >
                      <div className="flex-[1] flex flex-col items-center gap-2">
                        {/* Checkbox for marking as "當選" */}
                        <div>
                          <input
                            type="checkbox"
                            checked={elected[v.candidate.number] || false}
                            onChange={() =>
                              handleElectedChange(v.candidate.number)
                            }
                            className="mr-2"
                          />
                          <span className="font-medium">當選</span>
                        </div>
                        <div>
                          {/* Checkbox for marking as "備選" */}
                          <input
                            type="checkbox"
                            checked={backup[v.candidate.number] || false}
                            onChange={() =>
                              handleBackupChange(v.candidate.number)
                            }
                            className=" mr-2"
                          />

                          <span className="font-medium">備選</span>
                        </div>
                      </div>
                      <div className="flex font-medium flex-[3]">
                        <span>{`${v.candidate.text}`}</span>
                        <span className=" min-w-[30px] text-lg font-bold ">
                          {v.candidate.number}號
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-[1] justify-end">
                        <span
                          className={clsx(
                            "text-error  border-2 border-error rounded-full px-2 py-1 w-[38px] h-[38px] flex items-center justify-center",
                            elected[v.candidate.number] &&
                              "border-solid font-extrabold",
                            !elected[v.candidate.number] && "hidden"
                          )}
                        >
                          {elected[v.candidate.number] && "當選"}
                        </span>
                        <span className="text-lg font-bold text-blue-600 ">
                          {v.count} 票{" "}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
