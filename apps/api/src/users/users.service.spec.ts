import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const user = {
    id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.edu',
    passwordHash: 'stored-hash',
    role: Role.STUDENT,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  // Estructura idéntica a tu plantilla: instanciación manual pura
  function createService() {
    const prisma = {
      user: {
        findUnique: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        findUniqueOrThrow: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
        count: jest.fn<(...args: unknown[]) => Promise<number>>(),
        update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      },
    };
    const auditLog = { create: jest.fn<(...args: unknown[]) => Promise<unknown>>() };
    const transaction = { ...prisma, auditLog };
    const database = { ...prisma, $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)) };
    const service = new UsersService(
      database as unknown as PrismaService,
    );
    return { service, prisma, auditLog, database };
  }

  it('debería estar definido el servicio', () => {
    const { service } = createService();
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea un usuario de forma exitosa (Camino Feliz)', async () => {
      const { service, prisma } = createService();
      
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const result = await service.create({
        name: user.name,
        email: user.email,
        password: 'strong-password',
      });

      expect(result).toMatchObject({ id: user.id, email: user.email });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('rechaza la creación si el email ya se encuentra registrado (Branch Coverage)', async () => {
      const { service, prisma } = createService();
      
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.create({
          name: user.name,
          email: user.email,
          password: 'strong-password',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne / findById', () => {
    it('retorna el usuario si existe en la base de datos (Camino Feliz)', async () => {
      const { service, prisma } = createService();
      
      prisma.user.findUnique.mockResolvedValue(user);

      expect(await service.findOne('user-1')).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-1' } }));
    });

    it('lanza una excepción NotFoundException si el usuario no existe (Branch Coverage)', async () => {
      const { service, prisma } = createService();
      
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
  it('lists users ordered by name', async () => {
    const { service, prisma } = createService();
    prisma.user.findMany.mockResolvedValue([user]);
    expect(await service.list()).toEqual([user]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: 'asc' } }));
  });

  it('creates a user when the optional password is absent', async () => {
    const { service, prisma } = createService();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(user);
    await service.create({ name: user.name, email: user.email });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: user.name, email: user.email, passwordHash: 'default-hash' },
    }));
  });

  describe('role changes', () => {
    const actor = { sub: 'admin-1', email: 'admin@udea.edu.co', role: Role.ADMIN };
    it('rejects missing users before starting a transaction', async () => {
      const { service, prisma, database } = createService();
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateRole(actor, 'missing', Role.STAFF)).rejects.toBeInstanceOf(NotFoundException);
      expect(database.$transaction).not.toHaveBeenCalled();
    });
    it('returns an unchanged role without updating or auditing', async () => {
      const { service, prisma, auditLog } = createService();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);
      expect(await service.updateRole(actor, user.id, Role.STUDENT)).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(auditLog.create).not.toHaveBeenCalled();
    });
    it.each([0, 1])('protects the last administrator when count is %s', async (count) => {
      const { service, prisma, database } = createService();
      prisma.user.findUnique.mockResolvedValue({ ...user, role: Role.ADMIN });
      prisma.user.count.mockResolvedValue(count);
      await expect(service.updateRole(actor, user.id, Role.STUDENT)).rejects.toBeInstanceOf(ConflictException);
      expect(database.$transaction).not.toHaveBeenCalled();
    });
    it.each([
      [Role.STUDENT, Role.STAFF], [Role.STUDENT, Role.ADMIN], [Role.ADMIN, Role.STUDENT],
    ])('changes %s to %s and records the actor and transition', async (from, to) => {
      const { service, prisma, auditLog } = createService();
      prisma.user.findUnique.mockResolvedValue({ ...user, role: from });
      prisma.user.count.mockResolvedValue(2);
      prisma.user.update.mockResolvedValue({ ...user, role: to });
      expect(await service.updateRole(actor, user.id, to)).toMatchObject({ role: to });
      expect(auditLog.create).toHaveBeenCalledWith({ data: {
        actorId: actor.sub, entityType: 'User', entityId: user.id, fromValue: from, toValue: to,
      } });
    });
    it('propagates audit errors to the transaction', async () => {
      const { service, prisma, auditLog } = createService();
      prisma.user.findUnique.mockResolvedValue(user);
      auditLog.create.mockRejectedValue(new Error('audit unavailable'));
      await expect(service.updateRole(actor, user.id, Role.STAFF)).rejects.toThrow('audit unavailable');
    });
  });

});
