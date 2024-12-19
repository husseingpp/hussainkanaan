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