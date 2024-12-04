<!-- api_key = AIzaSyB1Q6KIAz4vHl5r1l07aA_76wpPFwnWsbE -->


<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $name = htmlspecialchars($_POST['name']);
    $email = htmlspecialchars($_POST['email']);
    $message = htmlspecialchars($_POST['message']);
    
    $to = "your_email@example.com"; // Replace with your email
    $subject = "New Contact Form Submission";
    $body = "Name: $name\nEmail: $email\n\nMessage:\n$message";
    $headers = "From: $email";

    if (mail($to, $subject, $body, $headers)) {
        echo "Thank you for reaching out! We'll get back to you soon.";
    } else {
        echo "Sorry, there was an error. Please try again later.";
    }
}
?>
