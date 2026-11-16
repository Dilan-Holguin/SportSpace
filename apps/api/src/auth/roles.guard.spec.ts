import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, jest } from '@jest/globals';
import { Role } from '@prisma/client';
import type { JwtPayload } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const student: JwtPayload = { sub: 'student-1', email: 'stu@udea.edu.co', role: Role.STUDENT };
  const staff: JwtPayload = { sub: 'staff-1', email: 'staff@udea.edu.co', role: Role.STAFF };
  const admin: JwtPayload = { sub: 'admin-1', email: 'admin@udea.edu.co', role: Role.ADMIN };

  function createGuard(requiredRoles?: Role[]) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    };
    return new RolesGuard(reflector as unknown as Reflector);
  }

  function httpContext(user?: JwtPayload): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows the request when the handler does not declare roles', () => {
    const guard = createGuard(undefined);
    expect(guard.canActivate(httpContext(student))).toBe(true);
  });

  it('allows STAFF and ADMIN on catalog, occupancy and reservation decision routes', () => {
    const guard = createGuard([Role.STAFF, Role.ADMIN]);
    expect(guard.canActivate(httpContext(staff))).toBe(true);
    expect(guard.canActivate(httpContext(admin))).toBe(true);
  });

  it('returns 403 when a student creates a space or approves a reservation', () => {
    const guard = createGuard([Role.STAFF, Role.ADMIN]);
    expect(() => guard.canActivate(httpContext(student))).toThrow(ForbiddenException);
  });

  it('returns 403 when STAFF tries an ADMIN-only route such as changing roles', () => {
    const guard = createGuard([Role.ADMIN]);
    expect(() => guard.canActivate(httpContext(staff))).toThrow(ForbiddenException);
    expect(guard.canActivate(httpContext(admin))).toBe(true);
  });

  it('returns 403 when the request has no authenticated user', () => {
    const guard = createGuard([Role.STAFF, Role.ADMIN]);
    expect(() => guard.canActivate(httpContext(undefined))).toThrow(ForbiddenException);
  });
});
