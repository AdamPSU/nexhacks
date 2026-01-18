import { useCallback, useEffect, useState } from 'react';
import { Editor, TLShapeId } from 'tldraw';

export interface Layer {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
}

export function useLayers(editor: Editor | null) {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'default', name: 'Background', isVisible: true, isLocked: false },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('default');

  // Load from editor meta on mount
  useEffect(() => {
    if (!editor) return;
    const pageMeta = editor.getCurrentPage()?.meta as any;
    if (pageMeta?.layers) {
      setLayers(pageMeta.layers);
      setActiveLayerId(pageMeta.activeLayerId || 'default');
    }
  }, [editor]);

  // Sync to editor meta whenever layers change
  useEffect(() => {
    if (!editor) return;
    const page = editor.getCurrentPage();
    if (!page) return;

    editor.updatePage({
      id: page.id,
      meta: {
        ...page.meta,
        layers,
        activeLayerId,
      },
    });
  }, [editor, layers, activeLayerId]);

  // Tag new shapes with the active layer ID
  useEffect(() => {
    if (!editor) return;

    return editor.sideEffects.register({
      shape: {
        beforeCreate: (shape) => {
          const activeLayer = layers.find(l => l.id === activeLayerId);
          return {
            ...shape,
            opacity: activeLayer?.isVisible === false ? 0 : shape.opacity,
            isLocked: activeLayer?.isLocked ? true : shape.isLocked,
            meta: {
              ...shape.meta,
              layerId: activeLayerId,
            },
          };
        },
      },
    });
  }, [editor, activeLayerId, layers]);

  const addLayer = useCallback(() => {
    const newId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      isVisible: true,
      isLocked: false,
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newId);
  }, [layers.length]);

  const deleteLayer = useCallback((id: string) => {
    if (id === 'default' && layers.length === 1) return;

    setLayers((prev) => {
      const filtered = prev.filter((l) => l.id !== id);
      if (activeLayerId === id) {
        setActiveLayerId(filtered[filtered.length - 1]?.id || 'default');
      }
      return filtered;
    });

    if (!editor) return;
    const shapesToDelete = editor.getCurrentPageShapes().filter(
      (s) => (s.meta as any)?.layerId === id
    ).map(s => s.id);
    
    if (shapesToDelete.length > 0) {
      // Ensure shapes are unlocked before deletion
      editor.updateShapes(shapesToDelete.map(shapeId => ({ id: shapeId, isLocked: false })));
      editor.deleteShapes(shapesToDelete);
    }
  }, [activeLayerId, editor, layers.length]);

  const toggleVisibility = useCallback((id: string) => {
    let newIsVisible = true;
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          newIsVisible = !l.isVisible;
          return { ...l, isVisible: newIsVisible };
        }
        return l;
      })
    );

    if (!editor) return;
    const shapesInLayer = editor.getCurrentPageShapes().filter(
      (s) => (s.meta as any)?.layerId === id
    );

    editor.updateShapes(
      shapesInLayer.map((s) => ({
        id: s.id,
        type: s.type,
        opacity: newIsVisible ? 1 : 0,
      }))
    );
  }, [editor]);

  const toggleLock = useCallback((id: string) => {
    let newIsLocked = false;
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          newIsLocked = !l.isLocked;
          return { ...l, isLocked: newIsLocked };
        }
        return l;
      })
    );

    if (!editor) return;
    const shapesInLayer = editor.getCurrentPageShapes().filter(
      (s) => (s.meta as any)?.layerId === id
    );

    editor.updateShapes(
      shapesInLayer.map((s) => ({
        id: s.id,
        type: s.type,
        isLocked: newIsLocked,
      }))
    );
  }, [editor]);

  const renameLayer = useCallback((id: string, newName: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: newName } : l))
    );
  }, []);

  const moveLayer = useCallback((id: string, direction: 'up' | 'down') => {
    setLayers((prev) => {
      const index = prev.findIndex((l) => l.id === id);
      if (index === -1) return prev;
      if (direction === 'up' && index === prev.length - 1) return prev;
      if (direction === 'down' && index === 0) return prev;

      const newLayers = [...prev];
      const nextIndex = direction === 'up' ? index + 1 : index - 1;
      const [moved] = newLayers.splice(index, 1);
      newLayers.splice(nextIndex, 0, moved);
      
      if (editor) {
        newLayers.forEach((layer) => {
          const shapes = editor.getCurrentPageShapes().filter(
            (s) => (s.meta as any)?.layerId === layer.id
          );
          if (shapes.length > 0) {
            editor.bringToFront(shapes.map(s => s.id));
          }
        });
      }
      return newLayers;
    });
  }, [editor]);

  return {
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    deleteLayer,
    toggleVisibility,
    toggleLock,
    renameLayer,
    moveLayer,
  };
}
