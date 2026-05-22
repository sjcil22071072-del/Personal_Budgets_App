const fs = require('fs');
const path = require('path');

function search(dir, depth = 0) {
  if (depth > 3) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      let stat;
      try { stat = fs.statSync(full); } catch (e) { continue; }
      if (stat.isDirectory()) {
        if (file === 'node_modules' || file === '.next' || file === '.git') continue;
        search(full, depth + 1);
      } else {
        if (file.startsWith('.env') || file.includes('env')) {
          console.log('Found env file:', full);
          try {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('SUPABASE_')) {
              console.log('Contains SUPABASE_! path:', full);
            }
          } catch(e) {}
        }
      }
    }
  } catch (e) {}
}

search('C:\\Users\\서인\\Desktop');
search('C:\\Users\\서인');
