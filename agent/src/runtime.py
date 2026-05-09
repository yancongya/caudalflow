"""Runtime factory for the CaudalFlow Copilot LangGraph agent."""

from __future__ import annotations

import os
from typing import Literal

from copilotkit import CopilotKitMiddleware
from langgraph.graph.state import CompiledStateGraph

RuntimeName = Literal["gemini-flash-deep", "gemini-flash-react", "noop"]

NOOP_FALLBACK_MESSAGE = (
    "Set GEMINI_API_KEY in agent/.env to enable the CaudalFlow Copilot agent. "
    "The frontend and runtime wiring are installed."
)


def build_graph(
    runtime: str,
    *,
    tools: list,
    system_prompt: str,
) -> CompiledStateGraph:
    middleware = [CopilotKitMiddleware()]

    if runtime == "noop":
        return _build_noop(NOOP_FALLBACK_MESSAGE)
    if runtime == "gemini-flash-react":
        return _build_gemini_react(tools, system_prompt, middleware)
    return _build_gemini_deep(tools, system_prompt, middleware)


from langgraph.graph.message import add_messages as _add_messages
from typing_extensions import Annotated as _Annotated, TypedDict as _TypedDict


class _NoopState(_TypedDict):
    messages: _Annotated[list, _add_messages]


def _build_noop(message: str) -> CompiledStateGraph:
    from langchain_core.messages import AIMessage
    from langgraph.graph import END, START, StateGraph

    def _respond(_state: _NoopState) -> dict:
        return {"messages": [AIMessage(content=message, id="noop-fallback")]}

    graph = StateGraph(_NoopState)
    graph.add_node("respond", _respond)
    graph.add_edge(START, "respond")
    graph.add_edge("respond", END)
    return graph.compile()


def _gemini_llm():
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "stub"
    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite"),
        temperature=float(os.getenv("AGENT_TEMPERATURE", "0")),
        api_key=api_key,
    )


def _build_gemini_deep(
    tools: list,
    system_prompt: str,
    middleware: list,
) -> CompiledStateGraph:
    from deepagents import create_deep_agent

    return create_deep_agent(
        model=_gemini_llm(),
        tools=tools,
        system_prompt=system_prompt,
        middleware=middleware,
    )


def _build_gemini_react(
    tools: list,
    system_prompt: str,
    middleware: list,
) -> CompiledStateGraph:
    from langchain.agents import create_agent

    return create_agent(
        model=_gemini_llm(),
        tools=tools,
        system_prompt=system_prompt,
        middleware=middleware,
    )
