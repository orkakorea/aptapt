import { useMemo } from "react";
import { X } from "lucide-react";
import { QuoteLineItem } from "@/components/QuoteModal";

interface QuotePanelProps {
  open: boolean;
  items: QuoteLineItem[];
  vatRate?: number;
  onClose: () => void;
  onInquiry?: (prefill: { subject: string; body: string }) => void;
}

// Formatting utilities
const fmtWon = (n: number) => `${n.toLocaleString()}원`;
const fmtNum = (n: number) => n.toLocaleString();

export function QuotePanel({
  open,
  items,
  vatRate = 0.1,
  onClose,
  onInquiry,
}: QuotePanelProps) {
  const computed = useMemo(() => {
    const rows = items.map((item) => {
      const basePrice = item.baseMonthly || 0;
      const subtotal = basePrice * item.months;
      return {
        ...item,
        basePrice,
        subtotal,
      };
    });

    const subtotal = rows.reduce((sum, r) => sum + r.subtotal, 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat;

    return { rows, subtotal, vat, total };
  }, [items, vatRate]);

  const handleInquiry = () => {
    if (!onInquiry) return;

    const subject = `견적 문의 (총 ${computed.rows.length}개 항목)`;
    let body = "안녕하세요,\n\n아래 견적에 대해 문의드립니다:\n\n";

    computed.rows.forEach((row, i) => {
      body += `${i + 1}. ${row.name} - ${row.mediaName || "상품"}\n`;
      body += `   계약기간: ${row.months}개월\n`;
      body += `   금액: ${fmtWon(row.subtotal)}\n\n`;
    });

    body += `\n소계: ${fmtWon(computed.subtotal)}\n`;
    body += `부가세(10%): ${fmtWon(computed.vat)}\n`;
    body += `총 합계: ${fmtWon(computed.total)}\n\n`;
    body += "감사합니다.";

    onInquiry({ subject, body });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-semibold">견적서</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-accent rounded-md transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100vh-140px)] px-4 py-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">총 항목</div>
            <div className="text-lg font-semibold">{computed.rows.length}</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">총 개월</div>
            <div className="text-lg font-semibold">
              {computed.rows.reduce((sum, r) => sum + r.months, 0)}
            </div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">총 세대</div>
            <div className="text-lg font-semibold">
              {fmtNum(computed.rows.reduce((sum, r) => sum + (r.households || 0), 0))}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3 mb-4">
          {computed.rows.map((row, idx) => (
            <div key={idx} className="bg-card border rounded-lg p-3">
              <div className="font-medium mb-2">{row.name}</div>
              <div className="text-sm text-muted-foreground mb-1">
                {row.mediaName || "상품"}
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>세대수: {fmtNum(row.households || 0)}</span>
                <span>모니터: {row.monitors || 0}대</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>계약기간: {row.months}개월</span>
                <span>{fmtWon(row.basePrice)}/월</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t mt-2">
                <span>소계</span>
                <span>{fmtWon(row.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>소계</span>
            <span>{fmtWon(computed.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>부가세 (10%)</span>
            <span>{fmtWon(computed.vat)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>총 합계</span>
            <span className="text-primary">{fmtWon(computed.total)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <button
          onClick={handleInquiry}
          className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          견적 문의하기
        </button>
      </div>
    </div>
  );
}
