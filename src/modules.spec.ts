import { AppModule } from './app.module';
import { AuthModule } from './auth/auth.module';
import { BookingRulesModule } from './booking-rules/booking-rules.module';
import { BookingsModule } from './bookings/bookings.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { GroupsModule } from './groups/groups.module';
import { PrismaModule } from './prisma/prisma.module';
import { ResourcesModule } from './resources/resources.module';
import { AuthenticatedRequest } from './common/types';

describe('Module declarations', () => {
  it('should export all module classes', () => {
    expect(AppModule).toBeDefined();
    expect(AuthModule).toBeDefined();
    expect(BookingRulesModule).toBeDefined();
    expect(BookingsModule).toBeDefined();
    expect(GroupsModule).toBeDefined();
    expect(PrismaModule).toBeDefined();
    expect(ResourcesModule).toBeDefined();
    expect(MaintenanceModule).toBeDefined();
  });

  it('should export the AuthenticatedRequest type', () => {
    const req: AuthenticatedRequest = { user: { id: 'u1' } } as any;
    expect(req.user).toHaveProperty('id');
  });
});
