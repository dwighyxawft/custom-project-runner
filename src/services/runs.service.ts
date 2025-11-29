// src/services/runs.service.ts
import uuid from 'uuid';
import * as path from 'path';
import fs from 'fs-extra';
import * as unzipper from 'unzipper';
import { ProjectDetector } from './project.detector';
import { DockerfileGenerator } from './dockerfiles.generator';
import { BuildManager } from './build.manager';
import { RunManager } from './run.manager';
import { LogsGateway } from './logs.gateway';
import { Injectable } from '@nestjs/common';
import * as net from 'net';

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

  /**
   * Main entrypoint called from controller
   */
  async createRunFromZip(buffer: Buffer) {
      const { v4: uuidv4 } = uuid;

    const runId = uuidv4();
    const workspace = path.join(process.cwd(), 'workspace', runId);
    await fs.ensureDir(workspace);

    /** ──────────────────────────────
     * 1. Extract ZIP into workspace
     * ──────────────────────────────*/
    await this.extractZipToWorkspace(buffer, workspace);

    /** ──────────────────────────────
     * 2. Detect project type
     * ──────────────────────────────*/
    const det = await this.detector.detect(workspace);

    /** ──────────────────────────────
     * 3. Generate correct Dockerfile
     * ──────────────────────────────*/
    await this.dockerfileGen.generate(det, workspace);
    const imageTag = `runner:${runId}`;

    /** ──────────────────────────────
     * 4. Docker build
     * ──────────────────────────────*/
    await this.builder.buildImage(workspace, imageTag, (msg) => {
      this.logsGateway.io.to(runId).emit('build_log', msg);
    });

    /** ──────────────────────────────
     * 5. Allocate host port
     * ──────────────────────────────*/
    const internalPort = det.port ?? 3000;
    const hostPort = await this.getFreePort();

    /** ──────────────────────────────
     * 6. Run container
     * ──────────────────────────────*/
    const runRes = await this.runner.runContainer(
      {
        imageTag,
        runId,
        port: internalPort,
        hostPort,
        memoryLimitMb: 512,
        cpuQuota: 50000
      },
      (log) => {
        this.logsGateway.io.to(runId).emit('log', log);
      }
    );

    /** ──────────────────────────────
     * 7. Save metadata
     * ──────────────────────────────*/
    const metadata = {
      runId,
      workspace,
      imageTag,
      containerId: runRes.containerId,
      hostPort,
      det,
      status: 'running' as const
    };

    this.runs.set(runId, metadata);

    /** ──────────────────────────────
     * 8. Return response to frontend
     * ──────────────────────────────*/
    const host = process.env.RUNNER_HOST || 'localhost';
    const ws = process.env.WS_PORT || 3001;

    return {
      runId,
      logsUrl: `ws://${host}:${ws}`,
      httpUrl: `http://${host}:${hostPort}/`,
      hostPort
    };
  }

  /**
   * Extract ZIP buffer into workspace
   */
  private async extractZipToWorkspace(buffer: Buffer, workspace: string) {
    return new Promise<void>((resolve, reject) => {
      const stream = unzipper.Extract({ path: workspace });

      stream.on('close', resolve);
      stream.on('error', reject);

      const readable = new (require('stream').Readable)();
      readable._read = () => {};
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  /**
   * Find free port on host machine
   */
  private getFreePort(): Promise<number> {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.listen(0, () => {
        const port = (srv.address() as any).port;
        srv.close(() => resolve(port));
      });
    });
  }

  /**
   * Stop running container
   */
  async stop(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    if (run.containerId) {
      await this.runner.stopContainer(run.containerId);
    }

    run.status = 'stopped';
    await this.cleanup(runId);
  }

  /**
   * Return run status
   */
  getStatus(runId: string) {
    return this.runs.get(runId) || { error: 'Run not found' };
  }

  /**
   * Deletes workspace, image, container
   */
  async cleanup(runId: string) {
    const run = this.runs.get(runId);
    if (!run) return;

    // remove workspace
    await fs.remove(run.workspace);

    // remove docker image
    try {
      await this.runner.removeImage(run.imageTag);
    } catch (error) {
      console.error(`Failed to remove image ${run.imageTag}:`, error);
    }

    this.runs.delete(runId);
  }
}
