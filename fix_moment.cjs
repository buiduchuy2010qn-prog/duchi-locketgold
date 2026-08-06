const fs = require('fs');
const file = 'src/pages/LocketCameraBeta/BottomHomeScreen/Views/SwiperView/MomentViewer.jsx';
let content = fs.readFileSync(file, 'utf8');

// We want to keep the "Updated upstream" part and discard the "Stashed changes" part.
const regex = /<<<<<<< Updated upstream\r?\n([\s\S]*?)\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> Stashed changes\r?\n?/g;
content = content.replace(regex, '$1\n');

fs.writeFileSync(file, content);
console.log('Fixed MomentViewer.jsx conflicts');
