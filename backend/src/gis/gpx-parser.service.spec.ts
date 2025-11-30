import { Test, TestingModule } from '@nestjs/testing';
import { GpxParserService } from './gpx-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('GpxParserService', () => {
  let service: GpxParserService;

  const sampleGpx = `
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Test">
      <metadata>
        <name>Test Route</name>
        <desc>A simple test route</desc>
      </metadata>
      <trk>
        <name>Test Track</name>
        <trkseg>
          <trkpt lat="39.9042" lon="116.4074">
            <ele>50</ele>
            <time>2023-10-01T10:00:00Z</time>
          </trkpt>
          <trkpt lat="39.9052" lon="116.4084">
            <ele>60</ele>
            <time>2023-10-01T10:10:00Z</time>
          </trkpt>
          <trkpt lat="39.9062" lon="116.4094">
            <ele>70</ele>
            <time>2023-10-01T10:20:00Z</time>
          </trkpt>
        </trkseg>
      </trk>
    </gpx>
  `;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GpxParserService],
    }).compile();

    service = module.get<GpxParserService>(GpxParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should parse valid GPX content', () => {
    const result = service.parseGpxContent(sampleGpx);

    expect(result.name).toBe('Test Track');
    expect(result.description).toBe('A simple test route');
    expect(result.points.length).toBe(3);
    expect(result.distance).toBeGreaterThan(0);
    expect(result.elevation).toBe(20); // 10 + 10
    expect(result.startPoint.lat).toBe(39.9042);
    expect(result.endPoint.lat).toBe(39.9062);
    expect(result.geojson.type).toBe('LineString');
    expect(result.geojson.coordinates.length).toBe(3);
  });

  it('should throw error for invalid GPX', () => {
    expect(() => service.parseGpxContent('invalid content')).toThrow(
      BadRequestException,
    );
  });

  it('should calculate distance correctly', () => {
    const pt1 = { lat: 0, lon: 0 };
    const pt2 = { lat: 0, lon: 1 }; // 1 degree lon at equator is ~111km
    const dist = service.calculateDistanceBetweenPoints(
      pt1.lat,
      pt1.lon,
      pt2.lat,
      pt2.lon,
    );
    expect(dist).toBeCloseTo(111319, -3); // Approx 111km
  });
});
