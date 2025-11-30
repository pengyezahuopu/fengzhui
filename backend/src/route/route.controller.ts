import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  RouteService,
  CreateRouteFromGpxDto,
  GeoQueryOptions,
} from './route.service';

@Controller('routes')
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  // ==================== 基础 CRUD ====================

  @Post()
  createRoute(
    @Body()
    data: {
      name: string;
      difficulty?: number;
      distance: number;
      elevation: number;
      gpxUrl?: string;
      description?: string;
      coverUrl?: string;
      region?: string;
      estimatedTime?: number;
    },
  ) {
    return this.routeService.createRoute(data);
  }

  @Get()
  getAllRoutes(
    @Query('difficulty') difficulty?: string,
    @Query('region') region?: string,
    @Query('withGeo') withGeo?: string,
    @Query('simplify') simplify?: string,
    @Query('tolerance') tolerance?: string,
    @Query('maxPoints') maxPoints?: string,
  ) {
    // 构建 GeoJSON 查询选项
    const geoOptions: GeoQueryOptions = {
      simplify: simplify === 'true',
      tolerance: tolerance ? parseFloat(tolerance) : undefined,
      maxPoints: maxPoints ? parseInt(maxPoints) : undefined,
    };

    // 按区域筛选
    if (region) {
      return this.routeService.getRoutesByRegion(region);
    }
    // 按难度筛选
    if (difficulty) {
      return this.routeService.getRoutesByDifficulty(parseInt(difficulty));
    }
    // 包含 GeoJSON
    if (withGeo === 'true') {
      return this.routeService.getAllRoutesWithGeoJson(geoOptions);
    }
    return this.routeService.getAllRoutes();
  }

  @Get(':id')
  getRouteById(
    @Param('id') id: string,
    @Query('withGeo') withGeo?: string,
    @Query('simplify') simplify?: string,
    @Query('tolerance') tolerance?: string,
    @Query('maxPoints') maxPoints?: string,
  ) {
    // 构建 GeoJSON 查询选项
    const geoOptions: GeoQueryOptions = {
      simplify: simplify === 'true',
      tolerance: tolerance ? parseFloat(tolerance) : undefined,
      maxPoints: maxPoints ? parseInt(maxPoints) : undefined,
    };

    if (withGeo === 'true') {
      return this.routeService.getRouteByIdWithGeoJson(id, geoOptions);
    }
    return this.routeService.getRouteById(id);
  }

  @Put(':id')
  updateRoute(
    @Param('id') id: string,
    @Body()
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
    return this.routeService.updateRoute(id, data);
  }

  @Delete(':id')
  deleteRoute(@Param('id') id: string) {
    return this.routeService.deleteRoute(id);
  }

  // ==================== GIS 增强接口 ====================

  /**
   * 通过 GPX 内容创建线路
   * POST /routes/gpx
   */
  @Post('gpx')
  createRouteFromGpx(@Body() dto: CreateRouteFromGpxDto) {
    if (!dto.gpxContent) {
      throw new BadRequestException('gpxContent 是必需的');
    }
    return this.routeService.createRouteFromGpx(dto);
  }

  /**
   * 上传 GPX 文件创建线路
   * POST /routes/upload-gpx
   */
  @Post('upload-gpx')
  @UseInterceptors(FileInterceptor('file'))
  async uploadGpxFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
    @Body('description') description?: string,
    @Body('coverUrl') coverUrl?: string,
    @Body('region') region?: string,
    @Body('difficulty') difficulty?: string,
  ) {
    if (!file) {
      throw new BadRequestException('请上传 GPX 文件');
    }

    // 检查文件类型
    const allowedMimeTypes = [
      'application/gpx+xml',
      'application/xml',
      'text/xml',
    ];
    if (
      !allowedMimeTypes.includes(file.mimetype) &&
      !file.originalname.endsWith('.gpx')
    ) {
      throw new BadRequestException('只支持 GPX 格式文件');
    }

    const gpxContent = file.buffer.toString('utf-8');

    return this.routeService.createRouteFromGpx({
      gpxContent,
      name,
      description,
      coverUrl,
      region,
      difficulty: difficulty ? parseInt(difficulty) : undefined,
    });
  }

  /**
   * 更新线路的 GPX 轨迹数据
   * PUT /routes/:id/gpx
   */
  @Put(':id/gpx')
  updateRouteGeometry(
    @Param('id') id: string,
    @Body('gpxContent') gpxContent: string,
  ) {
    if (!gpxContent) {
      throw new BadRequestException('gpxContent 是必需的');
    }
    return this.routeService.updateRouteGeometry(id, gpxContent);
  }

  /**
   * 搜索附近的线路
   * GET /routes/nearby/search?lat=39.9&lon=116.4&radius=50
   */
  @Get('nearby/search')
  findNearbyRoutes(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('radius') radius?: string,
  ) {
    if (!lat || !lon) {
      throw new BadRequestException('lat 和 lon 参数是必需的');
    }
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const radiusKm = radius ? parseFloat(radius) : 50;

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException('lat 和 lon 必须是有效的数字');
    }

    return this.routeService.findNearbyRoutes(latitude, longitude, radiusKm);
  }

  /**
   * 获取线路海拔剖面数据
   * GET /routes/:id/elevation
   */
  @Get(':id/elevation')
  getRouteElevationProfile(@Param('id') id: string) {
    return this.routeService.getRouteElevationProfile(id);
  }
}
