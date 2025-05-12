// deploy-railway.js
import { execSync } from 'child_process';
import fs from 'fs';

console.log('Starting Railway deployment process...');

try {
    // Clean previous builds
    if (fs.existsSync('dist')) {
        console.log('Cleaning previous build...');
        fs.rmSync('dist', { recursive: true, force: true });
    }

    // Build the application
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Deploy to Railway
    console.log('Deploying to Railway...');
    execSync('railway up', { stdio: 'inherit' });

    console.log('Deployment completed successfully!');
} catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
} 