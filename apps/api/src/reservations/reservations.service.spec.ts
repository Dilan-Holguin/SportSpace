import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Prisma, ReservationStatus, Role } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import type { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { ReservationsService } from './reservations.service';

describe('ReservationsService (Cobertura Ampliada)', () => {
  let spacesServiceMock: any;
  let availabilityServiceMock: any;
  let prismaMock: any;
  let txMock: any;

  beforeEach(() => {
    jest.useFakeTimers();
    // Congelamos el reloj en el futuro absoluto (Año 2030) para controlar el Date.now() de la línea 53
    jest.setSystemTime(new Date('2030-01-01T12:00:00.000Z'));

    txMock = {
      reservation: {
        create: jest.fn<() => Promise<any>>(),
        update: jest.fn<() => Promise<any>>(),
      },
      auditLog: {
        create: jest.fn<() => Promise<any>>(),
      },
    };

    prismaMock = {
      reservation: {
        findMany: jest.fn<() => Promise<any[]>>(),
        findUnique: jest.fn<() => Promise<any>>(),
        findFirst: jest.fn<() => Promise<any>>(),
        update: jest.fn<() => Promise<any>>(),
      },
      $transaction: jest.fn((cb: any) => cb(txMock)),
    };

    spacesServiceMock = {
      requireActive: jest.fn<() => Promise<any>>(),
    };

    availabilityServiceMock = {
      assertBookableInterval: jest.fn<() => Promise<void>>(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function createService() {
    const service = new ReservationsService(
      prismaMock as unknown as PrismaService,
      spacesServiceMock as unknown as SpacesService,
      availabilityServiceMock as unknown as AvailabilityService,
    );
    return { service };
  }

  const student: JwtPayload = { sub: 'student-1', email: 'stu@udea.edu', role: Role.STUDENT };
  const staff: JwtPayload = { sub: 'staff-1', email: 'staff@udea.edu', role: Role.STAFF };

  describe('Flujo de Creación (Líneas 50-74)', () => {
    it('crea exitosamente una reserva pendiente y ejecuta la transacción de auditoría (Camino Feliz)', async () => {
      const { service } = createService();
      
      spacesServiceMock.requireActive.mockResolvedValue({ id: 'space-1' });
      availabilityServiceMock.assertBookableInterval.mockResolvedValue(undefined);
      prismaMock.reservation.findFirst.mockResolvedValue(null); // No hay solapes locales

      const mockCreated = { id: 'res-123', spaceId: 'space-1', userId: student.sub, status: ReservationStatus.PENDING };
      txMock.reservation.create.mockResolvedValue(mockCreated);
      txMock.auditLog.create.mockResolvedValue({});

      const dto = { spaceId: 'space-1', startsAt: '2030-01-01T14:00:00.000Z', endsAt: '2030-01-01T15:00:00.000Z' };
      const result = await service.create(student, dto);

      expect(result).toHaveProperty('id', 'res-123');
      expect(txMock.reservation.create).toHaveBeenCalled();
      expect(txMock.auditLog.create).toHaveBeenCalled();
    });

    it('lanza ConflictException si se detecta un solape en la base de datos (Línea 115+)', async () => {
      const { service } = createService();
      
      spacesServiceMock.requireActive.mockResolvedValue({ id: 'space-1' });
      availabilityServiceMock.assertBookableInterval.mockResolvedValue(undefined);
      
      // Simulamos que findFirst encuentra un registro, forzando el solape
      prismaMock.reservation.findFirst.mockResolvedValue({ id: 'res-existente' });

      const dto = { spaceId: 'space-1', startsAt: '2030-01-01T14:00:00.000Z', endsAt: '2030-01-01T15:00:00.000Z' };
      
      await expect(service.create(student, dto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('Flujos de Estados e Internos (Líneas 115-171, 185-199)', () => {
    it('lanza NotFoundException en requireById si la reserva no existe en Prisma', async () => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue(null);

      // Invocamos el método de cancelación para forzar el llamado a requireById interno
      await expect(service.cancel(student, 'id-fantasma')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('cancela exitosamente una reserva si el dueño la solicita antes de comenzar', async () => {
      const { service } = createService();
      
      const mockReservation = {
        id: 'res-1',
        userId: student.sub,
        status: ReservationStatus.PENDING,
        startsAt: new Date('2030-01-01T15:00:00.000Z'), // Futuro con respecto a las 12:00Z
      };
      prismaMock.reservation.findUnique.mockResolvedValue(mockReservation);
      txMock.reservation.update.mockResolvedValue({ ...mockReservation, status: ReservationStatus.CANCELLED });

      const result = await service.cancel(student, 'res-1');
      expect(result.status).toBe(ReservationStatus.CANCELLED);
    });

    it('rechaza una reserva de forma transaccional guardando la razón truncada', async () => {
      const { service } = createService();
      
      const mockReservation = { id: 'res-1', userId: 'student-1', status: ReservationStatus.PENDING };
      prismaMock.reservation.findUnique.mockResolvedValue(mockReservation);
      txMock.reservation.update.mockResolvedValue({ ...mockReservation, status: ReservationStatus.REJECTED });

      const result = await service.reject(staff, 'res-1', '  Motivo Válido  ');
      expect(result.status).toBe(ReservationStatus.REJECTED);
    });
  });

  describe('HU-16 legal and illegal status transitions', () => {
    const futureStart = new Date('2030-01-01T15:00:00.000Z');

    function storedReservation(status: ReservationStatus, userId = student.sub) {
      return {
        id: 'res-1',
        userId,
        status,
        startsAt: futureStart,
        space: { id: 'space-1', name: 'Pista sintetica', type: 'pista', campus: 'Ciudad Universitaria' },
      };
    }

    it('allows PENDING to APPROVED, REJECTED and CANCELLED', async () => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue(storedReservation(ReservationStatus.PENDING));
      txMock.reservation.update
        .mockResolvedValueOnce({ status: ReservationStatus.APPROVED })
        .mockResolvedValueOnce({ status: ReservationStatus.REJECTED })
        .mockResolvedValueOnce({ status: ReservationStatus.CANCELLED });

      await expect(service.approve(staff, 'res-1')).resolves.toMatchObject({ status: ReservationStatus.APPROVED });
      await expect(service.reject(staff, 'res-1', 'Cancha en mantenimiento')).resolves.toMatchObject({
        status: ReservationStatus.REJECTED,
      });
      await expect(service.cancel(student, 'res-1')).resolves.toMatchObject({ status: ReservationStatus.CANCELLED });
    });

    it('allows APPROVED to CANCELLED', async () => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue(storedReservation(ReservationStatus.APPROVED));
      txMock.reservation.update.mockResolvedValue({ status: ReservationStatus.CANCELLED });

      await expect(service.cancel(student, 'res-1')).resolves.toMatchObject({ status: ReservationStatus.CANCELLED });
    });

    it.each([
      [ReservationStatus.APPROVED, 'approve'],
      [ReservationStatus.APPROVED, 'reject'],
      [ReservationStatus.REJECTED, 'approve'],
      [ReservationStatus.REJECTED, 'reject'],
      [ReservationStatus.REJECTED, 'cancel'],
      [ReservationStatus.CANCELLED, 'approve'],
      [ReservationStatus.CANCELLED, 'reject'],
      [ReservationStatus.CANCELLED, 'cancel'],
    ])('returns 409 when moving from %s via %s', async (from: ReservationStatus, action: string) => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue(storedReservation(from));

      const run =
        action === 'approve'
          ? service.approve(staff, 'res-1')
          : action === 'reject'
            ? service.reject(staff, 'res-1', 'Motivo de prueba')
            : service.cancel(student, 'res-1');

      await expect(run).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects cancelling a reservation that already started', async () => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue({
        ...storedReservation(ReservationStatus.PENDING),
        startsAt: new Date('2030-01-01T11:00:00.000Z'),
      });

      await expect(service.cancel(student, 'res-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('HU-04 and HU-14 authorization (403)', () => {
    it('forbids a student from approving or rejecting a reservation', async () => {
      const { service } = createService();

      await expect(service.approve(student, 'res-1')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.reject(student, 'res-1', 'No corresponde')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.reservation.findUnique).not.toHaveBeenCalled();
    });

    it('forbids cancelling another user reservation', async () => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue({
        id: 'res-1',
        userId: 'other-student',
        status: ReservationStatus.PENDING,
        startsAt: new Date('2030-01-01T15:00:00.000Z'),
      });

      await expect(service.cancel(student, 'res-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(txMock.reservation.update).not.toHaveBeenCalled();
    });
  });
  describe('Queries and creation validation', () => {
    const dto = { spaceId: 'space-1', startsAt: '2030-01-01T14:00:00Z', endsAt: '2030-01-01T15:00:00Z' };
    it.each([Role.STUDENT, Role.STAFF, Role.ADMIN])('lists only permitted reservations for %s', async (role) => {
      const { service } = createService();
      prismaMock.reservation.findMany.mockResolvedValue([]);
      expect(await service.list({ ...student, role })).toEqual([]);
      expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: role === Role.STUDENT ? { userId: student.sub } : {}, take: 100,
      }));
    });
    it.each([
      { startsAt: 'invalid' }, { endsAt: 'invalid' },
      { endsAt: dto.startsAt }, { endsAt: '2030-01-01T13:00:00Z' },
      { startsAt: '2030-01-01T12:00:00Z' },
    ])('rejects invalid or past intervals %j before querying spaces', async (invalid) => {
      const { service } = createService();
      await expect(service.create(student, { ...dto, ...invalid })).rejects.toBeInstanceOf(BadRequestException);
      expect(spacesServiceMock.requireActive).not.toHaveBeenCalled();
    });
    it.each([
      new Error('23P01'), new Error('Reservation_no_overlap'),
      { cause: new Error('23P01') },
      new Prisma.PrismaClientKnownRequestError('raw query failed', { code: 'P2010', clientVersion: '6' }),
    ])('translates database overlap failures to a conflict', async (error) => {
      const { service } = createService();
      prismaMock.reservation.findFirst.mockResolvedValue(null);
      prismaMock.$transaction.mockRejectedValue(error);
      await expect(service.create(student, dto)).rejects.toBeInstanceOf(ConflictException);
    });
    it.each([new Error('connection lost'), 'database unavailable', null, { cause: 'unknown' }])('propagates unrelated failures %j', async (error) => {
      const { service } = createService();
      prismaMock.$transaction.mockRejectedValue(error);
      await expect(service.create(student, dto)).rejects.toBe(error);
    });
    it('rejects a short reason before changing a reservation', async () => {
      const { service } = createService();
      await expect(service.reject(staff, 'res-1', '  a ')).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
    it('allows an administrator to approve and audits the transition', async () => {
      const { service } = createService();
      prismaMock.reservation.findUnique.mockResolvedValue({ id: 'res-1', status: ReservationStatus.PENDING });
      txMock.reservation.update.mockResolvedValue({ id: 'res-1', status: ReservationStatus.APPROVED });
      await service.approve({ ...staff, role: Role.ADMIN }, 'res-1');
      expect(txMock.auditLog.create).toHaveBeenCalledWith({ data: {
        actorId: staff.sub, entityType: 'Reservation', entityId: 'res-1', fromValue: 'PENDING', toValue: 'APPROVED',
      } });
    });
  });

});
