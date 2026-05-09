import { useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAgent, useFrontendTool } from '@copilotkit/react-core/v2';
import { z } from 'zod';
import { Eye, GitBranch, Merge, Plus, Sparkles } from 'lucide-react';
import { useFlowStore } from '../../stores/flowStore';
import { useChatStore } from '../../stores/chatStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { buildCanvasAgentState } from './canvasAgentState';
import { calculateBranchPosition, calculateMergePosition } from '../../utils/nodeLayout';
import { getBranchSystemPrompt, getMergeSystemPrompt } from '../../utils/systemPrompts';
import type { ChatNode } from '../../types/flow';
import type { MessageRole } from '../../types/chat';

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

function numberStyleValue(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function focusNode(nodeId: string, setCenter: ReturnType<typeof useReactFlow>['setCenter']) {
  const node = useFlowStore.getState().nodes.find((item) => item.id === nodeId);
  if (!node) return false;

  const width = numberStyleValue(node.style?.width, 400);
  const height = numberStyleValue(node.style?.height, 500);
  setCenter(node.position.x + width / 2, node.position.y + height / 2, {
    zoom: 0.9,
    duration: 350,
  });
  return true;
}

function LiveNodePreview({ args }: { args: NodePreviewArgs }) {
  const node = useFlowStore((state) => state.nodes.find((item) => item.id === args.nodeId));
  const messages = useChatStore((state) => (args.nodeId ? state.conversations[args.nodeId]?.messages ?? [] : []));
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
  const nodes = useFlowStore((state) => state.nodes.filter((node) => args.nodeIds?.includes(node.id)));
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

  const syncAgentState = useCallback(() => {
    if (!agent) return;
    const state = buildCanvasAgentState();
    const serialized = JSON.stringify(state);
    if (serialized === lastSyncedStateRef.current) return;
    lastSyncedStateRef.current = serialized;
    agent.setState(state);
  }, [agent]);

  useEffect(() => {
    syncAgentState();
    const unsubscribeFlow = useFlowStore.subscribe(syncAgentState);
    const unsubscribeChat = useChatStore.subscribe(syncAgentState);
    const unsubscribeWorkspace = useWorkspaceStore.subscribe(syncAgentState);

    return () => {
      unsubscribeFlow();
      unsubscribeChat();
      unsubscribeWorkspace();
    };
  }, [syncAgentState, workspaceId]);

  const createNodeAtEnd = useCallback((topic: string) => {
    const flow = useFlowStore.getState();
    const count = flow.nodes.length;
    return flow.addChatNode(
      {
        x: 80 + (count % 4) * 460,
        y: 80 + Math.floor(count / 4) * 560,
      },
      { topic, collapsed: false },
    );
  }, []);

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
    handler: async ({ parentNodeId, topic, branchText, prompt, assistantMessage }) => {
      const flow = useFlowStore.getState();
      const parent = flow.nodes.find((node) => node.id === parentNodeId);
      if (!parent) return `parent node ${parentNodeId} was not found`;

      const nodeId = flow.addChatNode(calculateBranchPosition(parent, flow.getChildCount(parentNodeId)), {
        topic,
        parentNodeId,
        branchText: branchText ?? topic,
        collapsed: false,
      });
      flow.addEdge(parentNodeId, nodeId, branchText ?? topic);

      const chat = useChatStore.getState();
      chat.initConversation(nodeId);
      const parentMessages = chat.getMessages(parentNodeId).map((message) => ({
        role: message.role,
        content: message.content,
      }));
      chat.addMessage(nodeId, 'system', getBranchSystemPrompt(parent.data.topic, parentMessages));
      if (prompt) chat.addMessage(nodeId, 'user', prompt);
      if (assistantMessage) chat.addMessage(nodeId, 'assistant', assistantMessage);
      syncAgentState();
      return `created branch ${nodeId}`;
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
    handler: async ({ nodeIds, topic, mergeAction, assistantSummary }) => {
      const flow = useFlowStore.getState();
      const chat = useChatStore.getState();
      const parents = nodeIds
        .map((nodeId) => flow.nodes.find((node) => node.id === nodeId))
        .filter((node): node is ChatNode => Boolean(node));

      if (parents.length < 2) return 'at least two valid source nodes are required';

      const nodeId = flow.addChatNode(calculateMergePosition(parents), {
        topic,
        parentNodeIds: parents.map((node) => node.id),
        mergeAction,
        collapsed: false,
      });
      for (const parent of parents) {
        flow.addEdge(parent.id, nodeId, mergeAction);
      }

      chat.initConversation(nodeId);
      const parentSummaries = parents.map((node) => ({
        topic: node.data.topic,
        messages: chat.getMessages(node.id).map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }));
      chat.addMessage(nodeId, 'system', getMergeSystemPrompt(parentSummaries, mergeAction));
      if (assistantSummary) chat.addMessage(nodeId, 'assistant', assistantSummary);
      syncAgentState();
      return `created merge node ${nodeId}`;
    },
  });

  useFrontendTool({
    name: 'appendNodeMessage',
    description: 'Append a system, user, or assistant message to an existing chat node.',
    parameters: z.object({
      nodeId: z.string(),
      role: roleSchema,
      content: z.string(),
    }),
    handler: async ({ nodeId, role, content }) => {
      const exists = useFlowStore.getState().nodes.some((node) => node.id === nodeId);
      if (!exists) return `node ${nodeId} was not found`;
      useChatStore.getState().initConversation(nodeId);
      useChatStore.getState().addMessage(nodeId, role as MessageRole, content);
      syncAgentState();
      return `appended ${role} message to ${nodeId}`;
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
    handler: async ({ nodeId, topic, label, color, collapsed }) => {
      const node = useFlowStore.getState().nodes.find((item) => item.id === nodeId);
      if (!node) return `node ${nodeId} was not found`;
      useFlowStore.getState().updateNodeData(nodeId, {
        ...(topic ? { topic } : {}),
        ...(label !== undefined ? { label: label ?? undefined } : {}),
        ...(color !== undefined ? { color: color ?? undefined } : {}),
        ...(collapsed !== undefined ? { collapsed } : {}),
      });
      syncAgentState();
      return `updated node ${nodeId}`;
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
    handler: async ({ title, finding, sourceNodeIds }) => {
      const flow = useFlowStore.getState();
      const nodeId = createNodeAtEnd(title);
      useFlowStore.getState().updateNodeData(nodeId, {
        label: 'Finding',
        color: '#22c55e',
      });
      useChatStore.getState().initConversation(nodeId);
      useChatStore.getState().addMessage(nodeId, 'assistant', finding);
      for (const sourceId of sourceNodeIds) {
        if (flow.nodes.some((node) => node.id === sourceId)) {
          flow.addEdge(sourceId, nodeId, 'finding');
        }
      }
      syncAgentState();
      return `created finding node ${nodeId}`;
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

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1.5 text-xs text-neutral-400 backdrop-blur md:flex">
      <GitBranch size={13} />
      <span>{nodeCount} canvas nodes are available to Copilot</span>
      <Plus size={13} className="text-accent-400" />
    </div>
  );
}
