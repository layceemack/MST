#!/usr/bin/env node

/**
 * Server Health Check Script
 * Run this to verify your email server is configured correctly
 */

const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkNodeVersion() {
    log('\n📦 Checking Node.js version...', 'blue');
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    
    if (majorVersion >= 16) {
        log(`✓ Node.js ${version} installed (minimum: 16.x)`, 'green');
        return true;
    } else {
        log(`✗ Node.js ${version} is too old. Please install Node.js 16 or higher.`, 'red');
        return false;
    }
}

function checkDependencies() {
    log('\n📚 Checking dependencies...', 'blue');
    
    try {
        const packageJson = require('./package.json');
        const dependencies = Object.keys(packageJson.dependencies || {});
        
        log('✓ package.json found', 'green');
        log(`  Dependencies: ${dependencies.length} packages`, 'cyan');
        
        // Check if node_modules exists
        const fs = require('fs');
        if (fs.existsSync('./node_modules')) {
            log('✓ node_modules directory exists', 'green');
        } else {
            log('✗ node_modules directory not found. Run: npm install', 'yellow');
            return false;
        }
        
        return true;
    } catch (error) {
        log('✗ package.json not found', 'red');
        return false;
    }
}

function checkEnvFile() {
    log('\n🔐 Checking .env file...', 'blue');
    
    const fs = require('fs');
    
    if (!fs.existsSync('./.env')) {
        log('✗ .env file not found', 'red');
        log('  Copy .env.example to .env and fill in your credentials', 'yellow');
        log('  Run: cp .env.example .env', 'cyan');
        return false;
    }
    
    log('✓ .env file exists', 'green');
    
    // Check if .env.example exists (for reference)
    if (fs.existsSync('./.env.example')) {
        log('✓ .env.example file exists (for reference)', 'green');
    }
    
    // Read .env and check for required variables
    try {
        const envContent = fs.readFileSync('./.env', 'utf8');
        const requiredVars = ['EMAIL_USER', 'EMAIL_APP_PASSWORD'];
        const optionalVars = ['PORT', 'TEST_EMAIL', 'NODE_ENV'];
        
        let allRequiredPresent = true;
        
        log('\n  Required environment variables:', 'cyan');
        for (const varName of requiredVars) {
            const regex = new RegExp(`^${varName}=`);
            if (regex.test(envContent)) {
                // Check if it's set to a non-default value
                const match = envContent.match(new RegExp(`^${varName}=(.+)$`, 'm'));
                const value = match ? match[1] : '';
                if (value && !value.includes('your-') && !value.includes('example.com')) {
                    log(`  ✓ ${varName}: ***configured***`, 'green');
                } else {
                    log(`  ⚠ ${varName}: needs to be configured`, 'yellow');
                    allRequiredPresent = false;
                }
            } else {
                log(`  ✗ ${varName}: missing`, 'red');
                allRequiredPresent = false;
            }
        }
        
        log('\n  Optional environment variables:', 'cyan');
        for (const varName of optionalVars) {
            const regex = new RegExp(`^${varName}=`);
            if (regex.test(envContent)) {
                log(`  ✓ ${varName}: set`, 'green');
            } else {
                log(`  ○ ${varName}: not set (will use defaults)`, 'yellow');
            }
        }
        
        return allRequiredPresent;
    } catch (error) {
        log('✗ Error reading .env file', 'red');
        return false;
    }
}

function checkHtmlFiles() {
    log('\n📄 Checking HTML files...', 'blue');
    
    const fs = require('fs');
    const requiredFiles = [
        { name: 'index.html', description: 'Client booking page' },
        { name: 'admin.html', description: 'Admin panel' }
    ];
    
    let allFound = true;
    
    for (const file of requiredFiles) {
        if (fs.existsSync(`./${file.name}`)) {
            log(`✓ ${file.name} (${file.description})`, 'green');
            
            // Check if API URL is configured
            const content = fs.readFileSync(`./${file.name}`, 'utf8');
            if (content.includes('YOUR_SHEETDB_API_ID') || content.includes('sheetdb.io/api/v1/YOUR_')) {
                log(`  ⚠ SheetDB URL needs to be configured`, 'yellow');
                allFound = false;
            }
        } else {
            log(`✗ ${file.name} not found`, 'red');
            allFound = false;
        }
    }
    
    return allFound;
}

