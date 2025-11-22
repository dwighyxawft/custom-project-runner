// src/services/build.manager.ts
import Dockerode = require('dockerode');
import * as tar from 'tar-fs';
import * as fs from 'fs-extra';
import * as path from 'path';
import { PassThrough } from 'stream';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export class BuildManager {
  async buildImage(
    workspacePath: string,
    imageTag: string,
    onProgress?: (msg: string) => void
  ) {
    const tarStream = tar.pack(workspacePath, {
      ignore: (name) => name.includes('node_modules'),
    });

    const stream = await docker.buildImage(tarStream, { t: imageTag });

    return new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(
        stream,
        (err) => (err ? reject(err) : resolve()),
        (event) => {
          if (onProgress) {
            if (event.stream) onProgress(event.stream.toString());
            else if (event.error) onProgress(event.error.toString());
          }
        }
      );
    });
  }
}
