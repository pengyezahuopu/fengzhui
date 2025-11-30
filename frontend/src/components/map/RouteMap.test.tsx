import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RouteMap from './RouteMap';

describe('RouteMap Component', () => {
  const mockGeoJson = {
    type: 'LineString' as const,
    coordinates: [
      [116.4074, 39.9042],
      [116.4084, 39.9052],
    ],
  };

  it('should render placeholder when no data', () => {
    render(<RouteMap />);
    expect(screen.getByText('暂无轨迹数据')).toBeInTheDocument();
  });

  it('should render map when geojson provided', async () => {
    render(<RouteMap geojson={mockGeoJson} />);
    expect(screen.getByTestId('taro-map')).toBeInTheDocument();
  });

  it('should calculate center correctly', () => {
    render(<RouteMap geojson={mockGeoJson} />);
    const map = screen.getByTestId('taro-map');
    
    const lat = parseFloat(map.getAttribute('latitude') || '0');
    const lon = parseFloat(map.getAttribute('longitude') || '0');

    expect(lat).toBeCloseTo(39.9047);
    expect(lon).toBeCloseTo(116.4079);
  });
});
