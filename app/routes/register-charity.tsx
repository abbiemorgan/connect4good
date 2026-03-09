import { useState } from "react";
import { useNavigate } from "react-router";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import type { Route } from "./+types/register-charity";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Register a Charity – Connect 4 Good" },
    { name: "description", content: "Register your charity on Connect 4 Good." },
  ];
}

export default function RegisterCharity() {
  const navigate = useNavigate();
  const [charityName, setCharityName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!charityName.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      await addDoc(collection(db, "charities"), {
        name: charityName.trim(),
        createdAt: serverTimestamp(),
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center px-4 py-16">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 max-w-md w-full text-center border border-emerald-100 dark:border-gray-700">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">
            Charity Registered!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{charityName}</span> has been added to Connect 4 Good. Companies can now find you and send volunteers your way.
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center px-4 py-16">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 max-w-md w-full border border-emerald-100 dark:border-gray-700">
        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 mb-8 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Register your Charity</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect 4 Good</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="charityName"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Charity name <span className="text-red-500">*</span>
            </label>
            <input
              id="charityName"
              type="text"
              required
              value={charityName}
              onChange={(e) => setCharityName(e.target.value)}
              placeholder="e.g. Greenpeace UK"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-3">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "loading" || !charityName.trim()}
            className="w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300"
          >
            {status === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Registering…
              </span>
            ) : (
              "Register Charity"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
