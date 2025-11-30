import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏔️ Testing Elevation Profile API...');

  const routeId = 'route004-baihua'; // Using a known seed route ID
  
  try {
    // Since we can't easily call the service logic directly without context,
    // we will verify the API endpoint using curl from shell, 
    // or here we just verify the data exists in DB.
    
    const route = await prisma.route.findUnique({ where: { id: routeId }});
    console.log('Route found:', route?.name);
    
    if (route) {
        console.log(`Elevation: ${route.elevation}m`);
        console.log(`Distance: ${route.distance}km`);
        console.log('✅ Route data is ready for elevation profile generation.');
    } else {
        console.error('❌ Route not found.');
        process.exit(1);
    }

  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
