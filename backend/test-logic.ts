import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting integration test...');

  // Clean up previous test data
  console.log('Cleaning up previous data...');
  try {
    await prisma.clubMember.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.activity.deleteMany({});
    await prisma.leaderProfile.deleteMany({});
    await prisma.club.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        openId: { in: ['wx_test_001', 'wx_test_002'] }
      }
    });
  } catch (error) {
    console.warn('Cleanup warning (might be empty):', error);
  }

  // 1. 创建一个用户 (作为俱乐部拥有者)
  const clubOwner = await prisma.user.create({
    data: {
      nickname: 'Club Owner Bob',
      phone: '13800000001',
      openId: 'wx_test_001',
    },
  });
  console.log('Created Club Owner:', clubOwner.id);

  // 2. 创建一个俱乐部
  const club = await prisma.club.create({
    data: {
      name: 'Fengzhui Outdoor Club',
      description: 'The best outdoor club.',
      ownerId: clubOwner.id,
      isVerified: true,
    },
  });
  console.log('Created Club:', club.name);

  // 3. 创建另一个用户 (准备申请成为领队)
  const potentialLeader = await prisma.user.create({
    data: {
      nickname: 'Hiker Alice',
      phone: '13900000002',
      openId: 'wx_test_002',
    },
  });
  console.log('Created User:', potentialLeader.nickname);

  // 4. 认证该用户为领队
  const leaderProfile = await prisma.leaderProfile.create({
    data: {
      userId: potentialLeader.id,
      realName: 'Alice Smith',
      idCard: '11010119900101XXXX',
      bio: 'Professional hiker.',
    },
  });
  
  // 别忘了更新用户角色
  await prisma.user.update({
    where: { id: potentialLeader.id },
    data: { role: 'LEADER' },
  });
  console.log('User upgraded to Leader:', leaderProfile.realName);

  // 5. 领队挂靠俱乐部
  const membership = await prisma.clubMember.create({
    data: {
      clubId: club.id,
      leaderId: leaderProfile.id,
      role: 'LEADER',
    },
  });
  console.log(`Leader ${leaderProfile.realName} joined club ${club.name}`);

  // 6. 验证查询：查出俱乐部下的所有领队
  const clubWithMembers = await prisma.club.findUnique({
    where: { id: club.id },
    include: {
      members: {
        include: {
          leader: true,
        },
      },
    },
  });

  console.log('Club Members Check:');
  clubWithMembers?.members.forEach((m) => {
    if (m.leader) {
      console.log(`- Leader: ${m.leader.realName} (Role: ${m.role})`);
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
