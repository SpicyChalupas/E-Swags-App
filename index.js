import { seedDemoUsers } from './db.js';

async function startServer() {
  console.log('Seeding demo users...');
  try {
    await seedDemoUsers(); // <-- Ensure this is called before app.listen
  } catch (err) {
    console.error('Failed to seed demo users:', err);
    process.exit(1);
  }
  app.listen(process.env.PORT || 3000);
    if (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
    console.log('Server is listening on port 3000');
  };


startServer();