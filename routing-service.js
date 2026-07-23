/**
 * Routing service for OpenRouteService integration
 * Handles route requests, caching, and geometry decoding
 */
class RoutingService {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.isInitialized = false;
    
    if (!this.config.openRouteService.apiKey) {
      console.warn(
        'OpenRouteService API key not configured. ' +
        'Routes will fall back to straight lines. ' +
        'Set ORS_API_KEY environment variable or window.ORS_API_KEY'
      );
    } else {
      this.isInitialized = true;
    }
  }

  /**
   * Generate a cache key from waypoints and travel mode
   */
  _getCacheKey(waypoints, travelMode) {
    const coords = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    return `${travelMode}:${coords}`;
  }

  /**
   * Check if cached route is still valid
   */
  _isCacheValid(cacheEntry) {
    if (!this.config.cache.enabled) return false;
    const age = Date.now() - cacheEntry.timestamp;
    return age < this.config.cache.duration;
  }

  /**
   * Decode polyline geometry from OpenRouteService response
   * Uses standard polyline encoding algorithm (precision 5)
   */
  _decodePolyline(encoded) {
    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const changes = {
      latitude: 0,
      longitude: 0,
    };

    while (index < encoded.length) {
      for (const unit of ['latitude', 'longitude']) {
        let result = 0;
        let shift = 0;
        let chunk = 0;

        do {
          chunk = encoded.charCodeAt(index++) - 63;
          result |= (chunk & 0x1f) << shift;
          shift += 5;
        } while (chunk >= 0x20);

        changes[unit] = result & 1 ? ~(result >> 1) : result >> 1;
      }

      lat += changes.latitude;
      lng += changes.longitude;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  /**
   * Format waypoints for OpenRouteService API
   * Expected format: [[lng, lat], [lng, lat], ...]
   */
  _formatWaypoints(waypoints) {
    return waypoints.map(wp => [wp.lng, wp.lat]);
  }

  /**
   * Fetch route from OpenRouteService API
   */
  async _fetchRoute(waypoints, travelMode) {
    if (!this.isInitialized) {
      console.warn('OpenRouteService not initialized - API key missing');
      return null;
    }

    const formattedCoords = this._formatWaypoints(waypoints);
    const url = new URL(
      `${this.config.openRouteService.baseUrl}/directions/${travelMode}`
    );
    
    url.searchParams.append('api_key', this.config.openRouteService.apiKey);
    url.searchParams.append('format', 'json');

    const requestBody = {
      coordinates: formattedCoords,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.openRouteService.requestTimeout
      );

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenRouteService API error: ${response.status} ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('OpenRouteService request timed out');
      } else {
        console.error('Failed to fetch route from OpenRouteService:', error);
      }
      return null;
    }
  }

  /**
   * Get route coordinates from waypoints
   * Returns array of [lat, lng] coordinates following the road network
   * Falls back to straight line on error
   */
  async getRoute(waypoints, travelMode = this.config.defaultTravelMode) {
    if (!waypoints || waypoints.length < 2) {
      console.warn('Route requires at least 2 waypoints');
      return null;
    }

    const cacheKey = this._getCacheKey(waypoints, travelMode);
    
    // Check cache
    if (this.config.cache.enabled && this.cache.has(cacheKey)) {
      const cacheEntry = this.cache.get(cacheKey);
      if (this._isCacheValid(cacheEntry)) {
        console.log('Using cached route');
        return cacheEntry.route;
      } else {
        this.cache.delete(cacheKey);
      }
    }

    // Fetch fresh route
    const response = await this._fetchRoute(waypoints, travelMode);
    
    if (!response?.routes?.[0]) {
      console.warn(
        'No route found from OpenRouteService. Falling back to straight line.'
      );
      return this._getStraightLineFallback(waypoints);
    }

    try {
      const geometry = response.routes[0].geometry;
      const routeCoordinates = this._decodePolyline(geometry);

      // Cache the result
      if (this.config.cache.enabled) {
        this.cache.set(cacheKey, {
          route: routeCoordinates,
          timestamp: Date.now(),
        });
      }

      console.log(
        `Route fetched successfully: ${routeCoordinates.length} points`
      );
      return routeCoordinates;
    } catch (error) {
      console.error('Error processing route geometry:', error);
      return this._getStraightLineFallback(waypoints);
    }
  }

  /**
   * Fallback to straight line when routing fails
   */
  _getStraightLineFallback(waypoints) {
    console.warn('Using straight-line fallback route');
    return waypoints.map(wp => [wp.lat, wp.lng]);
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache.clear();
    console.log('Route cache cleared');
  }
}
