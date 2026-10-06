import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { SharedChannelController } from './shared-channel.controller';
import { SharedChannelService } from './shared-channel.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    vendorProfile: { findUnique: jest.fn() },
    channel: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    message: { create: jest.fn() },
  };
}

describe('SharedChannelController', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let controller: SharedChannelController;

  beforeEach(() => {
    prisma = makePrisma();
    const service = new SharedChannelService(prisma as unknown as PrismaService);
    controller = new SharedChannelController(service);
  });

  const req = (userId: string, role: string) => ({ session: { userId, role } }) as any;

  it('is mounted at api/channels', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SharedChannelController)).toBe('api/channels');
    const proto = SharedChannelController.prototype;
    expect(Reflect.getMetadata(METHOD_METADATA, proto.postApiChannels)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(METHOD_METADATA, proto.getApiChannels)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, proto.postApiChannelsIdMessages)).toBe(':id/messages');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, proto.postApiChannelsIdMessages)).toBe(HttpStatus.CREATED);
  });

  it('vendor creates a shared channel', async () => {
    prisma.vendorProfile.findUnique.mockResolvedValue({ id: 'vp1', userId: 'u1' });
    prisma.channel.create.mockResolvedValue({ id: 'c1', name: 'Acme x Corp', vendorId: 'vp1' });
    const res = await controller.postApiChannels(req('u1', 'VENDOR'), { name: 'Acme x Corp' });
    expect(res).toEqual({ id: 'c1', name: 'Acme x Corp' });
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: { name: 'Acme x Corp', vendorId: 'vp1', vendorProfileId: 'vp1' },
    });
  });

  it('lists channels', async () => {
    prisma.channel.findMany.mockResolvedValue([{ id: 'c1', name: 'Acme x Corp', vendorId: 'vp1' }]);
    await expect(controller.getApiChannels()).resolves.toEqual([{ id: 'c1', name: 'Acme x Corp' }]);
  });

  it('customer posts a message', async () => {
    prisma.channel.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.message.create.mockResolvedValue({ id: 'm1', body: 'hello', channelId: 'c1', senderId: 'u2' });
    const res = await controller.postApiChannelsIdMessages(req('u2', 'CUSTOMER'), 'c1', { body: 'hello' });
    expect(res).toEqual({ id: 'm1', body: 'hello', channelId: 'c1' });
  });

  it('rejects an empty channel name', async () => {
    await expect(controller.postApiChannels(req('u1', 'VENDOR'), { name: ' ' })).rejects.toThrow();
  });

  it('404s for unknown channel', async () => {
    prisma.channel.findUnique.mockResolvedValue(null);
    await expect(
      controller.postApiChannelsIdMessages(req('u2', 'CUSTOMER'), 'nope', { body: 'hi' }),
    ).rejects.toThrow('Channel not found');
  });
});
