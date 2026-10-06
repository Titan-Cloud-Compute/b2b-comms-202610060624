import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { OrderManagementService } from './order-management.service';
import {
  GetApiOrdersResponseDto,
  PatchApiOrdersIdConfirmRequestDto,
  PatchApiOrdersIdConfirmResponseDto,
  PostApiOrdersRequestDto,
  PostApiOrdersResponseDto,
} from './order-management.dto';

@ApiTags('order-management')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/orders')
export class OrderManagementController {
  constructor(private readonly ordermanagement: OrderManagementService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async postApiOrders(
    @Req() req: Request,
    @Body() dto: PostApiOrdersRequestDto,
  ): Promise<PostApiOrdersResponseDto> {
    const { userId, role } = req.session!;
    return this.ordermanagement.createOrder({ userId, role }, dto?.vendorId, dto?.items);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.VENDOR, UserRole.ADMIN)
  async patchApiOrdersIdConfirm(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PatchApiOrdersIdConfirmRequestDto,
  ): Promise<PatchApiOrdersIdConfirmResponseDto> {
    const { userId, role } = req.session!;
    return this.ordermanagement.confirmOrder({ userId, role }, id, dto?.estimatedDelivery);
  }

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.USER, UserRole.MANAGER, UserRole.ADMIN)
  async getApiOrders(@Req() req: Request): Promise<GetApiOrdersResponseDto[]> {
    const { userId, role } = req.session!;
    return this.ordermanagement.listOrders({ userId, role });
  }
}
