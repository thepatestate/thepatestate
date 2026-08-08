"use client";
import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function JoinForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState(
    "That didn't send — check the address and try again."
  );
  const [googlePending, setGooglePending] = useState(false);

  if (!isSupabaseConfigured) {
    return <p className="lede">Citizenship opens shortly — the porch is still being wired.</p>;
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setErrorMessage("That didn't send — check the address and try again.");
      setState("error");
    } else {
      setState("sent");
    }
  }

  async function google() {
    setGooglePending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setErrorMessage("Google sign-in didn't start — try again, or use the email link.");
      setState("error");
      setGooglePending(false);
    }
  }

  if (state === "sent") {
    return (
      <div className="panel">
        <p className="eyebrow">Check your email</p>
        <h3>Your key is on the way</h3>
        <p>We sent a sign-in link to {email}. It works once and expires in an hour.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <form onSubmit={sendLink}>
        <label className="eyebrow" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ display: "block", width: "100%", padding: "12px 14px", margin: "8px 0 14px", fontFamily: "var(--mono)", fontSize: 14, border: "1.5px solid var(--line-l)", borderRadius: 2, background: "#fff", color: "var(--ink)" }}
        />
        <button className="btn solid" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email Me a Sign-In Link"}
        </button>
        {state === "error" && (
          <p className="note" style={{ marginTop: 12 }}>
            {errorMessage}
          </p>
        )}
      </form>
      <p style={{ margin: "18px 0 10px", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", color: "var(--ink-dim)" }}>OR</p>
      <button className="btn" onClick={google} disabled={googlePending}>
        {googlePending ? "Redirecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
