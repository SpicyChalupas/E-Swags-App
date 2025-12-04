import { seedDemoUsers } from './db.js';

async function startServer() {
  console.log('Seeding demo users...');
  await seedDemoUsers(); // <-- Ensure this is called before app.listen
  app.listen(3000);
}

startServer();