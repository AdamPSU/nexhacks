"use client";

import React, { useState, useEffect } from "react";
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
import { AIChatSidebar } from "@/components/AIChatSidebar";

function ImageActionButtons({
  pendingImageIds,
  onAccept,
  onReject,
  isVoiceSessionActive,
  isChatOpen,
}: {
  pendingImageIds: TLShapeId[];
  onAccept: (shapeId: TLShapeId) => void;
  onReject: (shapeId: TLShapeId) => void;
  isVoiceSessionActive: boolean;
  isChatOpen: boolean;
}) {
  if (pendingImageIds.length === 0) return null;
  const currentImageId = pendingImageIds[pendingImageIds.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        top: isVoiceSessionActive ? '56px' : '10px',
        left: isChatOpen ? 'calc(50% + 175px)' : '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
        transition: 'left 0.3s ease-in-out'
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
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const {
    pendingImageIds,
    status,
    errorMessage,
    statusMessage,
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
            left: isChatOpen ? '366px' : '16px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'left 0.3s ease-in-out'
          }}
        >
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft01Icon size={20} strokeWidth={2} />
          </Button>
        </div>
      )}

      {!isVoiceSessionActive && (
        <StatusIndicator
          status={status}
          errorMessage={errorMessage}
          customMessage={statusMessage}
        />
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
      />

      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        isVoiceSessionActive={isVoiceSessionActive}
        onAccept={handleAccept}
        onReject={handleReject}
        isChatOpen={isChatOpen}
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

