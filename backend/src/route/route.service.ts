import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GpxParserService, GpxParseResult } from '../gis/gpx-parser.service';

export interface RouteWithGeoJson {
  id: string;
  name: string;
  difficulty: number;
  distance: number;
  elevation: number;
  gpxUrl: string | null;
  description: string | null;
  coverUrl: string | null;
  region: string | null;
  estimatedTime: number | null;
  createdAt: Date;
  geojson: GeoJSON.LineString | null;
  startPoint: { lat: number; lon: number } | null;
  endPoint: { lat: number; lon: number } | null;
  pointCount?: number; // 简化后的点数量
  originalPointCount?: number; // 原始点数量
}

export interface GeoQueryOptions {
  simplify?: boolean; // 是否简化轨迹
  tolerance?: number; // 简化容差 (度), 默认 0.0001 约等于 10米
  maxPoints?: number; // 最大点数，超过此值自动启用简化
}

export interface CreateRouteFromGpxDto {
  gpxContent: string;
  name?: string;
  description?: string;
  coverUrl?: string;
  region?: string;
  difficulty?: number;
}

@Injectable()
export class RouteService {
  constructor(
    private prisma: PrismaService,
    private gpxParser: GpxParserService,
  ) {}

  // 创建线路
  async createRoute(data: {
    name: string;
    difficulty?: number;
    distance: number;
    elevation: number;
    gpxUrl?: string;
    description?: string;
    coverUrl?: string;
    region?: string;
    estimatedTime?: number;
  }) {
    return this.prisma.route.create({
      data: {
        name: data.name,
        difficulty: data.difficulty || 1,
        distance: data.distance,
        elevation: data.elevation,
        gpxUrl: data.gpxUrl,
        description: data.description,
        coverUrl: data.coverUrl,
        region: data.region,
        estimatedTime: data.estimatedTime,
      },
    });
  }

  // 通过 GPX 文件创建线路
  async createRouteFromGpx(dto: CreateRouteFromGpxDto): Promise<any> {
    const parseResult = this.gpxParser.parseGpxContent(dto.gpxContent);

    // 使用原生 SQL 插入包含几何数据的记录
    const result = await this.prisma.$queryRaw<any[]>`
      INSERT INTO "Route" (
        id, name, difficulty, distance, elevation, description,
        "coverUrl", region, "estimatedTime", geometry, "startPoint", "endPoint", "createdAt"
      )
      VALUES (
        gen_random_uuid(),
        ${dto.name || parseResult.name},
        ${dto.difficulty || 2},
        ${parseResult.distance},
        ${parseResult.elevation},
        ${dto.description || parseResult.description || ''},
        ${dto.coverUrl || ''},
        ${dto.region || ''},
        ${parseResult.estimatedTime},
        ST_GeomFromText(${parseResult.wkt}, 4326),
        ST_GeomFromText(${this.gpxParser.pointToWkt(parseResult.startPoint.lat, parseResult.startPoint.lon)}, 4326),
        ST_GeomFromText(${this.gpxParser.pointToWkt(parseResult.endPoint.lat, parseResult.endPoint.lon)}, 4326),
        NOW()
      )
      RETURNING id, name, difficulty, distance, elevation, description, "coverUrl", region, "estimatedTime", "createdAt"
    `;

    return {
      ...result[0],
      geojson: parseResult.geojson,
      startPoint: parseResult.startPoint,
      endPoint: parseResult.endPoint,
      pointCount: parseResult.points.length,
    };
  }

