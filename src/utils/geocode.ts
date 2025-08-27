// Naver Maps Geocoding API utility
// Note: This requires NAVER_CLIENT_ID and NAVER_CLIENT_SECRET to be configured

interface GeocodeResult {
  lat: number;
  lng: number;
}

class GeocodeQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private readonly delayMs = 200; // 5 QPS = 200ms delay

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        await this.delay(this.delayMs);
      }
    }
    
    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const geocodeQueue = new GeocodeQueue();

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim() === '') {
    return null;
  }

  return geocodeQueue.add(async () => {
    try {
      // For now, we'll use Kakao Maps geocoding since Naver requires server-side API calls
      // In a real implementation, you'd call your backend or use Supabase Edge Functions
      return await geocodeWithKakao(address.trim());
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  });
}

async function geocodeWithKakao(address: string): Promise<GeocodeResult | null> {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve(null);
      return;
    }

    const geocoder = new window.kakao.maps.services.Geocoder();
    
    geocoder.addressSearch(address, (result: any[], status: string) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        resolve({
          lat: parseFloat(result[0].y),
          lng: parseFloat(result[0].x)
        });
      } else {
        resolve(null);
      }
    });
  });
}

// For future Naver Maps implementation (requires server-side API call)
export async function geocodeWithNaver(address: string, clientId: string, clientSecret: string): Promise<GeocodeResult | null> {
  try {
    // This would need to be called from a backend/edge function due to CORS
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        address,
        clientId,
        clientSecret 
      }),
    });

    if (!response.ok) {
      throw new Error('Geocoding API request failed');
    }

    const data = await response.json();
    
    if (data.addresses && data.addresses.length > 0) {
      const location = data.addresses[0];
      return {
        lat: parseFloat(location.y),
        lng: parseFloat(location.x)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Naver geocoding error:', error);
    return null;
  }
}

export function checkGeocodeCredentials(): { hasCredentials: boolean; message?: string } {
  // For Kakao Maps (current implementation)
  if (window.kakao?.maps?.services) {
    return { hasCredentials: true };
  }
  
  return { 
    hasCredentials: false, 
    message: 'Kakao Maps SDK not loaded. Please ensure the map is initialized.' 
  };
}