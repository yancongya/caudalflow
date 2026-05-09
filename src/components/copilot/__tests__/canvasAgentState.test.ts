import { describe, it, expect, beforeEach } from 'vitest';
import { buildCanvasAgentState } from '../canvasAgentState';
import { useChatStore } from '../../../stores/chatStore';
import { useFlowStore } from '../../../stores/flowStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';

beforeEach(() => {
  useFlowStore.setState({ nodes: [], edges: [] });
  useChatStore.setState({ conversations: {} });
  useWorkspaceStore.setState({
    workspaces: [
      {
        id: 'workspace-1',
        name: 'Research Map',
        createdAt: 100,
        updatedAt: 200,
      },
    ],
    activeWorkspaceId: 'workspace-1',
  });
});

describe('buildCanvasAgentState', () => {
  it('exposes workspace, nodes, edges, conversations, and current selected messages', () => {
    const flow = useFlowStore.getState();
    const nodeId = flow.addChatNode({ x: 10, y: 20 }, { topic: 'Root question', collapsed: false });
    const childId = flow.addChatNode({ x: 500, y: 20 }, { topic: 'Branch', parentNodeId: nodeId });
    flow.addEdge(nodeId, childId, 'follow-up');
    useFlowStore
      .getState()
      .setNodes(useFlowStore.getState().nodes.map((node) => (node.id === nodeId ? { ...node, selected: true } : node)));

    const chat = useChatStore.getState();
    chat.initConversation(nodeId);
    chat.addMessage(nodeId, 'system', 'hidden system prompt');
    chat.addMessage(nodeId, 'user', 'What should we explore?', [{ base64: 'large-image-payload', mimeType: 'image/png' }]);
    chat.addMessage(nodeId, 'assistant', 'Explore the cost, risk, and timing.');

    const state = buildCanvasAgentState();

    expect(state.activeWorkspace).toMatchObject({
      id: 'workspace-1',
      name: 'Research Map',
      createdAt: 100,
      updatedAt: 200,
    });
    expect(state.nodes).toHaveLength(2);
    expect(state.nodes[0]).toMatchObject({
      id: nodeId,
      topic: 'Root question',
      selected: true,
      position: { x: 10, y: 20 },
      messageCount: 2,
      lastUserMessage: 'What should we explore?',
      lastAssistantMessage: 'Explore the cost, risk, and timing.',
    });
    expect(state.edges).toEqual([
      {
        id: `e-${nodeId}-${childId}`,
        source: nodeId,
        target: childId,
        label: 'follow-up',
      },
    ]);
    expect(state.conversations[nodeId]).toMatchObject({
      nodeId,
      messageCount: 2,
      systemMessageCount: 1,
    });
    expect(state.conversations[nodeId].messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(state.conversations[nodeId].messages[0]).toMatchObject({
      imageCount: 1,
      hasImages: true,
    });
    expect(state.conversations[nodeId].messages[0]).not.toHaveProperty('images');
    expect(state.selectedNodes.map((node) => node.id)).toEqual([nodeId]);
    expect(state.currentMessages.map((message) => message.sourceNodeId)).toEqual([nodeId, nodeId]);
    expect(state.mergeContext).toBeNull();
  });

  it('builds mergeContext from multiple selected nodes', () => {
    const flow = useFlowStore.getState();
    const firstId = flow.addChatNode({ x: 0, y: 0 }, { topic: 'Option A' });
    const secondId = flow.addChatNode({ x: 480, y: 0 }, { topic: 'Option B' });
    useFlowStore.getState().setNodes(useFlowStore.getState().nodes.map((node) => ({ ...node, selected: true })));

    const chat = useChatStore.getState();
    chat.initConversation(firstId);
    chat.initConversation(secondId);
    chat.addMessage(firstId, 'assistant', 'A is fast.');
    chat.addMessage(secondId, 'assistant', 'B is safer.');

    const state = buildCanvasAgentState();

    expect(state.selectedNodes.map((node) => node.id)).toEqual([firstId, secondId]);
    expect(state.currentMessages.map((message) => message.sourceTopic)).toEqual(['Option A', 'Option B']);
    expect(state.mergeContext).toMatchObject({
      ready: true,
      sourceNodeIds: [firstId, secondId],
      sourceTopics: ['Option A', 'Option B'],
    });
    expect(state.mergeContext?.sources.map((source) => source.lastAssistantMessage)).toEqual(['A is fast.', 'B is safer.']);
  });
});
