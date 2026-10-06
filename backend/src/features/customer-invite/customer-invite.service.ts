import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GetApiAdminCustomersResponseDto,
  PostApiAdminCustomersInviteResponseDto,
} from './customer-invite.dto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class CustomerInviteService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Customer', 'User'] as const);
  }

  async listCustomers(): Promise<GetApiAdminCustomersResponseDto[]> {
    return this.model('Customer').findMany({
      select: { id: true, email: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async invite(rawEmail: unknown): Promise<PostApiAdminCustomersInviteResponseDto> {
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) {
      throw new BadRequestException('A valid email is required');
    }
    const existing = await this.model('Customer').findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Customer already exists');
    }
    let user = await this.model('User').findUnique({ where: { email } });
    if (!user) {
      user = await this.model('User').create({ data: { email, role: 'CUSTOMER' } });
    } else {
      const linked = await this.model('Customer').findUnique({ where: { userId: user.id } });
      if (linked) throw new ConflictException('Customer already exists');
    }
    const customer = await this.model('Customer').create({ data: { email, userId: user.id } });
    return { customerId: customer.id, email: customer.email, invitationSent: true };
  }
}
