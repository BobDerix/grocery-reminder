"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Create account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Account aangemaakt. Check je e-mail om te bevestigen.");
      setLoading(false);
      return;
    }

    if (mode === "create") {
      // Create household + join in one call (bypasses RLS via SECURITY DEFINER)
      const { error: rpcError } = await supabase.rpc(
        "create_household_with_member",
        { household_name: householdName || "Ons Huishouden" }
      );

      if (rpcError) {
        setError("Kon huishouden niet aanmaken: " + rpcError.message);
        setLoading(false);
        return;
      }
    } else {
      // Join household by invite code (bypasses RLS via SECURITY DEFINER)
      const { error: rpcError } = await supabase.rpc(
        "join_household_by_invite",
        { code: inviteCode.trim() }
      );

      if (rpcError) {
        setError(rpcError.message === "Ongeldige uitnodigingscode"
          ? "Ongeldige uitnodigingscode"
          : "Kon niet toetreden: " + rpcError.message);
        setLoading(false);
        return;
      }
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">
          Account aanmaken
        </h1>
        <p className="text-gray-500 text-center mb-6 text-sm">
          Maak een nieuw huishouden of sluit je aan bij een bestaand
        </p>

        <form onSubmit={handleRegister} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wachtwoord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {/* Toggle create / join */}
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "create"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              Nieuw huishouden
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "join"
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              Meedoen
            </button>
          </div>

          {mode === "create" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Naam huishouden
              </label>
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="bijv. Ons Huishouden"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Uitnodigingscode
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Plak de code hier"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Bezig..." : "Registreer"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Heb je al een account?{" "}
          <Link href="/login" className="text-green-600 hover:underline">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
