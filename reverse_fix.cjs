const fs = require('fs');

let data = fs.readFileSync('vercel.json', 'utf8');
data = data.replace(/https:\/\/api\.locket-dio\.com\//g, 'https://huy-locket-api-production.up.railway.app/');
data = data.replace(/https:\/\/api\.locket-dio\.com/g, 'https://huy-locket-api-production.up.railway.app');
data = data.replace(/"source": "\/dio-auth",\s*"destination": "https:\/\/auth\.locket-dio\.com\/"/g, '"source": "/dio-auth",\n      "destination": "https://huy-locket-api-production.up.railway.app/"');
data = data.replace(/"source": "\/dio-auth\/:path\*",\s*"destination": "https:\/\/auth\.locket-dio\.com\/:path\*"/g, '"source": "/dio-auth/:path*",\n      "destination": "https://huy-locket-api-production.up.railway.app/:path*"');
fs.writeFileSync('vercel.json', data);

let serverMjs = fs.readFileSync('server.mjs', 'utf8');
serverMjs = serverMjs.replace(
  /"https:\/\/api\.locket-dio\.com"/g,
  '"https://huy-locket-api-production.up.railway.app"'
);
fs.writeFileSync('server.mjs', serverMjs);
console.log('Restored Railway API endpoint.');
