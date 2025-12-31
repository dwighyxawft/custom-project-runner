// src/services/dockerfiles.generator.ts
import * as fs from 'fs-extra';
import * as path from 'path';

export class DockerfileGenerator {
  // Try multiple likely template locations: dist (when compiled), src (dev), or packaged templates
  private templateDirs(): string[] {
    const candidates = [
      path.join(__dirname, '../templates/dockerfiles'),               // runtime from dist
      path.join(process.cwd(), 'dist', 'templates', 'dockerfiles'),  // possible dist copy
      path.join(process.cwd(), 'src', 'templates', 'dockerfiles'),   // local dev
      path.join(process.cwd(), 'templates', 'dockerfiles'),          // other
    ];
    return candidates;
  }

  async generate(det: { type: string; startCommand?: string; port?: number }, workspacePath: string): Promise<string> {
    const type = det.type || 'node';
    let tpl: string | null = null;
    let tplPath = '';

    for (const dir of this.templateDirs()) {
      const p = path.join(dir, `${type}.tpl`);
      if (await fs.pathExists(p)) {
        tpl = await fs.readFile(p, 'utf8');
        tplPath = p;
        break;
      }
    }

    // fallback to node.tpl if not found
    if (!tpl) {
      for (const dir of this.templateDirs()) {
        const p = path.join(dir, 'node.tpl');
        if (await fs.pathExists(p)) {
          tpl = await fs.readFile(p, 'utf8');
          tplPath = p;
          break;
        }
      }
    }

    if (!tpl) {
      throw new Error(`Dockerfile template not found for ${type} — looked in paths: ${this.templateDirs().join(', ')}`);
    }

    const port = det.port || 3000;
    const rendered = tpl
      .replace(/\{\{PORT\}\}/g, String(port))
      .replace(/\{\{START_CMD\}\}/g, det.startCommand || '')
      .replace(/\{\{WORKDIR\}\}/g, workspacePath);

    // write Dockerfile into workspace
    await fs.writeFile(path.join(workspacePath, 'Dockerfile'), rendered, 'utf8');

    return rendered;
  }
}
