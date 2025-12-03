// src/services/project.detector.ts
import * as fs from 'fs-extra';
import * as path from 'path';

export type ProjectType =
  | 'node'
  | 'react'
  | 'react-vite'
  | 'next'
  | 'nestjs'
  | 'angular'
  | 'vue'
  | 'laravel'
  | 'php'
  | 'django'
  | 'flask'
  | 'python'
  | 'ml'
  | 'dl'
  | 'jupyter'
  | 'react-native-metro'
  | 'react-native-cli'
  | 'expo'
  | 'vite'
  | 'android-gradle';

export interface DetectionResult {
  type: ProjectType | 'unknown';
  startCommand?: string;
  port?: number;
  reason?: string[];
}

export class ProjectDetector {
  async detect(projectPath: string): Promise<DetectionResult> {
    const reasons: string[] = [];
    const entries = await fs.readdir(projectPath);
    const has = (name: string) => entries.includes(name);

    // package.json check
    if (has('package.json')) {
      const pkg = await fs
        .readJSON(path.join(projectPath, 'package.json'))
        .catch(() => ({}));

      const scripts = pkg.scripts || {};
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // --- NEXT.JS ---
      if (deps['next']) {
        reasons.push('found next in package.json');
        return {
          type: 'next',
          startCommand: scripts.start || 'npm run dev',
          reason: reasons,
        };
      }

      // --- NESTJS ---
      if (deps['@nestjs/core']) {
        reasons.push('found @nestjs/core');
        return {
          type: 'nestjs',
          startCommand: scripts.start || 'npm run start:prod',
          reason: reasons,
        };
      }

      // React Vite
      if (deps['vite'] || scripts['dev']?.includes('vite')) {
        reasons.push('found vite');
        return {
          type: 'vite',
          startCommand: scripts.dev || 'npm run dev',
          port: 5173,
          reason: reasons
        };
      }


      // --- REACT (CRA) ---
      if (deps['react-scripts']) {
        reasons.push('found react-scripts');
        return {
          type: 'react',
          startCommand: scripts.start || 'npm start',
          reason: reasons,
        };
      }

      // --- GENERIC REACT detection ---
      if (deps['react']) {
        reasons.push('react dependency detected');
        return {
          type: 'react',
          startCommand: scripts.start || 'npm start',
          reason: reasons,
        };
      }

      // --- NODEJS ---
      if (pkg.main || scripts.start || deps['express']) {
        reasons.push('generic node project');
        return {
          type: 'node',
          startCommand: scripts.start || 'node index.js',
          reason: reasons,
        };
      }
    }

    // --- PHP/LARAVEL ---
    if (has('composer.json')) {
      const composer = await fs
        .readJSON(path.join(projectPath, 'composer.json'))
        .catch(() => ({}));

      if (composer.require?.laravel) {
        reasons.push('laravel detected');
        return {
          type: 'laravel',
          startCommand:
            'php artisan serve --host=0.0.0.0 --port=8000',
          reason: reasons,
        };
      }

      return {
        type: 'php',
        startCommand: 'php -S 0.0.0.0:8080 -t public',
        reason: ['php project (composer.json)'],
      };
    }

    // --- PYTHON DETECTION ---
    if (has('manage.py') || has('requirements.txt')) {
      const reqs = await fs
        .readFile(path.join(projectPath, 'requirements.txt'))
        .catch(() => '');

      if (reqs.includes('Django') || has('manage.py')) {
        return {
          type: 'django',
          startCommand: 'python manage.py runserver 0.0.0.0:8000',
          reason: ['django detected'],
        };
      }

      if (reqs.includes('flask') || has('app.py')) {
        return {
          type: 'flask',
          startCommand: 'python app.py',
          reason: ['flask detected'],
        };
      }

      return {
        type: 'python',
        startCommand: 'python main.py',
        reason: ['generic python project'],
      };
    }

    // fallback
    return { type: 'unknown', reason: ['no recognized markers'] };
  }
}
