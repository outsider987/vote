"use client";

import { Typography } from "antd";
import EventList from "@/app/vote/event/components/EventList";
import ProtectedRoute from "@/components/ProtectedRoute";

const { Title } = Typography;

export default function EventPage() {
  return (
    <ProtectedRoute requiredPermission="/vote">
      <EventList />
    </ProtectedRoute>
  );
}
