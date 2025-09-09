import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Eye, MessageSquare, Calendar, Building, User, Phone, Mail, Package } from "lucide-react";

type Inquiry = {
  id: string;
  inquiry_kind: "SEAT" | "PACKAGE";
  customer_name: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
  memo: string | null;
  status: string;
  apt_name: string | null;
  product_name: string | null;
  product_code: string | null;
  source_page: string | null;
  admin_notes: string | null;
  cart_snapshot: any;
  utm: any;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "NEW", label: "새 문의", variant: "default" as const },
  { value: "IN_PROGRESS", label: "처리중", variant: "secondary" as const },
  { value: "CONTACTED", label: "연락완료", variant: "outline" as const },
  { value: "COMPLETED", label: "완료", variant: "default" as const },
  { value: "CANCELLED", label: "취소", variant: "destructive" as const },
];

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchInquiries();
  }, []);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInquiries(data || []);
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message || "문의 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (inquiryId: string, newStatus: string) => {
    try {
      setUpdatingStatus(inquiryId);
      const { error } = await (supabase as any)
        .from("inquiries")
        .update({ status: newStatus })
        .eq("id", inquiryId);

      if (error) throw error;

      setInquiries(prev =>
        prev.map(inquiry =>
          inquiry.id === inquiryId ? { ...inquiry, status: newStatus } : inquiry
        )
      );

      toast({
        title: "성공",
        description: "상태가 업데이트되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message || "상태 업데이트에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateAdminNotes = async (inquiryId: string, notes: string) => {
    try {
      const { error } = await (supabase as any)
        .from("inquiries")
        .update({ admin_notes: notes })
        .eq("id", inquiryId);

      if (error) throw error;

      setInquiries(prev =>
        prev.map(inquiry =>
          inquiry.id === inquiryId ? { ...inquiry, admin_notes: notes } : inquiry
        )
      );

      toast({
        title: "성공",
        description: "관리자 메모가 저장되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message || "메모 저장에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return (
      <Badge variant={statusOption?.variant || "default"}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">문의 관리</h1>
          <p className="text-muted-foreground">고객 문의를 관리하고 처리 상태를 업데이트하세요</p>
        </div>
        <Button onClick={fetchInquiries} disabled={loading}>
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            문의 목록 ({inquiries.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>고객정보</TableHead>
                  <TableHead>상품/단지</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(inquiry.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={inquiry.inquiry_kind === "SEAT" ? "default" : "secondary"}>
                        {inquiry.inquiry_kind === "SEAT" ? "구좌" : "패키지"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{inquiry.customer_name}</span>
                        </div>
                        {inquiry.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {inquiry.phone}
                          </div>
                        )}
                        {inquiry.company && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building className="h-3 w-3" />
                            {inquiry.company}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {inquiry.apt_name && (
                          <div className="font-medium text-sm">{inquiry.apt_name}</div>
                        )}
                        {inquiry.product_name && (
                          <div className="text-sm text-muted-foreground">{inquiry.product_name}</div>
                        )}
                        {inquiry.cart_snapshot?.totalWon && (
                          <div className="text-sm text-muted-foreground">
                            {Number(inquiry.cart_snapshot.totalWon).toLocaleString()}원
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={inquiry.status}
                        onValueChange={(newStatus) => updateStatus(inquiry.id, newStatus)}
                        disabled={updatingStatus === inquiry.id}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedInquiry(inquiry);
                              setAdminNotes(inquiry.admin_notes || "");
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>문의 상세정보</DialogTitle>
                          </DialogHeader>
                          {selectedInquiry && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">문의 유형</label>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedInquiry.inquiry_kind === "SEAT" ? "구좌 문의" : "패키지 문의"}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">상태</label>
                                  <div className="mt-1">
                                    {getStatusBadge(selectedInquiry.status)}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="font-medium">고객 정보</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">이름:</span> {selectedInquiry.customer_name}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">연락처:</span> {selectedInquiry.phone}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">이메일:</span> {selectedInquiry.email || "-"}
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">회사:</span> {selectedInquiry.company || "-"}
                                  </div>
                                </div>
                              </div>

                              {selectedInquiry.apt_name && (
                                <div className="space-y-3">
                                  <h4 className="font-medium">상품 정보</h4>
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">단지명:</span> {selectedInquiry.apt_name}
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">상품명:</span> {selectedInquiry.product_name || "-"}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {selectedInquiry.memo && (
                                <div className="space-y-2">
                                  <h4 className="font-medium">고객 메모</h4>
                                  <p className="text-sm bg-muted p-3 rounded-md">
                                    {selectedInquiry.memo}
                                  </p>
                                </div>
                              )}

                              <div className="space-y-2">
                                <h4 className="font-medium">관리자 메모</h4>
                                <Textarea
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  placeholder="관리자 메모를 입력하세요..."
                                  rows={3}
                                />
                                <Button
                                  onClick={() => updateAdminNotes(selectedInquiry.id, adminNotes)}
                                  size="sm"
                                >
                                  메모 저장
                                </Button>
                              </div>

                              <div className="text-xs text-muted-foreground pt-4 border-t">
                                <div>페이지: {selectedInquiry.source_page}</div>
                                <div>접수일: {formatDate(selectedInquiry.created_at)}</div>
                                <div>ID: {selectedInquiry.id}</div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {inquiries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      문의가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}