  // 获取所有线路
  async getAllRoutes() {
    return this.prisma.route.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // 获取所有线路（包含 GeoJSON）
  async getAllRoutesWithGeoJson(
    options: GeoQueryOptions = {},
  ): Promise<RouteWithGeoJson[]> {
    const { simplify = false, tolerance = 0.0001, maxPoints = 1000 } = options;

    // 根据是否简化选择不同的查询
    const routes = await this.prisma.$queryRaw<any[]>`
      SELECT
        id, name, difficulty, distance, elevation, "gpxUrl",
        description, "coverUrl", region, "estimatedTime", "createdAt",
        CASE
          WHEN ${simplify} = true OR ST_NPoints(geometry) > ${maxPoints} THEN
            ST_AsGeoJSON(ST_Simplify(geometry, ${tolerance}))
          ELSE
            ST_AsGeoJSON(geometry)
        END as geojson_str,
        ST_NPoints(geometry) as original_point_count,
        CASE
          WHEN ${simplify} = true OR ST_NPoints(geometry) > ${maxPoints} THEN
            ST_NPoints(ST_Simplify(geometry, ${tolerance}))
          ELSE
            ST_NPoints(geometry)
        END as point_count,
        ST_Y("startPoint"::geometry) as start_lat,
        ST_X("startPoint"::geometry) as start_lon,
        ST_Y("endPoint"::geometry) as end_lat,
        ST_X("endPoint"::geometry) as end_lon
      FROM "Route"
      ORDER BY "createdAt" DESC
    `;

    return routes.map((route) => ({
      id: route.id,
      name: route.name,
      difficulty: route.difficulty,
      distance: route.distance,
      elevation: route.elevation,
      gpxUrl: route.gpxUrl,
      description: route.description,
      coverUrl: route.coverUrl,
      region: route.region,
      estimatedTime: route.estimatedTime,
      createdAt: route.createdAt,
      geojson: route.geojson_str ? JSON.parse(route.geojson_str) : null,
      startPoint:
        route.start_lat && route.start_lon
          ? { lat: route.start_lat, lon: route.start_lon }
          : null,
      endPoint:
        route.end_lat && route.end_lon
          ? { lat: route.end_lat, lon: route.end_lon }
          : null,
      pointCount: route.point_count ? Number(route.point_count) : undefined,
      originalPointCount: route.original_point_count
        ? Number(route.original_point_count)
        : undefined,
    }));
  }

  // 根据ID获取线路
  async getRouteById(id: string) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: {
        activities: {
          where: {
            status: 'PUBLISHED',
          },
          take: 5,
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!route) {
      throw new NotFoundException(`线路 ${id} 不存在`);
    }

    return route;
  }

  // 根据ID获取线路（包含 GeoJSON）
  async getRouteByIdWithGeoJson(
    id: string,
    options: GeoQueryOptions = {},
  ): Promise<RouteWithGeoJson> {
    const { simplify = false, tolerance = 0.0001, maxPoints = 1000 } = options;

    const routes = await this.prisma.$queryRaw<any[]>`
      SELECT
        id, name, difficulty, distance, elevation, "gpxUrl",
        description, "coverUrl", region, "estimatedTime", "createdAt",
        CASE
          WHEN ${simplify} = true OR ST_NPoints(geometry) > ${maxPoints} THEN
            ST_AsGeoJSON(ST_Simplify(geometry, ${tolerance}))
          ELSE
            ST_AsGeoJSON(geometry)
        END as geojson_str,
        ST_NPoints(geometry) as original_point_count,
        CASE
          WHEN ${simplify} = true OR ST_NPoints(geometry) > ${maxPoints} THEN
            ST_NPoints(ST_Simplify(geometry, ${tolerance}))
          ELSE
            ST_NPoints(geometry)
        END as point_count,
        ST_Y("startPoint"::geometry) as start_lat,
        ST_X("startPoint"::geometry) as start_lon,
        ST_Y("endPoint"::geometry) as end_lat,
        ST_X("endPoint"::geometry) as end_lon
      FROM "Route"
      WHERE id = ${id}
    `;

    if (routes.length === 0) {
      throw new NotFoundException(`线路 ${id} 不存在`);
    }

    const route = routes[0];
    return {
      id: route.id,
      name: route.name,
      difficulty: route.difficulty,
      distance: route.distance,
      elevation: route.elevation,
      gpxUrl: route.gpxUrl,
      description: route.description,
      coverUrl: route.coverUrl,
      region: route.region,
      estimatedTime: route.estimatedTime,
      createdAt: route.createdAt,
      geojson: route.geojson_str ? JSON.parse(route.geojson_str) : null,
      startPoint:
        route.start_lat && route.start_lon
          ? { lat: route.start_lat, lon: route.start_lon }
          : null,
      endPoint:
        route.end_lat && route.end_lon
          ? { lat: route.end_lat, lon: route.end_lon }
          : null,
      pointCount: route.point_count ? Number(route.point_count) : undefined,
      originalPointCount: route.original_point_count
        ? Number(route.original_point_count)
        : undefined,
    };
  }

  // 搜索附近的线路
  async findNearbyRoutes(
    lat: number,
    lon: number,
    radiusKm: number = 50,
  ): Promise<RouteWithGeoJson[]> {
    const routes = await this.prisma.$queryRaw<any[]>`
      SELECT
        id, name, difficulty, distance, elevation, "gpxUrl",
        description, "coverUrl", region, "estimatedTime", "createdAt",
        ST_AsGeoJSON(geometry) as geojson_str,
        ST_Y("startPoint"::geometry) as start_lat,
        ST_X("startPoint"::geometry) as start_lon,
        ST_Y("endPoint"::geometry) as end_lat,
        ST_X("endPoint"::geometry) as end_lon,
        ST_Distance(
          "startPoint"::geography,
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography
        ) / 1000 as distance_km
      FROM "Route"
      WHERE "startPoint" IS NOT NULL
        AND ST_DWithin(
          "startPoint"::geography,
          ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography,
          ${radiusKm * 1000}
        )
      ORDER BY distance_km ASC
    `;

    return routes.map((route) => ({
      id: route.id,
      name: route.name,
      difficulty: route.difficulty,
      distance: route.distance,
      elevation: route.elevation,
      gpxUrl: route.gpxUrl,
      description: route.description,
      coverUrl: route.coverUrl,
      region: route.region,
      estimatedTime: route.estimatedTime,
      createdAt: route.createdAt,
      geojson: route.geojson_str ? JSON.parse(route.geojson_str) : null,
      startPoint:
        route.start_lat && route.start_lon
          ? { lat: route.start_lat, lon: route.start_lon }
          : null,
      endPoint:
        route.end_lat && route.end_lon
          ? { lat: route.end_lat, lon: route.end_lon }
          : null,
    }));
  }

  // 更新线路
  async updateRoute(
    id: string,
    data: {
      name?: string;
      difficulty?: number;
      distance?: number;
      elevation?: number;
      gpxUrl?: string;
      description?: string;
      coverUrl?: string;
      region?: string;
      estimatedTime?: number;
    },
  ) {
    return this.prisma.route.update({
      where: { id },
      data,
    });
  }

  // 通过 GPX 更新线路几何数据
  async updateRouteGeometry(id: string, gpxContent: string): Promise<any> {
    const parseResult = this.gpxParser.parseGpxContent(gpxContent);

    await this.prisma.$executeRaw`
      UPDATE "Route"
      SET
        distance = ${parseResult.distance},
        elevation = ${parseResult.elevation},
        "estimatedTime" = ${parseResult.estimatedTime},
        geometry = ST_GeomFromText(${parseResult.wkt}, 4326),
        "startPoint" = ST_GeomFromText(${this.gpxParser.pointToWkt(parseResult.startPoint.lat, parseResult.startPoint.lon)}, 4326),
        "endPoint" = ST_GeomFromText(${this.gpxParser.pointToWkt(parseResult.endPoint.lat, parseResult.endPoint.lon)}, 4326)
      WHERE id = ${id}
    `;

    return this.getRouteByIdWithGeoJson(id);
  }

  // 删除线路
  async deleteRoute(id: string) {
    return this.prisma.route.delete({
      where: { id },
    });
  }

  // 按难度筛选线路
  async getRoutesByDifficulty(difficulty: number) {
    return this.prisma.route.findMany({
      where: {
        difficulty: {
          lte: difficulty,
        },
      },
      orderBy: { difficulty: 'asc' },
    });
  }

  // 获取线路海拔剖面数据
  async getRouteElevationProfile(
    id: string,
  ): Promise<{ distance: number; elevation: number }[]> {
    // 获取线路基本信息
    const route = await this.prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      throw new NotFoundException(`线路 ${id} 不存在`);
    }

    // 从数据库获取 GeoJSON 坐标
    const geoData = await this.prisma.$queryRaw<any[]>`
      SELECT
        ST_AsGeoJSON(geometry) as geojson_str,
        ST_NPoints(geometry) as point_count
      FROM "Route"
      WHERE id = ${id}
    `;

    if (!geoData[0]?.geojson_str) {
      // 如果没有几何数据，返回基于距离和爬升的模拟剖面
      return this.generateSimulatedProfile(route.distance, route.elevation);
    }

    const geojson = JSON.parse(geoData[0].geojson_str);
    const pointCount = Number(geoData[0].point_count);

    // 生成基于实际轨迹的海拔剖面
    return this.generateProfileFromCoordinates(
      geojson.coordinates,
      route.distance,
      route.elevation,
    );
  }

