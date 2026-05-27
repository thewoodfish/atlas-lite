"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseIntent } from "@/lib/api";

const PLACEHOLDER_ADDRESS = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

export default function HomePage() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [userAddress, setUserAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim() || !userAddress.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await parseIntent(message.trim(), userAddress.trim());

      if (result.action_object.action === "unknown") {
        setError(
          result.action_object.message ||
            "I can currently help with staking and balance checks on Portaldot."
        );
        setLoading(false);
        return;
      }

      // Store parsed action for the confirm page
      sessionStorage.setItem("pendingAction", JSON.stringify(result));
      router.push("/confirm");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Is the backend running?");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl flex flex-col gap-8">
      {/* Hero */}
      <div className="text-center flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight">
          What would you like to do{" "}
          <span className="text-violet-400">onchain?</span>
        </h1>
        <p className="text-zinc-400 text-lg">
          Type a goal in plain English. Atlas resolves the best action and
          submits it to Portaldot for you.
        </p>
      </div>

      {/* Example pills */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[
          "Stake 20 POT to the safest validator",
          "Stake 50 POT to the cheapest validator",
          "What's my balance?",
        ].map((ex) => (
          <button
            key={ex}
            onClick={() => setMessage(ex)}
            className="text-xs bg-zinc-900 border border-zinc-700 hover:border-violet-600 text-zinc-300 hover:text-violet-300 rounded-full px-3 py-1.5 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4"
      >
        {/* Intent message */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-zinc-400 font-medium">
            Your intent
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Stake 20 POT to the safest validator"
            rows={3}
            className="bg-zinc-950 border border-zinc-700 focus:border-violet-600 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 resize-none outline-none transition-colors text-sm"
            disabled={loading}
          />
        </div>

        {/* Wallet address */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-zinc-400 font-medium">
            Your wallet address{" "}
            <span className="text-zinc-600 font-normal">(ss58)</span>
          </label>
          <input
            type="text"
            value={userAddress}
            onChange={(e) => setUserAddress(e.target.value)}
            placeholder={PLACEHOLDER_ADDRESS}
            className="bg-zinc-950 border border-zinc-700 focus:border-violet-600 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 font-mono text-sm outline-none transition-colors"
            disabled={loading}
          />
          <p className="text-xs text-zinc-600">
            Used to fetch your balance and provide context to the AI. The demo
            hot wallet signs the transaction.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !message.trim() || !userAddress.trim()}
          className="bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl px-6 py-3 font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Querying chain & parsing intent…
            </>
          ) : (
            "Parse Intent →"
          )}
        </button>
      </form>

      {/* Stubbed coming-soon actions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
          Coming soon
        </p>
        <div className="flex flex-wrap gap-2">
          {["Governance voting", "Token transfer", "Identity management", "Batch calls"].map(
            (item) => (
              <span
                key={item}
                className="text-xs bg-zinc-800 text-zinc-500 rounded-full px-3 py-1"
              >
                {item}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
}
