import { useCallback, useState, useRef, useEffect } from "react";
import { 
  useEditor, 
  TLShapeId, 
  createShapeId, 
  AssetRecordType 
} from "tldraw";
import { logger } from "@/lib/logger";
import { useDebounceActivity } from "@/hooks/useDebounceActivity";
import { StatusIndicatorState } from "@/components/StatusIndicator";

export function useCanvasSolver(isVoiceSessionActive: boolean) {
  const editor = useEditor();
  const [pendingImageIds, setPendingImageIds] = useState<TLShapeId[]>([]);
  const [status, setStatus] = useState<StatusIndicatorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isAIEnabled, setIsAIEnabled] = useState<boolean>(false);
  
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUpdatingImageRef = useRef(false);

  const getStatusMessage = useCallback((statusType: "generating" | "success") => {
    if (statusType === "generating") {
      return "Thinking...";
    } else if (statusType === "success") {
      return "Autocomplete generated";
    }
    return "";
  }, []);

  const generateSolution = useCallback(
    async (options?: {
      promptOverride?: string;
      force?: boolean;
      source?: "auto" | "voice";
    }): Promise<boolean> => {
      if (
        !editor ||
        isProcessingRef.current ||
        (isVoiceSessionActive && options?.source !== "voice")
      ) {
        return false;
      }

      if (!isAIEnabled && options?.source !== "voice") return false;

      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        return false;
      }

      isProcessingRef.current = true;
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const viewportBounds = editor.getViewportPageBounds();
        const shapesToCapture = [...shapeIds].filter(id => !pendingImageIds.includes(id));
        
        if (shapesToCapture.length === 0) {
          isProcessingRef.current = false;
          return false;
        }

        // Optimized Capture: Using viewport but with compression and lower scale
        const { blob } = await editor.toImage(shapesToCapture, {
          format: "jpeg",    
          quality: 0.7,     
          scale: 0.7,        
          bounds: viewportBounds,
          background: true,
          padding: 0,
        });

        if (!blob || signal.aborted) return false;

        // OPTIMIZATION: Skip Base64 conversion and send raw binary via FormData
        const formData = new FormData();
        formData.append("image", blob, "canvas.jpg");
        if (options?.promptOverride) {
          formData.append("prompt", options.promptOverride);
        }
        formData.append("source", options?.source ?? "auto");

        setStatus("generating");
        setStatusMessage(getStatusMessage("generating"));

        const solutionResponse = await fetch('/api/generate-solution', {
          method: 'POST',
          body: formData,
          signal,
        });

        if (!solutionResponse.ok || signal.aborted) {
          throw new Error('Solution generation failed');
        }

        const solutionData = await solutionResponse.json();
        const imageUrl = solutionData.imageUrl as string | null | undefined;
        const textContent = solutionData.textContent || '';

        logger.info({ 
          hasImageUrl: !!imageUrl, 
          imageUrlLength: imageUrl?.length,
          textContent: textContent
        }, 'Solution data received');

        if (!imageUrl || signal.aborted) {
          logger.info({ textContent }, 'Gemini decided help is not needed');
          setStatus("idle");
          setStatusMessage("");
          isProcessingRef.current = false;
          return false;
        }

        if (signal.aborted) return false;

        const assetId = AssetRecordType.createId();
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(null);
          img.onerror = (e) => reject(new Error('Failed to load generated image'));
          img.src = imageUrl;
        });

        if (signal.aborted) return false;

        isUpdatingImageRef.current = true;

        editor.createAssets([
          {
            id: assetId,
            type: 'image',
            typeName: 'asset',
            props: {
              name: 'generated-solution.png',
              src: imageUrl,
              w: img.width,
              h: img.height,
              mimeType: 'image/png',
              isAnimated: false,
            },
            meta: {},
          },
        ]);

        const shapeId = createShapeId();
        const scale = Math.min(
          viewportBounds.width / img.width,
          viewportBounds.height / img.height
        );
        const shapeWidth = img.width * scale;
        const shapeHeight = img.height * scale;

        editor.createShape({
          id: shapeId,
          type: "image",
          x: viewportBounds.x + (viewportBounds.width - shapeWidth) / 2,
          y: viewportBounds.y + (viewportBounds.height - shapeHeight) / 2,
          opacity: 0.3,
          isLocked: true,
          props: {
            w: shapeWidth,
            h: shapeHeight,
            assetId: assetId,
          },
        });

        setPendingImageIds((prev) => [...prev, shapeId]);
        
        setStatus("success");
        setStatusMessage(getStatusMessage("success"));
        setTimeout(() => {
          setStatus("idle");
          setStatusMessage("");
        }, 2000);

        setTimeout(() => {
          isUpdatingImageRef.current = false;
        }, 100);

        return true;
      } catch (error) {
        if (signal.aborted) {
          setStatus("idle");
          setStatusMessage("");
          return false;
        }
        
        logger.error({ error }, 'Auto-generation error');
        setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
        setStatus("error");
        setStatusMessage("");
        
        setTimeout(() => {
          setStatus("idle");
          setErrorMessage("");
        }, 3000);

        return false;
      } finally {
        isProcessingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [editor, pendingImageIds, isVoiceSessionActive, isAIEnabled, getStatusMessage],
  );

  const handleAutoGeneration = useCallback(() => {
    void generateSolution({ source: "auto" });
  }, [generateSolution]);

  useDebounceActivity(handleAutoGeneration, 2000, editor, isUpdatingImageRef, isProcessingRef);

  useEffect(() => {
    if (!editor) return;

    const handleEditorChange = () => {
      if (isUpdatingImageRef.current) return;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStatus("idle");
        setStatusMessage("");
        isProcessingRef.current = false;
      }
    };

    const dispose = editor.store.listen(handleEditorChange, {
      source: 'user',
      scope: 'document'
    });

    return () => dispose();
  }, [editor]);

  const handleAccept = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;
      isUpdatingImageRef.current = true;
      editor.updateShape({ id: shapeId, type: "image", isLocked: false, opacity: 1 });
      editor.updateShape({ id: shapeId, type: "image", isLocked: true });
      setPendingImageIds((prev) => prev.filter((id) => id !== shapeId));
      setTimeout(() => { isUpdatingImageRef.current = false; }, 100);
    },
    [editor]
  );

  const handleReject = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;
      isUpdatingImageRef.current = true;
      editor.updateShape({ id: shapeId, type: "image", isLocked: false });
      editor.deleteShape(shapeId);
      setPendingImageIds((prev) => prev.filter((id) => id !== shapeId));
      setTimeout(() => { isUpdatingImageRef.current = false; }, 100);
    },
    [editor]
  );

  return {
    pendingImageIds,
    status,
    errorMessage,
    statusMessage,
    isAIEnabled,
    setIsAIEnabled,
    generateSolution,
    handleAccept,
    handleReject,
    isUpdatingImageRef, // Needed for useBoardSync
  };
}
