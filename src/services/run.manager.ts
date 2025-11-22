import Dockerode = require('dockerode');
import * as stream from 'stream';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export interface RunOptions {
  imageTag: string;
  runId: string;
  port?: number;
  hostPort?: number;
  env?: Record<string, string>;
  memoryLimitMb?: number;
  cpuQuota?: number;
}

export class RunManager {
  private docker: Dockerode;

  constructor() {
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  async runContainer(opts: RunOptions, onLog?: (chunk: string) => void) {
    const port = opts.port ?? 3000;
    const hostPort = opts.hostPort ?? 0;

    const portBindings: any = {
      [`${port}/tcp`]: [{ HostPort: hostPort === 0 ? '' : String(hostPort) }],
    };

    const HostConfig: any = {
      PortBindings: portBindings,
      AutoRemove: false,
      NetworkMode: 'bridge',
      Memory: opts.memoryLimitMb ? opts.memoryLimitMb * 1024 * 1024 : undefined,
      CpuQuota: opts.cpuQuota,
    };

    const container = await this.docker.createContainer({
      Image: opts.imageTag,
      Env: Object.entries(opts.env || {}).map(([k, v]) => `${k}=${v}`),
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig,
    });

    await container.start();

    const inspect = await container.inspect();
    const mappedPort =
      inspect.NetworkSettings.Ports?.[`${port}/tcp`]?.[0]?.HostPort;

    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      since: 0,
      tail: 100,
    });

    logStream.on('data', (chunk) => {
      if (onLog) onLog(chunk.toString());
    });

    container.wait().then((res) => {
      if (onLog) onLog(`Container exited with ${JSON.stringify(res)}`);
    });

    return { containerId: container.id, hostPort: mappedPort };
  }

  async stopContainer(containerId: string) {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: 5 });
    } catch {}
    await container.remove({ force: true });
  }

  async removeImage(imageTag: string): Promise<void> {
    try {
      const image = this.docker.getImage(imageTag);
      await image.remove({ force: true });
      console.log(`Image removed: ${imageTag}`);
    } catch (error) {
      console.error(`Failed to remove docker image ${imageTag}:`, error);
      throw error;
    }
  }
}
