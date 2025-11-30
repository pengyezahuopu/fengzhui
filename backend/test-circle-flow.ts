import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Testing Phase 3.2 Circle Flow...');

  // Clean up
  try {
    await prisma.circleMember.deleteMany({});
    await prisma.circle.deleteMany({});
    await prisma.user.deleteMany({ where: { openId: { in: ['test_circle_creator', 'test_circle_joiner'] } } });
  } catch (e) {
    console.log('Cleanup warning:', e);
  }

  // 1. Create Users
  const creator = await prisma.user.create({
    data: { nickname: 'Creator', openId: 'test_circle_creator' },
  });
  const joiner = await prisma.user.create({
    data: { nickname: 'Joiner', openId: 'test_circle_joiner' },
  });

  // 2. Create Circle
  const circle = await prisma.circle.create({
    data: {
      name: 'Test Circle',
      creatorId: creator.id,
      members: {
        create: { userId: creator.id, role: 'OWNER' },
      },
    },
  });
  console.log(`✅ Circle Created: ${circle.id}`);

  // 3. Join Circle
  await prisma.circleMember.create({
    data: { circleId: circle.id, userId: joiner.id, role: 'MEMBER' },
  });
  console.log('✅ User Joined Circle');

  // 4. Verify Members
  const members = await prisma.circleMember.findMany({
    where: { circleId: circle.id },
  });

  if (members.length === 2) {
    console.log('✅ Member Count Verified: 2');
  } else {
    console.error('❌ Member Count Mismatch:', members.length);
    process.exit(1);
  }

  // 5. Leave Circle
  await prisma.circleMember.deleteMany({
    where: { circleId: circle.id, userId: joiner.id },
  });
  console.log('✅ User Left Circle');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
