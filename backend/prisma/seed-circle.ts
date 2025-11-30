import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Phase 3.2 Circle & Album Data...');

  // 1. Get or Create User
  const user = await prisma.user.upsert({
    where: { openId: 'circle_master_001' },
    update: {},
    create: {
      nickname: 'Circle Master',
      openId: 'circle_master_001',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Circle',
    },
  });

  // 2. Create Circle
  const circle = await prisma.circle.create({
    data: {
      name: 'Beijing Hikers',
      description: 'A group for hiking lovers in Beijing.',
      category: 'INTEREST',
      creatorId: user.id,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  });
  console.log(`Created Circle: ${circle.name}`);

  // 3. Create Activity & Album Photos
  // First, need a route and club (reusing existing or creating simplified)
  const club = await prisma.club.create({
    data: {
      name: 'Test Club for Album',
      ownerId: user.id,
    },
  });

  const route = await prisma.route.create({
    data: {
      name: 'Album Route',
      distance: 5,
      elevation: 100,
    },
  });

  const leaderProfile = await prisma.leaderProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
        userId: user.id,
        realName: 'Leader One',
        idCard: '123456'
    }
  });

  const activity = await prisma.activity.create({
    data: {
      title: 'Photo Activity',
      startTime: new Date(),
      endTime: new Date(),
      clubId: club.id,
      routeId: route.id,
      leaderId: leaderProfile.id,
      price: 0,
      maxPeople: 10,
      status: 'COMPLETED', // Must be completed to upload photos
    },
  });

  await prisma.activityPhoto.createMany({
    data: [
      {
        activityId: activity.id,
        userId: user.id,
        url: 'https://images.unsplash.com/photo-1',
        isFeatured: true,
      },
      {
        activityId: activity.id,
        userId: user.id,
        url: 'https://images.unsplash.com/photo-2',
      },
    ],
  });
  console.log(`Created Activity Album with 2 photos`);

  console.log('✅ Phase 3.2 Seed Completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
