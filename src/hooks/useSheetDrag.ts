import { useCallback, useRef, useState } from 'react';

interface DragState {
  isDragging: boolean;
  startY: number;
  currentY: number;
  deltaY: number;
}

interface UseSheetDragOptions {
  onDragStart?: () => void;
  onDragMove?: (deltaY: number) => void;
  onDragEnd?: (deltaY: number, velocity: number) => void;
  threshold?: number;
}

export function useSheetDrag(options: UseSheetDragOptions = {}) {
  const { onDragStart, onDragMove, onDragEnd, threshold = 50 } = options;
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startY: 0,
    currentY: 0,
    deltaY: 0,
  });

  const startTimeRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);

  const handleDragStart = useCallback((clientY: number) => {
    startTimeRef.current = Date.now();
    lastYRef.current = clientY;
    
    setDragState({
      isDragging: true,
      startY: clientY,
      currentY: clientY,
      deltaY: 0,
    });
    
    onDragStart?.();
  }, [onDragStart]);

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragState.isDragging) return;

    const deltaY = clientY - dragState.startY;
    lastYRef.current = clientY;

    setDragState(prev => ({
      ...prev,
      currentY: clientY,
      deltaY,
    }));

    onDragMove?.(deltaY);
  }, [dragState.isDragging, dragState.startY, onDragMove]);

  const handleDragEnd = useCallback(() => {
    if (!dragState.isDragging) return;

    const endTime = Date.now();
    const timeDelta = endTime - startTimeRef.current;
    const velocity = timeDelta > 0 ? dragState.deltaY / timeDelta : 0;

    setDragState({
      isDragging: false,
      startY: 0,
      currentY: 0,
      deltaY: 0,
    });

    onDragEnd?.(dragState.deltaY, velocity);
  }, [dragState.isDragging, dragState.deltaY, onDragEnd]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  }, [handleDragStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  }, [handleDragMove]);

  const onTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  }, [handleDragStart]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientY);
  }, [handleDragMove]);

  const onMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Attach mouse move/up listeners to window when dragging
  const bindMouseEvents = useCallback(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [dragState.isDragging, onMouseMove, onMouseUp]);

  return {
    dragState,
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    mouseHandlers: {
      onMouseDown,
    },
    bindMouseEvents,
    shouldClose: dragState.deltaY > threshold,
  };
}
