import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SelectedApt } from "@/core/types";

type Props = {
  apt: SelectedApt | null;
  onClose: () => void;
  onAddToCart?: (apt: SelectedApt) => void;
};

export default function DetailPanel({ apt, onClose, onAddToCart }: Props) {
  if (!apt) return null;

  return (
    <div className="px-4 pb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">{apt.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{apt.address}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">위치</p>
              <p className="text-sm font-medium text-foreground">
                {apt.lat.toFixed(6)}, {apt.lng.toFixed(6)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">월 광고료</p>
              <p className="text-sm font-medium text-foreground">
                {apt.monthlyFee ? `${apt.monthlyFee.toLocaleString()}원` : "문의"}
              </p>
            </div>
          </div>
        </div>

        {onAddToCart && (
          <Button
            onClick={() => onAddToCart(apt)}
            className="w-full"
            size="lg"
          >
            장바구니에 추가
          </Button>
        )}
      </div>
    </div>
  );
}
