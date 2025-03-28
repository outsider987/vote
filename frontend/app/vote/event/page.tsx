"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import CreateVoteModal from "@/components/CreateVoteModal";
import EventList from "@/components/EventList";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Vote() {
  const router = useRouter();
  const eventListRef = useRef<{ fetchEvents: () => Promise<void> }>();
  const [isModalOpen, setIsModalOpen] = useState(false);


  return (
    <ProtectedRoute requiredPermission="/vote">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="text-2xl font-bold">所有投票活動</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          建立投票
        </Button>
      </div>

      <div style={{ marginBottom: 40 }}>
        <EventList ref={eventListRef} />
      </div>

      <CreateVoteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="create"
        onSuccess={() => eventListRef.current?.fetchEvents()}
      />
    </ProtectedRoute>
  );
}
