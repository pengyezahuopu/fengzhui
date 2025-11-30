import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RouteDetailPage from './detail';
import { api } from '../../services/request';
import Taro, { useRouter } from '@tarojs/taro';

// Mock services and hooks
jest.mock('../../services/request', () => ({
  api: {
    getRouteDetail: jest.fn(),
  },
}));

jest.mock('@tarojs/taro', () => {
  const originalModule = jest.requireActual('../../../__mocks__/taro');
  return {
    __esModule: true,
    default: {
      ...originalModule.default,
      useRouter: jest.fn(),
      navigateTo: jest.fn(),
      showToast: jest.fn(),
    },
    useRouter: jest.fn(),
  };
});

// Mock RouteMap component to simplify testing
jest.mock('../../components/map/RouteMap', () => {
  return {
    __esModule: true,
    default: (props) => <div data-testid="route-map" data-props={JSON.stringify(props)} />,
  };
});

describe('RouteDetailPage', () => {
  const mockRoute = {
    id: 'route-1',
    name: 'Test Route',
    difficulty: 3,
    distance: 10.5,
    elevation: 500,
    gpxUrl: 'http://example.com/test.gpx',
    description: 'A nice route',
    coverUrl: 'http://example.com/cover.jpg',
    region: 'Beijing',
    estimatedTime: 120, // 2 hours
    createdAt: '2023-01-01',
    geojson: {
      type: 'LineString',
      coordinates: [[116.0, 39.0], [116.1, 39.1]],
    },
    startPoint: { lat: 39.0, lon: 116.0 },
    endPoint: { lat: 39.1, lon: 116.1 },
    activities: [
      {
        id: 'act-1',
        title: 'Test Activity',
        startTime: '2023-12-01T09:00:00Z',
        price: '100',
        status: 'PUBLISHED',
        maxPeople: 20,
        _count: { enrollments: 5 },
      },
    ],
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({ params: { id: 'route-1' } });
    (api.getRouteDetail as jest.Mock).mockResolvedValue(mockRoute);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', async () => {
    // Delay the resolution to check loading state
    (api.getRouteDetail as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<RouteDetailPage />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('should render route details correctly', async () => {
    render(<RouteDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Route')).toBeInTheDocument();
    });

    expect(screen.getByText('10.5')).toBeInTheDocument(); // distance
    expect(screen.getByText('500')).toBeInTheDocument(); // elevation
    expect(screen.getByText('2小时')).toBeInTheDocument(); // time
    expect(screen.getByText('中级')).toBeInTheDocument(); // difficulty
    expect(screen.getByText('A nice route')).toBeInTheDocument();
    expect(screen.getByTestId('route-map')).toBeInTheDocument();
  });

  it('should render related activities', async () => {
    render(<RouteDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('近期活动')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Activity')).toBeInTheDocument();
    expect(screen.getByText('¥100')).toBeInTheDocument();
  });

  it('should navigate to activity detail on click', async () => {
    render(<RouteDetailPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Activity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Test Activity'));
    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/activity/detail?id=act-1',
    });
  });

  it('should handle error state', async () => {
    (api.getRouteDetail as jest.Mock).mockRejectedValue(new Error('Failed'));
    render(<RouteDetailPage />);
    
    await waitFor(() => {
        // Should call toast on error
        expect(Taro.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '加载失败' }));
    });
  });
});
