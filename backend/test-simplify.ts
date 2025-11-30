import { PrismaClient, ActivityStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing ST_Simplify...');

  // 1. Create a complex route (many points)
  // Simulate a zigzag route with 100 points
  let gpxPoints = '';
  for (let i = 0; i < 100; i++) {
    const lat = 39.9 + i * 0.0001 + Math.random() * 0.00005;
    const lon = 116.4 + i * 0.0001 + Math.random() * 0.00005;
    gpxPoints += `<trkpt lat="${lat}" lon="${lon}"><ele>${100 + i}</ele></trkpt>`;
  }

  const gpxContent = `
    <?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Test">
      <metadata><name>Complex Route</name></metadata>
      <trk><name>Complex Track</name><trkseg>${gpxPoints}</trkseg></trk>
    </gpx>
  `;

  // Insert via Raw SQL to bypass service for direct control
  // But we can use our GpxParserService if we instantiate it, or just mocking the logic.
  // Let's use a simplified insertion logic similar to RouteService.createRouteFromGpx
  
  // Actually, let's just insert one route and query it using raw SQL to test ST_Simplify
  // We need to make sure we have at least one route in DB with geometry.
  
  // Clean up first
  // await prisma.route.deleteMany({ where: { name: 'Simplify Test Route' } });

  // Insert a test route with raw geometry
  const routeId = 'test-simplify-uuid';
  
  // Create a LineString with 10 points
  const lineString = 'LINESTRING(0 0, 1 1, 2 0, 3 1, 4 0, 5 1, 6 0, 7 1, 8 0, 9 1)';
  
  try {
    await prisma.$executeRaw`
      INSERT INTO "Route" (id, name, distance, elevation, geometry, "createdAt")
      VALUES (${routeId}, 'Simplify Test Route', 10, 100, ST_GeomFromText(${lineString}, 4326), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    // 2. Query with ST_Simplify (Simulate Service Logic)
    // Tolerance 1.0 should simplify this zigzag line significantly
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        ST_NPoints(geometry) as original_points,
        ST_NPoints(ST_Simplify(geometry, 1.0)) as simplified_points
      FROM "Route"
      WHERE id = ${routeId}
    `;

    console.log('Original Points:', result[0].original_points);
    console.log('Simplified Points (Tol=1.0):', result[0].simplified_points);

    if (result[0].original_points > result[0].simplified_points) {
      console.log('✅ ST_Simplify works!');
    } else {
      console.error('❌ ST_Simplify did not reduce points.');
      process.exit(1);
    }

  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  } finally {
    // Cleanup
    await prisma.route.deleteMany({ where: { id: routeId } });
    await prisma.$disconnect();
  }
}

main();
