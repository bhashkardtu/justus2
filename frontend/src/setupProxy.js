const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(createProxyMiddleware('/api', { target: 'https://justus-9hwt.onrender.com', changeOrigin: true }));
};
