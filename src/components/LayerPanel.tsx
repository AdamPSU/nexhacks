import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ViewIcon, 
  ViewOffIcon, 
  PlusSignIcon, 
  Delete02Icon, 
  ArrowUp01Icon, 
  ArrowDown01Icon,
  Layers01Icon,
  LockedIcon,
  SquareUnlock01Icon
} from 'hugeicons-react';
import { Button } from './ui/button';
import { Layer } from '@/hooks/useLayers';
import { cn } from '@/lib/utils';

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  onSetActiveLayer: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
}

export function LayerPanel({
  layers,
  activeLayerId,
  onSetActiveLayer,
  onAddLayer,
  onDeleteLayer,
  onToggleVisibility,
  onToggleLock,
  onRenameLayer,
  onMoveLayer,
}: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const reversedLayers = [...layers].reverse();

  const handleStartRename = (layer: Layer) => {
    setEditingId(layer.id);
    setEditValue(layer.name);
  };

  const handleFinishRename = () => {
    if (editingId && editValue.trim()) {
      onRenameLayer(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden w-72 pointer-events-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/50">
            <div className="flex items-center gap-2">
              <Layers01Icon size={18} className="text-neutral-500" />
              <span className="text-sm font-semibold">Layers</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddLayer}
              className="h-8 w-8 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
            >
              <PlusSignIcon size={18} />
            </Button>
          </div>

          {/* Layer List */}
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
            {reversedLayers.map((layer, index) => {
              const isActive = activeLayerId === layer.id;
              const isFirst = index === 0;
              const isLast = index === layers.length - 1;

              return (
                <div
                  key={layer.id}
                  onClick={() => onSetActiveLayer(layer.id)}
                  onDoubleClick={() => handleStartRename(layer)}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-xl transition-all cursor-pointer border border-transparent",
                    isActive 
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30" 
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  {/* Visibility Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(layer.id);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      layer.isVisible 
                        ? "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700" 
                        : "text-neutral-300 dark:text-neutral-600"
                    )}
                    title={layer.isVisible ? "Hide Layer" : "Show Layer"}
                  >
                    {layer.isVisible ? <ViewIcon size={16} /> : <ViewOffIcon size={16} />}
                  </button>

                  {/* Lock Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock(layer.id);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      layer.isLocked 
                        ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" 
                        : "text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    )}
                    title={layer.isLocked ? "Unlock Layer" : "Lock Layer"}
                  >
                    {layer.isLocked ? <LockedIcon size={16} /> : <SquareUnlock01Icon size={16} />}
                  </button>

                  {/* Layer Name */}
                  <div className="flex-1 min-w-0">
                    {editingId === layer.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-white dark:bg-neutral-800 border border-blue-500 rounded px-1 text-xs focus:outline-none"
                      />
                    ) : (
                      <span className={cn(
                        "block text-xs font-medium truncate",
                        isActive ? "text-blue-700 dark:text-blue-400" : "text-neutral-600 dark:text-neutral-400",
                        !layer.isVisible && "opacity-50"
                      )}>
                        {layer.name}
                      </span>
                    )}
                  </div>

                  {/* Actions (visible on hover or if active) */}
                  <div className={cn(
                    "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                    isActive && "opacity-100"
                  )}>
                    <button
                      disabled={isFirst}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveLayer(layer.id, 'up');
                      }}
                      className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30"
                      title="Move Up"
                    >
                      <ArrowUp01Icon size={14} />
                    </button>
                    <button
                      disabled={isLast}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveLayer(layer.id, 'down');
                      }}
                      className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30"
                      title="Move Down"
                    >
                      <ArrowDown01Icon size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-600 transition-colors"
                      title="Delete Layer"
                    >
                      <Delete02Icon size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
