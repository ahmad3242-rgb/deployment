// server.js - Complete Node.js Backend for ROOK API with Prisma and Neon Postgres

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to get base URL
function getBaseUrl() {
  return `http://localhost:${PORT}`;
}

app.use(bodyParser.json());

// Axios for ROOK API (sandbox demo creds)
const rookApi = axios.create({
  baseURL: process.env.ROOK_BASE_URL || 'https://api.rook-connect.review',
  headers: { 'Content-Type': 'application/json' },
  auth: {
    username: process.env.CLIENT_UUID || 'demoClientUUID',
    password: process.env.CLIENT_SECRET || 'demoClientSecret',
  },
});

// Helper for 204 responses
function handleNoContent(error, res) {
  if (error.response?.status === 204) {
    res.status(204).send();
  } else {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Debug environment variables
app.get('/debug-env', (req, res) => {
  res.json({
    message: 'Environment variables check',
    credentials: {
      CLIENT_UUID: process.env.CLIENT_UUID ? `${process.env.CLIENT_UUID.substring(0, 8)}...` : 'NOT SET',
      CLIENT_SECRET: process.env.CLIENT_SECRET ? `${process.env.CLIENT_SECRET.substring(0, 8)}...` : 'NOT SET',
      ROOK_BASE_URL: process.env.ROOK_BASE_URL || 'NOT SET'
    },
    lengths: {
      CLIENT_UUID_length: process.env.CLIENT_UUID?.length || 0,
      CLIENT_SECRET_length: process.env.CLIENT_SECRET?.length || 0
    },
    hasDotEnv: !!process.env.CLIENT_UUID,
    workingDirectory: process.cwd()
  });
});

// Comprehensive API Dashboard data endpoint
app.get('/api-dashboard-data', async (req, res) => {
  try {
    console.log('🚀 Starting API dashboard data collection...');
    const results = [];
    const baseURL = getBaseUrl();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
    
    console.log('📅 Date range:', { today, yesterday });
    console.log('🌐 Base URL:', baseURL);
    
    // Get real user ID and user data
    let realUserId = 'demoUserId';
    let userData = null;
    let clientStats = null;
    
    try {
      console.log('👤 Fetching user data...');
      const clientStatusRes = await rookApi.get('/api/v1/client/users/status', { 
        params: { up_to_date: today } 
      });
      console.log('✅ User data fetched successfully');
      if (clientStatusRes.data.users && clientStatusRes.data.users.length > 0) {
        realUserId = clientStatusRes.data.users[0].user_id;
        clientStats = clientStatusRes.data;
        console.log('👤 Real user ID:', realUserId);
      }
    } catch (err) {
      console.log('⚠️ Could not fetch real user ID, using demoUserId:', err.message);
    }

    // Test all APIs and collect data
    const testApi = async (name, method, url, { data, params, category = 'general' } = {}) => {
      try {
        const response = await rookApi.request({ method, url, data, params });
        return {
          name,
          method,
          url,
          category,
          requestData: data,
          requestParams: params,
          status: response.status,
          success: response.status >= 200 && response.status < 400,
          responseData: response.data,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        return {
          name,
          method,
          url,
          category,
          requestData: data,
          requestParams: params,
          status: error.response?.status || 'ERR',
          success: false,
          responseData: error.response?.data || { error: error.message },
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };

    // 1. Authentication & Basic APIs
    results.push(await testApi('TEST AUTH', 'get', '/api/v1/client/users/status', { 
      params: { up_to_date: today },
      category: 'auth'
    }));
    
    results.push(await testApi('AUTHORIZER URL', 'get', `/api/v1/user_id/${realUserId}/data_source/Oura/authorizer`, {
      category: 'data_sources'
    }));
    
    results.push(await testApi('AUTHORIZED SOURCES', 'get', `/api/v2/user_id/${realUserId}/data_sources/authorized`, {
      category: 'data_sources'
    }));
    
    results.push(await testApi('REVOKE SOURCE', 'post', `/api/v1/user_id/${realUserId}/data_sources/revoke_auth`, { 
      data: { data_source: 'Oura' },
      category: 'data_sources'
    }));
    
    results.push(await testApi('CLIENT USERS STATUS', 'get', '/api/v1/client/users/status', { 
      params: { up_to_date: today },
      category: 'client'
    }));
    
    const startDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
    const finishDate = new Date().toISOString().split('T')[0];
    results.push(await testApi('RESEND NOTIFICATIONS', 'post', '/api/v2/resend_rejected_notifications', { 
      data: { start: startDate, finish: finishDate },
      category: 'client'
    }));

    // 2. User Information APIs
    results.push(await testApi('GET USER INFO', 'get', `/v2/processed_data/user/info`, {
      params: { user_id: realUserId, date: today },
      category: 'user'
    }));
    
    results.push(await testApi('SET TIMEZONE', 'post', `/api/v1/user_id/${realUserId}/time_zone`, {
      data: { time_zone: 'America/New_York', offset: '-05:00' },
      category: 'user'
    }));

    // 3. Health Data APIs - Physical Health
    results.push(await testApi('PHYSICAL HEALTH SUMMARY', 'get', '/v2/processed_data/physical_health/summary', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));
    
    results.push(await testApi('PHYSICAL HEALTH EVENTS - STEPS', 'get', '/v2/processed_data/physical_health/events/steps', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));
    
    results.push(await testApi('PHYSICAL HEALTH EVENTS - HEART RATE', 'get', '/v2/processed_data/physical_health/events/heart_rate', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));
    
    results.push(await testApi('PHYSICAL HEALTH EVENTS - WORKOUTS', 'get', '/v2/processed_data/physical_health/events/workouts', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));

    // 4. Health Data APIs - Sleep Health
    results.push(await testApi('SLEEP HEALTH SUMMARY', 'get', '/v2/processed_data/sleep_health/summary', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));
    
    results.push(await testApi('SLEEP HEALTH EVENTS', 'get', '/v2/processed_data/sleep_health/events/sleep', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));

    // 5. Health Data APIs - Body Health
    results.push(await testApi('BODY HEALTH SUMMARY', 'get', '/v2/processed_data/body_health/summary', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));
    
    results.push(await testApi('BODY HEALTH EVENTS - WEIGHT', 'get', '/v2/processed_data/body_health/events/weight', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));
    
    results.push(await testApi('BODY HEALTH EVENTS - BODY FAT', 'get', '/v2/processed_data/body_health/events/body_fat', {
      params: { user_id: realUserId, date: today },
      category: 'health'
    }));

    // 6. Historical Data (yesterday)
    results.push(await testApi('YESTERDAY PHYSICAL SUMMARY', 'get', '/v2/processed_data/physical_health/summary', {
      params: { user_id: realUserId, date: yesterday },
      category: 'historical'
    }));
    
    results.push(await testApi('YESTERDAY SLEEP SUMMARY', 'get', '/v2/processed_data/sleep_health/summary', {
      params: { user_id: realUserId, date: yesterday },
      category: 'historical'
    }));

    // Categorize results
    const categorizedResults = {
      auth: results.filter(r => r.category === 'auth'),
      data_sources: results.filter(r => r.category === 'data_sources'),
      client: results.filter(r => r.category === 'client'),
      user: results.filter(r => r.category === 'user'),
      health: results.filter(r => r.category === 'health'),
      historical: results.filter(r => r.category === 'historical')
    };

    // Calculate category statistics
    const categoryStats = {};
    Object.keys(categorizedResults).forEach(category => {
      const categoryResults = categorizedResults[category];
      categoryStats[category] = {
        total: categoryResults.length,
        passed: categoryResults.filter(r => r.success).length,
        failed: categoryResults.filter(r => !r.success).length,
        successRate: Math.round((categoryResults.filter(r => r.success).length / categoryResults.length) * 100) || 0
      };
    });

    console.log('📊 Preparing response...');
    console.log('📈 Results count:', results.length);
    console.log('✅ Successful tests:', results.filter(r => r.success).length);
    console.log('❌ Failed tests:', results.filter(r => !r.success).length);
    
    const response = {
      timestamp: new Date().toISOString(),
      baseURL: baseURL,
      realUserId: realUserId,
      userData: userData,
      clientStats: clientStats,
      totalTests: results.length,
      passedTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      successRate: Math.round((results.filter(r => r.success).length / results.length) * 100),
      results: results,
      categorizedResults: categorizedResults,
      categoryStats: categoryStats
    };
    
    console.log('✅ Response prepared successfully');
    res.json(response);
  } catch (error) {
    console.error('❌ Error in API dashboard data endpoint:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Ping endpoint for health checking
app.get('/ping', (req, res) => {
  res.json({
    status: 'pong',
    message: 'Server is alive and running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    server: {
      name: 'ROOK Health API Backend',
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform
    },
    health: {
      status: 'healthy',
      memory: process.memoryUsage(),
      pid: process.pid
    }
  });
});

// Simple test endpoint for debugging
app.get('/test-simple', (req, res) => {
  res.json({
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    status: 'success',
    data: {
      test: 'This is a simple test endpoint',
      server: 'ROOK API Backend',
      version: '1.0.0'
    }
  });
});

// Serve HTML dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// Serve smoke test results
app.get('/smoke', (req, res) => {
  res.sendFile(__dirname + '/smoke.js');
});

// Run smoke tests and return JSON results
app.get('/run-smoke-tests', async (req, res) => {
  try {
    const { spawn } = require('child_process');
    const smokeTest = spawn('node', ['smoke.js'], { cwd: __dirname });
    
    let output = '';
    let errorOutput = '';
    
    smokeTest.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    smokeTest.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    smokeTest.on('close', (code) => {
      res.json({
        success: code === 0,
        exitCode: code,
        output: output,
        error: errorOutput,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test server functionality
app.get('/debug-server', (req, res) => {
  res.json({
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      hasClientUuid: !!process.env.CLIENT_UUID,
      hasClientSecret: !!process.env.CLIENT_SECRET
    }
  });
});

// Test auth
app.get('/test-auth', async (req, res) => {
  try {
    console.log('Testing ROOK API authentication...');
    
    // Check if credentials are properly set
    const clientUuid = process.env.CLIENT_UUID;
    const clientSecret = process.env.CLIENT_SECRET;
    
    if (!clientUuid || !clientSecret) {
      return res.status(400).json({
        error: 'Missing ROOK API credentials',
        message: 'Please set CLIENT_UUID and CLIENT_SECRET in your .env file',
        currentCredentials: {
          CLIENT_UUID: clientUuid ? '***set***' : 'NOT SET',
          CLIENT_SECRET: clientSecret ? '***set***' : 'NOT SET'
        },
        instructions: [
          '1. Create a .env file in your backend directory',
          '2. Add CLIENT_UUID=your_actual_uuid',
          '3. Add CLIENT_SECRET=your_actual_secret',
          '4. Restart your server'
        ]
      });
    }
    
    console.log('Using credentials:', {
      username: clientUuid,
      password: '***hidden***',
      usernameLength: clientUuid?.length || 0,
      passwordLength: clientSecret?.length || 0
    });
    console.log('Base URL:', process.env.ROOK_BASE_URL || 'https://api.rook-connect.review');
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      hasDotEnv: !!process.env.CLIENT_UUID,
      clientUuidPrefix: clientUuid?.substring(0, 8) + '...',
      clientSecretPrefix: clientSecret?.substring(0, 8) + '...'
    });
    
    // Try a simpler endpoint first - just test basic auth
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    const response = await rookApi.get(`/api/v1/client/users/status?up_to_date=${today}`);
    console.log('ROOK API response status:', response.status);
    res.json({ 
      status: 'Authenticated', 
      message: 'Successfully connected to ROOK API',
      data: response.data 
    });
  } catch (error) {
    console.error('ROOK API Error Details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      }
    });
    
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      error: 'Auth failed: ' + error.message,
      details: error.response?.data || 'No additional details available',
      status: statusCode,
      troubleshooting: {
        message: 'This could be due to invalid credentials, network issues, or ROOK API server problems',
        suggestions: [
          'Check if CLIENT_UUID and CLIENT_SECRET environment variables are set correctly',
          'Verify the ROOK API base URL is correct',
          'Check if the ROOK API service is operational'
        ]
      }
    });
  }
});

// --- User Management Routes ---

const userSchema = Joi.object({
  datetime: Joi.string().isoDate().required(),
  user_id: Joi.string().pattern(/^[a-zA-Z0-9-]{1,50}$/).required(),
  date_of_birth_string: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  height_cm_int: Joi.number().integer(),
  weight_kg_float: Joi.number(),
  bmi_float: Joi.number(),
  sex_string: Joi.string().valid('female', 'male'),
});
app.post('/users/info', (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  if (error) return res.status(422).json({ error: error.details[0].message });
  next();
}, async (req, res) => {
  try {
    const response = await rookApi.post('/api/v2/user-information', req.body);
    await prisma.user.upsert({
      where: { user_id: req.body.user_id },
      update: {
        date_of_birth: req.body.date_of_birth_string,
        height_cm: req.body.height_cm_int,
        weight_kg: req.body.weight_kg_float,
        bmi: req.body.bmi_float,
        sex: req.body.sex_string,
      },
      create: {
        user_id: req.body.user_id,
        date_of_birth: req.body.date_of_birth_string,
        height_cm: req.body.height_cm_int,
        weight_kg: req.body.weight_kg_float,
        bmi: req.body.bmi_float,
        sex: req.body.sex_string,
      },
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.post('/users/:user_id/timezone', async (req, res) => {
  const { user_id } = req.params;
  const { time_zone, offset } = req.body;
  try {
    const response = await rookApi.post(`/api/v1/user_id/${user_id}/time_zone`, { time_zone, offset });
    await prisma.user.upsert({
      where: { user_id },
      update: { time_zone, offset },
      create: { user_id, time_zone, offset },
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/users/:user_id/info', async (req, res) => {
  const { user_id } = req.params;
  const { date } = req.query;
  try {
    const cached = await prisma.user.findUnique({ where: { user_id } });
    if (cached && !date) return res.json({ data_structure: 'user_info', user_information: cached });
    const response = await rookApi.get(`/v2/processed_data/user/info?user_id=${user_id}&date=${date}`);
    if (response.data.user_information) {
      await prisma.user.upsert({
        where: { user_id },
        update: { date_of_birth: response.data.user_information.user_demographics?.date_of_birth_string },
        create: { user_id, date_of_birth: response.data.user_information.user_demographics?.date_of_birth_string },
      });
    }
    res.status(response.status).json(response.data);
  } catch (error) {
    handleNoContent(error, res);
  }
});

// --- Data Source Authorization Routes ---

app.get('/users/:user_id/sources/:data_source/authorizer', async (req, res) => {
  const { user_id, data_source } = req.params;
  const { redirect_url } = req.query;
  let url = `/api/v1/user_id/${user_id}/data_source/${data_source}/authorizer`;
  if (redirect_url) url += `?redirect_url=${encodeURIComponent(redirect_url)}`;
  try {
    const response = await rookApi.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/users/:user_id/sources/authorized', async (req, res) => {
  const { user_id } = req.params;
  try {
    const response = await rookApi.get(`/api/v2/user_id/${user_id}/data_sources/authorized`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.post('/users/:user_id/sources/revoke', async (req, res) => {
  const { user_id } = req.params;
  const { data_source } = req.body;
  try {
    const response = await rookApi.post(`/api/v1/user_id/${user_id}/data_sources/revoke_auth`, { data_source });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// --- Health Data Routes ---

app.get('/health/physical/summary', async (req, res) => {
  const { user_id, date } = req.query;
  try {
    const cached = await prisma.healthData.findFirst({ where: { user_id, data_type: 'physical_summary', date } });
    if (cached) return res.json(cached.data);
    const response = await rookApi.get(`/v2/processed_data/physical_health/summary?user_id=${user_id}&date=${date}`);
    if (response.data) {
      await prisma.healthData.create({
        data: { user_id, data_type: 'physical_summary', date, data: response.data, fetched_at: new Date() },
      });
    }
    res.json(response.data);
  } catch (error) {
    handleNoContent(error, res);
  }
});

app.get('/health/physical/events/:type', async (req, res) => {
  const { type } = req.params;
  const { user_id, date } = req.query;
  try {
    const cached = await prisma.healthData.findFirst({ where: { user_id, data_type: `physical_${type}`, date } });
    if (cached) return res.json(cached.data);
    const response = await rookApi.get(`/v2/processed_data/physical_health/events/${type}?user_id=${user_id}&date=${date}`);
    if (response.data) {
      await prisma.healthData.create({
        data: { user_id, data_type: `physical_${type}`, date, data: response.data, fetched_at: new Date() },
      });
    }
    res.json(response.data);
  } catch (error) {
    handleNoContent(error, res);
  }
});

app.get('/health/sleep/summary', async (req, res) => {
  const { user_id, date } = req.query;
  try {
    const cached = await prisma.healthData.findFirst({ where: { user_id, data_type: 'sleep_summary', date } });
    if (cached) return res.json(cached.data);
    const response = await rookApi.get(`/v2/processed_data/sleep_health/summary?user_id=${user_id}&date=${date}`);
    if (response.data) {
      await prisma.healthData.create({
        data: { user_id, data_type: 'sleep_summary', date, data: response.data, fetched_at: new Date() },
      });
    }
    res.json(response.data);
  } catch (error) {
    handleNoContent(error, res);
  }
});

app.get('/health/body/summary', async (req, res) => {
  const { user_id, date } = req.query;
  try {
    const cached = await prisma.healthData.findFirst({ where: { user_id, data_type: 'body_summary', date } });
    if (cached) return res.json(cached.data);
    const response = await rookApi.get(`/v2/processed_data/body_health/summary?user_id=${user_id}&date=${date}`);
    if (response.data) {
      await prisma.healthData.create({
        data: { user_id, data_type: 'body_summary', date, data: response.data, fetched_at: new Date() },
      });
    }
    res.json(response.data);
  } catch (error) {
    handleNoContent(error, res);
  }
});

app.get('/health/body/events/:type', async (req, res) => {
  const { type } = req.params;
  const { user_id, date } = req.query;
  try {
    const cached = await prisma.healthData.findFirst({ where: { user_id, data_type: `body_${type}`, date } });
    if (cached) return res.json(cached.data);
    const response = await rookApi.get(`/v2/processed_data/body_health/events/${type}?user_id=${user_id}&date=${date}`);
    if (response.data) {
      await prisma.healthData.create({
        data: { user_id, data_type: `body_${type}`, date, data: response.data, fetched_at: new Date() },
      });
    }
    res.json(response.data);
  } catch (error) {
    handleNoContent(error, res);
  }
});

// --- Client-Level Routes ---

app.post('/client/notifications/resend', async (req, res) => {
  const { start, finish } = req.body;
  try {
    const response = await rookApi.post('/api/v2/resend_rejected_notifications', { start, finish });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/client/users/status', async (req, res) => {
  const { up_to_date, page } = req.query;
  let url = `/api/v1/client/users/status?up_to_date=${up_to_date}`;
  if (page) url += `&page=${page}`;
  try {
    const response = await rookApi.get(url);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// --- Webhook and Callback ---

app.post('/webhooks/rook', (req, res) => {
  const { user_id, data_structure } = req.body;
  console.log(`Webhook received: New ${data_structure} for user ${user_id}`);
  res.status(200).json({ received: true });
});

app.get('/callback/client_uuid/:uuid/user_id/:user_id', (req, res) => {
  const { user_id } = req.params;
  console.log(`Authorization success for user ${user_id}`);
  res.redirect('/dashboard?status=authorized');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}. Using demo credentials for sandbox.`);
});