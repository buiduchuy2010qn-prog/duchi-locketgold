const fs = require('fs');

// Fix vercel.json
let data = fs.readFileSync('vercel.json', 'utf8');
data = data.replace(/https:\/\/huy-locket-api-production\.up\.railway\.app\//g, 'https://api.locket-dio.com/');
data = data.replace(/https:\/\/huy-locket-api-production\.up\.railway\.app/g, 'https://api.locket-dio.com');
data = data.replace(/"source": "\/dio-auth",\s*"destination": "https:\/\/api\.locket-dio\.com\/"/g, '"source": "/dio-auth",\n      "destination": "https://auth.locket-dio.com/"');
data = data.replace(/"source": "\/dio-auth\/:path\*",\s*"destination": "https:\/\/api\.locket-dio\.com\/:path\*"/g, '"source": "/dio-auth/:path*",\n      "destination": "https://auth.locket-dio.com/:path*"');
fs.writeFileSync('vercel.json', data);

// Fix server.mjs
let serverMjs = fs.readFileSync('server.mjs', 'utf8');
serverMjs = serverMjs.replace(
  /"https:\/\/huy-locket-api-production\.up\.railway\.app"/g,
  '"https://api.locket-dio.com"'
);
fs.writeFileSync('server.mjs', serverMjs);
