// Comprehensive API testing with detailed data output and call examples
// Run with: npm run smoke

const axios = require('axios');

function getBaseUrl() {
	const port = process.env.PORT || 3000;
	return `http://localhost:${port}`;
}

function printSeparator(title) {
	console.log('\n' + '='.repeat(80));
	console.log(`  ${title}`);
	console.log('='.repeat(80));
}

function printApiCall(method, url, { data, params } = {}) {
	console.log(`\n📞 API Call:`);
	console.log(`   Method: ${method.toUpperCase()}`);
	console.log(`   URL: ${url}`);
	if (data) console.log(`   Body: ${JSON.stringify(data, null, 2)}`);
	if (params) console.log(`   Params: ${JSON.stringify(params, null, 2)}`);
}

function printResponse(name, status, data) {
	const statusIcon = status >= 200 && status < 400 ? '✅' : '❌';
	console.log(`\n${statusIcon} ${name} → ${status}`);
	console.log(`📊 Response Data:`);
	console.log(JSON.stringify(data, null, 2));
}

async function testApi(name, method, url, { data, params } = {}) {
	const baseURL = getBaseUrl();
	const client = axios.create({ baseURL, validateStatus: () => true });
	
	printApiCall(method, url, { data, params });
	
	try {
		const res = await client.request({ method, url, data, params });
		printResponse(name, res.status, res.data);
		return { name, status: res.status, data: res.data, success: res.status >= 200 && res.status < 400 };
	} catch (err) {
		const status = err.response?.status || 'ERR';
		printResponse(name, status, { error: err.message });
		return { name, status: status, error: err.message, success: false };
	}
}

function today() {
	return new Date().toISOString().split('T')[0];
}

