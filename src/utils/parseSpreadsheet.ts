import * as XLSX from 'xlsx';
import { ParsedRow } from '@/types/Place';

export function parseSpreadsheetFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON - get raw arrays first
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, 
          defval: '' 
        });
        
        if (rawData.length === 0) {
          resolve([]);
          return;
        }
        
        // Get headers from first row
        const headers = rawData[0] as string[];
        const rows = rawData.slice(1);
        
        // Convert to objects with proper headers
        const parsedRows: ParsedRow[] = rows
          .map((row: any[]) => {
            const obj: ParsedRow = {};
            headers.forEach((header, index) => {
              const value = row[index];
              obj[header.trim()] = typeof value === 'string' ? value.trim() : value;
            });
            return obj;
          })
          .filter((row) => {
            // Filter out completely empty rows
            return Object.values(row).some(value => 
              value !== '' && value !== null && value !== undefined
            );
          });
        
        // Remove duplicates based on address+name or lat+lng
        const uniqueRows = removeDuplicates(parsedRows);
        
        resolve(uniqueRows);
      } catch (error) {
        reject(new Error(`파일 파싱 실패: ${error}`));
      }
    };
    
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

function removeDuplicates(rows: ParsedRow[]): ParsedRow[] {
  const seen = new Set<string>();
  
  return rows.filter((row) => {
    // Create a unique key based on address+name or lat+lng
    let key = '';
    
    const address = getStringValue(row.address || row.Address || row['주소']);
    const name = getStringValue(row.name || row.Name || row['이름'] || row['장소명']);
    const lat = getNumberValue(row.lat || row.latitude || row.Latitude || row['위도']);
    const lng = getNumberValue(row.lng || row.longitude || row.Longitude || row['경도']);
    
    if (lat && lng) {
      key = `${lat},${lng}`;
    } else if (address) {
      key = `${address}:${name || ''}`;
    } else {
      // If no address or coordinates, use all values
      key = Object.values(row).join('|');
    }
    
    if (seen.has(key)) {
      return false;
    }
    
    seen.add(key);
    return true;
  });
}

function getStringValue(value: any): string {
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function getNumberValue(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.trim());
    return isNaN(num) ? null : num;
  }
  return null;
}

export function generateSampleCSV(): string {
  const headers = ['name', 'address', 'latitude', 'longitude', 'notes'];
  const sampleData = [
    ['카페 스타벅스', '서울특별시 강남구 테헤란로 427', '', '', '맛있는 커피'],
    ['롯데월드타워', '', '37.5125', '127.1025', '서울 랜드마크'],
    ['한강공원', '서울특별시 영등포구 여의동로 330', '', '', '산책하기 좋은 곳'],
  ];
  
  const csvContent = [headers, ...sampleData]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
    
  return csvContent;
}

export function downloadSampleCSV() {
  const csvContent = generateSampleCSV();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'locations_template.csv');
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}