function checkServerPort() {
    log('\n🌐 Checking server port...', 'blue');
    
    const fs = require('fs');
    try {
        const envContent = fs.readFileSync('./.env', 'utf8');
        const match = envContent.match(/^PORT=(.+)$/m);
        const port = match ? match[1].trim() : '3000';
        
        log(`✓ Configured port: ${port}`, 'green');
        log(`  Server will run at: http://localhost:${port}`, 'cyan');
        
        return port;
    } catch (error) {
        log('⚠ Using default port: 3000', 'yellow');
        return '3000';
    }
}

function checkServerRunning(port) {
    log('\n🔄 Checking if server is running...', 'blue');
    
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const health = JSON.parse(data);
                    if (health.status === 'ok') {
                        log('✓ Server is running and healthy!', 'green');
                        log(`  Service: ${health.service}`, 'cyan');
                        log(`  Timestamp: ${health.timestamp}`, 'cyan');
                        resolve(true);
                    } else {
                        log('✗ Server returned unexpected response', 'red');
                        resolve(false);
                    }
                } catch (error) {
                    log('✗ Invalid response from server', 'red');
                    resolve(false);
                }
            });
        });
        
        req.on('error', () => {
            log('✗ Server is not running', 'yellow');
            log(`  Start it with: npm start`, 'cyan');
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            log('✗ Server request timed out', 'red');
            resolve(false);
        });
    });
}

async function checkEmailService(port) {
    log('\n📧 Checking email service endpoint...', 'blue');
    
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, (res) => {
            log('✓ Email service endpoint is accessible', 'green');
            log(`  Test email: http://localhost:${port}/test`, 'cyan');
            log(`  Send confirmation: http://localhost:${port}/send-confirmation`, 'cyan');
            resolve(true);
        });
        
        req.on('error', () => {
            log('✗ Cannot reach email service', 'red');
            resolve(false);
        });
    });
}

function printSummary(results) {
    log('\n' + '='.repeat(50), 'blue');
    log('📊 HEALTH CHECK SUMMARY', 'blue');
    log('='.repeat(50), 'blue');
    
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(r => r).length;
    
    log(`\nPassed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
    
    if (passed === total) {
        log('\n✨ All checks passed! Your server is ready to go.', 'green');
        log('\nNext steps:', 'blue');
        log('  1. Start the server: npm start', 'cyan');
        log('  2. Test email: curl http://localhost:' + results.port + '/test', 'cyan');
        log('  3. Open index.html in your browser', 'cyan');
        log('  4. Open admin.html in your browser', 'cyan');
    } else {
        log('\n⚠️  Some checks failed. Please fix the issues above.', 'yellow');
        log('\nCommon fixes:', 'blue');
        log('  - Run: npm install', 'cyan');
        log('  - Run: cp .env.example .env', 'cyan');
        log('  - Edit .env with your credentials', 'cyan');
        log('  - Update SheetDB URLs in HTML files', 'cyan');
    }
    
    log('\n' + '='.repeat(50) + '\n', 'blue');
}

async function main() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   🌙 Luna Massage - Server Health Check    ║');
    console.log('╚══════════════════════════════════════════════╝');
    
    const results = {};
    
    results.nodeVersion = checkNodeVersion();
    results.dependencies = checkDependencies();
    results.envFile = checkEnvFile();
    results.htmlFiles = checkHtmlFiles();
    results.port = checkServerPort();
    
    if (results.nodeVersion && results.dependencies && results.envFile) {
        results.serverRunning = await checkServerRunning(results.port);
        
        if (results.serverRunning) {
            results.emailService = await checkEmailService(results.port);
        } else {
            results.emailService = false;
        }
    } else {
        results.serverRunning = false;
        results.emailService = false;
    }
    
    printSummary(results);
    
    process.exit(results.serverRunning ? 0 : 1);
}

// Run the health check
main().catch(error => {
    console.error('Error running health check:', error);
    process.exit(1);
});
