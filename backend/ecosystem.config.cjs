module.exports = {
  apps: [
    {
      name: 'rukotvornoe-api',
      cwd: '/var/www/rukotvornoe/backend',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
};
