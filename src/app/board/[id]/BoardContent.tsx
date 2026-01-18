"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TLShapeId } from "tldraw";
import { Button } from "@/components/ui/button";
import { 
  Tick01Icon, 
  Cancel01Icon, 
  ArrowLeft01Icon,
  SparklesIcon
} from "hugeicons-react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { useCanvasSolver } from "@/hooks/useCanvasSolver";
import { useBoardSync } from "@/hooks/useBoardSync";
import { StatusIndicator } from "@/components/StatusIndicator";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { cn } from "@/lib/utils";

function ImageActionButtons({
  pendingImageIds,
  onAccept,
  onReject,
  isVoiceSessionActive,
}: {
  pendingImageIds: TLShapeId[];
  onAccept: (shapeId: TLShapeId) => void;
  onReject: (shapeId: TLShapeId) => void;
  isVoiceSessionActive: boolean;
}) {
  if (pendingImageIds.length === 0) return null;
  const currentImageId = pendingImageIds[pendingImageIds.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
      }}
    >
      <Button 
        variant="outline" 
        onClick={() => onReject(currentImageId)}
        className="rounded-xl shadow-md h-9 bg-white dark:bg-neutral-900 border-neutral-200"
      >
        <Cancel01Icon size={18} strokeWidth={2.5} />
        <span className="ml-2 font-medium">Reject</span>
      </Button>
      <Button 
        variant="default" 
        onClick={() => onAccept(currentImageId)}
        className="rounded-xl shadow-md h-9"
      >
        <Tick01Icon size={18} strokeWidth={2.5} />
        <span className="ml-2 font-medium">Accept</span>
      </Button>
    </div>
  );
}

export function BoardContent({ 
  id, 
  isChatOpen, 
  setIsChatOpen 
}: { 
  id: string; 
  isChatOpen: boolean; 
  setIsChatOpen: (open: boolean) => void; 
}) {
  const router = useRouter();
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);

  const {
    pendingImageIds,
    status,
    errorMessage,
    statusMessage,
    isAIEnabled,
    setIsAIEnabled,
    generateSolution,
    handleAccept,
    handleReject,
    isUpdatingImageRef,
  } = useCanvasSolver(isVoiceSessionActive);

  const voiceAgent = useVoiceAgent({
    onSessionChange: setIsVoiceSessionActive,
    onSolveWithPrompt: async (instructions) => {
      return await generateSolution({
        promptOverride: instructions,
        force: true,
        source: "voice",
      });
    },
  });

  useBoardSync(id, isUpdatingImageRef);

  return (
    <>
      {!isVoiceSessionActive && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft01Icon size={20} strokeWidth={2} />
          </Button>
        </div>
      )}

      {!isVoiceSessionActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-280px) translateX(-60%)',
            zIndex: 1000,
          }}
        >
          <StatusIndicator
            status={status}
            errorMessage={errorMessage}
            customMessage={statusMessage}
          />
        </div>
      )}

      <AIChatSidebar
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        status={status}
        onSubmit={async (prompt) => {
          return await generateSolution({
            promptOverride: prompt,
            source: "chat",
            force: true,
          });
        }}
        voiceAgent={voiceAgent}
      />

      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        isVoiceSessionActive={isVoiceSessionActive}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(280px) translateX(-40%)',
          zIndex: 1000,
        }}
      >
        <Button 
          variant={isAIEnabled ? "default" : "outline"}
          onClick={() => setIsAIEnabled(!isAIEnabled)}
          className={cn(
            "h-10 px-4 rounded-xl shadow-md border border-neutral-200 dark:border-neutral-800 transition-all gap-2",
            isAIEnabled ? "bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200" : "bg-white dark:bg-neutral-900 text-black dark:text-white hover:bg-neutral-50"
          )}
        >
          <SparklesIcon size={18} fill={isAIEnabled ? "currentColor" : "none"} />
          <span className="text-sm font-medium">
            {isAIEnabled ? "AI Enabled" : "Enable AI"}
          </span>
        </Button>
      </div>
    </>
  );
}

