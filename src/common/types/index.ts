import { User, GroupRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: User;
}

export { GroupRole };
