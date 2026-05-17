import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAgent, useFrontendTool } from '@copilotkit/react-core/v2';
import { useShallow } from 'zustand/react/shallow';
import { z } from 'zod';
import { Eye, GitBranch, Merge, Plus, Sparkles } from 'lucide-react';
import { BranchProposalCard } from './BranchProposalCard';
import { ChartRenderer } from './ChartRenderer';
import { useFlowStore } from '../../stores/flowStore';
import { useChatStore } from '../../stores/chatStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { buildCanvasAgentState } from './canvasAgentState';
import {
  focusNode,
  createNodeAtEnd,
  handleCreateBranchFromNode,
  handleMergeChatNodes,
  handleDeleteChatNode,
  handleAppendNodeMessage,
  handleUpdateChatNode,
  handleHighlightWorkspaceFinding,
} from './canvasHandlers';
import type { ChatMessage, MessageRole } from '../../types/chat';

const EMPTY_MESSAGES: ChatMessage[] = [];
const roleSchema = z.enum(['system', 'user', 'assistant']);

type NodePreviewArgs = {
  nodeId?: string;
  title?: string;
  summary?: string;
};

type MergePlanArgs = {
  title?: string;
  nodeIds?: string[];
  rationale?: string;
  steps?: string[];
};

function LiveNodePreview({ args }: { args: NodePreviewArgs }) {
  const node = useFlowStore((state) => state.nodes.find((item) => item.id === args.nodeId));
  const messages = useChatStore(
    (state) => args.nodeId
      ? state.conversations[args.nodeId]?.messages ?? EMPTY_MESSAGES
      : EMPTY_MESSAGES
  );
  const { setCenter } = useReactFlow();
  const title = args.title ?? node?.data.topic ?? 'Node preview';
  const body =
    args.summary ??
    [...messages].reverse().find((message) => message.role === 'assistant')?.content ??
    'No assistant response yet.';

  return (
    <div className="my-2 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-neutral-100 shadow-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Sparkles size={15} className="text-accent-400" />
        <span className="truncate">{title}</span>
      </div>
      <p className="line-clamp-4 text-xs leading-5 text-neutral-300">{body}</p>
      {node && (
        <button
          type="button"
          onClick={() => focusNode(node.id, setCenter)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-200 transition-colors hover:border-accent-500 hover:text-accent-300"
        >
          <Eye size={13} />
          Focus
        </button>
      )}
    </div>
  );
}

function LiveMergePlan({ args }: { args: MergePlanArgs }) {
  const nodes = useFlowStore(
    useShallow((state) => state.nodes.filter((node) => args.nodeIds?.includes(node.id)))
  );
  return (
    <div className="my-2 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-neutral-100 shadow-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Merge size={15} className="text-accent-400" />
        <span>{args.title ?? 'Preparing merge plan...'}</span>
      </div>
      {args.rationale && <p className="mb-2 text-xs leading-5 text-neutral-300">{args.rationale}</p>}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {nodes.map((node) => (
          <span key={node.id} className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">
            {node.data.topic}
          </span>
        ))}
      </div>
      {args.steps?.length ? (
        <ol className="space-y-1 text-xs text-neutral-300">
          {args.steps.map((step, index) => (
            <li key={`${step}-${index}`}>{index + 1}. {step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function CanvasCopilotBridge() {
  const { agent } = useAgent();
  const { setCenter } = useReactFlow();
  const lastSyncedStateRef = useRef('');
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const nodeCount = useFlowStore((state) => state.nodes.length);

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const syncAgentState = useCallback(() => {
    if (!agent) return;
    const state = buildCanvasAgentState();
    const serialized = JSON.stringify(state);
    if (serialized === lastSyncedStateRef.current) return;
    lastSyncedStateRef.current = serialized;
    agent.setState(state);
  }, [agent]);

  const debouncedSync = useCallback(() => {
    clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(syncAgentState, 80);
  }, [syncAgentState]);

  useEffect(() => {
    syncAgentState();
    const unsubscribeFlow = useFlowStore.subscribe(debouncedSync);
    const unsubscribeChat = useChatStore.subscribe(debouncedSync);
    const unsubscribeWorkspace = useWorkspaceStore.subscribe(debouncedSync);

    return () => {
      unsubscribeFlow();
      unsubscribeChat();
      unsubscribeWorkspace();
      clearTimeout(syncTimeoutRef.current);
    };
  }, [syncAgentState, debouncedSync, workspaceId]);

  useFrontendTool({
    name: 'createChatNode',
    description: 'Create a new chat node on the CaudalFlow canvas.',
    parameters: z.object({
      topic: z.string().default('New Chat'),
      initialAssistantMessage: z.string().optional(),
      label: z.string().optional(),
      color: z.string().optional(),
    }),
    handler: async ({ topic, initialAssistantMessage, label, color }) => {
      const nodeId = createNodeAtEnd(topic);
      useFlowStore.getState().updateNodeData(nodeId, { label, color });
      useChatStore.getState().initConversation(nodeId);
      if (initialAssistantMessage) {
        useChatStore.getState().addMessage(nodeId, 'assistant', initialAssistantMessage);
      }
      syncAgentState();
      return `created node ${nodeId}`;
    },
  });

  useFrontendTool({
    name: 'createBranchFromNode',
    description: 'Create a child branch from an existing node, optionally seeding it with a user prompt and assistant note.',
    parameters: z.object({
      parentNodeId: z.string(),
      topic: z.string(),
      branchText: z.string().optional(),
      prompt: z.string().optional(),
      assistantMessage: z.string().optional(),
    }),
    handler: async (args) => {
      const result = handleCreateBranchFromNode(args);
      syncAgentState();
      return result;
    },
  });

  useFrontendTool({
    name: 'mergeChatNodes',
    description: 'Create a merge node from two or more existing nodes and connect them with labeled edges.',
    parameters: z.object({
      nodeIds: z.array(z.string()).min(2),
      topic: z.string(),
      mergeAction: z.string(),
      assistantSummary: z.string().optional(),
    }),
    handler: async (args) => {
      const result = handleMergeChatNodes(args);
      syncAgentState();
      return result;
    },
  });

  useFrontendTool({
    name: 'appendNodeMessage',
    description: 'Append a system, user, or assistant message to an existing chat node. Use triggeredBy to show which node initiated this cross-node update.',
    parameters: z.object({
      nodeId: z.string(),
      role: roleSchema,
      content: z.string(),
      triggeredBy: z.string().optional(),
    }),
    handler: async ({ nodeId, role, content, triggeredBy }) => {
      const result = handleAppendNodeMessage({ nodeId, role: role as MessageRole, content, triggeredBy });
      syncAgentState();
      return result;
    },
  });

  useFrontendTool({
    name: 'deleteChatNode',
    description: 'Delete a chat node from the canvas. Use this when the user selects one branch from several alternatives and wants sibling branches removed.',
    parameters: z.object({
      nodeId: z.string(),
    }),
    handler: async ({ nodeId }) => {
      const result = handleDeleteChatNode(nodeId);
      syncAgentState();
      return result;
    },
  });

  useFrontendTool({
    name: 'updateChatNode',
    description: 'Update a chat node title, label, color, or collapsed state.',
    parameters: z.object({
      nodeId: z.string(),
      topic: z.string().optional(),
      label: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      collapsed: z.boolean().optional(),
    }),
    handler: async (args) => {
      const result = handleUpdateChatNode(args);
      syncAgentState();
      return result;
    },
  });

  useFrontendTool({
    name: 'focusChatNode',
    description: 'Pan and zoom the canvas to a specific chat node.',
    parameters: z.object({ nodeId: z.string() }),
    handler: async ({ nodeId }) => {
      return focusNode(nodeId, setCenter) ? `focused node ${nodeId}` : `node ${nodeId} was not found`;
    },
  });

  useFrontendTool({
    name: 'highlightWorkspaceFinding',
    description: 'Create a concise finding as a new assistant-authored node.',
    parameters: z.object({
      title: z.string(),
      finding: z.string(),
      sourceNodeIds: z.array(z.string()).default([]),
    }),
    handler: async (args) => {
      const result = handleHighlightWorkspaceFinding(args);
      syncAgentState();
      return result;
    },
  });

  useFrontendTool({
    name: 'renderNodePreview',
    description: 'Render an inline preview card for a canvas node in the Copilot chat stream.',
    parameters: z.object({
      nodeId: z.string(),
      title: z.string().optional(),
      summary: z.string().optional(),
    }),
    render: ({ args }) => <LiveNodePreview args={args} />,
  });

  useFrontendTool({
    name: 'renderMergePlan',
    description: 'Render an inline proposed merge plan before creating or explaining a merge node.',
    parameters: z.object({
      title: z.string(),
      nodeIds: z.array(z.string()),
      rationale: z.string().optional(),
      steps: z.array(z.string()).optional(),
    }),
    render: ({ args }) => <LiveMergePlan args={args} />,
  });

  useFrontendTool({
    name: 'renderBranchProposal',
    description: 'Render an inline branch proposal card when suggesting parallel exploration paths before calling createBranchFromNode.',
    parameters: z.object({
      parentNodeId: z.string().optional(),
      parentTopic: z.string().optional(),
      rationale: z.string().optional(),
      options: z.array(z.object({ topic: z.string(), prompt: z.string().optional() })).optional(),
    }),
    render: ({ args }) => <BranchProposalCard args={args} />,
  });

  useFrontendTool({
    name: 'renderChart',
    description: 'Render a pie, bar, or line chart inline in the Copilot chat stream. Use this whenever the user asks for a chart, graph, or data visualization.',
    parameters: z.object({
      chartType: z.enum(['pie', 'bar', 'line']).default('pie'),
      title: z.string().optional(),
      data: z.array(z.object({ name: z.string(), value: z.number() })),
    }),
    render: ({ args }) => <ChartRenderer args={args} />,
  });

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1.5 text-xs text-neutral-400 backdrop-blur md:flex">
      <GitBranch size={13} />
      <span>{nodeCount} canvas nodes are available to Copilot</span>
      <Plus size={13} className="text-accent-400" />
    </div>
  );
}
