import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AvailabilityKind, PrismaClient, ReservationStatus } from '@prisma/client';
import * as cookieParser from 'cookie-parser';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';

const PASSWORD = 'RaceTest123';
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

type LoginBody = { accessToken: string };

describe('HU-12 reservation race (PostgreSQL EXCLUDE)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  const stamp = Date.now();
  const emails = [
    `race.a.${stamp}@udea.edu.co`,
    `race.b.${stamp}@udea.edu.co`,
  ];
  let spaceId = '';
  let userIds: string[] = [];
  let tokens: string[] = [];
  let startsAt = '';
  let endsAt = '';

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    prisma = new PrismaClient();
    await prisma.$connect();

    const space = await prisma.space.create({
      data: {
        name: `Race court ${stamp}`,
        type: 'cancha',
        campus: 'Ciudad Universitaria',
        capacity: 10,
        usageRules: 'Solo para la prueba de carrera',
      },
    });
    spaceId = space.id;
    await prisma.availabilityRule.createMany({
      data: WEEKDAYS.map((dayOfWeek) => ({
        spaceId,
        kind: AvailabilityKind.WEEKLY_HOURS,
        dayOfWeek,
        startTime: '06:00',
        endTime: '22:00',
      })),
    });

    const slot = nextFutureSlot();
    startsAt = slot.startsAt;
    endsAt = slot.endsAt;

    userIds = [];
    for (const [index, email] of emails.entries()) {
      await postJson('/api/auth/register', {
        name: `Race student ${index + 1}`,
        email,
        password: PASSWORD,
      });
    }
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    userIds = users.map((user) => user.id);
    tokens = [];
    for (const email of emails) {
      tokens.push(await login(email));
    }
  });

  afterAll(async () => {
    if (spaceId) {
      await prisma.reservation.deleteMany({ where: { spaceId } });
    }
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    }
    if (spaceId) {
      await prisma.availabilityRule.deleteMany({ where: { spaceId } });
      await prisma.space.delete({ where: { id: spaceId } }).catch(() => undefined);
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app.close();
  });

  it('rejects a second booking after the slot is already PENDING', async () => {
    const [tokenA, tokenB] = tokens;
    const sequentialSlot = shiftHours(startsAt, endsAt, 3);

    const first = await postReservation(tokenA, sequentialSlot.startsAt, sequentialSlot.endsAt);
    expect(first.status).toBe(201);

    const second = await postReservation(tokenB, sequentialSlot.startsAt, sequentialSlot.endsAt);
    expect(second.status).toBe(409);

    const pending = await countActive(sequentialSlot.startsAt, sequentialSlot.endsAt);
    expect(pending).toBe(1);
  });

  it('keeps a single PENDING when two students POST the same slot at once', async () => {
    const [tokenA, tokenB] = tokens;
    const body = {
      spaceId,
      startsAt,
      endsAt,
    };

    const [first, second] = await Promise.all([
      postReservation(tokenA, body.startsAt, body.endsAt),
      postReservation(tokenB, body.startsAt, body.endsAt),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409]);

    const winner = first.status === 201 ? first : second;
    const loser = first.status === 409 ? first : second;
    const created = (await winner.json()) as { status: string };
    expect(created.status).toBe(ReservationStatus.PENDING);

    const conflict = (await loser.json()) as { message?: string; statusCode?: number };
    expect(conflict.statusCode).toBe(409);
    expect(String(conflict.message).toLowerCase()).toMatch(/overlap|conflict/);

    expect(await countActive(startsAt, endsAt)).toBe(1);
  });

  async function login(email: string): Promise<string> {
    const response = await postJson('/api/auth/login', { email, password: PASSWORD });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as LoginBody;
    expect(payload.accessToken).toBeTruthy();
    return payload.accessToken;
  }

  function postReservation(token: string, slotStart: string, slotEnd: string): Promise<Response> {
    return fetch(`${baseUrl}/api/reservations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ spaceId, startsAt: slotStart, endsAt: slotEnd }),
    });
  }

  function postJson(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function countActive(slotStart: string, slotEnd: string): Promise<number> {
    return prisma.reservation.count({
      where: {
        spaceId,
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        startsAt: { lt: new Date(slotEnd) },
        endsAt: { gt: new Date(slotStart) },
      },
    });
  }
});

function nextFutureSlot(): { startsAt: string; endsAt: string } {
  const now = Date.now();
  for (let daysAhead = 1; daysAhead <= 10; daysAhead += 1) {
    const instant = new Date(now + daysAhead * 24 * 60 * 60 * 1000);
    const date = instant.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const startsAt = new Date(`${date}T16:00:00-05:00`);
    const endsAt = new Date(`${date}T18:00:00-05:00`);
    if (startsAt.getTime() > now + 60 * 60 * 1000) {
      return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
    }
  }
  throw new Error('Could not find a future 16:00–18:00 slot');
}

function shiftHours(
  startsAt: string,
  endsAt: string,
  hours: number,
): { startsAt: string; endsAt: string } {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  start.setUTCHours(start.getUTCHours() + hours);
  end.setUTCHours(end.getUTCHours() + hours);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}
