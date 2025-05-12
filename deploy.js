import { execSync } from 'child_process';
import fs from 'fs';

// Clean up any existing files that might cause issues
try {
    if (fs.existsSync('.npmrc')) {
        console.log('Backing up .npmrc...');
        fs.renameSync('.npmrc', '.npmrc.backup');
    }

    console.log('Creating new .npmrc with legacy peer deps setting...');
    fs.writeFileSync('.npmrc', 'legacy-peer-deps=true\nloglevel=error\n');

    // Remove package-lock.json to avoid dependency conflicts
    if (fs.existsSync('package-lock.json')) {
        console.log('Removing package-lock.json...');
        fs.unlinkSync('package-lock.json');
    }

    console.log('Installing dependencies without package lock...');
    execSync('npm install --no-package-lock', { stdio: 'inherit' });

    console.log('Building project...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('Deploying to Vercel...');
    execSync('vercel --prod', { stdio: 'inherit' });

    console.log('Deployment complete!');
} catch (error) {
    console.error('Deployment failed:', error);

    // Restore backup files
    if (fs.existsSync('.npmrc.backup')) {
        fs.renameSync('.npmrc.backup', '.npmrc');
    }
} 