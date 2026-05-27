"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExecuteResponse } from "@/lib/api";

const EXPLORER_BASE = "https://portaldot.world";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-zinc-500 hover:text-violet-400 transition-colors px-2 py-0.5 rounded border border-zinc-700 hover:border-violet-600 ml-2"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
        {label}
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="font-mono text-xs text-zinc-300 break-all">{value}</span>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<ExecuteResponse | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("lastResult");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setResult(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!result) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="w-6 h-6 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  const action = result.action;

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">
      {/* Success banner */}
      <div className="bg-emerald-950 border border-emerald-700 rounded-2xl px-6 py-5 flex items-start gap-4">
        <span className="text-3xl">✅</span>
        <div>
          <h1 className="text-xl font-bold text-emerald-300">
            Transaction confirmed!
          </h1>
          <p className="text-emerald-400 text-sm mt-1">
            Your intent has been executed and recorded on Portaldot Mainnet.
          </p>
        </div>
      </div>

      {/* Intent summary */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Intent executed
        </p>
        <p className="text-zinc-200 italic">
          &ldquo;{action.raw_intent}&rdquo;
        </p>
        <div className="mt-2 flex gap-4 text-sm text-zinc-400">
          <span>
            Validator:{" "}
            <span className="text-zinc-200">{action.validator_name}</span>
          </span>
          <span>
            Amount:{" "}
            <span className="text-zinc-200">{action.amount_pot} POT</span>
          </span>
        </div>
      </div>

      {/* Chain details */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
        <HashRow label="Extrinsic hash" value={result.extrinsic_hash} />
        <HashRow label="Block hash" value={result.block_hash} />

        {/* Contract logged */}
        <div className="flex items-center gap-3 py-3 border-t border-zinc-800">
          <span className={result.contract_logged ? "text-emerald-400" : "text-red-400"}>
            {result.contract_logged ? "✅" : "⚠️"}
          </span>
          <div>
            <p className="text-sm font-medium">Intent logged on-chain</p>
            <p className="text-xs text-zinc-500">
              {result.contract_logged
                ? "Recorded in IntentLog ink! contract · POT gas consumed"
                : "Contract log failed — nomination still succeeded"}
            </p>
          </div>
        </div>

        {/* Explorer link */}
        <a
          href={`${EXPLORER_BASE}/extrinsic/${result.extrinsic_hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border border-zinc-700 hover:border-violet-600 text-zinc-300 hover:text-violet-300 rounded-xl px-4 py-3 text-sm font-medium transition-colors"
        >
          View on Portaldot Explorer ↗
        </a>
      </div>

      {/* Try another */}
      <button
        onClick={() => {
          sessionStorage.removeItem("pendingAction");
          sessionStorage.removeItem("lastResult");
          router.push("/");
        }}
        className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
      >
        Try another intent
      </button>
    </div>
  );
}
