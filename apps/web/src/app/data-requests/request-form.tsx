"use client";

import { useState, type FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function DataRequestForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [requestType, setRequestType] = useState<"delete" | "export">("export");
  const [status, setStatus] = useState<"idle" | "error" | "loading" | "success">("idle");
  const [result, setResult] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setResult("");
    const session = typeof window !== "undefined" ? localStorage.getItem("fleetcore-session") : undefined;
    let token: string | undefined;
    try {
      token = session ? (JSON.parse(session) as { accessToken?: string }).accessToken : undefined;
    } catch {
      token = undefined;
    }
    if (!token) {
      setStatus("error");
      setResult("Please sign in as workspace owner before submitting a data request.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/compliance/data-subject-requests`, {
        body: JSON.stringify({ email, message, requestType }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
      });
      const body = await response.json() as { data?: { id: string; status: string }; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Request failed");
      setStatus("success");
      setResult(`Request ${body.data?.id ?? ""} created with status ${body.data?.status ?? "received"}.`);
      setMessage("");
    } catch (error) {
      setStatus("error");
      setResult(error instanceof Error ? error.message : "Unable to create request");
    }
  }

  return (
    <form className="data-request-form" onSubmit={(event) => void submit(event)}>
      <label>
        Request type
        <select value={requestType} onChange={(event) => setRequestType(event.target.value as "delete" | "export")}>
          <option value="export">Export my workspace data</option>
          <option value="delete">Delete account / deletion review</option>
        </select>
      </label>
      <label>
        Account email
        <input autoComplete="email" inputMode="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Details
        <textarea maxLength={1000} placeholder="Optional context for the privacy review" value={message} onChange={(event) => setMessage(event.target.value)} />
      </label>
      <button className="primary-button" disabled={status === "loading"} type="submit">
        {status === "loading" ? "Submitting..." : "Submit request"}
      </button>
      {result ? <p className={`data-request-state ${status}`}>{result}</p> : null}
    </form>
  );
}
