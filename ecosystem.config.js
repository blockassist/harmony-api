module.exports = {
  apps : [{
    name      : "blockassist-harmony",
    script    : "build/src/main.js",
    instances : "1",
    exec_mode : "cluster",
    env: {
      NODE_ENV: process.env.NODE_ENV
    },
  }]
}
