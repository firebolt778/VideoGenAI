module.exports = {
  apps: [
    {
      name: "video-gen-ai",
      cwd: "/root/VideoGenAI",
      script: "npm",
      args: "start",
      interpreter: "/root/.nvm/versions/node/v23.11.1/bin/node",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};