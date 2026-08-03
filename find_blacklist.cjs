const fs = require('fs');
const lines = fs.readFileSync('src/pages/Public/AdminUsers/index.jsx', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('advancedSubTab === "blacklist"')) {
    console.log(i);
  }
}
