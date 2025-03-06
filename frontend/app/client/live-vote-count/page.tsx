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
import { useTickets } from "@/app/data/queries/tickets";
import { useVoteContext } from "@/app/store/VoteContext";
import { Button } from "@/components/ui/button";

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
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  const voteApi = getVoteInfo();
  const { data: tickets = [] } = useTickets(eventId);

  // Use VoteContext instead of local state
  const {
    selected: selected,
    backup,
    setElected,
    setBackup,
    currentEventId,
    setCurrentEventId,
  } = useVoteContext();

  // Set current event ID when component mounts or eventId changes
  useEffect(() => {
    if (eventId) {
      setCurrentEventId(eventId);
    }
  }, [eventId, setCurrentEventId]);

  // Fetch current vote counts and check if event is archived
  const fetchVoteCounts = async () => {
    if (!eventId) return;
    try {
      const response = await voteApi.GET_VOTE_COUNTS(eventId);
      setVoteCounts(response.data.vote_counts);
      setEvent(response.data.event);

      // If event is archived, fetch archived results
      if (response.data.event.is_archived) {
        const archivedResponse = await voteApi.GET_ARCHIVED_RESULT(eventId);
        const archivedData = archivedResponse.data;

        // Set elected and backup from archived data
        const archivedElected = {};
        const archivedBackup = {};

        archivedData.vote_result.forEach((vote) => {
          if (vote.candidate) {
            archivedElected[vote.candidate.number] = true;
          }
          // if (vote.candidate) {
          //   archivedBackup[vote.candidate.number] = true;
          // }
        });

        // Update context with archived data
        Object.keys(archivedElected).forEach((num) => {
          setElected(eventId, parseInt(num), true);
        });
        Object.keys(archivedBackup).forEach((num) => {
          setBackup(eventId, parseInt(num), true);
        });
      }
    } catch (error) {
      console.error("Failed to fetch vote counts:", error);
    }
  };

  // Handle archive button click
  const handleArchive = async () => {
    if (!eventId) return;
    try {
      const selectedData = Object.keys(selected).map((key) => ({
        candidate: {
          number: parseInt(key),
          text: voteCounts.find((v) => v.candidate.number === parseInt(key))
            ?.candidate.text,
        },
      }));
      await voteApi.ARCHIVE_VOTE_RESULT(eventId, selectedData);

      alert("投票結果已封存");
      // Refresh data
      fetchVoteCounts();
    } catch (error) {
      console.error("Failed to archive vote result:", error);
      alert(
        `封存失敗: ${error.response.data.error.message} 
        清單: ${JSON.stringify(
          error.response.data.error.details.remaining_tickets
        )}`
      );
    }
  };

  // Setup WebSocket connection
  const setupWebSocket = () => {
    if (!eventId || isConnecting) return;

    setIsConnecting(true);
    // const ws = new WebSocket(`ws://localhost:8000/ws/vote-updates`);

    // ws.onopen = () => {
    //   console.log("WebSocket 已連線");
    //   setIsConnecting(false);
    // };

    // ws.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   setVoteCounts(data);
    // };

    // ws.onerror = (error) => {
    //   console.error("WebSocket 錯誤:", error);
    //   setIsConnecting(false);
    // };

    // ws.onclose = () => {
    //   console.log("WebSocket 已關閉");
    //   setIsConnecting(false);
    //   // Try to reconnect after 5 seconds
    //   setTimeout(() => setupWebSocket(), 5000);
    // };

    return () => {
      // ws.close();
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
    labels: voteCounts
      .sort((a, b) => {
        // First, sort descending by count.
        // if (b.count !== a.count) {
        //   return b.count - a.count;
        // }
        // If counts are equal, sort ascending by candidate number.
        return a.candidate.number - b.candidate.number;
      })
      .map((v) => v.candidate.number),
    datasets: [
      {
        label: "得票數",
        data: voteCounts
          .sort((a, b) => {
            // First, sort descending by count.
            // if (b.count !== a.count) {
            //   return b.count - a.count;
            // }
            // If counts are equal, sort ascending by candidate number.
            return a.candidate.number - b.candidate.number;
          })
          .map((v) => v.count),
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
        text: `${event?.title} 即時投票結果 `,
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
    if (!eventId) return;
    setElected(eventId, candidateNumber, !selected[candidateNumber]);
  };

  // Toggle backup status for a candidate
  const handleBackupChange = (candidateNumber: number) => {
    if (!eventId) return;
    setBackup(eventId, candidateNumber, !backup[candidateNumber]);
  };

  // Calculate total counts for elected and backup candidates
  const electedCount = Object.values(selected).filter(Boolean).length;
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
          <div className="flex gap-2 justify-between items-center">
            <p className="text-lg font-semibold">活動ID: {event?.id}</p>
          </div>

          {/* Chart display */}
          <div className="mb-8 bg-white p-4 rounded-lg shadow">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Display selected and backup counts */}
          <div className="flex  justify-between mb-4 p-4 bg-primary rounded shadow">
            <p className="text-lg flex items-center font-semibold ">
              當選數: {electedCount} | 備選數: {backupCount}
            </p>
            <div className="flex p-2 bg-black gap-4 mt-2 text-sm text-gray-500">
              <p className="text-red">
                已使用票券: {tickets?.filter((ticket) => ticket.used).length}
              </p>
              <p className="text-green">
                未使用票券: {tickets?.filter((ticket) => !ticket.used).length}
              </p>
              <p className="text-gray-100">總票券數: {tickets.length}</p>
            </div>
          </div>

          {/* Table display */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex mb-4 items-center justify-between">
              <h3 className="text-xl font-semibold  text-black">詳細票數</h3>
              <span className="text-sm text-gray-500">
                {!event?.is_archived && (
                  <Button
                    onClick={handleArchive}
                    variant="success"
                    className=" text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    封存投票結果
                  </Button>
                )}{" "}
              </span>
            </div>
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
                  if (selected[v.candidate.number]) {
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
                            checked={selected[v.candidate.number] || false}
                            onChange={() =>
                              handleElectedChange(v.candidate.number)
                            }
                            className="mr-2"
                            disabled={event?.is_archived}
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
                            className="mr-2"
                            disabled={event?.is_archived}
                          />
                          <span className="font-medium">備選</span>
                        </div>
                      </div>
                      <div className="flex justify-between font-medium gap-2 flex-[3]">
                        <span className="flex items-center min-w-[30px] text-lg font-bold ">
                          {v.candidate.number}號
                        </span>
                        <span className="text-lg font-bold ">
                          {v.candidate.text}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-[1] justify-end">
                        <span
                          className={clsx(
                            "text-error  border-2 border-error rounded-full px-2 py-1 w-[38px] h-[38px] flex items-center justify-center",
                            selected[v.candidate.number] &&
                              "border-solid font-extrabold",
                            !selected[v.candidate.number] && "hidden"
                          )}
                        >
                          {selected[v.candidate.number] && "當選"}
                        </span>
                        <span className="text-lg font-bold text-blue-600 min-w-[33px]">
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
