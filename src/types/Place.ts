export interface Place {
  id?: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  category?: string;
}

export interface ParsedRow {
  [key: string]: string | number;
}

export interface ColumnMapping {
  address?: string;
  latitude?: string;
  longitude?: string;
  name?: string;
  notes?: string;
  category?: string;
}

export interface ImportResult {
  totalRows: number;
  geocoded: number;
  failed: number;
  plotted: number;
  failedAddresses: string[];
}