"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface LinkQrCardProps {
  title: string;
  emoji: string;
  url: string;
  note?: string;
}

export default function LinkQrCard({ title, emoji, url, note }: LinkQrCardProps) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrWrapRef = useRef<HTMLDivElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard 不可環境は無視（ユーザーは表示URLを手動選択できる）
    }
  }

  function handleDownloadPng() {
    const canvas = qrWrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <h2 className="font-bold text-gray-100">{title}</h2>
      </div>
      {note && <p className="text-xs text-gray-500">{note}</p>}

      <p className="font-mono text-sm text-indigo-300 break-all bg-gray-950 rounded-lg px-3 py-2 border border-gray-800">
        {url}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          {copied ? "コピーしました ✓" : "コピー"}
        </button>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
        >
          {showQr ? "QRを隠す" : "QRを表示"}
        </button>
        {showQr && (
          <button
            onClick={handleDownloadPng}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
          >
            PNG保存
          </button>
        )}
      </div>

      {showQr && (
        <div ref={qrWrapRef} className="flex justify-center bg-white rounded-xl p-4">
          <QRCodeCanvas value={url} size={200} level="M" marginSize={4} />
        </div>
      )}
    </div>
  );
}
