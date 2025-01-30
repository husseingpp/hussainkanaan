// Select the menu toggle button and the menu items container
const menuToggle = document.querySelector('.menu-toggle');
const menuItems = document.querySelector('.menu-items');

// Toggle the dropdown menu visibility on button click
menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    menuItems.style.display = menuItems.style.display === 'block' ? 'none' : 'block';
});

// Ensure the menu adapts correctly when resizing the window
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        // Show menu items for larger screens
        menuItems.style.display = 'block';
    } else if (!menuToggle.classList.contains('active')) {
        // Hide menu items for smaller screens if menu is not active
        menuItems.style.display = 'none';
    }
});



function myFunction(x) {
    x.classList.toggle("change");
  }
// Mobile menu toggle
document.querySelector('.menu-toggle').addEventListener('click', function() {
    const menuItems = document.querySelector('.menu-items');
    menuItems.style.display = menuItems.style.display === 'block' ? 'none' : 'block';
});

// Image slider animation
let currentSlide = 0;
const slider = document.querySelector('.slider-container');
const slides = document.querySelectorAll('.slider-container img');
const totalSlides = slides.length;

function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    slider.style.transform = `translateX(-${currentSlide * 100}%)`;
}

setInterval(nextSlide, 3000); // Change slide every 3 seconds