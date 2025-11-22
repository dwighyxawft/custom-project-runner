// src/services/dockerfile.generator.ts
import * as fs from 'fs-extra';
import * as path from 'path';

export class DockerfileGenerator {
  templatesPath = path.join(__dirname, '../templates/dockerfiles');

  async generate(det: { type: string, startCommand?: string, port?: number }, workspacePath: string): Promise<string> {
    const tplFile = path.join(this.templatesPath, `${det.type}.tpl`);
    let tpl = await fs.readFile(tplFile, 'utf8').catch(()=>null);
    if (!tpl) {
      // fallback to node.tpl
      tpl = await fs.readFile(path.join(this.templatesPath, 'node.tpl'), 'utf8');
    }
    const port = det.port || 3000;
    const rendered = tpl
      .replace(/\{\{PORT\}\}/g, String(port))
      .replace(/\{\{START_CMD\}\}/g, det.startCommand || '')
      .replace(/\{\{WORKDIR\}\}/g, workspacePath);
    // write to workspace
    await fs.writeFile(path.join(workspacePath, 'Dockerfile'), rendered, 'utf8');
    return rendered;
  }
}
