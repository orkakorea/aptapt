import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, User, FileText, Tag, Navigation } from 'lucide-react';
import { ParsedRow, ColumnMapping } from '@/types/Place';

interface ColumnMappingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: string[];
  sampleData: ParsedRow[];
  onConfirm: (mapping: ColumnMapping) => void;
}

export function ColumnMappingModal({ 
  open, 
  onOpenChange, 
  columns, 
  sampleData, 
  onConfirm 
}: ColumnMappingModalProps) {
  const [mapping, setMapping] = useState<ColumnMapping>({});

  useEffect(() => {
    if (open && columns.length > 0) {
      // Auto-detect columns based on common names
      const autoMapping: ColumnMapping = {};
      
      columns.forEach(col => {
        const lower = col.toLowerCase();
        
        // Address detection
        if (!autoMapping.address && (
          lower.includes('주소') || 
          lower.includes('address') || 
          lower.includes('addr') ||
          lower.includes('위치')
        )) {
          autoMapping.address = col;
        }
        
        // Latitude detection
        if (!autoMapping.latitude && (
          lower.includes('위도') || 
          lower.includes('latitude') || 
          lower.includes('lat')
        )) {
          autoMapping.latitude = col;
        }
        
        // Longitude detection
        if (!autoMapping.longitude && (
          lower.includes('경도') || 
          lower.includes('longitude') || 
          lower.includes('lng') ||
          lower.includes('lon')
        )) {
          autoMapping.longitude = col;
        }
        
        // Name detection
        if (!autoMapping.name && (
          lower.includes('이름') || 
          lower.includes('name') || 
          lower.includes('장소') ||
          lower.includes('title') ||
          lower.includes('제목')
        )) {
          autoMapping.name = col;
        }
        
        // Notes detection
        if (!autoMapping.notes && (
          lower.includes('메모') || 
          lower.includes('notes') || 
          lower.includes('설명') ||
          lower.includes('description') ||
          lower.includes('비고')
        )) {
          autoMapping.notes = col;
        }
        
        // Category detection
        if (!autoMapping.category && (
          lower.includes('카테고리') || 
          lower.includes('category') || 
          lower.includes('분류') ||
          lower.includes('타입') ||
          lower.includes('type')
        )) {
          autoMapping.category = col;
        }
      });
      
      setMapping(autoMapping);
    }
  }, [open, columns]);

  const handleConfirm = () => {
    // Validation
    const hasCoordinates = mapping.latitude && mapping.longitude;
    const hasAddress = mapping.address;
    
    if (!hasCoordinates && !hasAddress) {
      alert('주소 또는 위도/경도 정보가 필요합니다.');
      return;
    }
    
    onConfirm(mapping);
    onOpenChange(false);
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === 'none' ? undefined : value
    }));
  };

  const getSampleValue = (column: string) => {
    const sample = sampleData[0];
    if (sample && column && sample[column]) {
      const value = String(sample[column]);
      return value.length > 20 ? `${value.substring(0, 20)}...` : value;
    }
    return '';
  };

  const hasRequiredMapping = () => {
    const hasCoordinates = mapping.latitude && mapping.longitude;
    const hasAddress = mapping.address;
    return hasCoordinates || hasAddress;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            열 매핑 설정
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Required Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Navigation className="h-4 w-4 text-red-500" />
                필수 정보
                <Badge variant="destructive">필수</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>주소</Label>
                  <Select 
                    value={mapping.address || 'none'} 
                    onValueChange={(value) => handleMappingChange('address', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="주소 열 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>
                          {col} {getSampleValue(col) && `(예: ${getSampleValue(col)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="text-center self-end pb-2 text-sm text-muted-foreground">
                  또는
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>위도 (Latitude)</Label>
                  <Select 
                    value={mapping.latitude || 'none'} 
                    onValueChange={(value) => handleMappingChange('latitude', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="위도 열 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>
                          {col} {getSampleValue(col) && `(예: ${getSampleValue(col)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>경도 (Longitude)</Label>
                  <Select 
                    value={mapping.longitude || 'none'} 
                    onValueChange={(value) => handleMappingChange('longitude', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="경도 열 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>
                          {col} {getSampleValue(col) && `(예: ${getSampleValue(col)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Optional Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-500" />
                추가 정보
                <Badge variant="secondary">선택사항</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    이름/제목
                  </Label>
                  <Select 
                    value={mapping.name || 'none'} 
                    onValueChange={(value) => handleMappingChange('name', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="이름 열 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>
                          {col} {getSampleValue(col) && `(예: ${getSampleValue(col)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    카테고리
                  </Label>
                  <Select 
                    value={mapping.category || 'none'} 
                    onValueChange={(value) => handleMappingChange('category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리 열 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {columns.map(col => (
                        <SelectItem key={col} value={col}>
                          {col} {getSampleValue(col) && `(예: ${getSampleValue(col)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  설명/메모
                </Label>
                <Select 
                  value={mapping.notes || 'none'} 
                  onValueChange={(value) => handleMappingChange('notes', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="설명 열 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">선택 안함</SelectItem>
                    {columns.map(col => (
                      <SelectItem key={col} value={col}>
                        {col} {getSampleValue(col) && `(예: ${getSampleValue(col)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {sampleData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">미리보기 (첫 번째 행)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1">
                  {Object.entries(sampleData[0]).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium">{key}:</span>
                      <span className="text-muted-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!hasRequiredMapping()}>
            확인 ({sampleData.length}개 행 처리)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}