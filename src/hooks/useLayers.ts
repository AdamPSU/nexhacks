import { useCallback, useEffect, useState } from 'react';
import { Editor, TLShapeId } from 'tldraw';

export interface Layer {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
}

type LayerShapeMap = Record<string, TLShapeId[]>;

export function useLayers(editor: Editor | null) {
  const [layers, setLayers] = useState<Layer[]>([
    { id: 'default', name: 'Layer 1', isVisible: true, isLocked: false },
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('default');

  const getLayerShapeMap = useCallback((): LayerShapeMap => {
    if (!editor) return {};
    const pageMeta = editor.getCurrentPage()?.meta as any;
    return pageMeta?.layerShapeMap ?? {};
  }, [editor]);

  const setLayerShapeMap = useCallback((map: LayerShapeMap) => {
    if (!editor) return;
    const page = editor.getCurrentPage();
    if (!page) return;
    editor.updatePage({
      id: page.id,
      meta: {
        ...(page.meta as any),
        layerShapeMap: map,
      },
    });
  }, [editor]);

  const getLayerIdForShape = useCallback((shapeId: TLShapeId) => {
    const map = getLayerShapeMap();
    for (const [layerId, ids] of Object.entries(map)) {
      if (ids.includes(shapeId)) return layerId;
    }
    return null;
  }, [getLayerShapeMap]);

  const assignShapeToLayer = useCallback((shapeId: TLShapeId, layerId: string) => {
    const map = getLayerShapeMap();
    const next: LayerShapeMap = { ...map };

    for (const key of Object.keys(next)) {
      if (key === layerId) continue;
      const filtered = next[key]?.filter((id) => id !== shapeId) ?? [];
      if (filtered.length !== (next[key]?.length ?? 0)) {
        next[key] = filtered;
      }
    }

    if (!next[layerId]?.includes(shapeId)) {
      next[layerId] = [...(next[layerId] ?? []), shapeId];
    }

    setLayerShapeMap(next);
  }, [getLayerShapeMap, setLayerShapeMap]);

  const getLayerShapeIds = useCallback((layerId: string) => {
    if (!editor) return [];
    const map = getLayerShapeMap();
    const ids = map[layerId] ?? [];
    const existing = ids.filter((id) => !!editor.getShape(id));

    if (existing.length !== ids.length) {
      setLayerShapeMap({
        ...map,
        [layerId]: existing,
      });
    }

    return existing;
  }, [editor, getLayerShapeMap, setLayerShapeMap]);

  const ensureLayerBindings = useCallback(() => {
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) return;

    const fallbackLayerId = activeLayerId || layers[0]?.id || 'default';
    const map = getLayerShapeMap();
    const next: LayerShapeMap = { ...map };
    let changed = false;

    for (const shape of shapes) {
      const metaLayerId = (shape.meta as any)?.layerId;
      const existingLayerId = Object.entries(next).find(([, ids]) => ids.includes(shape.id))?.[0];
      const targetLayerId = metaLayerId || existingLayerId || fallbackLayerId;

      if (existingLayerId !== targetLayerId) {
        if (existingLayerId) {
          next[existingLayerId] = next[existingLayerId].filter((id) => id !== shape.id);
        }
        next[targetLayerId] = [...(next[targetLayerId] ?? []), shape.id];
        changed = true;
      }

      if (!metaLayerId || metaLayerId !== targetLayerId) {
        editor.updateShape({
          id: shape.id,
          type: shape.type,
          meta: {
            ...(shape.meta as any),
            layerId: targetLayerId,
          },
        });
      }
    }

    if (changed) {
      setLayerShapeMap(next);
    }
  }, [activeLayerId, editor, getLayerShapeMap, layers, setLayerShapeMap]);

  // Load from editor meta on mount
  useEffect(() => {
    if (!editor) return;
    const pageMeta = editor.getCurrentPage()?.meta as any;
    if (pageMeta?.layers) {
      setLayers(pageMeta.layers);
      setActiveLayerId(pageMeta.activeLayerId || 'default');
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    ensureLayerBindings();
  }, [editor, ensureLayerBindings]);

  // Sync to editor meta whenever layers change
  useEffect(() => {
    if (!editor) return;
    const page = editor.getCurrentPage();
    if (!page) return;

    editor.updatePage({
      id: page.id,
      meta: {
        ...(page.meta as any),
        layers: layers as any,
        activeLayerId,
      },
    });
  }, [editor, layers, activeLayerId]);

  // Tag new shapes with the active layer ID and visibility
  useEffect(() => {
    if (!editor) return;

    return (editor.sideEffects as any).register({
      shape: {
        beforeCreate: (shape: any) => {
          // Get the latest layers and active layer from the editor's own metadata
          // to avoid closure staleness issues
          const pageMeta = editor.getCurrentPage()?.meta as any;
          const currentLayers: Layer[] = pageMeta?.layers || layers;
          const currentActiveLayerId = pageMeta?.activeLayerId || activeLayerId;

          const shapeLayerId = (shape.meta as any)?.layerId || currentActiveLayerId || currentLayers[0]?.id || 'default';
          const targetLayer = currentLayers.find(l => l.id === shapeLayerId);
          
          const isLayerVisible = targetLayer ? targetLayer.isVisible : true;

          assignShapeToLayer(shape.id, shapeLayerId);
          
          return {
            ...shape,
            opacity: isLayerVisible === false ? 0 : shape.opacity ?? 1,
            meta: {
              ...shape.meta,
              layerId: shapeLayerId,
            },
          };
        },
      },
    });
  }, [editor, activeLayerId, layers, assignShapeToLayer]);

  const addLayer = useCallback(() => {
    const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find the highest layer number to avoid duplicates
    const layerNumbers = layers
      .map(l => {
        const match = l.name.match(/^Layer (\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    
    const nextNumber = layerNumbers.length > 0 ? Math.max(...layerNumbers) + 1 : 1;

    const newLayer: Layer = {
      id: newId,
      name: `Layer ${nextNumber}`,
      isVisible: true,
      isLocked: false,
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newId);
  }, [layers]);

  const deleteLayer = useCallback((id: string) => {
    if (id === 'default' && layers.length === 1) return;

    if (editor) {
      const shapesToDelete = getLayerShapeIds(id);
      
      if (shapesToDelete.length > 0) {
        editor.deleteShapes(shapesToDelete);
      }

      const map = getLayerShapeMap();
      if (map[id]) {
        const next = { ...map };
        delete next[id];
        setLayerShapeMap(next);
      }
    }

    setLayers((prev) => {
      const filtered = prev.filter((l) => l.id !== id);
      if (activeLayerId === id) {
        // Try to pick the next logical layer, or fall back to default
        const currentIndex = layers.findIndex(l => l.id === id);
        const nextLayer = filtered[currentIndex] || filtered[filtered.length - 1];
        setActiveLayerId(nextLayer?.id || 'default');
      }
      return filtered;
    });
  }, [activeLayerId, editor, getLayerShapeIds, getLayerShapeMap, layers, setLayerShapeMap]);

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
    const shapeIds = getLayerShapeIds(id);
    const shapesInLayer = shapeIds.map((shapeId) => editor.getShape(shapeId)).filter(Boolean) as any[];

    editor.updateShapes(
      shapesInLayer.map((s) => ({
        id: s.id,
        type: s.type,
        opacity: newIsVisible ? 1 : 0,
      }))
    );
  }, [editor, getLayerShapeIds]);

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
    const shapeIds = getLayerShapeIds(id);
    const shapesInLayer = shapeIds.map((shapeId) => editor.getShape(shapeId)).filter(Boolean) as any[];

    editor.updateShapes(
      shapesInLayer.map((s) => ({
        id: s.id,
        type: s.type,
        isLocked: newIsLocked,
      }))
    );
  }, [editor, getLayerShapeIds]);

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
          const shapeIds = getLayerShapeIds(layer.id);
          if (shapeIds.length > 0) {
            editor.bringToFront(shapeIds);
          }
        });
      }
      return newLayers;
    });
  }, [editor, getLayerShapeIds]);

  const findOrCreateLayer = useCallback((layerName: string) => {
    const normalizedSearch = layerName.toLowerCase().replace(/^layer\s+/i, '').trim();
    
    const existingLayer = layers.find((l) => {
      const normalizedLayerName = l.name.toLowerCase().replace(/^layer\s+/i, '').trim();
      return normalizedLayerName === normalizedSearch || l.id === layerName || l.name.toLowerCase() === layerName.toLowerCase();
    });

    if (existingLayer) {
      setActiveLayerId(existingLayer.id);
      return existingLayer.id;
    }

    const newId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newLayer: Layer = {
      id: newId,
      name: layerName.match(/^layer\s+\d+$/i) ? layerName : (layerName.match(/^\d+$/) ? `Layer ${layerName}` : layerName),
      isVisible: true,
      isLocked: false,
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newId);
    return newId;
  }, [layers]);

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
    findOrCreateLayer,
    assignShapeToLayer,
    getLayerIdForShape,
  };
}
