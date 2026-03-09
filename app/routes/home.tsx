import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Connect 4 Good" },
    {
      name: "description",
      content:
        "Connecting charities with companies for CSRF volunteering days.",
    },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500 mb-6 shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </div>
        <h1 className="text-5xl font-bold text-gray-800 dark:text-white tracking-tight mb-3">
          Connect 4 Good
        </h1>
        <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mb-3">
          Your workforce. Their mission. One perfect match.
        </p>
        <p className="text-base text-gray-600 dark:text-gray-300 max-w-lg mx-auto leading-relaxed">
          We bridge the gap between companies with willing hands and charities
          with meaningful work — turning volunteer days into real impact.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Charity column */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-emerald-100 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
            I&apos;m a Charity
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
            Register your charity and connect with companies whose employees
            want to volunteer their time and skills for your cause.
          </p>
          <Link
            to="/register-charity"
            className="mt-auto w-full py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-300 text-center"
          >
            Register as a Charity
          </Link>
        </div>

        {/* Company column */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 flex flex-col items-center text-center border border-teal-100 dark:border-gray-700 hover:shadow-2xl transition-shadow duration-300">
          <div className="w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 text-teal-600 dark:text-teal-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
            I&apos;m a Company
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm leading-relaxed">
            Register your company and find meaningful charities where your team
            can spend their CSRF volunteering days making a real difference.
          </p>
          <Link
            to="/dashboard"
            className="mt-auto w-full py-3 px-6 rounded-xl bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-teal-300 text-center"
          >
            Register as a Company
          </Link>
        </div>
      </div>

      <p className="mt-10 text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <a
          href="#"
          className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
