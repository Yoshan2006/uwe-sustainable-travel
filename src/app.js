document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from reloading

    const emailInput = document.getElementById('email').value.trim().toLowerCase();
    const passwordInput = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    // Check if the email ends with 'uwe.ac.uk'
    const isValidEmail = emailInput.includes('@') && emailInput.endsWith('uwe.ac.uk');
    
    // Check if a password is entered
    const isPasswordEntered = passwordInput.length > 2;

    if (isValidEmail && isPasswordEntered) {
        // Hide error message if both are valid
        errorMessage.style.display = 'none';
        
        // Show success alert
        alert("Authentication Successful! Welcome to UWE Smart Travel Hub.");
        
        // Redirect to the dashboard
        window.location.href = "dashboard.html";
        
    } else if (!isValidEmail) {
        // If email is invalid
        errorMessage.textContent = "Access Denied: Please use a valid UWE email address (e.g. @uwe.ac.uk or @live.uwe.ac.uk).";
        errorMessage.style.display = 'block';
    } else {
        // If password is not entered or too short
        errorMessage.textContent = "Please enter your password.";
        errorMessage.style.display = 'block';
    }
});