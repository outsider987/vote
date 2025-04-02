"use client";

import { useEffect, useState } from "react";
import { message } from "antd";
import ReactDOM from "react-dom/client";
import QRCode from "react-qr-code";
import type { Event } from "../../../../data/types";
import type { Ticket } from "../../../../data/types";

interface QRCodePrinterProps {
  tickets?: Ticket[];
  event: Event | null;
  isPrinting: boolean;
  onPrintComplete: () => void;
}

export default function QRCodePrinter({ 
  tickets = [], 
  event, 
  isPrinting, 
  onPrintComplete 
}: QRCodePrinterProps) {
  
  const getVoteCodeURL = (voteCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/client/vote?vote_code=${voteCode}`;
    }
    return `/client/vote?vote_code=${voteCode}`;
  };

  // Printing function
  const doPrint = (currentEvent: Event, currentTickets: Ticket[]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      <style>
        @media print {
          @page { size: A4; margin: 0.5cm; }
          body { margin: 0; padding: 0; }
          .page { break-after: page; padding: 0.5cm; }
          .page:last-child { break-after: auto; }
          .qr-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 0.3cm;
          }
          .qr-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0.3cm;
            border: 1px solid #ccc;
            background: white;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .qr-code {
            width: 3cm;
            height: 3cm;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-code svg { width: 100%; height: 100%; }
          .vote-code {
            margin-top: 0.2cm;
            font-size: 8pt;
            font-family: monospace;
          }
          .page-header {
            text-align: center;
            margin-bottom: 0.5cm;
            font-size: 12pt;
            font-weight: bold;
          }
        }
      </style>
    `;

    // Create a temporary container to render QR codes and capture their SVG markup.
    const tempDiv = document.createElement("div");
    const root = ReactDOM.createRoot(tempDiv);
    root.render(
      <div style={{ display: "none" }}>
        {currentTickets.map((ticket) => (
          <div key={ticket.voteCode} id={`qr-${ticket.voteCode}`}>
            <QRCode
              value={getVoteCodeURL(ticket.voteCode)}
              size={256}
              level="M"
            />
          </div>
        ))}
      </div>
    );

    // Wait briefly to allow QR codes to render.
    setTimeout(() => {
      const itemsPerPage = 25;
      const pages = Math.ceil(currentTickets.length / itemsPerPage);

      const content = `
        <html>
          <head>
            <title>Print QR Codes - ${currentEvent.title}</title>
            ${styles}
          </head>
          <body>
            ${Array.from({ length: pages }, (_, pageIndex) => {
              const pageTickets = currentTickets.slice(
                pageIndex * itemsPerPage,
                (pageIndex + 1) * itemsPerPage
              );
              return `
                <div class="page">
                  <div class="page-header">
                    ${currentEvent.title} - 投票券 (第 ${
                pageIndex + 1
              } 頁，共 ${pages} 頁)
                  </div>
                  <div class="qr-grid">
                    ${pageTickets
                      .map((ticket) => {
                        const qrElement = tempDiv.querySelector(
                          `#qr-${ticket.voteCode}`
                        );
                        const qrSvg = qrElement?.innerHTML || "";
                        return `
                        <div class="qr-item">
                          <div class="qr-code">${qrSvg}</div>
                          <div class="vote-code">${ticket.voteCode}</div>
                        </div>
                      `;
                      })
                      .join("")}
                  </div>
                </div>
              `;
            }).join("")}
          </body>
        </html>
      `;

      root.unmount();

      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
        };
      };
    }, 100);
  };

  // Watch for changes to tickets while printing.
  useEffect(() => {
    if (isPrinting && event) {
      if (tickets && tickets.length > 0) {
        doPrint(event, tickets);
        onPrintComplete();
      } else {
        // If tickets are still empty after 1 second, alert the user.
        const timeoutId = setTimeout(() => {
          if (tickets.length === 0) {
            message.warning("目前沒有票券可列印");
            onPrintComplete();
          }
        }, 1000);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [tickets, isPrinting, event, onPrintComplete]);

  return null; // This is a utility component with no UI
} 