async function main() {
	printSeparator('🚀 COMPREHENSIVE API TESTING SUITE');
	console.log(`Testing against: ${getBaseUrl()}`);
	
	const results = [];
	let realUserId = 'demoUserId';

	// ============================================================================
	// 1. AUTHENTICATION & BASIC CONNECTIVITY
	// ============================================================================
	printSeparator('1. AUTHENTICATION & BASIC CONNECTIVITY');
	
	results.push(await testApi('TEST AUTH', 'get', '/test-auth'));

	// ============================================================================
	// 2. GET REAL USER ID FOR TESTING
	// ============================================================================
	printSeparator('2. GETTING REAL USER ID');
	
	const clientStatusResult = await testApi('CLIENT USERS STATUS', 'get', '/client/users/status', { 
		params: { up_to_date: today() } 
	});
	
	if (clientStatusResult.success && clientStatusResult.data.users && clientStatusResult.data.users.length > 0) {
		realUserId = clientStatusResult.data.users[0].user_id;
		console.log(`\n✅ Using real user ID: ${realUserId}`);
	} else {
		console.log(`\n⚠️  Using fallback user ID: ${realUserId}`);
	}

	// ============================================================================
	// 3. DATA SOURCE MANAGEMENT
	// ============================================================================
	printSeparator('3. DATA SOURCE MANAGEMENT');
	
	const sampleDataSource = 'Oura';
	const redirectUrl = 'http://localhost:3000/callback/client_uuid/test/user_id/test';
	
	// Get authorization URL
	results.push(await testApi('AUTHORIZER URL', 'get', `/users/${realUserId}/sources/${sampleDataSource}/authorizer`));
	
	// Get authorized sources
	results.push(await testApi('AUTHORIZED SOURCES', 'get', `/users/${realUserId}/sources/authorized`));
	
	// Try to revoke source (will fail if not authorized - this is expected)
	results.push(await testApi('REVOKE SOURCE', 'post', `/users/${realUserId}/sources/revoke`, { 
		data: { data_source: sampleDataSource } 
	}));

	// ============================================================================
	// 4. CLIENT MANAGEMENT
	// ============================================================================
	printSeparator('4. CLIENT MANAGEMENT');
	
	// Client users status
	results.push(await testApi('CLIENT USERS STATUS', 'get', '/client/users/status', { 
		params: { up_to_date: today() } 
	}));
	
	// Resend notifications
	const startDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
	const finishDate = new Date().toISOString().split('T')[0];
	results.push(await testApi('RESEND NOTIFICATIONS', 'post', '/client/notifications/resend', { 
		data: { start: startDate, finish: finishDate } 
	}));

	// ============================================================================
	// 5. WEBHOOK & CALLBACK TESTING
	// ============================================================================
	printSeparator('5. WEBHOOK & CALLBACK TESTING');
	
	// Webhook receiver
	results.push(await testApi('WEBHOOK ROOK', 'post', '/webhooks/rook', { 
		data: { 
			user_id: realUserId, 
			data_structure: 'test_event',
			timestamp: new Date().toISOString()
		} 
	}));
	
	// Callback URL
	results.push(await testApi('CALLBACK URL', 'get', `/callback/client_uuid/test/user_id/${realUserId}`));

	// ============================================================================
	// 6. USER INFORMATION MANAGEMENT (Database-dependent)
	// ============================================================================
	printSeparator('6. USER INFORMATION MANAGEMENT');
	
	const sampleUserInfo = {
		datetime: new Date().toISOString(),
		user_id: realUserId,
		date_of_birth_string: '1990-01-01',
		height_cm_int: 175,
		weight_kg_float: 70.5,
		bmi_float: 23.0,
		sex_string: 'male'
	};
	
	// Create/update user info
	results.push(await testApi('CREATE USER INFO', 'post', '/users/info', { 
		data: sampleUserInfo 
	}));
	
	// Get user info
	results.push(await testApi('GET USER INFO', 'get', `/users/${realUserId}/info`));
	
	// Set timezone
	results.push(await testApi('SET TIMEZONE', 'post', `/users/${realUserId}/timezone`, { 
		data: { 
			time_zone: 'America/New_York', 
			offset: '-05:00' 
		} 
	}));

	// ============================================================================
	// 7. HEALTH DATA ENDPOINTS (Database-dependent)
	// ============================================================================
	printSeparator('7. HEALTH DATA ENDPOINTS');
	
	const testDate = today();
	
	// Physical health summary
	results.push(await testApi('PHYSICAL HEALTH SUMMARY', 'get', '/health/physical/summary', { 
		params: { user_id: realUserId, date: testDate } 
	}));
	
	// Physical health events
	results.push(await testApi('PHYSICAL HEALTH EVENTS', 'get', '/health/physical/events/steps', { 
		params: { user_id: realUserId, date: testDate } 
	}));
	
	// Sleep health summary
	results.push(await testApi('SLEEP HEALTH SUMMARY', 'get', '/health/sleep/summary', { 
		params: { user_id: realUserId, date: testDate } 
	}));
	
	// Body health summary
	results.push(await testApi('BODY HEALTH SUMMARY', 'get', '/health/body/summary', { 
		params: { user_id: realUserId, date: testDate } 
	}));
	
	// Body health events
	results.push(await testApi('BODY HEALTH EVENTS', 'get', '/health/body/events/weight', { 
		params: { user_id: realUserId, date: testDate } 
	}));

	// ============================================================================
	// 8. SUMMARY & API USAGE EXAMPLES
	// ============================================================================
	printSeparator('8. TEST SUMMARY & API USAGE EXAMPLES');
	
	const passed = results.filter(r => r.success).length;
	const total = results.length;
	
	console.log(`\n📊 FINAL RESULTS: ${passed}/${total} APIs working correctly`);
	
	const failures = results.filter(r => !r.success);
	if (failures.length > 0) {
		console.log('\n❌ Failed APIs:');
		failures.forEach(f => console.log(`   - ${f.name}: ${f.status}`));
	}
	
	console.log('\n📚 HOW TO USE THESE APIs:');
	console.log(`
🔐 Authentication:
   GET /test-auth
   - Tests ROOK API connection
   - Returns: { status: "Authenticated", data: {...} }

👤 User Management:
   POST /users/info
   - Body: { datetime, user_id, date_of_birth_string, height_cm_int, weight_kg_float, bmi_float, sex_string }
   - Creates/updates user information
   
   GET /users/{user_id}/info?date=YYYY-MM-DD
   - Gets user information (cached or fresh)
   
   POST /users/{user_id}/timezone
   - Body: { time_zone, offset }
   - Sets user timezone

📊 Data Sources:
   GET /users/{user_id}/sources/{data_source}/authorizer
   - Gets authorization URL for data source
   - Returns: { data_source, authorized, authorization_url }
   
   GET /users/{user_id}/sources/authorized
   - Lists all authorized data sources
   
   POST /users/{user_id}/sources/revoke
   - Body: { data_source }
   - Revokes data source authorization

💊 Health Data:
   GET /health/physical/summary?user_id={id}&date=YYYY-MM-DD
   GET /health/physical/events/{type}?user_id={id}&date=YYYY-MM-DD
   GET /health/sleep/summary?user_id={id}&date=YYYY-MM-DD
   GET /health/body/summary?user_id={id}&date=YYYY-MM-DD
   GET /health/body/events/{type}?user_id={id}&date=YYYY-MM-DD

🔔 Webhooks:
   POST /webhooks/rook
   - Body: { user_id, data_structure, ... }
   - Receives ROOK webhooks

📈 Client Management:
   GET /client/users/status?up_to_date=YYYY-MM-DD
   POST /client/notifications/resend
   - Body: { start: "YYYY-MM-DD", finish: "YYYY-MM-DD" }
	`);

	if (failures.length > 0) {
		process.exitCode = 1;
	}
}

main();


