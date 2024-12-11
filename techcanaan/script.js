// Smooth scroll for navigation links
document.querySelectorAll('nav a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        target.scrollIntoView({ behavior: 'smooth' });
    });
});




menuToggle.addEventListener('click', () => {
    const isVisible = menuItems.style.display === 'block';
    menuItems.style.display = isVisible ? 'none' : 'block';
});

// Close the menu when clicking outside
document.addEventListener('click', (e) => {
    if (!menuToggle.contains(e.target) && !menuItems.contains(e.target)) {
        menuItems.style.display = 'none';
    }
});



const menuToggle = document.querySelector('.menu-toggle');
const menuItems = document.querySelector('.menu-items');

menuToggle.addEventListener('click', () => {
    menuItems.classList.toggle('show');
});
