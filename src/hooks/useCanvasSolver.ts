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
import { removeWhiteBackground } from "@/utils/imageProcessing";

export function useCanvasSolver(
  isVoiceSessionActive: boolean,
  findOrCreateLayer?: (name: string) => string,
  activeLayerId?: string
) {
  const editor = useEditor();
  const [pendingImageIds, setPendingImageIds] = useState<TLShapeId[]>([]);
  const [status, setStatus] = useState<StatusIndicatorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isAIEnabled, setIsAIEnabled] = useState<boolean>(true);
  
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUpdatingImageRef = useRef(false);

  const getStatusMessage = useCallback((statusType: "generating" | "success") => {
    if (statusType === "generating") {
      return "Thinking...";
    } else if (statusType === "success") {
      return "Success!";
    }
    return "";
  }, []);

  const generateSolution = useCallback(
    async (options?: {
      promptOverride?: string;
      force?: boolean;
      source?: "auto" | "voice" | "chat";
      images?: File[];
    }): Promise<{ success: boolean; textContent: string }> => {
      if (
        !editor ||
        isProcessingRef.current ||
        (isVoiceSessionActive && options?.source !== "voice")
      ) {
        return { success: false, textContent: "" };
      }

      if (!isAIEnabled && options?.source === "auto") {
        return { success: false, textContent: "" };
      }

      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0 && options?.source !== "chat") {
        return { success: false, textContent: "" };
      }

      isProcessingRef.current = true;
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const viewportBounds = editor.getViewportPageBounds();
        const shapesToCapture = [...shapeIds].filter(id => !pendingImageIds.includes(id));
        
        let blob: Blob | null = null;
        if (shapesToCapture.length > 0) {
          const result = await editor.toImage(shapesToCapture, {
            format: "jpeg",    
            quality: 0.7,     
            scale: 0.7,        
            bounds: viewportBounds,
            background: true,
            padding: 0,
          });
          blob = result.blob;
        }

        if (shapesToCapture.length > 0 && !blob) {
          isProcessingRef.current = false;
          return { success: false, textContent: "" };
        }

        if (signal.aborted) return { success: false, textContent: "" };

        // OPTIMIZATION: Skip Base64 conversion and send raw binary via FormData
        const formData = new FormData();
        if (blob) {
          formData.append("image", blob, "canvas.jpg");
        }
        if (options?.promptOverride) {
          formData.append("prompt", options.promptOverride);
        }
        if (options?.images && options.images.length > 0) {
          options.images.forEach((file, index) => {
            formData.append(`reference_${index}`, file);
          });
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
        const targetLayerName = solutionData.targetLayer as string | null | undefined;

        logger.info({ 
          hasImageUrl: !!imageUrl, 
          imageUrlLength: imageUrl?.length,
          textContent: textContent,
          targetLayerName
        }, 'Solution data received');

        if (!imageUrl || signal.aborted) {
          logger.info({ textContent }, 'Gemini decided help is not needed');
          setStatus("idle");
          setStatusMessage("");
          isProcessingRef.current = false;
          return { success: true, textContent };
        }

        if (signal.aborted) return { success: false, textContent: "" };

        // Process image to remove white background
        const processedImageUrl = await removeWhiteBackground(imageUrl);

        const assetId = AssetRecordType.createId();
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = () => resolve(null);
          img.onerror = (e) => reject(new Error('Failed to load generated image'));
          img.src = processedImageUrl;
        });

        if (signal.aborted) return { success: false, textContent: "" };

        isUpdatingImageRef.current = true;

        editor.createAssets([
          {
            id: assetId,
            type: 'image',
            typeName: 'asset',
            props: {
              name: 'generated-solution.png',
              src: processedImageUrl,
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

        // Resolve target layer
        let destinationLayerId = activeLayerId;
        if (targetLayerName && findOrCreateLayer) {
          destinationLayerId = findOrCreateLayer(targetLayerName);
        }

        editor.createShape({
          id: shapeId,
          type: "image",
          x: viewportBounds.x + (viewportBounds.width - shapeWidth) / 2,
          y: viewportBounds.y + (viewportBounds.height - shapeHeight) / 2,
          opacity: 1.0,
          isLocked: true,
          props: {
            w: shapeWidth,
            h: shapeHeight,
            assetId: assetId,
          },
          meta: {
            layerId: destinationLayerId,
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

        return { success: true, textContent };
      } catch (error) {
        if (signal.aborted) {
          setStatus("idle");
          setStatusMessage("");
          return { success: false, textContent: "" };
        }
        
        logger.error(error, 'Auto-generation error');
        setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
        setStatus("error");
        setStatusMessage("");
        
        setTimeout(() => {
          setStatus("idle");
          setErrorMessage("");
        }, 3000);

        return { success: false, textContent: "" };
      } finally {
        isProcessingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [editor, pendingImageIds, isVoiceSessionActive, getStatusMessage, isAIEnabled, findOrCreateLayer, activeLayerId],
  );

  const handleAutoGeneration = useCallback(() => {
    if (!isAIEnabled) return;
    void generateSolution({ source: "auto" });
  }, [generateSolution, isAIEnabled]);

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
