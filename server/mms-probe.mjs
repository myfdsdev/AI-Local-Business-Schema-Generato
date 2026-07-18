const t = setTimeout(() => { console.error('TIMEOUT: still working after 60s'); process.exit(3); }, 60000);
try {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  console.log('imported, creating server...');
  const srv = await MongoMemoryServer.create();
  console.log('STARTED URI:', srv.getUri());
  await srv.stop();
  console.log('STOP OK');
  clearTimeout(t);
  process.exit(0);
} catch (e) {
  console.error('ERROR:', e.message, e.stack);
  clearTimeout(t);
  process.exit(1);
}
