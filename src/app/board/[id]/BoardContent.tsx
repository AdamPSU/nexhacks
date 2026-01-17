"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { TLShapeId } from "tldraw";
import { Button } from "@/components/ui/button";
import { 
  Tick01Icon, 
  Cancel01Icon, 
  ArrowLeft01Icon 
} from "hugeicons-react";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { useCanvasSolver } from "@/hooks/useCanvasSolver";
import { useBoardSync } from "@/hooks/useBoardSync";
import { VoiceControls } from "@/components/VoiceControls";
import { StatusIndicator } from "@/components/StatusIndicator";

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
        top: isVoiceSessionActive ? '56px' : '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
      }}
    >
      <Button variant="default" onClick={() => onAccept(currentImageId)}>
        <Tick01Icon size={20} strokeWidth={2.5} />
        <span className="ml-2">Accept</span>
      </Button>
      <Button variant="secondary" onClick={() => onReject(currentImageId)}>
        <Cancel01Icon size={20} strokeWidth={2.5} />
        <span className="ml-2">Reject</span>
      </Button>
    </div>
  );
}

export function BoardContent({ id }: { id: string }) {
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
          <div className="flex items-center gap-2">
            <Button
              variant={isAIEnabled ? "default" : "secondary"}
              onClick={() => setIsAIEnabled(!isAIEnabled)}
              className="w-24 shadow-sm"
            >
              {isAIEnabled ? "Disable AI" : "Enable AI"}
            </Button>
          </div>
        </div>
      )}

      {!isVoiceSessionActive && (
        <StatusIndicator
          status={status}
          errorMessage={errorMessage}
          customMessage={statusMessage}
        />
      )}

      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        isVoiceSessionActive={isVoiceSessionActive}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      <VoiceControls
        isSessionActive={voiceAgent.isSessionActive}
        status={voiceAgent.status}
        statusDetail={voiceAgent.statusDetail}
        isMuted={voiceAgent.isMuted}
        onToggleSession={voiceAgent.toggleSession}
        onToggleMute={voiceAgent.toggleMute}
      />
    </>
  );
}

