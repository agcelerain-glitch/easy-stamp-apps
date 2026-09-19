"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  pointId: number;
}

type ScanState = "idle" | "scanning" | "verifying" | "success" | "error";

export default function AdminScanner({ pointId }: Props) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [message, setMessage] = useState("");
  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);
  const processingRef = useRef(false);

  async function verifyToken(token: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanState("verifying");

    try {
      const res = await fetch("/api/stamp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setScanState("success");
        setMessage(`ポイント${data.stamp_point_id} のスタンプを付与しました！`);
        // 3秒後にスキャン再開
        setTimeout(() => {
          setScanState("idle");
          setMessage("");
          processingRef.current = false;
        }, 3000);
      } else {
        const errMap: Record<string, string> = {
          invalid_token: "無効なQRコードです",
          expired: "QRコードの有効期限が切れています",
          wrong_point: data.message ?? "このポイント用のQRコードではありません",
          already_stamped: "このユーザーはすでにスタンプ済みです",
          unauthorized: "セッションが切れました。再ログインしてください",
          timeout: "接続がタイムアウトしました",
        };
        setScanState("error");
        setMessage(errMap[data.error] ?? "エラーが発生しました");
        setTimeout(() => {
          setScanState("idle");
          setMessage("");
          processingRef.current = false;
        }, 3000);
      }
    } catch (e) {
      setScanState("error");
      if (e instanceof Error && e.name === "TimeoutError") {
        setMessage("接続がタイムアウトしました");
      } else {
        setMessage("エラーが発生しました");
      }
      setTimeout(() => {
        setScanState("idle");
        setMessage("");
        processingRef.current = false;
      }, 3000);
    }
  }

  async function startScanner() {
    if (!scannerRef.current) return;
    setScanState("scanning");

    // html5-qrcode は SSR 非対応のため動的インポート
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
    html5QrRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          verifyToken(decodedText);
        },
        undefined
      );
    } catch {
      setScanState("error");
      setMessage("カメラへのアクセスが許可されていません");
    }
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch {}
      html5QrRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (scanState === "idle" && !processingRef.current) {
      // idle に戻ったらスキャナを停止
      stopScanner();
    }
  }, [scanState]);

  return (
    <div className="flex flex-col flex-1 items-center justify-start px-4 py-8 space-y-6">
      {/* QR読み取りエリア */}
      <div
        id="qr-reader"
        ref={scannerRef}
        className={`w-72 h-72 rounded-2xl overflow-hidden bg-gray-800 border-2 ${
          scanState === "scanning" ? "border-indigo-400" : "border-gray-600"
        }`}
      />

      {/* ステータス表示 */}
      {scanState === "idle" && (
        <div className="text-center space-y-4">
          <p className="text-gray-400 text-sm">
            ユーザーのQRコードをスキャンしてください
          </p>
          <button
            onClick={startScanner}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors"
          >
            カメラを起動する
          </button>
        </div>
      )}

      {scanState === "scanning" && (
        <div className="text-center space-y-2">
          <p className="text-indigo-300 font-bold">スキャン中...</p>
          <p className="text-gray-400 text-sm">
            QRコードをカメラに向けてください
          </p>
          <button
            onClick={() => { stopScanner(); setScanState("idle"); processingRef.current = false; }}
            className="mt-2 text-xs text-gray-500 underline"
          >
            キャンセル
          </button>
        </div>
      )}

      {scanState === "verifying" && (
        <div className="flex items-center gap-3 text-yellow-300">
          <div className="w-5 h-5 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold">確認中...</p>
        </div>
      )}

      {scanState === "success" && (
        <div className="text-center space-y-2">
          <p className="text-4xl">✅</p>
          <p className="text-green-400 font-bold text-lg">{message}</p>
        </div>
      )}

      {scanState === "error" && (
        <div className="text-center space-y-2">
          <p className="text-4xl">❌</p>
          <p className="text-red-400 font-bold">{message}</p>
        </div>
      )}
    </div>
  );
}
