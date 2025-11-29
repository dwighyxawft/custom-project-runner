// src/resources/runner/runner.types.ts
export type RunStatus = 'starting' | 'running' | 'completed' | 'failed' | 'stopped';

export interface RunRecord {
  id: string;
  workspacePath: string;
  containerId?: string;
  hostPort?: number;
  containerPort?: number;
  status: RunStatus;
  httpUrl?: string | null;
  logsPath: string;
  createdAt: Date;
  meta?: any;
}

export class RunResponseDto {
  runId: string;
  logsUrl: string;
  httpUrl?: string | null;
}
