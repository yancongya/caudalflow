import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Map,
  Settings,
  Plus,
  HelpCircle,
  Network,
  ChevronDownSquare,
  ChevronUpSquare,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useFlowStore } from '../../stores/flowStore';
import { useChatStore } from '../../stores/chatStore';
import { HelpGuidePanel } from '../ui/HelpGuide';
import { Tooltip } from '../ui/Tooltip';
import { calculateAutoLayoutPositions } from '../../utils/nodeLayout';

interface CanvasControlsProps {}

export function CanvasControls({}: CanvasControlsProps) {
  const { t } = useTranslation();
  const { zoomIn, zoomOut, fitView, getViewport } = useReactFlow();
  const toggleMinimap = useSettingsStore((s) => s.toggleMinimap);
  const showMinimap = useSettingsStore((s) => s.showMinimap);
  const toggleSettings = useSettingsStore((s) => s.toggleSettings);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const [showHelp, setShowHelp] = useState(false);
  const arrangeTimerRef = useRef<number | null>(null);
  const toggleCollapseSmart = useFlowStore((s) => s.toggleCollapseSmart);

  const nodes = useFlowStore((s) => s.nodes);
  const collapsedCount = nodes.filter((n) => n.data?.collapsed).length;
  const mostlyCollapsed = collapsedCount > nodes.length / 2;

  useEffect(() => {
    return () => {
      if (arrangeTimerRef.current !== null) {
        window.clearTimeout(arrangeTimerRef.current);
      }
      document.querySelector('.react-flow')?.classList.remove('auto-arranging');
    };
  }, []);

  const handleNewNode = () => {
    const viewport = getViewport();
    const x = (-viewport.x + window.innerWidth / 2) / viewport.zoom - 200;
    const y = (-viewport.y + window.innerHeight / 2) / viewport.zoom - 250;

    const nodeId = useFlowStore.getState().addChatNode({ x, y }, {
      topic: t('canvas.newChat'),
      collapsed: false,
    });
    useChatStore.getState().initConversation(nodeId);
  };

  const handleAutoArrange = () => {
    const flowStore = useFlowStore.getState();
    const flowElement = document.querySelector('.react-flow');

    if (arrangeTimerRef.current !== null) {
      window.clearTimeout(arrangeTimerRef.current);
    }

    flowElement?.classList.add('auto-arranging');

    const positions = calculateAutoLayoutPositions(flowStore.nodes, flowStore.edges, {
      horizontalGap: 100,
      verticalGap: 40,
      componentGap: 200,
      origin: { x: 0, y: 0 },
    });

    flowStore.setNodes(
      flowStore.nodes.map((node) => {
        const position = positions[node.id];
        if (!position) return node;
        return {
          ...node,
          position,
        };
      })
    );

    arrangeTimerRef.current = window.setTimeout(() => {
      fitView({ padding: 0.2 });
      flowElement?.classList.remove('auto-arranging');
      arrangeTimerRef.current = null;
    }, 320);
  };

  const handleThemeToggle = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const btnClass =
    'p-2 rounded-lg bg-surface-900 border border-border text-text-secondary hover:text-text-primary hover:bg-surface-800 transition-colors';

  return (
    <>
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
        <Tooltip content={t('canvas.newChat')}>
          <button onClick={handleNewNode} className={btnClass}>
            <Plus size={18} />
          </button>
        </Tooltip>
        <div className="h-px bg-border my-0.5" />
        <Tooltip content={t('canvas.zoomIn')}>
          <button onClick={() => zoomIn()} className={btnClass}>
            <ZoomIn size={18} />
          </button>
        </Tooltip>
        <Tooltip content={t('canvas.zoomOut')}>
          <button onClick={() => zoomOut()} className={btnClass}>
            <ZoomOut size={18} />
          </button>
        </Tooltip>
        <Tooltip content={t('canvas.fitView')}>
          <button onClick={() => fitView({ padding: 0.2 })} className={btnClass}>
            <Maximize size={18} />
          </button>
        </Tooltip>
        <Tooltip content={t('canvas.autoArrange')}>
          <button onClick={handleAutoArrange} className={btnClass}>
            <Network size={18} />
          </button>
        </Tooltip>
        <div className="h-px bg-border my-0.5" />
        <Tooltip content={t(`settings.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`)}>
          <button onClick={handleThemeToggle} className={btnClass}>
            <ThemeIcon size={18} />
          </button>
        </Tooltip>
        <Tooltip content={t('canvas.settings')}>
          <button onClick={toggleSettings} className={btnClass}>
            <Settings size={18} />
          </button>
        </Tooltip>
        <Tooltip content={t('canvas.help')}>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`${btnClass} ${showHelp ? 'text-accent-400' : ''}`}
          >
            <HelpCircle size={18} />
          </button>
        </Tooltip>
      </div>
      {showHelp && <HelpGuidePanel />}
    </>
  );
}
