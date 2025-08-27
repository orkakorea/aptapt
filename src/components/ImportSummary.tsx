import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MapPin, 
  CheckCircle, 
  XCircle, 
  Eye, 
  ChevronDown, 
  AlertTriangle 
} from 'lucide-react';
import { ImportResult } from '@/types/Place';

interface ImportSummaryProps {
  result: ImportResult;
  className?: string;
}

export function ImportSummary({ result, className }: ImportSummaryProps) {
  const [showFailed, setShowFailed] = useState(false);

  if (result.totalRows === 0) {
    return null;
  }

  const successRate = result.totalRows > 0 
    ? Math.round((result.plotted / result.totalRows) * 100) 
    : 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          가져오기 결과
          <Badge variant={successRate >= 80 ? "default" : "secondary"}>
            {successRate}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3 text-blue-500" />
            <span>총 행: {result.totalRows}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span>표시됨: {result.plotted}</span>
          </div>
          
          {result.geocoded > 0 && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-orange-500" />
              <span>지오코딩: {result.geocoded}</span>
            </div>
          )}
          
          {result.failed > 0 && (
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>실패: {result.failed}</span>
            </div>
          )}
        </div>

        {/* Failed Addresses */}
        {result.failed > 0 && result.failedAddresses.length > 0 && (
          <Collapsible open={showFailed} onOpenChange={setShowFailed}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                실패한 주소 보기 ({result.failedAddresses.length})
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${showFailed ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2">
              <div className="max-h-24 overflow-y-auto text-xs">
                {result.failedAddresses.map((addr, index) => (
                  <div 
                    key={index} 
                    className="p-1 bg-muted rounded text-muted-foreground truncate"
                    title={addr}
                  >
                    {addr}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Success Message */}
        {successRate >= 80 && (
          <div className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            성공적으로 가져왔습니다!
          </div>
        )}
        
        {/* Warning for low success rate */}
        {successRate < 80 && successRate > 0 && (
          <div className="text-xs text-orange-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            일부 위치를 찾을 수 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}