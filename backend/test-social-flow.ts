import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Testing Phase 3 Social Flow...');

  // Clean up
  try {
    await prisma.postLike.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.user.deleteMany({ where: { openId: { in: ['test_user_a', 'test_user_b'] } } });
  } catch (e) {
    console.log('Cleanup warning:', e);
  }

  // 1. Create Users
  const userA = await prisma.user.create({
    data: { nickname: 'User A', openId: 'test_user_a', avatarUrl: 'http://a.com' },
  });
  const userB = await prisma.user.create({
    data: { nickname: 'User B', openId: 'test_user_b', avatarUrl: 'http://b.com' },
  });

  // 2. User A Creates Post
  const post = await prisma.post.create({
    data: {
      userId: userA.id,
      content: 'My first post!',
      images: {
        create: [{ url: 'http://img.com' }],
      },
    },
  });
  console.log(`✅ Post Created: ${post.id}`);

  // 3. User B Likes Post
  await prisma.postLike.create({
    data: { postId: post.id, userId: userB.id },
  });
  console.log('✅ Post Liked');

  // 4. User B Comments
  const comment = await prisma.comment.create({
    data: { postId: post.id, userId: userB.id, content: 'Nice pic!' },
  });
  console.log('✅ Comment Created');

  // 5. User A Replies
  await prisma.comment.create({
    data: { postId: post.id, userId: userA.id, content: 'Thanks!', parentId: comment.id },
  });
  console.log('✅ Reply Created');

  // 6. Verify Counts (Simulate API logic)
  const postCheck = await prisma.post.findUnique({
    where: { id: post.id },
    include: { _count: { select: { likes: true, comments: true } } },
  });

  if (postCheck?._count.likes === 1 && postCheck._count.comments === 2) {
    console.log('✅ Counts Verified: 1 Like, 2 Comments');
  } else {
    console.error('❌ Counts Mismatch:', postCheck?._count);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
