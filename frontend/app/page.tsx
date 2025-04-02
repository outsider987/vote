"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Typography, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import CreateVoteModal from "../components/CreateVoteModal";
import EventList from "./vote/event/components/EventList";

const { Title } = Typography;

export default function Home() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 className="text-2xl font-bold">DashBoad</h1>
      </div>
    </div>
  );
}
