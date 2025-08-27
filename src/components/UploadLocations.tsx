import React, { useCallback, useState } from 'react';
import { Upload, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { parseSpreadsheetFile, downloadSampleCSV } from '@/utils/parseSpreadsheet';
import { ParsedRow } from '@/types/Place';

interface UploadLocationsProps {
  onFilesParsed: (rows: ParsedRow[]) => void;
  isProcessing?: boolean;
}

export function UploadLocations({ onFilesParsed, isProcessing = false }: UploadLocationsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: "Excel (.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({
        title: "파일 크기 초과",
        description: "10MB 이하의 파일만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    try {
      const rows = await parseSpreadsheetFile(file);
      
      if (rows.length === 0) {
        toast({
          title: "빈 파일",
          description: "파일에 데이터가 없습니다.",
          variant: "destructive"
        });
        return;
      }

      onFilesParsed(rows);
      
      toast({
        title: "파일 파싱 완료",
        description: `${rows.length}개의 행을 찾았습니다.`
      });
    } catch (error) {
      toast({
        title: "파일 파싱 실패",
        description: error instanceof Error ? error.message : "파일을 읽을 수 없습니다.",
        variant: "destructive"
      });
    }
  }, [onFilesParsed, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // Reset input
    e.target.value = '';
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}
        onDrop={onDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && document.getElementById('file-input')?.click()}
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <Upload className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-medium">위치 파일 업로드</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Excel (.xlsx, .xls) 또는 CSV 파일을 드래그하거나 클릭하여 업로드하세요
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">
              최대 10MB, 주소 또는 위도/경도 필요
            </span>
          </div>
        </div>
        
        <input
          id="file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onFileInput}
          className="hidden"
          disabled={isProcessing}
        />
      </Card>

      {/* Download Template Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={downloadSampleCSV}
          disabled={isProcessing}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          샘플 CSV 다운로드
        </Button>
      </div>
    </div>
  );
}