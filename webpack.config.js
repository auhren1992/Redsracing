const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    main: './assets/js/main.js',
    router: './assets/js/router.js',
    "redsracing-dashboard": './assets/js/redsracing-dashboard.js',
    "follower-dashboard": './assets/js/follower-dashboard.js',
    "follower-login": './assets/js/follower-login.js',
    "auth-guard": './assets/js/auth-guard.js',
    feedback: './assets/js/feedback.js',
    gallery: './assets/js/gallery.js',
    jonny: './assets/js/jonny.js',
    leaderboard: './assets/js/leaderboard.js',
    'login-page': './assets/js/login-page.js',
    navigation: './assets/js/navigation.js',
    profile: './assets/js/profile.js',
    'profile-inline-fallback': './assets/js/profile-inline-fallback.js',
    qna: './assets/js/qna.js',
    schedule: './assets/js/schedule.js',
    'signup-page': './assets/js/signup-page.js',
    sponsorship: './assets/js/sponsorship.js',
    videos: './assets/js/videos.js',
    'leaderboard-inline-fallback': './assets/js/leaderboard-inline-fallback.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true, // Clean the output directory before emit
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']
                },
                modules: false
              }]
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy all HTML files
        { from: '*.html', to: '' },
        // Copy styles
        { from: 'styles', to: 'styles' },
        // Copy static assets
        { from: '*.png', to: '', noErrorOnMissing: true },
        { from: '*.ico', to: '', noErrorOnMissing: true },
        { from: '*.svg', to: '', noErrorOnMissing: true },
        { from: '*.webmanifest', to: '', noErrorOnMissing: true },
        { from: 'site.webmanifest', to: '', noErrorOnMissing: true },
        // Copy other static files
        { from: 'apple-touch-icon.png', to: '', noErrorOnMissing: true },
        { from: 'hero-bg.png', to: '', noErrorOnMissing: true },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.json'],
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        firebase: {
          test: /[\\/]node_modules[\\/]firebase[\\/]/,
          name: 'firebase',
          chunks: 'all',
        },
      },
    },
  },
};