import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, Filter, MapPin } from 'lucide-react';

interface MapChromeProps {
  onBack?: () => void;
  onSearch?: () => void;
  onFilter?: () => void;
  searchQuery?: string;
}

export const MapChrome: React.FC<MapChromeProps> = ({
  onBack,
  onSearch,
  onFilter,
  searchQuery
}) => {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 bg-background/95 backdrop-blur-sm border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="font-semibold text-foreground">지도 검색</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {searchQuery && (
            <div className="hidden sm:flex items-center px-3 py-1.5 bg-muted rounded-md text-sm text-muted-foreground">
              "{searchQuery}"
            </div>
          )}
          
          {onSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSearch}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          
          {onFilter && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onFilter}
            >
              <Filter className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};