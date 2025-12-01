// src/services/runs.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as unzipper from 'unzipper';
import { Readable, PassThrough } from 'stream';
import * as net from 'net';

import { ProjectDetector } from './project.detector';
import { DockerfileGenerator } from './dockerfiles.generator';
import { BuildManager } from './build.manager';
import { RunManager } from './run.manager';
import { LogsGateway } from './logs.gateway';

type RunMeta = {
  runId: string;
  workspace: string;
  imageTag: string;
  containerId: string | null;
  hostPort: number | null;
  det: any;
  status: 'running' | 'stopped' | 'error' | 'building';
  createdAt: number;
};

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);
  private runs = new Map<string, RunMeta>();

  constructor(
    private detector: ProjectDetector,
    private dockerfileGen: DockerfileGenerator,
    private builder: BuildManager,
    private runner: RunManager,
    private logsGateway: LogsGateway
  ) {}

  /**
   * Create a run from an uploaded zip buffer.
   * Always returns an object containing runId and logsUrl so frontend can stream logs.
   * If build+run succeed, httpUrl will also be returned.
   */
  async createRunFromZip(buffer: Buffer) {
    const runId = typeof (global as any).crypto?.randomUUID === 'function'
      ? (global as any).crypto.randomUUID()
      : this.fallbackUuid();

    const workspace = path.join(process.cwd(), 'workspace', runId);
    await fs.ensureDir(workspace);

    // Put initial metadata so frontend can query early
    const initialMeta: RunMeta = {
      runId,
      workspace,
      imageTag: `runner:${runId}`,
      containerId: null,
      hostPort: null,
      det: null,
      status: 'building',
      createdAt: Date.now()
    };
    this.runs.set(runId, initialMeta);

    const host = process.env.RUNNER_HOST || 'localhost';
    const wsPort = process.env.WS_PORT || 3001;

    // Immediately return runId and logsUrl so frontend can connect to websocket
    // Build and run are performed asynchronously below — but we still await the build so
    // we can return httpUrl when successful. If you want purely async fire-and-forget,
    // you can spawn a background task instead.
    try {
      // extract zip
      await this.extractZipToWorkspace(buffer, workspace);
      this.logger.log(`[${runId}] extracted workspace`);

      // detect project
      const det = await this.detector.detect(workspace);
      initialMeta.det = det;
      this.logger.log(`[${runId}] detected project: ${JSON.stringify(det)}`);

      // generate Dockerfile
      await this.dockerfileGen.generate(det, workspace);
      this.logger.log(`[${runId}] dockerfile generated`);

      // build image (stream build logs to websocket)
      await this.builder.buildImage(workspace, initialMeta.imageTag, (msg) => {
        this.logsGateway.io.to(runId).emit('build_log', String(msg));
      });

      this.logger.log(`[${runId}] build finished`);

      // allocate host port and run container
      const internalPort = det.port ?? 3000;
      const hostPort = await this.getFreePort();
      const runRes = await this.runner.runContainer(
        {
          imageTag: initialMeta.imageTag,
          runId,
          port: internalPort,
          hostPort,
          memoryLimitMb: 512,
          cpuQuota: 50000,
        },
        (logLine) => {
          // emit runtime logs
          this.logsGateway.io.to(runId).emit('log', String(logLine));
        }
      );

      // update metadata
      initialMeta.containerId = runRes.containerId;
      initialMeta.hostPort = runRes.hostPort ? Number(runRes.hostPort) : hostPort;
      initialMeta.status = 'running';
      this.runs.set(runId, initialMeta);

      const httpUrl = `http://${host}:${initialMeta.hostPort}/`;
      const logsUrl = `ws://${host}:${wsPort}`;

      return { runId, logsUrl, httpUrl, hostPort: initialMeta.hostPort };
    } catch (err) {
      this.logger.error(`[${runId}] run failed`, err as any);

      // emit the error to logs so frontend sees it too
      this.logsGateway.io.to(runId).emit('build_log', `ERROR: ${(err as any)?.message || err}`);

      // set status
      const meta = this.runs.get(runId);
      if (meta) meta.status = 'error';

      // try cleanup of workspace and image if partially created
      try {
        await fs.remove(workspace);
      } catch (e) {
        this.logger.warn(`[${runId}] cleanup workspace failed: ${(e as any)?.message}`);
      }
      try {
        // best-effort: remove image if it exists
        await this.runner.removeImage(initialMeta.imageTag).catch(() => {});
      } catch {}

      // still return runId and logsUrl so frontend can inspect logs for failure diagnostics
      const logsUrl = `ws://${host}:${wsPort}`;
      return { runId, logsUrl, error: (err as any)?.message || String(err) };
    }
  }

  /**
   * Stops and cleans a run.
   */
  async stop(runId: string) {
    const meta = this.runs.get(runId);
    if (!meta) return { ok: false, error: 'run not found' };

    if (meta.containerId) {
      try {
        await this.runner.stopContainer(meta.containerId);
      } catch (e) {
        this.logger.warn(`[${runId}] stopContainer error: ${(e as any)?.message}`);
      }
    }

    try {
      await this.cleanup(runId);
    } catch (e) {
      this.logger.warn(`[${runId}] cleanup after stop failed: ${(e as any)?.message}`);
    }

    return { ok: true };
  }

  /**
   * Return status metadata for a run
   */
  getStatus(runId: string) {
    const meta = this.runs.get(runId);
    if (!meta) return { error: 'run not found' };
    return {
      runId: meta.runId,
      status: meta.status,
      hostPort: meta.hostPort,
      containerId: meta.containerId,
      detected: meta.det,
      createdAt: meta.createdAt
    };
  }

  /**
   * Remove workspace + image + map cleanup
   */
  async cleanup(runId: string) {
    const meta = this.runs.get(runId);
    if (!meta) return;

    // remove workspace dir
    try {
      await fs.remove(meta.workspace);
    } catch (e) {
      this.logger.warn(`[${runId}] failed to remove workspace: ${(e as any)?.message}`);
    }

    // remove image
    if (meta.imageTag) {
      try {
        await this.runner.removeImage(meta.imageTag);
      } catch (e) {
        this.logger.warn(`[${runId}] failed to remove image: ${(e as any)?.message}`);
      }
    }

    this.runs.delete(runId);
  }

  /**
   * Extract zip buffer into workspace. Uses a PassThrough so unzipper receives a stream.
   */
  private extractZipToWorkspace(buffer: Buffer, workspace: string) {
    return new Promise<void>((resolve, reject) => {
      try {
        // ensure directory exists (redundant but safe)
        fs.ensureDirSync(workspace);

        const stream = unzipper.Extract({ path: workspace });
        stream.on('close', () => resolve());
        stream.on('error', (err) => reject(err));

        const pass = new PassThrough();
        pass.end(buffer);
        pass.pipe(stream);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Find a free port on host.
   */
  private getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : undefined;
        server.close(() => resolve(port as number));
      });
    });
  }

  /**
   * Fallback uuid generation if crypto.randomUUID isn't available
   */
  private fallbackUuid() {
    // simple fallback, not as strong as randomUUID but sufficient for runId uniqueness
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
