// Test if DOM elements are found correctly
console.log('Testing DOM elements...');
console.log('loginScreen:', document.getElementById('loginScreen'));
console.log('dashboardScreen:', document.getElementById('dashboardScreen'));
console.log('loginForm:', document.getElementById('loginForm'));
console.log('loginError:', document.getElementById('loginError'));
console.log('logoutBtn:', document.getElementById('logoutBtn'));
console.log('navItems:', document.querySelectorAll('.nav-item'));
console.log('views:', document.querySelectorAll('.view'));

// Test screen switching
function testScreenSwitch() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    console.log('Before switch - loginScreen classes:', loginScreen.className);
    console.log('Before switch - dashboardScreen classes:', dashboardScreen.className);
    
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');
    
    console.log('After switch - loginScreen classes:', loginScreen.className);
    console.log('After switch - dashboardScreen classes:', dashboardScreen.className);
}

// Run test after page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(testScreenSwitch, 1000);
});
