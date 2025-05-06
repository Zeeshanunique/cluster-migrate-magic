/**
 * Deployment verification script
 * 
 * This script checks if the frontend and backend are properly deployed and accessible.
 * It makes HTTP requests to both the frontend and API endpoints to verify they're working.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

// Configuration
const baseUrl = process.argv[2] || 'http://localhost:8089';
const frontendPath = '/kube-migrate/';
const apiPath = '/health';

console.log('🔍 Kube-Migrate Deployment Verification');
console.log('=======================================');
console.log(`Base URL: ${baseUrl}`);

// Function to make HTTP request and return a promise
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'GET',
      rejectUnauthorized: false, // Allow self-signed certificates
      timeout: 5000 // 5 seconds timeout
    };

    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    
    req.end();
  });
}

// Check backend health endpoint
async function checkBackend() {
  console.log('\n📡 Checking backend API...');
  try {
    const url = `${baseUrl}${apiPath}`;
    console.log(`Making request to: ${url}`);
    
    const response = await makeRequest(url);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('✅ Backend API is accessible');
      console.log(`   Status code: ${response.statusCode}`);
      console.log(`   Response: ${response.data.substring(0, 100)}`);
      return true;
    } else {
      console.log('❌ Backend API returned an error');
      console.log(`   Status code: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to connect to backend API');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Check frontend
async function checkFrontend() {
  console.log('\n🖥️ Checking frontend...');
  try {
    const url = `${baseUrl}${frontendPath}`;
    console.log(`Making request to: ${url}`);
    
    const response = await makeRequest(url);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log('✅ Frontend is accessible');
      console.log(`   Status code: ${response.statusCode}`);
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      
      // Check if response looks like HTML
      if (response.data.includes('<!DOCTYPE html>') || response.data.includes('<html>')) {
        console.log('   Response appears to be HTML content');
        return true;
      } else {
        console.log('⚠️ Response doesn't look like HTML content');
        return false;
      }
    } else {
      console.log('❌ Frontend returned an error');
      console.log(`   Status code: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log('❌ Failed to connect to frontend');
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  let backendSuccess = false;
  let frontendSuccess = false;
  
  try {
    backendSuccess = await checkBackend();
    frontendSuccess = await checkFrontend();
    
    console.log('\n📊 Verification Results');
    console.log('=====================');
    console.log(`Backend API: ${backendSuccess ? '✅ Working' : '❌ Not working'}`);
    console.log(`Frontend: ${frontendSuccess ? '✅ Working' : '❌ Not working'}`);
    
    if (backendSuccess && frontendSuccess) {
      console.log('\n🎉 Deployment verification successful! Both frontend and backend are working correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️ Deployment verification failed. Please check the logs for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification process failed with an error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the main function
main(); 