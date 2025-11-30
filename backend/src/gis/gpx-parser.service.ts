import { Injectable, BadRequestException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import * as turf from '@turf/turf';

export interface GpxTrackPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface GpxParseResult {
  name: string;
  description?: string;
  points: GpxTrackPoint[];
  distance: number; // 公里
  elevation: number; // 累计爬升（米）
  estimatedTime: number; // 预计用时（分钟）
  startPoint: { lat: number; lon: number };
  endPoint: { lat: number; lon: number };
  geojson: GeoJSON.LineString;
  wkt: string;
}

@Injectable()
export class GpxParserService {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * 解析 GPX 文件内容
   */
  parseGpxContent(gpxContent: string): GpxParseResult {
    // 预验证：检查文件内容
    if (!gpxContent || gpxContent.trim().length === 0) {
      throw new BadRequestException({
        code: 'GPX_EMPTY',
        message: '文件内容为空',
        suggestion: '请上传有效的 GPX 文件',
      });
    }

    // 检查是否为 XML 格式
    if (!gpxContent.trim().startsWith('<?xml') && !gpxContent.trim().startsWith('<gpx')) {
      throw new BadRequestException({
        code: 'GPX_NOT_XML',
        message: '文件不是有效的 XML 格式',
        suggestion: '请确保上传的是 GPX 格式文件（.gpx）',
      });
    }

    try {
      const parsed = this.parser.parse(gpxContent);
      const gpx = parsed.gpx;

      if (!gpx) {
        throw new BadRequestException({
          code: 'GPX_NO_ROOT',
          message: 'XML 文件缺少 <gpx> 根元素',
          suggestion: '请检查 GPX 文件结构是否正确',
        });
      }

      // 检查 GPX 版本
      const version = gpx['@_version'];
      if (version && !['1.0', '1.1'].includes(version)) {
        throw new BadRequestException({
          code: 'GPX_VERSION_UNSUPPORTED',
          message: `不支持的 GPX 版本: ${version}`,
          suggestion: '请使用 GPX 1.0 或 1.1 版本的文件',
        });
      }

      // 提取轨迹名称
      const name = gpx.trk?.name || gpx.metadata?.name || '未命名线路';
      const description = gpx.trk?.desc || gpx.metadata?.desc;

      // 提取轨迹点
      const points = this.extractTrackPoints(gpx);

      if (points.length === 0) {
        throw new BadRequestException({
          code: 'GPX_NO_POINTS',
          message: '文件中没有找到轨迹点',
          suggestion: '请确保 GPX 文件包含 <trk>/<trkseg>/<trkpt> 或 <rte>/<rtept> 数据',
        });
      }

      if (points.length === 1) {
        throw new BadRequestException({
          code: 'GPX_SINGLE_POINT',
          message: '文件只包含 1 个轨迹点',
          suggestion: '线路轨迹至少需要 2 个点才能形成路径',
        });
      }

      // 验证坐标有效性
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (isNaN(p.lat) || isNaN(p.lon)) {
          throw new BadRequestException({
            code: 'GPX_INVALID_COORDINATES',
            message: `第 ${i + 1} 个轨迹点坐标无效`,
            suggestion: '请检查轨迹点的 lat/lon 属性是否为有效数字',
          });
        }
        if (p.lat < -90 || p.lat > 90 || p.lon < -180 || p.lon > 180) {
          throw new BadRequestException({
            code: 'GPX_COORDINATES_OUT_OF_RANGE',
            message: `第 ${i + 1} 个轨迹点坐标超出有效范围`,
            suggestion: '纬度范围：-90 到 90，经度范围：-180 到 180',
          });
        }
      }

      // 检查是否有海拔数据
      const hasElevation = points.some((p) => p.ele !== undefined);

      // 计算线路统计信息
      const distance = this.calculateDistance(points);
      const elevation = this.calculateElevationGain(points);
      const estimatedTime = this.estimateTime(distance, elevation);

      // 生成 GeoJSON 和 WKT
      const geojson = this.toGeoJson(points);
      const wkt = this.toWkt(points);

      return {
        name,
        description,
        points,
        distance: Math.round(distance * 100) / 100,
        elevation: Math.round(elevation),
        estimatedTime,
        startPoint: { lat: points[0].lat, lon: points[0].lon },
        endPoint: {
          lat: points[points.length - 1].lat,
          lon: points[points.length - 1].lon,
        },
        geojson,
        wkt,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // XML 解析错误
      if (error.message?.includes('parse') || error.message?.includes('XML')) {
        throw new BadRequestException({
          code: 'GPX_PARSE_ERROR',
          message: 'XML 解析失败',
          suggestion: '文件可能损坏或格式不正确，请检查 XML 语法',
          detail: error.message,
        });
      }
      throw new BadRequestException({
        code: 'GPX_UNKNOWN_ERROR',
        message: 'GPX 处理失败',
        suggestion: '请检查文件格式或联系技术支持',
        detail: error.message,
      });
    }
  }

  /**
   * 从 GPX 对象中提取轨迹点
   */
  private extractTrackPoints(gpx: any): GpxTrackPoint[] {
    const points: GpxTrackPoint[] = [];

    // 尝试从 trk (track) 中提取
    if (gpx.trk) {
      const tracks = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
      for (const track of tracks) {
        if (track.trkseg) {
          const segments = Array.isArray(track.trkseg)
            ? track.trkseg
            : [track.trkseg];
          for (const segment of segments) {
            if (segment.trkpt) {
              const trackPoints = Array.isArray(segment.trkpt)
                ? segment.trkpt
                : [segment.trkpt];
              for (const pt of trackPoints) {
                points.push({
                  lat: parseFloat(pt['@_lat']),
                  lon: parseFloat(pt['@_lon']),
                  ele: pt.ele ? parseFloat(pt.ele) : undefined,
                  time: pt.time,
                });
              }
            }
          }
        }
      }
    }

    // 尝试从 rte (route) 中提取
    if (gpx.rte && points.length === 0) {
      const routes = Array.isArray(gpx.rte) ? gpx.rte : [gpx.rte];
      for (const route of routes) {
        if (route.rtept) {
          const routePoints = Array.isArray(route.rtept)
            ? route.rtept
            : [route.rtept];
          for (const pt of routePoints) {
            points.push({
              lat: parseFloat(pt['@_lat']),
              lon: parseFloat(pt['@_lon']),
              ele: pt.ele ? parseFloat(pt.ele) : undefined,
              time: pt.time,
            });
          }
        }
      }
    }

    // 尝试从 wpt (waypoints) 中提取
    if (gpx.wpt && points.length === 0) {
      const waypoints = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
      for (const pt of waypoints) {
        points.push({
          lat: parseFloat(pt['@_lat']),
          lon: parseFloat(pt['@_lon']),
          ele: pt.ele ? parseFloat(pt.ele) : undefined,
          time: pt.time,
        });
      }
    }

    return points;
  }

  /**
   * 计算总距离（公里）
   */
  private calculateDistance(points: GpxTrackPoint[]): number {
    const coordinates = points.map((p) => [p.lon, p.lat]);
    const line = turf.lineString(coordinates);
    return turf.length(line, { units: 'kilometers' });
  }

  /**
   * 计算累计爬升（米）
   */
  private calculateElevationGain(points: GpxTrackPoint[]): number {
    let gain = 0;
    for (let i = 1; i < points.length; i++) {
      const prevEle = points[i - 1].ele || 0;
      const currEle = points[i].ele || 0;
      if (currEle > prevEle) {
        gain += currEle - prevEle;
      }
    }
    return gain;
  }

  /**
   * 估算用时（分钟）
   * 基于 Naismith's Rule: 基础速度 5km/h + 每 600m 爬升增加 1 小时
   */
  private estimateTime(distanceKm: number, elevationM: number): number {
    const baseTimeHours = distanceKm / 5; // 5km/h 基础速度
    const elevationTimeHours = elevationM / 600; // 每 600m 爬升 +1 小时
    return Math.round((baseTimeHours + elevationTimeHours) * 60);
  }

  /**
   * 转换为 GeoJSON LineString
   */
  private toGeoJson(points: GpxTrackPoint[]): GeoJSON.LineString {
    return {
      type: 'LineString',
      coordinates: points.map((p) => [p.lon, p.lat]),
    };
  }

  /**
   * 转换为 WKT 格式 (PostGIS 使用)
   */
  private toWkt(points: GpxTrackPoint[]): string {
    const coordString = points.map((p) => `${p.lon} ${p.lat}`).join(', ');
    return `LINESTRING(${coordString})`;
  }

  /**
   * 点转 WKT
   */
  pointToWkt(lat: number, lon: number): string {
    return `POINT(${lon} ${lat})`;
  }

  /**
   * 计算两点之间的距离（米）
   */
  calculateDistanceBetweenPoints(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const from = turf.point([lon1, lat1]);
    const to = turf.point([lon2, lat2]);
    return turf.distance(from, to, { units: 'meters' });
  }

  /**
   * 获取海拔数据用于绘制海拔图
   */
  getElevationProfile(
    points: GpxTrackPoint[],
  ): { distance: number; elevation: number }[] {
    const profile: { distance: number; elevation: number }[] = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        cumulativeDistance += this.calculateDistanceBetweenPoints(
          points[i - 1].lat,
          points[i - 1].lon,
          points[i].lat,
          points[i].lon,
        );
      }
      profile.push({
        distance: Math.round(cumulativeDistance),
        elevation: points[i].ele || 0,
      });
    }

    return profile;
  }
}
