// script.js
const albums = ["josiah", "untitled"];
const imageExtensions = ["jpg", "jpeg", "png"];
const gallery = document.getElementById("gallery");
const menu = document.getElementById("albumMenu");

albums.forEach(album => {
  const albumItem = document.createElement("div");
  albumItem.className = "album-item";
  albumItem.textContent = album;
  albumItem.onclick = () => {
    const el = document.getElementById(`album-${album}`);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };
  menu.appendChild(albumItem);

  const folder = `albums/${album}`;
  for (let i = 1; i <= 99; i++) {
    for (const ext of imageExtensions) {
      const filename = `${i}.${ext}`;
      const img = new Image();
      img.src = `${folder}/${filename}`;
      img.onload = () => {
        const slide = document.createElement("div");
        slide.className = "slide";
        if (i === 1) slide.id = `album-${album}`;
        img.alt = `${album} ${i}`;
        slide.appendChild(img);
        gallery.appendChild(slide);
      };
      img.onerror = () => {};
    }
  }
});
