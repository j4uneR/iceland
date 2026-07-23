/**
 * Configuration for itinerary routing and map display
 */
const CONFIG = {
  // OpenRouteService API configuration
  openRouteService: {
    // API key loaded from environment - MUST be set in .env file
    apiKey: typeof window !== 'undefined' ? window.ORS_API_KEY || '' : '',
    baseUrl: 'https://api.openrouteservice.org/v2',
    requestTimeout: 10000, // milliseconds
  },
  
  // Default travel mode for routing
  travelModes: {
    driving: 'driving-car',
    walking: 'foot-walking',
    cycling: 'cycling-regular',
  },
  defaultTravelMode: 'driving-car',
  
  // Route styling configuration
  routeStyling: {
    // Primary route color (used for most routes)
    primaryColor: '#667eea',
    // Alternative colors for multi-day routes (if needed in future)
    colors: ['#667eea', '#ff6b6b', '#4ecdc4', '#45b7d1', '#ffa07a'],
    lineWidth: 3,
    opacity: 0.7,
    // Route layer stays below markers
    zIndex: 10,
  },
  
  // Marker styling configuration
  markerStyling: {
    radius: 10,
    fillColor: '#667eea',
    color: '#fff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
    // Markers appear above routes
    zIndex: 20,
  },
  
  // Caching configuration to avoid duplicate API calls
  cache: {
    enabled: true,
    // Cache duration in milliseconds (5 minutes)
    duration: 5 * 60 * 1000,
  },
};

// Load API key from environment variable if available
if (typeof window !== 'undefined' && window.location.search) {
  const params = new URLSearchParams(window.location.search);
  if (params.has('orsKey')) {
    CONFIG.openRouteService.apiKey = params.get('orsKey');
  }
}
