import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RunsController } from './controllers/runs.controller';
import { RunsService } from './services/runs.service';
import { ProjectDetector } from './services/project.detector';
import { DockerfileGenerator } from './services/dockerfiles.generator';
import { LogsGateway } from './services/logs.gateway';
import { BuildManager } from './services/build.manager';
import { RunManager } from './services/run.manager';

@Module({
  controllers: [AppController, RunsController],
  providers: [AppService, RunsService, ProjectDetector, DockerfileGenerator, LogsGateway, BuildManager, RunManager],
})
export class AppModule {}
