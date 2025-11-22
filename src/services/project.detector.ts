// src/services/project.detector.ts
import * as fs from 'fs-extra';
import * as path from 'path';

export type ProjectType =
  | 'node'
  | 'react'
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
  | 'android-gradle';

export interface DetectionResult {
  type: ProjectType | 'unknown';
  startCommand?: string; // npm run start, python main.py, etc
  port?: number; // if detectable
  reason?: string[];
}

export class ProjectDetector {
  async detect(projectPath: string): Promise<DetectionResult> {
    const reasons: string[] = [];
    const entries = await fs.readdir(projectPath);
    const has = (name: string) => entries.includes(name);

    // check package.json
    if (has('package.json')) {
      const pkg = await fs.readJSON(path.join(projectPath, 'package.json')).catch(() => ({}));
      const scripts = pkg.scripts || {};
      const deps = {...pkg.dependencies, ...pkg.devDependencies};
      // Next.js
      if (deps['next'] || pkg.name?.includes('next')) {
        reasons.push('found next in package.json');
        return { type: 'next', startCommand: scripts.start || 'npm run dev', reason: reasons };
      }
      // NestJS
      if (deps['@nestjs/core'] || deps['nestjs']) {
        reasons.push('found @nestjs/core');
        return { type: 'nestjs', startCommand: scripts.start || 'npm run start:prod', reason: reasons };
      }
      // React (Create React App)
      if (deps['react-scripts'] || pkg.name?.includes('react')) {
        reasons.push('found react-scripts');
        return { type: 'react', startCommand: scripts.start || 'npm start', reason: reasons };
      }
      // Vue
      if (deps['vue'] || deps['@vue/cli-service']) {
        reasons.push('found vue');
        return { type: 'vue', startCommand: scripts.serve || scripts.start || 'npm run serve', reason: reasons };
      }
      // Angular
      if (deps['@angular/core'] || has('angular.json')) {
        reasons.push('found @angular/core');
        return { type: 'angular', startCommand: scripts.start || 'npm start', reason: reasons };
      }
      // React Native / Expo
      if (deps['react-native'] && deps['expo']) {
        reasons.push('found react-native & expo');
        return { type: 'expo', startCommand: scripts.start || 'expo start --tunnel', reason: reasons };
      }
      if (deps['react-native'] && !deps['expo']) {
        // determine metro vs cli by scripts
        if (scripts['android'] || scripts['run-android']) {
          reasons.push('react-native with android script');
          return { type: 'react-native-cli', startCommand: scripts.start || 'npx react-native start', reason: reasons };
        }
        reasons.push('react-native (metro)');
        return { type: 'react-native-metro', startCommand: scripts.start || 'npx react-native start', reason: reasons };
      }
      // Node generic
      if (pkg.main || scripts.start || deps['express'] || deps['koa']) {
        reasons.push('generic node project');
        return { type: 'node', startCommand: scripts.start || 'node index.js', reason: reasons };
      }
    }

    // PHP / Laravel
    if (has('composer.json')) {
      const composer = await fs.readJSON(path.join(projectPath, 'composer.json')).catch(() => ({}));
      if (has('artisan') || composer.require?.laravel) {
        reasons.push('laravel detected');
        return { type: 'laravel', startCommand: 'php artisan serve --host=0.0.0.0 --port=8000', reason: reasons };
      }
      reasons.push('php project (composer.json)');
      return { type: 'php', startCommand: 'php -S 0.0.0.0:8080 -t public', reason: reasons };
    }

    // Python
    if (has('manage.py') || has('requirements.txt') || has('pyproject.toml')) {
      const reqs = await fs.readFile(path.join(projectPath, 'requirements.txt')).catch(() => '');
      // Django
      if (has('manage.py') || reqs.includes('Django')) {
        reasons.push('django detected');
        return { type: 'django', startCommand: 'python manage.py runserver 0.0.0.0:8000', reason: reasons };
      }
      // Flask
      if (reqs.includes('flask') || has('app.py') || has('wsgi.py')) {
        reasons.push('flask detected');
        return { type: 'flask', startCommand: 'gunicorn -w 1 -b 0.0.0.0:8000 app:app', reason: reasons };
      }
      // ML / DL if numpy/pandas/torch/tensorflow are in requirements
      if (reqs.includes('numpy') || reqs.includes('pandas') || reqs.includes('scikit-learn')) {
        reasons.push('python ML project');
        return { type: 'ml', startCommand: 'python main.py', reason: reasons };
      }
      if (reqs.includes('torch') || reqs.includes('tensorflow')) {
        reasons.push('python DL project');
        return { type: 'dl', startCommand: 'python main.py', reason: reasons };
      }
      // Jupyter-like
      if (has('notebook.ipynb') || entries.some(e => e.endsWith('.ipynb'))) {
        reasons.push('jupyter detected');
        return { type: 'jupyter', startCommand: 'python notebook_to_script.py && python main.py', reason: reasons };
      }

      // generic python
      reasons.push('generic python project');
      return { type: 'python', startCommand: 'python main.py', reason: reasons };
    }

    // Android native gradle
    if (has('build.gradle') || has('gradlew') || has('app') && has('android')) {
      reasons.push('android gradle project');
      return { type: 'android-gradle', startCommand: './gradlew assembleDebug', reason: reasons };
    }

    // fallback
    return { type: 'unknown', reason: ['no recognized markers'] };
  }
}
