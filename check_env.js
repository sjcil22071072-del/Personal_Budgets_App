const { execSync } = require('child_process');

try {
  console.log('--- User Env Variables (registry) ---');
  const userEnv = execSync('reg query HKCU\\Environment', { encoding: 'utf8' });
  console.log(userEnv);
} catch (e) {
  console.error('Failed to get HKCU Env:', e.message);
}

try {
  console.log('--- System Env Variables (registry) ---');
  const sysEnv = execSync('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"', { encoding: 'utf8' });
  console.log(sysEnv);
} catch (e) {
  console.error('Failed to get HKLM Env:', e.message);
}
