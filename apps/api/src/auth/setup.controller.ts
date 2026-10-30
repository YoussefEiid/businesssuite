import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SetupService } from './setup.service';
import { InitializeCompanyDto } from './dto/setup.dto';

@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  @Get('status')
  async getStatus() {
    return this.setupService.getSetupStatus();
  }

  @Post('initialize')
  @HttpCode(HttpStatus.CREATED)
  async initializeCompany(@Body() dto: InitializeCompanyDto) {
    return this.setupService.initializeCompany(dto);
  }
}
