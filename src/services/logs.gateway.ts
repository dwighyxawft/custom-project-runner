// src/services/logs.gateway.ts
import { Server } from 'socket.io';
import http from 'http';

export class LogsGateway {
  io: Server;

  constructor(server: http.Server) {
    // create io server bound to provided http.Server
    this.io = new Server(server, {
      cors: { origin: '*' },
      // You can add namespaces or adapter config here
    });

    // simple connection handler
    this.io.on('connection', (socket) => {
      socket.on('join', (data: { runId: string }) => {
        if (data && data.runId) {
          socket.join(data.runId);
        }
      });
    });
  }

  // helper to emit logs programmatically
  emitBuildLog(runId: string, msg: string) {
    this.io.to(runId).emit('build_log', msg);
  }

  emitRunLog(runId: string, msg: string) {
    this.io.to(runId).emit('log', msg);
  }
}
