require('dotenv').config();

const { spawn } = require('child_process');

const children = [
  spawn('node', ['server.js'], { stdio: 'inherit' }),
  spawn('node', ['worker.js'], { stdio: 'inherit' }),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  setTimeout(() => process.exit(code), 1000).unref();
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown) {
      shutdown(code || 1);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
