import { Server } from 'socket.io';
import http from 'http';

export class LogsGateway {
  io: Server;

  constructor(server: http.Server) {
    this.io = new Server(server, { cors: { origin: '*' } });
  }

  attachLogs(
    runId: string,
    register: (listener: (msg: string) => void) => void
  ) {
    // register listener
    register((message: string) => {
      this.io.to(runId).emit('log', message);
    });
  }
}
