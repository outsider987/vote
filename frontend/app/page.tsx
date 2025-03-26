"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Typography, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import CreateVoteModal from "../components/CreateVoteModal";
import EventList from "../components/EventList";

const { Title } = Typography;

export default function Home() {
  const router = useRouter();
  const eventListRef = useRef<{ fetchEvents: () => Promise<void> }>();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check if token exists
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>投票系統</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setIsModalOpen(true)}
        >
          建立投票
        </Button>
      </div>
      
      <div style={{ marginBottom: 40 }}>
        <Title level={3} style={{ marginBottom: 16 }}>所有投票活動</Title>
        <EventList ref={eventListRef} />
      </div>
      
      <CreateVoteModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode="create"
        onSuccess={() => eventListRef.current?.fetchEvents()} 
      />
    </div>
  );
}
