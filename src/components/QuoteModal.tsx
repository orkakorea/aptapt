import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, MapPin, Phone, Mail, FileText } from "lucide-react";

interface QuoteItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface QuoteModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  quote?: {
    id: string;
    title: string;
    status: "draft" | "sent" | "approved" | "rejected";
    createdDate: string;
    validUntil: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    customerAddress?: string;
    items: QuoteItem[];
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
  };
}

const defaultQuote = {
  id: "Q-2024-001",
  title: "웹사이트 개발 프로젝트",
  status: "sent" as const,
  createdDate: "2024-01-15",
  validUntil: "2024-02-15",
  customerName: "홍길동",
  customerEmail: "hong@example.com",
  customerPhone: "010-1234-5678",
  customerAddress: "서울시 강남구 테헤란로 123",
  items: [
    {
      id: "1",
      name: "반응형 웹사이트 디자인",
      description: "모바일, 태블릿, 데스크탑 대응",
      quantity: 1,
      unitPrice: 2000000,
      total: 2000000,
    },
    {
      id: "2",
      name: "백엔드 API 개발",
      description: "사용자 관리 및 데이터베이스 설계",
      quantity: 1,
      unitPrice: 1500000,
      total: 1500000,
    },
    {
      id: "3",
      name: "SEO 최적화",
      description: "검색엔진 최적화 및 성능 개선",
      quantity: 1,
      unitPrice: 800000,
      total: 800000,
    },
  ],
  subtotal: 4300000,
  tax: 430000,
  total: 4730000,
  notes: "프로젝트 완료 후 3개월 무료 유지보수 포함",
};

const getStatusBadge = (status: string) => {
  const statusConfig = {
    draft: { label: "임시저장", variant: "secondary" as const },
    sent: { label: "발송완료", variant: "default" as const },
    approved: { label: "승인됨", variant: "default" as const },
    rejected: { label: "거절됨", variant: "destructive" as const },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("ko-KR");
};

export function QuoteModal({
  trigger,
  open,
  onOpenChange,
  quote = defaultQuote,
}: QuoteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">견적서</DialogTitle>
            {getStatusBadge(quote.status)}
          </div>
          <DialogDescription>
            견적 번호: {quote.id} | 작성일: {formatDate(quote.createdDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                프로젝트 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{quote.title}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>유효기간: {formatDate(quote.validUntil)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>작성일: {formatDate(quote.createdDate)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 고객 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>고객 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-lg font-semibold">{quote.customerName}</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {quote.customerEmail}
                </div>
                {quote.customerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {quote.customerPhone}
                  </div>
                )}
                {quote.customerAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {quote.customerAddress}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 견적 항목 */}
          <Card>
            <CardHeader>
              <CardTitle>견적 내역</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quote.items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.name}</h4>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="text-sm text-muted-foreground mt-2">
                          수량: {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                    </div>
                    {index < quote.items.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              {/* 합계 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>소계</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>부가세 (10%)</span>
                  <span>{formatCurrency(quote.tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>총 금액</span>
                  <span>{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 참고사항 */}
          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>참고사항</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{quote.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1">
              PDF 다운로드
            </Button>
            <Button variant="outline" className="flex-1">
              이메일 발송
            </Button>
            <Button className="flex-1">
              승인 요청
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}