"""LangGraph entry point for the CaudalFlow Copilot agent."""

from __future__ import annotations

import os

from dotenv import load_dotenv

from src.prompts import SYSTEM_PROMPT
from src.runtime import build_graph


load_dotenv()

runtime = os.getenv("AGENT_RUNTIME", "gemini-flash-deep")
if not (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
    runtime = "noop"
    print(
        "\n[runtime] GEMINI_API_KEY missing — using noop fallback graph.\n"
        "Set GEMINI_API_KEY in agent/.env to enable the CaudalFlow agent.\n",
        flush=True,
    )

graph = build_graph(
    runtime,
    tools=[],
    system_prompt=SYSTEM_PROMPT,
)


if __name__ == "__main__":
    import subprocess
    import sys

    raise SystemExit(
        subprocess.call(
            ["langgraph", "dev", "--port", "8133"],
            cwd=os.path.dirname(__file__),
            env=os.environ.copy(),
        )
    )
