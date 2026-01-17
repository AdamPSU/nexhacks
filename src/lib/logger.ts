import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
});

// Create child loggers for different modules
export const ocrLogger = logger.child({ module: 'ocr' });
export const helpCheckLogger = logger.child({ module: 'help-check' });
export const solutionLogger = logger.child({ module: 'solution-generation' });
export const voiceLogger = logger.child({ module: 'voice' });
