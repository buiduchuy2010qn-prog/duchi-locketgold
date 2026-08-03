const fs = require('fs');
const lines = fs.readFileSync('api/src/routes/adminRoutes.js', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('router.post("/broadcast"')) {
    console.log(i);
  }
}
