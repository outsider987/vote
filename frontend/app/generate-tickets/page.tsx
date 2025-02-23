// pages/generate-tickets.tsx
'use client'
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';

export default function GenerateTickets() {
  const [tickets, setTickets] = useState<string[]>([]);
  const [ticketCount, setTicketCount] = useState(1);

  const handleGenerate = () => {
    const newTickets: string[] = [];
    for (let i = 0; i < ticketCount; i++) {
      const voteCode = Math.random().toString(36).substring(2, 10);
      newTickets.push(voteCode);
    }
    setTickets(newTickets);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">票券產生 (QR Code)</h2>
      <div className="flex items-center space-x-4 mb-6">
        <label className="font-medium">票券數量:</label>
        <input
          type="number"
          value={ticketCount}
          onChange={(e) => setTicketCount(Number(e.target.value))}
          min="1"
          className="border rounded p-2 w-20"
        />
        <Button onClick={handleGenerate}>產生票券</Button>
      </div>
      <div className="flex flex-wrap">
        {tickets.map((ticket, index) => (
          <div key={index} className="m-4 p-4 border rounded text-center">
            <QRCodeSVG value={ticket} size={128} />
            <p className="mt-2 text-sm">{ticket}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
