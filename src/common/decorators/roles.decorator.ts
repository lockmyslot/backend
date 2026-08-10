import { SetMetadata } from '@nestjs/common';
import { GroupRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: GroupRole[]) => SetMetadata(ROLES_KEY, roles);
