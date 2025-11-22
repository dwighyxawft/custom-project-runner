// src/controllers/runs.controller.ts
import { Controller, Post, UploadedFile, UseInterceptors, Body, Get, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RunsService } from '../services/runs.service';

@Controller('runs')
export class RunsController {
  constructor(private runs: RunsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndRun(@UploadedFile() file: Express.Multer.File) {
    const run = await this.runs.createRunFromZip(file.buffer); // returns run info
    return run;
  }

  @Post(':runId/stop')
  async stopRun(@Param('runId') runId: string) {
    await this.runs.stop(runId);
    return { ok: true };
  }

  @Get(':runId/status')
  async status(@Param('runId') runId: string) {
    return this.runs.getStatus(runId);
  }
}
