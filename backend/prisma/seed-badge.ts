import { PrismaClient, BadgeCategory, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding badges and notifications...');

  // Clean up existing data
  await prisma.notification.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();

  // 1. Create Badges
  const badges = [
    {
      name: 'First Hike',
      icon: '🥾',
      description: 'Completed your first hiking activity',
      category: BadgeCategory.MILESTONE,
      criteria: { type: 'activity_count', value: 1 },
      sortOrder: 1,
    },
    {
      name: 'Trail Walker',
      icon: '🚶',
      description: 'Completed 10 hiking activities',
      category: BadgeCategory.CUMULATIVE,
      criteria: { type: 'activity_count', value: 10 },
      sortOrder: 2,
    },
    {
      name: 'Social Star',
      icon: '💬',
      description: 'Received 100 likes on your posts',
      category: BadgeCategory.SOCIAL,
      criteria: { type: 'like_count', value: 100 },
      sortOrder: 3,
    },
  ];

  for (const badge of badges) {
    await prisma.badge.create({
      data: badge,
    });
  }
  console.log(`Created ${badges.length} badges`);

  // 2. Find a user to award badges to (using the first available user)
  const user = await prisma.user.findFirst();
  
  if (user) {
    // Award 'First Hike' badge
    const firstHikeBadge = await prisma.badge.findUnique({
      where: { name: 'First Hike' },
    });

    if (firstHikeBadge) {
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeId: firstHikeBadge.id,
        },
      });
      console.log(`Awarded 'First Hike' badge to user ${user.nickname || user.id}`);

      // Create a notification for the badge
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.BADGE,
          title: 'New Badge Unlocked!',
          content: `Congratulations! You have unlocked the "${firstHikeBadge.name}" badge.`,
          targetId: firstHikeBadge.id,
          targetType: 'badge',
        },
      });
      console.log('Created badge notification');
    }

    // Create some other notifications
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: NotificationType.SYSTEM,
        title: 'Welcome to FengZhui',
        content: 'Thanks for joining our community of outdoor enthusiasts!',
        isRead: true,
      },
    });
    
    console.log('Created system notification');
  } else {
    console.log('No user found to award badges to. Skipping user-related seeding.');
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
