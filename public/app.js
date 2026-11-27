// Интерактивный градиент заголовка, реагирующий на движение мыши
const brandTitle = document.getElementById("brandTitle");
if (brandTitle) {
    brandTitle.addEventListener("mousemove", (e) => {
        const rect = brandTitle.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        brandTitle.style.setProperty("--x", `${x}px`);
        brandTitle.style.setProperty("--y", `${y}px`);
    });

    brandTitle.addEventListener("mouseleave", () => {
        brandTitle.style.setProperty("--x", "50%");
        brandTitle.style.setProperty("--y", "50%");
    });
}