  // 基于坐标生成海拔剖面（模拟高程变化）
  private generateProfileFromCoordinates(
    coordinates: number[][],
    totalDistance: number,
    totalElevation: number,
  ): { distance: number; elevation: number }[] {
    const profile: { distance: number; elevation: number }[] = [];
    const segmentCount = coordinates.length;

    // 基础海拔（假设起点海拔 500m）
    const baseElevation = 500;

    // 计算每段距离
    let cumulativeDistance = 0;
    const segmentDistance = totalDistance / (segmentCount - 1);

    for (let i = 0; i < segmentCount; i++) {
      // 使用正弦函数模拟真实的爬升/下降曲线
      const progress = i / (segmentCount - 1);
      const elevationFactor = Math.sin(progress * Math.PI * 0.8); // 前80%主要爬升

      // 添加一些随机波动
      const noise = (Math.sin(i * 2.5) * 0.1 + Math.sin(i * 5) * 0.05) * totalElevation;

      const currentElevation =
        baseElevation + totalElevation * elevationFactor + noise;

      profile.push({
        distance: Math.round(cumulativeDistance * 1000), // 转换为米
        elevation: Math.round(Math.max(baseElevation, currentElevation)),
      });

      cumulativeDistance += segmentDistance;
    }

    return profile;
  }

