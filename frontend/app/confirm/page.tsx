"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { executeIntent, ParseResponse } from "@/lib/api";

function truncateAddress(addr: string, chars = 8): string {
  if (!addr || addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export default function ConfirmPage() {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingAction");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      setParsed(JSON.parse(raw));
    } catch {
      router.replace("/");
    }
  }, [router]);

  async function handleConfirm() {
    if (!parsed) return;
    setLoading(true);
    setError(null);

    try {
      const result = await executeIntent(
        parsed.action_object,
        parsed.balance.address
      );
      sessionStorage.setItem("lastResult", JSON.stringify(result));
      router.push("/result");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Execution failed. Check backend logs.");
      setLoading(false);
    }
  }

  if (!parsed) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="w-6 h-6 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  const action = parsed.action_object;
  const balance = parsed.balance;

  return (
    <div className="w-full max-w-lg flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-violet-400 font-medium uppercase tracking-widest">
          Step 2 of 2
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Confirm action</h1>
        <p className="text-zinc-400">
          Review the details before submitting to Portaldot.
        </p>
      </div>

      {/* Intent echo */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Your intent
        </p>
        <p className="text-zinc-200 italic">&ldquo;{action.raw_intent}&rdquo;</p>
      </div>

      {/* Action card */}
      <div className="bg-zinc-900 border border-violet-800/50 rounded-2xl p-6 flex flex-col gap-5">
        {/* Action badge */}
        <div className="flex items-center gap-2">
          <span className="bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            {action.action}
          </span>
          <span className="text-zinc-400 text-sm">on Portaldot Mainnet</span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-zinc-500 text-xs mb-1">Validator</p>
            <p className="text-zinc-100 font-medium">{action.validator_name}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-1">Amount</p>
            <p className="text-zinc-100 font-medium">
              {action.amount_pot} <span className="text-zinc-400">POT</span>
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-zinc-500 text-xs mb-1">Validator address</p>
            <p className="font-mono text-xs text-zinc-400 break-all">
              {action.validator_address
                ? truncateAddress(action.validator_address, 12)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-1">Est. gas</p>
            <p className="text-zinc-100 font-medium">~0.001 POT</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs mb-1">Your free balance</p>
            <p className="text-zinc-100 font-medium">
              {balance.free} <span className="text-zinc-400">POT</span>
            </p>
          </div>
        </div>

        {/* AI reasoning */}
        {action.reasoning && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1 uppercase tracking-widest font-medium">
              AI reasoning
            </p>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {action.reasoning}
            </p>
          </div>
        )}

        {/* What happens */}
        <div className="text-xs text-zinc-500 flex flex-col gap-1">
          <p>On confirm:</p>
          <ul className="list-disc list-inside space-y-0.5 text-zinc-600">
            <li>
              <code className="text-zinc-500">staking.nominate</code> extrinsic
              submitted (pays POT gas)
            </li>
            <li>Intent recorded in IntentLog ink! contract (pays POT gas)</li>
          </ul>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push("/")}
          disabled={loading}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 rounded-xl px-6 py-3 font-medium transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex-2 flex-grow bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting to chain…
            </>
          ) : (
            "Confirm & Execute"
          )}
        </button>
      </div>
    </div>
  );
}
