// src/services/build.manager.ts
import Dockerode = require('dockerode');
import * as tar from 'tar-fs';
import * as fs from 'fs-extra';
import * as path from 'path';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

export class BuildManager {
  /**
   * Build a Docker image from the workspace path.
   * Streams ALL Docker logs and throws detailed errors on failure.
   */
  async buildImage(
    workspacePath: string,
    imageTag: string,
    onProgress?: (msg: string) => void
  ): Promise<void> {

    // ✔️ Validate the workspace
    if (!(await fs.pathExists(workspacePath))) {
      throw new Error(`Workspace does not exist: ${workspacePath}`);
    }

    // ✔️ Dockerfile MUST exist
    const dockerfilePath = path.join(workspacePath, 'Dockerfile');
    if (!(await fs.pathExists(dockerfilePath))) {
      throw new Error(`Dockerfile not found at: ${dockerfilePath}`);
    }

    // ✔️ Pack the folder as tar for Docker build
    const tarStream = tar.pack(workspacePath, {
      ignore: (name: string) => name.includes('node_modules'),
    });

    // ✔️ Start docker build
    let stream;
    try {
      stream = await docker.buildImage(tarStream, {
        t: imageTag,
        dockerfile: 'Dockerfile',
      });
    } catch (err: any) {
      throw new Error(
        `Docker buildImage() failed BEFORE build started: ${err.message || err}`
      );
    }

    // ✔️ Follow build progress and stream logs
    return new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(
        stream,

        // 🔴 BUILD ERROR
        (err: any) => {
          if (err) {
            const message = err?.message || JSON.stringify(err);
            reject(new Error(`Docker image build failed: ${message}`));
          } else {
            resolve();
          }
        },

        // 🔵 BUILD LOG STREAM
        (event: any) => {
          if (!onProgress) return;

          if (event.stream) onProgress(event.stream.toString());
          if (event.error) onProgress(`ERROR: ${event.error.toString()}`);
          if (event.status) onProgress(event.status.toString());
        }
      );
    });
  }
}
