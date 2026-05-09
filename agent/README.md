# CaudalFlow Copilot Agent

Local LangGraph agent used by the Vite app through the CopilotKit BFF.

Run from the repository root:

```bash
npm run install:agent
npm run dev:copilot
```

Create `agent/.env` with:

```bash
GEMINI_API_KEY=...
```

Without a Gemini key, the graph boots in a noop fallback mode so the frontend
and runtime wiring can still be verified.
