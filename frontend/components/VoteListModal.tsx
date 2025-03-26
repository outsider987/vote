import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import moment from "moment";
import { useVoteList } from "../data/queries/useVoteList";
import type { Vote } from "../data/types";

interface VoteListModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
}

const VoteListModal = ({ isOpen, onOpenChange, eventId }: VoteListModalProps) => {
  const { data, isLoading } = useVoteList(eventId);

  const columns: ColumnsType<Vote> = [
    {
      title: '票根ID',
      dataIndex: 'vote_code',
      key: 'vote_code',
      width: 200,
    },
    {
      title: '選擇',
      dataIndex: 'candidate',
      key: 'candidate',
      render: (candidate) => (
        <span>{`${candidate.number}. ${candidate.text}`}</span>
      ),
    },
    {
      title: '投票時間',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '狀態',
      dataIndex: ['ticket', 'used'],
      key: 'ticket.used',
      render: (used) => (
        <Tag color={used ? 'green' : 'red'}>
          {used ? '已使用' : '未使用'}
        </Tag>
      ),
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>投票列表</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <Table
            columns={columns}
            dataSource={data?.votes}
            loading={isLoading}
            rowKey="vote_id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: true }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoteListModal; 