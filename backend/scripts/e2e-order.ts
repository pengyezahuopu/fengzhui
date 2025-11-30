/*
 End-to-end flow: login → pick activity → enrollment → order → prepay → mock success → status
 Usage: ts-node scripts/e2e-order.ts [baseUrl]
 Default baseUrl: http://localhost:3000
*/

const base = process.argv[2] || 'http://localhost:3000';

async function json(method: string, url: string, body?: any, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function main() {
  console.log(`Base: ${base}`);

  // 1) login
  const login = await json('POST', `${base}/users/login`, {
    openId: 'wx_user_001',
    nickname: 'E2E',
  });
  const token = login.token as string;
  const userId = login.user.id as string;
  console.log('login ok:', { userId });

  // 2) pick a PUBLISHED activity
  const acts = await json('GET', `${base}/activities`);
  const published = acts.data?.find((a: any) => a.status === 'PUBLISHED');
  if (!published) throw new Error('no PUBLISHED activity found');
  const activityId = published.id as string;
  console.log('activity:', { activityId, title: published.title });

  // 3) enrollment
  const enr = await json('POST', `${base}/enrollments`, {
    activityId,
    userId,
    contactName: '张三',
    contactPhone: '13911112222',
  });
  const enrollmentId = enr.id as string;
  console.log('enrollment ok:', { enrollmentId });

  // 4) order (with Authorization)
  const order = await json(
    'POST',
    `${base}/orders`,
    {
      enrollmentId,
      insuredName: '张三',
      insuredPhone: '13911112222',
    },
    { Authorization: `Bearer ${token}` },
  );
  const orderId = order.id as string;
  console.log('order ok:', { orderId, status: order.status });

  // 5) prepay
  const prepay = await json(
    'POST',
    `${base}/payments/prepay`,
    { orderId, openId: 'wx_user_001' },
    { Authorization: `Bearer ${token}` },
  );
  console.log('prepay ok:', prepay);

  // 6) mock success (dev only)
  const mock = await json(
    'POST',
    `${base}/payments/${orderId}/mock-success`,
    undefined,
    { Authorization: `Bearer ${token}` },
  );
  console.log('mock success:', mock);

  // 7) status
  const status = await json(
    'GET',
    `${base}/payments/${orderId}/status`,
    undefined,
    { Authorization: `Bearer ${token}` },
  );
  console.log('payment status:', status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

