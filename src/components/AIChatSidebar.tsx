"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { VoiceStatus } from "@/hooks/useVoiceAgent";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<{ success: boolean; textContent: string }>;
  status: "idle" | "generating" | "success" | "error";
  voiceAgent: {
    isSessionActive: boolean;
    status: VoiceStatus;
    statusDetail: string | null;
    isMuted: boolean;
    toggleSession: () => void;
    toggleMute: () => void;
  };
}

const voiceStatusMessages: Record<Exclude<VoiceStatus, "idle">, string> = {
  connecting: "Connecting...",
  listening: "Listening...",
  thinking: "Thinking...",
  callingTool: "Drawing...",
  error: "Voice Error",
};

export function AIChatSidebar({ isOpen, onClose, onSubmit, status, voiceAgent }: AIChatSidebarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === "generating") return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");

    try {
      const result = await onSubmit(currentInput);
      if (result.textContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "ai",
            content: result.textContent,
          },
        ]);
      } else if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "ai",
            content: "I've processed your request on the canvas.",
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: "Sorry, I encountered an error while processing that.",
        },
      ]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-0 left-0 h-full w-[350px] bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 z-[3000] shadow-2xl flex flex-col"
        >
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-neutral-600 dark:text-neutral-400">
                <Sparkles size={18} />
              </div>
              <h2 className="font-semibold text-sm">AI Agent</h2>
            </div>
            
            <div className="flex items-center gap-1">
              {voiceAgent.isSessionActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={voiceAgent.toggleMute}
                  className="h-8 w-8 rounded-full"
                >
                  {voiceAgent.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </Button>
              )}
              <Button
                variant={voiceAgent.isSessionActive ? "default" : "ghost"}
                size="icon"
                onClick={voiceAgent.toggleSession}
                className={cn(
                  "h-8 w-8 rounded-full",
                  voiceAgent.isSessionActive && "bg-red-500 hover:bg-red-600 text-white"
                )}
                title={voiceAgent.isSessionActive ? "End Voice Session" : "Start Voice Session"}
              >
                {voiceAgent.isSessionActive ? <MicOff size={16} /> : <Mic size={16} />}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full ml-1">
                <X size={16} />
              </Button>
            </div>
          </div>

          {voiceAgent.status !== "idle" && (
            <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-neutral-500">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                voiceAgent.status === "error" ? "bg-red-500" : "bg-green-500"
              )} />
              {voiceAgent.statusDetail || voiceStatusMessages[voiceAgent.status as Exclude<VoiceStatus, "idle">]}
            </div>
          )}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto custom-scrollbar [direction:rtl]"
          >
            <div className="[direction:ltr] p-4 flex flex-col gap-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                  <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-4">
                    <Sparkles size={24} />
                  </div>
                  <p className="text-sm font-medium">How can I help you draw today?</p>
                  <p className="text-xs mt-1">Try "draw a cat" or "add a table".</p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col gap-1 max-w-[85%]",
                    m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-3 py-2 rounded-2xl text-sm shadow-sm",
                      m.role === "user"
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {status === "generating" && (
                <div className="flex items-center gap-2 text-xs text-neutral-500 italic px-2">
                  <Loader2 size={12} className="animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AI to draw..."
                className="pr-10 h-11 rounded-xl bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 focus-visible:ring-black dark:focus-visible:ring-white"
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || status === "generating"}
                className="absolute right-1 top-1 h-9 w-9 rounded-lg bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-all active:scale-95 disabled:opacity-30"
              >
                <Send size={16} />
              </Button>
            </form>
            <p className="text-[10px] text-center mt-2 text-neutral-400 uppercase tracking-widest font-medium">
              Ctrl+L to toggle
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
