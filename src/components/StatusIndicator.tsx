import { Loading03Icon } from "hugeicons-react";

export type StatusIndicatorState = 
  | "idle"
  | "generating"
  | "success"
  | "error";

interface StatusIndicatorProps {
  status: StatusIndicatorState;
  errorMessage?: string;
  customMessage?: string;
}

const statusMessages: Record<Exclude<StatusIndicatorState, "idle">, string> = {
  generating: "Generating solution...",
  success: "Solution added",
  error: "Error occurred",
};

export function StatusIndicator({ status, errorMessage, customMessage }: StatusIndicatorProps) {
  // Don't render anything when idle
  if (status === "idle") return null;

  const message = customMessage || (status === "error" && errorMessage 
    ? errorMessage 
    : statusMessages[status]);

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        position: 'absolute',
        // Default top-center position for canvas status; voice UI can choose
        // to hide this component when a voice session is active.
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
      }}
    >
      {status === "generating" && (
        <Loading03Icon 
          size={16} 
          strokeWidth={2} 
          className="animate-spin text-blue-600"
        />
      )}
      <span className={`text-sm font-medium ${status === "error" ? "text-red-600" : "text-gray-700"}`}>
        {message}
      </span>
    </div>
  );
}

