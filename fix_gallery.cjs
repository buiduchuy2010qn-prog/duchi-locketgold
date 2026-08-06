const fs = require('fs');
const file = 'src/pages/LocketCameraBeta/BottomHomeScreen/Views/GridMoments/MomentsGallery.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<<<<<<< Updated upstream\r?\n([\s\S]*?)\r?\n=======\r?\n[\s\S]*?\r?\n>>>>>>> Stashed changes\r?\n?/g;
content = content.replace(regex, '$1\n');

fs.writeFileSync(file, content);
console.log('Fixed MomentsGallery.jsx conflicts');
