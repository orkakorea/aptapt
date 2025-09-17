import React from 'react';

interface SpinnerImageOverlayProps {
  isVisible?: boolean;
  className?: string;
}

export const SpinnerImageOverlay: React.FC<SpinnerImageOverlayProps> = ({ 
  isVisible = true,
  className = ""
}) => {
  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm ${className}`}>
      <div className="flex flex-col items-center gap-4">
        <img
          src="/orka-spinner.png.png"
          alt="Loading..."
          className="w-16 h-16 animate-spin"
        />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
};