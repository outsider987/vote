"use client";

import { Modal, Button } from "antd";
import type { Event } from "../../../../data/types";

interface DeleteModalProps {
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: (isOpen: boolean) => void;
  eventToDelete: Event | null;
  onDelete: (eventId: string) => Promise<void>;
}

export default function DeleteModal({
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  eventToDelete,
  onDelete,
}: DeleteModalProps) {
  return (
    <Modal
      title="確認刪除"
      open={isDeleteModalOpen}
      onCancel={() => setIsDeleteModalOpen(false)}
      footer={[
        <Button key="cancel" onClick={() => setIsDeleteModalOpen(false)}>
          取消
        </Button>,
        <Button
          key="delete"
          danger
          type="primary"
          onClick={async () => {
            if (eventToDelete) {
              await onDelete(eventToDelete.id);
              setIsDeleteModalOpen(false);
            }
          }}
        >
          確認刪除
        </Button>,
      ]}
    >
      <p>確定要刪除事件 "{eventToDelete?.title}" 嗎？此操作無法恢復。</p>
    </Modal>
  );
} 