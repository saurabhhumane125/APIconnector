import { createServer } from './server';
import { config } from './config';
import { runMigrations } from '../../database/migrate';
import { closeDatabase } from '../../database/connection';

async function bootstrap() {
  try {
    console.log('[Universal AI API Hub] Initializing system...');
    
    // Ensure SQLite database and migrations are up to date
    runMigrations();

    const app = createServer();

    const server = app.listen(config.port, () => {
      console.log('========================================================');
      console.log(` Universal AI API Hub running in ${config.nodeEnv.toUpperCase()} mode`);
      console.log(` Backend URL:  ${config.apiBaseUrl}`);
      console.log(` Health Check: ${config.apiBaseUrl}/api/health`);
      console.log('========================================================');
    });

    // Graceful shutdown handlers
    const shutdown = (signal: string) => {
      console.log(`\n[Universal AI API Hub] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        closeDatabase();
        console.log('[Universal AI API Hub] Database connection closed. Exiting process.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('[Universal AI API Hub] Fatal startup error:', error);
    process.exit(1);
  }
}

bootstrap();
