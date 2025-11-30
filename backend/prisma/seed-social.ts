import { PrismaClient, ActivityStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Phase 3 Social Data...');

  // 1. Create a User who will be the social star
  const user = await prisma.user.upsert({
    where: { openId: 'social_star_001' },
    update: {},
    create: {
      nickname: 'Social Star',
      openId: 'social_star_001',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Star',
    },
  });

  // 2. Create a Post
  const post = await prisma.post.create({
    data: {
      userId: user.id,
      content: 'My first hike! Amazing view!',
      tags: ['hiking', 'nature'],
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1' },
          { url: 'https://images.unsplash.com/photo-2' },
        ],
      },
    },
  });
  console.log(`Created Post: ${post.id}`);

  // 3. Create Comments
  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      userId: user.id,
      content: 'Great photos!',
    },
  });
  console.log(`Created Comment: ${comment.id}`);

  // 4. Create Reply
  await prisma.comment.create({
    data: {
      postId: post.id,
      userId: user.id,
      content: 'Thanks!',
      parentId: comment.id,
    },
  });

  // 5. Create Like
  await prisma.postLike.create({
    data: {
      postId: post.id,
      userId: user.id,
    },
  });

  console.log('✅ Phase 3 Seed Completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
