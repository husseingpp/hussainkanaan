document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
  
    fetch('login.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === 'success') {
          window.location.href = 'dashboard.html'; // Redirect to dashboard
        } else {
          alert(data.message);
        }
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  });
  document.getElementById('search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const customerNumber = document.getElementById('customer-number').value;
  
    fetch(`get_customer.php?customer_number=${customerNumber}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.status === 'success') {
          displayCustomerDetails(data.data);
        } else {
          alert(data.message);
        }
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  });
  
  function displayCustomerDetails(details) {
    const customerDetailsDiv = document.getElementById('customer-details');
    customerDetailsDiv.innerHTML = `
      <h2>Customer Details</h2>
      <p><strong>Name:</strong> ${details.name}</p>
      <p><strong>Anydisk Numbers:</strong> ${details.anydisk_numbers.join(', ')}</p>
      <p><strong>IPs:</strong> ${details.ips.join(', ')}</p>
      <p><strong>Database Name:</strong> ${details.database_name}</p>
      <p><strong>Omega ID:</strong> ${details.omega_id}</p>
      <p><strong>Anydisk Password:</strong> ${details.anydisk_password}</p>
      <p><strong>Omega Cloud:</strong> ${details.omega_cloud_email} / ${details.omega_cloud_password}</p>
      <p><strong>Payment Status:</strong> ${details.payment_status}</p>
    `;
  }