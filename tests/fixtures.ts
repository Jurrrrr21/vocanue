// Synthetic data only; never copy real caller information into fixtures.
export function reportFixture() {
  return {
    message: {
      type: "end-of-call-report",
      call: {
        id: "synthetic-call-001",
        status: "ended",
        customer: { number: "+61400000000" },
      },
      startedAt: "2026-10-17T00:00:00.000Z",
      endedAt: "2026-10-17T00:01:30.250Z",
      endedReason: "customer-ended-call",
      analysis: { summary: "Customer reported a blocked drain." },
      artifact: {
        messages: [
          { role: "system", message: "Private system instructions" },
          { role: "user", message: "My drain is blocked." },
          { role: "bot", message: "Is it draining slowly?" },
        ],
      },
    },
  };
}
