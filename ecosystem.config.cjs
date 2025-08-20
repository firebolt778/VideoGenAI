module.exports = {
  apps: [
    {
      name: "video-gen-ai",
      cwd: "/root/VideoGenAI",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};