  // 生成模拟的海拔剖面数据
  private generateSimulatedProfile(
    distanceKm: number,
    elevationGain: number,
  ): { distance: number; elevation: number }[] {
    const profile: { distance: number; elevation: number }[] = [];
    const pointCount = Math.max(10, Math.min(100, Math.round(distanceKm * 5)));
    const segmentDistance = (distanceKm * 1000) / (pointCount - 1);

    // 基础海拔
    const baseElevation = 500;

    for (let i = 0; i < pointCount; i++) {
      const progress = i / (pointCount - 1);
      // 模拟山形曲线
      const elevationFactor = Math.sin(progress * Math.PI * 0.85);
      const noise = Math.sin(i * 3) * elevationGain * 0.08;

      profile.push({
        distance: Math.round(i * segmentDistance),
        elevation: Math.round(
          baseElevation + elevationGain * elevationFactor + noise,
        ),
      });
    }

    return profile;
  }

  // 按区域筛选线路
  async getRoutesByRegion(region: string): Promise<RouteWithGeoJson[]> {
    const routes = await this.prisma.$queryRaw<any[]>`
      SELECT
        id, name, difficulty, distance, elevation, "gpxUrl",
        description, "coverUrl", region, "estimatedTime", "createdAt",
        ST_AsGeoJSON(geometry) as geojson_str,
        ST_Y("startPoint"::geometry) as start_lat,
        ST_X("startPoint"::geometry) as start_lon,
        ST_Y("endPoint"::geometry) as end_lat,
        ST_X("endPoint"::geometry) as end_lon
      FROM "Route"
      WHERE region LIKE ${'%' + region + '%'}
      ORDER BY "createdAt" DESC
    `;

    return routes.map((route) => ({
      id: route.id,
      name: route.name,
      difficulty: route.difficulty,
      distance: route.distance,
      elevation: route.elevation,
      gpxUrl: route.gpxUrl,
      description: route.description,
      coverUrl: route.coverUrl,
      region: route.region,
      estimatedTime: route.estimatedTime,
      createdAt: route.createdAt,
      geojson: route.geojson_str ? JSON.parse(route.geojson_str) : null,
      startPoint:
        route.start_lat && route.start_lon
          ? { lat: route.start_lat, lon: route.start_lon }
          : null,
      endPoint:
        route.end_lat && route.end_lon
          ? { lat: route.end_lat, lon: route.end_lon }
          : null,
    }));
  }
}
