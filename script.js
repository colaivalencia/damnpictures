// gallery.js must be included BEFORE this script in index.html
// It defines `allItems = [...]`

const gallery = document.getElementById('gallery');
const albumMenu = document.getElementById('albumMenu');

// Randomize and group subfoldered items
const shuffled = shuffleAndGroup(allItems);

shuffled.forEach((item, index) => {
  const slide = document.createElement('div');
  slide.className = 'slide';
  slide.id = `slide-${index}`;

  const img = document.createElement('img');
  img.src = encodeURI(item.src);
  img.alt = item.name || '';
  slide.appendChild(img);

  gallery.appendChild(slide);

  const albumItem = document.createElement('div');
  albumItem.className = 'album-item';
  albumItem.textContent = item.name;
  albumItem.onclick = () => {
    document.getElementById(`slide-${index}`).scrollIntoView({ behavior: 'smooth' });
  };
  albumMenu.appendChild(albumItem);
});

function shuffleAndGroup(items) {
  const standalone = items.filter(i => !i.group);
  const groupedMap = {};
  items.forEach(i => {
    if (i.group) {
      groupedMap[i.group] = groupedMap[i.group] || [];
      groupedMap[i.group].push(i);
    }
  });
  const grouped = Object.values(groupedMap);
  const combined = [...standalone, ...grouped];

  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.flat();
}
