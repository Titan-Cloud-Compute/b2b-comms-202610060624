import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FeatureService } from '../../common/feature';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

export interface ChannelActor {
  userId: string;
  role: string;
}

@Injectable()
export class SharedChannelService extends FeatureService {
  constructor(prisma: PrismaService) {
    super(prisma, ['Channel', 'Message']);
  }

  async createChannel(actor: ChannelActor, name: unknown): Promise<PostApiChannelsResponseDto> {
    if (typeof name !== 'string' || !name.trim()) {
      throw new BadRequestException('name is required');
    }
    const profile = await this.prisma.vendorProfile.findUnique({ where: { userId: actor.userId } });
    if (!profile) {
      throw new ForbiddenException('Only vendors with a profile can create channels');
    }
    const channel = await this.model('Channel').create({
      data: { name: name.trim(), vendorId: profile.id, vendorProfileId: profile.id },
    });
    return { id: channel.id, name: channel.name };
  }

  async listChannels(): Promise<GetApiChannelsResponseDto[]> {
    const channels = await this.model('Channel').findMany({ orderBy: { createdAt: 'asc' } });
    return channels.map((c) => ({ id: c.id, name: c.name }));
  }

  async postMessage(
    actor: ChannelActor,
    channelId: string,
    body: unknown,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    if (typeof body !== 'string' || !body.trim()) {
      throw new BadRequestException('body is required');
    }
    const channel = await this.model('Channel').findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    const message = await this.model('Message').create({
      data: { body: body.trim(), channelId, senderId: actor.userId },
    });
    return { id: message.id, body: message.body, channelId: message.channelId };
  }
}
