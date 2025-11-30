-- Manual GIS Migration Script
-- 运行此脚本确保 PostGIS 字段和索引正确创建
-- 使用方式: psql -d fengzhui -f manual_gis_indexes.sql

-- 1. 确保 PostGIS 扩展已启用
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. 添加缺失的 Route 表字段（如果不存在）
DO $$
BEGIN
    -- 添加 description 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'description') THEN
        ALTER TABLE "Route" ADD COLUMN "description" TEXT;
    END IF;

    -- 添加 coverUrl 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'coverUrl') THEN
        ALTER TABLE "Route" ADD COLUMN "coverUrl" TEXT;
    END IF;

    -- 添加 region 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'region') THEN
        ALTER TABLE "Route" ADD COLUMN "region" TEXT;
    END IF;

    -- 添加 estimatedTime 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'estimatedTime') THEN
        ALTER TABLE "Route" ADD COLUMN "estimatedTime" INTEGER;
    END IF;

    -- 添加 creatorId 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'creatorId') THEN
        ALTER TABLE "Route" ADD COLUMN "creatorId" TEXT;
        ALTER TABLE "Route" ADD CONSTRAINT "Route_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    -- 添加 geometry 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'geometry') THEN
        ALTER TABLE "Route" ADD COLUMN "geometry" geometry(LineString, 4326);
    END IF;

    -- 添加 startPoint 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'startPoint') THEN
        ALTER TABLE "Route" ADD COLUMN "startPoint" geometry(Point, 4326);
    END IF;

    -- 添加 endPoint 字段
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Route' AND column_name = 'endPoint') THEN
        ALTER TABLE "Route" ADD COLUMN "endPoint" geometry(Point, 4326);
    END IF;
END $$;

-- 3. 创建 GIST 空间索引（如果不存在）
CREATE INDEX IF NOT EXISTS "idx_route_geometry" ON "Route" USING GIST ("geometry");
CREATE INDEX IF NOT EXISTS "idx_route_startpoint" ON "Route" USING GIST ("startPoint");
CREATE INDEX IF NOT EXISTS "idx_route_endpoint" ON "Route" USING GIST ("endPoint");

-- 4. 验证索引创建
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'Route'
AND indexname LIKE 'idx_route_%';

-- 5. 输出成功信息
DO $$
BEGIN
    RAISE NOTICE 'GIS fields and indexes have been successfully created/verified!';
END $$;
