import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { SharedChannelService } from './shared-channel.service';
import {
  GetApiChannelsResponseDto,
  PostApiChannelsIdMessagesRequestDto,
  PostApiChannelsIdMessagesResponseDto,
  PostApiChannelsRequestDto,
  PostApiChannelsResponseDto,
} from './shared-channel.dto';

@ApiTags('shared-channel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/channels')
export class SharedChannelController {
  constructor(private readonly sharedchannel: SharedChannelService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @HttpCode(HttpStatus.CREATED)
  async postApiChannels(
    @Req() req: Request,
    @Body() dto: PostApiChannelsRequestDto,
  ): Promise<PostApiChannelsResponseDto> {
    const { userId, role } = req.session!;
    return this.sharedchannel.createChannel({ userId, role }, dto?.name);
  }

  @Post(':id/messages')
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  @HttpCode(HttpStatus.CREATED)
  async postApiChannelsIdMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PostApiChannelsIdMessagesRequestDto,
  ): Promise<PostApiChannelsIdMessagesResponseDto> {
    const { userId, role } = req.session!;
    return this.sharedchannel.postMessage({ userId, role }, id, dto?.body);
  }

  @Get()
  @Roles(UserRole.VENDOR, UserRole.CUSTOMER)
  async getApiChannels(): Promise<GetApiChannelsResponseDto[]> {
    return this.sharedchannel.listChannels();
  }
}
