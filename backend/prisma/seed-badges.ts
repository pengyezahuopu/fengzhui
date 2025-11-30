import { PrismaClient, BadgeCategory } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 勋章定义数据
 * 触发条件格式:
 * - type: 触发类型 (activity_count, distance, elevation, post_count, route_count, follower_count, special)
 * - threshold: 触发阈值
 * - condition: 额外条件 (可选)
 */
const badges = [
  // ==================== 里程碑勋章 ====================
  {
    name: '初次启程',
    icon: '🥾',
    description: '完成第一次户外活动',
    category: BadgeCategory.MILESTONE,
    criteria: {
      type: 'activity_count',
      threshold: 1,
    },
    sortOrder: 1,
  },
  {
    name: '徒步达人',
    icon: '🏃',
    description: '累计参与 10 次户外活动',
    category: BadgeCategory.MILESTONE,
    criteria: {
      type: 'activity_count',
      threshold: 10,
    },
    sortOrder: 2,
  },
  {
    name: '户外老炮',
    icon: '🏔️',
    description: '累计参与 50 次户外活动',
    category: BadgeCategory.MILESTONE,
    criteria: {
      type: 'activity_count',
      threshold: 50,
    },
    sortOrder: 3,
  },

  // ==================== 累计型勋章 ====================
  {
    name: '百里征程',
    icon: '📏',
    description: '累计徒步里程达到 100 公里',
    category: BadgeCategory.CUMULATIVE,
    criteria: {
      type: 'distance',
      threshold: 100,
    },
    sortOrder: 10,
  },
  {
    name: '千里之行',
    icon: '🗺️',
    description: '累计徒步里程达到 1000 公里',
    category: BadgeCategory.CUMULATIVE,
    criteria: {
      type: 'distance',
      threshold: 1000,
    },
    sortOrder: 11,
  },
  {
    name: '攀登者',
    icon: '⛰️',
    description: '累计爬升达到 5000 米',
    category: BadgeCategory.CUMULATIVE,
    criteria: {
      type: 'elevation',
      threshold: 5000,
    },
    sortOrder: 12,
  },
  {
    name: '云端漫步',
    icon: '☁️',
    description: '累计爬升达到 20000 米',
    category: BadgeCategory.CUMULATIVE,
    criteria: {
      type: 'elevation',
      threshold: 20000,
    },
    sortOrder: 13,
  },

  // ==================== 社交型勋章 ====================
  {
    name: '社区之星',
    icon: '✨',
    description: '发布第一篇帖子',
    category: BadgeCategory.SOCIAL,
    criteria: {
      type: 'post_count',
      threshold: 1,
    },
    sortOrder: 20,
  },
  {
    name: '意见领袖',
    icon: '📣',
    description: '拥有 100 名粉丝',
    category: BadgeCategory.SOCIAL,
    criteria: {
      type: 'follower_count',
      threshold: 100,
    },
    sortOrder: 21,
  },
  {
    name: '热门作者',
    icon: '🔥',
    description: '发布 50 篇帖子',
    category: BadgeCategory.SOCIAL,
    criteria: {
      type: 'post_count',
      threshold: 50,
    },
    sortOrder: 22,
  },

  // ==================== 贡献型勋章 ====================
  {
    name: '探路者',
    icon: '🧭',
    description: '贡献第一条线路',
    category: BadgeCategory.CONTRIBUTION,
    criteria: {
      type: 'route_count',
      threshold: 1,
    },
    sortOrder: 30,
  },
  {
    name: '线路大师',
    icon: '📍',
    description: '贡献 10 条线路',
    category: BadgeCategory.CONTRIBUTION,
    criteria: {
      type: 'route_count',
      threshold: 10,
    },
    sortOrder: 31,
  },

  // ==================== 挑战型勋章 ====================
  {
    name: '周末战士',
    icon: '💪',
    description: '单周参与 3 次活动',
    category: BadgeCategory.CHALLENGE,
    criteria: {
      type: 'weekly_activity',
      threshold: 3,
    },
    sortOrder: 40,
  },
  {
    name: '连续打卡',
    icon: '📅',
    description: '连续 4 周参与活动',
    category: BadgeCategory.CHALLENGE,
    criteria: {
      type: 'consecutive_weeks',
      threshold: 4,
    },
    sortOrder: 41,
  },

  // ==================== 领队专属勋章 ====================
  {
    name: '新手领队',
    icon: '🎓',
    description: '成为认证领队',
    category: BadgeCategory.LEADER,
    criteria: {
      type: 'leader_certified',
      threshold: 1,
    },
    sortOrder: 50,
  },
  {
    name: '金牌领队',
    icon: '🏅',
    description: '带队完成 20 次活动',
    category: BadgeCategory.LEADER,
    criteria: {
      type: 'led_activity_count',
      threshold: 20,
    },
    sortOrder: 51,
  },

  // ==================== 特殊型勋章 ====================
  {
    name: '早起鸟',
    icon: '🐦',
    description: '参与 5 点前出发的活动',
    category: BadgeCategory.SPECIAL,
    criteria: {
      type: 'early_activity',
      threshold: 1,
      condition: { startHour: 5 },
    },
    sortOrder: 60,
  },
  {
    name: '夜行侠',
    icon: '🌙',
    description: '参与夜徒活动',
    category: BadgeCategory.SPECIAL,
    criteria: {
      type: 'night_activity',
      threshold: 1,
    },
    sortOrder: 61,
  },
];

async function main() {
  console.log('🏅 开始初始化勋章数据...');

  for (const badge of badges) {
    const existing = await prisma.badge.findUnique({
      where: { name: badge.name },
    });

    if (existing) {
      // 更新已存在的勋章
      await prisma.badge.update({
        where: { name: badge.name },
        data: badge,
      });
      console.log(`  ✅ 更新勋章: ${badge.icon} ${badge.name}`);
    } else {
      // 创建新勋章
      await prisma.badge.create({
        data: badge,
      });
      console.log(`  ✅ 创建勋章: ${badge.icon} ${badge.name}`);
    }
  }

  const count = await prisma.badge.count();
  console.log(`\n🎉 勋章初始化完成，共 ${count} 个勋章`);
}

main()
  .catch((e) => {
    console.error('❌ 勋章初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
