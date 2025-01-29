<?php
header('Content-Type: application/json');

// Connect to SQLite database
$db = new SQLite3('database.db');

// Get input data
$customer_number = $_GET['customer_number'];

// Query the database
$stmt = $db->prepare('SELECT * FROM customers WHERE customer_number = :customer_number');
$stmt->bindValue(':customer_number', $customer_number, SQLITE3_TEXT);
$result = $stmt->execute();

$customer = $result->fetchArray(SQLITE3_ASSOC);

if ($customer) {
    // Decode JSON fields
    $customer['anydisk_numbers'] = json_decode($customer['anydisk_numbers'], true);
    $customer['ips'] = json_decode($customer['ips'], true);
    echo json_encode(['status' => 'success', 'data' => $customer]);
} else {
    echo json_encode(['status' => 'error', 'message' => 'Customer not found']);
}

$db->close();
?>