import React from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { 
  Mic02Icon, 
  MicOff02Icon, 
  Loading03Icon 
} from "hugeicons-react";
import { VoiceStatus } from "@/hooks/useVoiceAgent";

interface VoiceControlsProps {
  isSessionActive: boolean;
  status: VoiceStatus;
  statusDetail: string | null;
  isMuted: boolean;
  onToggleSession: () => void;
  onToggleMute: () => void;
}

const statusMessages: Record<Exclude<VoiceStatus, "idle">, string> = {
  connecting: "Connecting voice assistant...",
  listening: "Listening...",
  thinking: "Thinking...",
  callingTool: "Working on your canvas...",
  error: "Voice error",
};

export function VoiceControls({
  isSessionActive,
  status,
  statusDetail,
  isMuted,
  onToggleSession,
  onToggleMute,
}: VoiceControlsProps) {
  const showStatus = status !== "idle";
  const isError = status === "error";

  return (
    <>
      {showStatus && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
        >
          {status !== "error" && (
            <Loading03Icon
              size={16}
              strokeWidth={2}
              className="animate-spin text-blue-600"
            />
          )}
          <span
            className={`text-sm font-medium ${
              isError ? "text-red-600" : "text-gray-700"
            }`}
          >
            {statusDetail || statusMessages[status] || "Voice status"}
          </span>
        </div>
      )}

      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[2000] pointer-events-auto">
        <div className="flex items-center gap-2">
          {isSessionActive && (
            <Button
              type="button"
              onClick={onToggleMute}
              variant="outline"
              size="icon"
              className="rounded-full shadow-md bg-white hover:bg-gray-50"
              aria-label={isMuted ? "Unmute tutor" : "Mute tutor"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            onClick={onToggleSession}
            variant={"outline"}
            className="rounded-full shadow-md bg-white hover:bg-gray-50"
            size="lg"
          >
            {isSessionActive ? (
              <MicOff02Icon size={20} strokeWidth={2} />
            ) : (
              <Mic02Icon size={20} strokeWidth={2} />
            )}
            <span className="ml-2 font-medium">
              {isSessionActive ? "End Session" : "Voice Mode"}
            </span>
          </Button>
        </div>
      </div>
    </>
  );
}


