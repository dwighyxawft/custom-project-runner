// src/services/runs.service.ts
import { v4 as _unused } from 'uuid'; // keep for types if needed; not used
import * as path from 'path';
import * as fs from 'fs-extra';
import * as unzipper from 'unzipper';
import { ProjectDetector } from './project.detector';
import { DockerfileGenerator } from './dockerfiles.generator';
import { BuildManager } from './build.manager';
import { RunManager } from './run.manager';
import { LogsGateway } from './logs.gateway';
import { Injectable } from '@nestjs/common';
import * as net from 'net';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

@Injectable()
export class RunsService {
  private runs = new Map<
    string,
    {
      runId: string;
      workspace: string;
      imageTag: string;
      containerId: string | null;
      hostPort: number;
      det: any;
      status: 'running' | 'stopped' | 'error';
    }
  >();

  constructor(
    private detector: ProjectDetector,
    private dockerfileGen: DockerfileGenerator,
    private builder: BuildManager,
    private runner: RunManager,
    private logsGateway: LogsGateway
  ) {}

  async createRunFromZip(buffer: Buffer) {
    // use built-in Node UUID to avoid uuid ESM problems
    const runId = randomUUID();
    const workspace = path.join(process.cwd(), 'workspace', runId);

    // ensure workspace exists
    await fs.ensureDir(workspace);

    // extract zip
    await this.extractZipToWorkspace(buffer, workspace);

    // detect project
    const det = await this.detector.detect(workspace);

    // generate Dockerfile
    await this.dockerfileGen.generate(det, workspace);
    const imageTag = `runner:${runId}`;

    // build image (emit build logs)
    await this.builder.buildImage(workspace, imageTag, (msg) => {
      try {
        this.logsGateway.io.to(runId).emit('build_log', msg);
      } catch (e) {}
    });

    const internalPort = det.port ?? 3000;
    const hostPort = await this.getFreePort();

    const runRes = await this.runner.runContainer(
      {
        imageTag,
        runId,
        port: internalPort,
        hostPort,
        memoryLimitMb: 512,
        cpuQuota: 50000,
      },
      (log) => {
        try {
          this.logsGateway.io.to(runId).emit('log', log);
        } catch (e) {}
      }
    );

    const metadata = {
      runId,
      workspace,
      imageTag,
      containerId: runRes.containerId,
      hostPort: runRes.hostPort ?? hostPort,
      det,
      status: 'running' as const,
    };

    this.runs.set(runId, metadata);

    const host = process.env.RUNNER_HOST || 'localhost';
    const ws = process.env.WS_PORT || 3001;

    return {
      runId,
      logsUrl: `ws://${host}:${ws}`,
      httpUrl: `http://${host}:${metadata.hostPort}/`,
      hostPort: metadata.hostPort,
    };
  }

  private async extractZipToWorkspace(buffer: Buffer, workspace: string) {
    return new Promise<void>((resolve, reject) => {
      const stream = unzipper.Extract({ path: workspace });

      stream.on('close', resolve);
      stream.on('error', reject);

      // create a Readable from the buffer
      const readable = new Readable();
      readable._read = () => {};
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  private getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.once('error', reject);
      srv.listen(0, () => {
        const addr = srv.address();
        const port = typeof addr === 'string' ? 0 : (addr as any).port;
        srv.close(() => resolve(port));
      });
    });
  }

  async stop(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;
    if (run.containerId) {
      await this.runner.stopContainer(run.containerId);
    }
    run.status = 'stopped';
    await this.cleanup(runId);
  }

  getStatus(runId: string) {
    return this.runs.get(runId) || { error: 'Run not found' };
  }

  async cleanup(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    try {
      await fs.remove(run.workspace);
    } catch (e) {
      console.error('Failed to remove workspace', e);
    }

    try {
      await this.runner.removeImage(run.imageTag);
    } catch (error) {
      console.error(`Failed to remove image ${run.imageTag}:`, error);
    }

    this.runs.delete(runId);
  }
}
