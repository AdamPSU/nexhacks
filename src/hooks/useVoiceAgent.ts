import { useCallback, useState, useRef } from "react";
import { useEditor } from "tldraw";

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "callingTool"
  | "error";

interface UseVoiceAgentProps {
  onSessionChange: (active: boolean) => void;
  onSolveWithPrompt: (
    instructions?: string
  ) => Promise<boolean>;
}

export function useVoiceAgent({
  onSessionChange,
  onSolveWithPrompt,
}: UseVoiceAgentProps) {
  const editor = useEditor();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const setErrorStatus = useCallback((message: string) => {
    setStatus("error");
    setStatusDetail(message);
    console.error("[Voice Agent]", message);
  }, []);

  const cleanupSession = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();

    dcRef.current = null;
    pcRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
  }, []);

  const stopSession = useCallback(() => {
    cleanupSession();
    setIsSessionActive(false);
    setStatus("idle");
    setStatusDetail(null);
    setIsMuted(false);
    onSessionChange(false);
  }, [cleanupSession, onSessionChange]);

  const captureCanvasImage = useCallback(async (): Promise<string | null> => {
    if (!editor) return null;

    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) return null;

    const viewportBounds = editor.getViewportPageBounds();
    const { blob } = await editor.toImage([...shapeIds], {
      format: "png",
      bounds: viewportBounds,
      background: true,
      scale: 1,
      padding: 0,
    });

    if (!blob) return null;

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, [editor]);

  const handleFunctionCall = useCallback(
    async (name: string, argsJson: string, callId: string) => {
      const dc = dcRef.current;
      if (!dc) return;

      let args: any = {};
      try {
        args = argsJson ? JSON.parse(argsJson) : {};
      } catch (e) {
        setErrorStatus(`Failed to parse tool arguments for ${name}`);
        return;
      }

      try {
        if (name === "analyze_workspace") {
          setStatus("callingTool");
          setStatusDetail("Analyzing your canvas...");

          const image = await captureCanvasImage();
          if (!image) {
            throw new Error("Canvas is empty or could not be captured");
          }

          const res = await fetch("/api/voice/analyze-workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image,
              focus: args.focus ?? null,
            }),
          });

          if (!res.ok) {
            throw new Error("Workspace analysis request failed");
          }

          const data = await res.json();
          const analysis = data.analysis ?? "";

          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  analysis,
                }),
              },
            }),
          );

          dc.send(
            JSON.stringify({
              type: "response.create",
            }),
          );

          setStatus("thinking");
          setStatusDetail(null);
        } else if (name === "draw_on_canvas") {
          setStatus("callingTool");
          setStatusDetail("Updating your canvas...");

          const success =
            (await onSolveWithPrompt(
              args.instructions ?? undefined,
            )) ?? false;

          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success,
                }),
              },
            }),
          );

          dc.send(
            JSON.stringify({
              type: "response.create",
            }),
          );

          setStatus("thinking");
          setStatusDetail(null);
        }
      } catch (error) {
        console.error("[Voice Agent] Tool error", error);

        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify({
                error:
                  error instanceof Error ? error.message : "Tool execution failed",
              }),
            },
          }),
        );

        dc.send(
          JSON.stringify({
            type: "response.create",
          }),
        );

        setErrorStatus(
          `Tool ${name} failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    },
    [captureCanvasImage, onSolveWithPrompt, setErrorStatus],
  );

  const handleServerEvent = useCallback(
    (event: any) => {
      if (!event || typeof event !== "object") return;

      switch (event.type) {
        case "response.created":
          setStatus("thinking");
          setStatusDetail(null);
          break;
        case "response.output_text.delta":
          break;
        case "response.done": {
          const output = event.response?.output ?? [];
          for (const item of output) {
            if (item.type === "function_call") {
              handleFunctionCall(
                item.name,
                item.arguments ?? "{}",
                item.call_id,
              );
            }
          }
          setStatus("listening");
          setStatusDetail(null);
          break;
        }
        case "input_audio_buffer.speech_started":
          setStatus("listening");
          setStatusDetail("Listening...");
          break;
        case "input_audio_buffer.speech_stopped":
          setStatus("thinking");
          setStatusDetail(null);
          break;
        case "error":
          console.error("[Voice Agent] Server error event:", event);
          setErrorStatus(event.error?.message || event.message || "Realtime error");
          break;
        case "invalid_request_error":
          console.error("[Voice Agent] Invalid request error:", event);
          setErrorStatus(event.message || "Invalid request");
          break;
        default:
          break;
      }
    },
    [handleFunctionCall, setErrorStatus],
  );

  const startSession = useCallback(async () => {
    if (isSessionActive) return;

    if (!editor) {
      setErrorStatus("Canvas not ready yet");
      return;
    }

    try {
      setStatus("connecting");
      setStatusDetail(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      remoteAudioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("listening");
        setStatusDetail(null);
        setIsSessionActive(true);
        onSessionChange(true);

        const tools = [
          {
            type: "function",
            name: "analyze_workspace",
            description:
              "Analyze the current artistic whiteboard canvas to understand what the user is drawing and where they might benefit from suggestions.",
            parameters: {
              type: "object",
              properties: {
                focus: {
                  type: "string",
                  description:
                    "Optional focus for the analysis, e.g. 'check the proportions' or 'suggest color palettes'.",
                },
              },
              required: [],
            },
          },
          {
            type: "function",
            name: "draw_on_canvas",
            description:
              "Use the Gemini 3 Pro artistic autocomplete to add completions or refinements directly onto the whiteboard image.",
            parameters: {
              type: "object",
              properties: {
                instructions: {
                  type: "string",
                  description:
                    "Optional instructions about what to draw or refine.",
                },
              },
              required: [],
            },
          },
        ];

        const sessionUpdate = {
          type: "session.update",
          session: {
            // Model and core configuration are set when creating the session on the server.
            // Here we provide tools.
            modalities: ["audio", "text"],
            tools,
            tool_choice: "auto",
          },
        };

        dc.send(JSON.stringify(sessionUpdate));
      };

      dc.onmessage = (event) => {
        try {
          const serverEvent = JSON.parse(event.data);
          handleServerEvent(serverEvent);
        } catch (e) {
          console.error("[Voice Agent] Failed to parse server event", e);
        }
      };

      dc.onmessage = (event) => {
        try {
          const serverEvent = JSON.parse(event.data);
          handleServerEvent(serverEvent);
        } catch (e) {
          console.error("[Voice Agent] Failed to parse server event", e);
        }
      };

      dc.onerror = (e) => {
        console.error("[Voice Agent] DataChannel error", e);
        setErrorStatus("Voice channel error");
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setErrorStatus("Voice connection lost");
          stopSession();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", checkState);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", checkState);
      });

      const tokenRes = await fetch("/api/voice/token", {
        method: "POST",
      });

      if (!tokenRes.ok) {
        throw new Error("Failed to obtain Realtime session token");
      }

      const { client_secret } = await tokenRes.json();
      if (!client_secret) {
        throw new Error("Realtime token missing client_secret");
      }

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-realtime",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
          body: pc.localDescription?.sdp ?? "",
        },
      );

      if (!sdpRes.ok) {
        const errorText = await sdpRes.text().catch(() => "");
        console.error(
          "[Voice Agent] SDP exchange failed",
          sdpRes.status,
          errorText,
        );
        throw new Error("Failed to exchange SDP with Realtime API");
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (error) {
      console.error("[Voice Agent] Failed to start session", error);
      setErrorStatus(
        error instanceof Error ? error.message : "Failed to start voice session",
      );
      stopSession();
    }
  }, [editor, isSessionActive, handleServerEvent, onSessionChange, setErrorStatus, stopSession]);

  const toggleSession = useCallback(() => {
    if (isSessionActive) {
      stopSession();
    } else {
      void startSession();
    }
  }, [isSessionActive, startSession, stopSession]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  return {
    isSessionActive,
    status,
    statusDetail,
    isMuted,
    toggleSession,
    toggleMute,
  };
}

