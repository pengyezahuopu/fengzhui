import { Test, TestingModule } from '@nestjs/testing';
import { GpxParserService } from './gpx-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('GpxParserService - Error Handling', () => {
  let service: GpxParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GpxParserService],
    }).compile();

    service = module.get<GpxParserService>(GpxParserService);
  });

  it('should throw GPX_EMPTY for empty content', () => {
    expect(() => service.parseGpxContent('')).toThrow(BadRequestException);
    try {
      service.parseGpxContent('');
    } catch (e) {
      expect(e.getResponse()).toMatchObject({ code: 'GPX_EMPTY' });
    }
  });

  it('should throw GPX_NOT_XML for non-xml content', () => {
    expect(() => service.parseGpxContent('invalid content')).toThrow(
      BadRequestException,
    );
    try {
      service.parseGpxContent('invalid content');
    } catch (e) {
      expect(e.getResponse()).toMatchObject({ code: 'GPX_NOT_XML' });
    }
  });

  it('should throw GPX_NO_ROOT for xml without gpx tag', () => {
    const xml = '<?xml version="1.0"?><root></root>';
    expect(() => service.parseGpxContent(xml)).toThrow(BadRequestException);
    try {
      service.parseGpxContent(xml);
    } catch (e) {
      expect(e.getResponse()).toMatchObject({ code: 'GPX_NO_ROOT' });
    }
  });

  it('should throw GPX_VERSION_UNSUPPORTED for unsupported version', () => {
    const gpx = '<?xml version="1.0"?><gpx version="2.0"></gpx>';
    expect(() => service.parseGpxContent(gpx)).toThrow(BadRequestException);
    try {
      service.parseGpxContent(gpx);
    } catch (e) {
      expect(e.getResponse()).toMatchObject({
        code: 'GPX_VERSION_UNSUPPORTED',
      });
    }
  });

  it('should throw GPX_NO_POINTS if no track points found', () => {
    const gpx = '<?xml version="1.0"?><gpx version="1.1"><trk></trk></gpx>';
    expect(() => service.parseGpxContent(gpx)).toThrow(BadRequestException);
    try {
      service.parseGpxContent(gpx);
    } catch (e) {
      expect(e.getResponse()).toMatchObject({ code: 'GPX_NO_POINTS' });
    }
  });

  it('should throw GPX_SINGLE_POINT if only 1 point found', () => {
    const gpx = `
      <?xml version="1.0"?>
      <gpx version="1.1">
        <trk>
          <trkseg>
            <trkpt lat="0" lon="0"></trkpt>
          </trkseg>
        </trk>
      </gpx>
    `;
    expect(() => service.parseGpxContent(gpx)).toThrow(BadRequestException);
    try {
      service.parseGpxContent(gpx);
    } catch (e) {
      expect(e.getResponse()).toMatchObject({ code: 'GPX_SINGLE_POINT' });
    }
  });

  it('should throw GPX_INVALID_COORDINATES for NaN coordinates', () => {
    const gpx = `
      <?xml version="1.0"?>
      <gpx version="1.1">
        <trk>
          <trkseg>
            <trkpt lat="invalid" lon="0"></trkpt>
            <trkpt lat="0" lon="0"></trkpt>
          </trkseg>
        </trk>
      </gpx>
    `;
    expect(() => service.parseGpxContent(gpx)).toThrow(BadRequestException);
    try {
      service.parseGpxContent(gpx);
    } catch (e) {
      expect(e.getResponse()).toMatchObject({ code: 'GPX_INVALID_COORDINATES' });
    }
  });
});
