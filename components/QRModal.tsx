"use client";

import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  pointId: number;
  token: string;
  expiresAt: string;
  onClose: () => void;
}

const POINT_LABELS = ["ポイント①", "ポイント②", "ポイント③", "ポイント④", "ポイント⑤"];

export default function QRModal({ pointId, token, expiresAt, onClose }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  const calcSecondsLeft = useCallback(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }, [expiresAt]);

  useEffect(() => {
    setSecondsLeft(calcSecondsLeft());
    const id = setInterval(() => {
      const s = calcSecondsLeft();
      setSecondsLeft(s);
      if (s <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [calcSecondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isExpired = secondsLeft <= 0;
  const isUrgent = secondsLeft <= 300;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <p className="text-sm text-gray-500">QRコードを管理者に見せてください</p>
          <p className="font-bold text-indigo-700 text-lg">
            {POINT_LABELS[pointId - 1]}
          </p>
        </div>

        {isExpired ? (
          <div className="flex flex-col items-center py-8 space-y-3">
            <p className="text-4xl">⏰</p>
            <p className="font-bold text-red-600">QRコードの有効期限が切れました</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold"
            >
              閉じて再発行する
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center p-3 bg-white border-2 border-gray-100 rounded-2xl">
              <QRCodeSVG value={token} size={200} level="M" />
            </div>

            <div
              className={`mt-4 text-center py-2 rounded-xl text-sm font-bold ${
                isUrgent
                  ? "bg-red-50 text-red-600"
                  : "bg-indigo-50 text-indigo-600"
              }`}
            >
              残り時間：{minutes}分{String(seconds).padStart(2, "0")}秒
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-gray-600 underline"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
