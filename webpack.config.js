const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    'auth-guard': './assets/js/auth-guard.js',
    feedback: './assets/js/feedback.js',
    'follower-dashboard': './assets/js/follower-dashboard.js',
    'follower-login': './assets/js/follower-login.js',
    gallery: './assets/js/gallery.js',
    jonny: './assets/js/jonny.js',
    leaderboard: './assets/js/leaderboard.js',
    'login-page': './assets/js/login-page.js',
    main: './assets/js/main.js',
    navigation: './assets/js/navigation.js',
    profile: './assets/js/profile.js',
    qna: './assets/js/qna.js',
    'redsracing-dashboard': './assets/js/redsracing-dashboard.js',
    router: './assets/js/router.js',
    schedule: './assets/js/schedule.js',
    'signup-page': './assets/js/signup-page.js',
    sponsorship: './assets/js/sponsorship.js',
    'team-members': './assets/js/team-members.js',
    videos: './assets/js/videos.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
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
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'styles', to: 'styles' },
        { from: '*.html', to: '' },
        { from: '*.png', to: '' },
        { from: '*.ico', to: '' },
        { from: '*.svg', to: '' },
        { from: 'site.webmanifest', to: '' },
      ],
    }),
  ],
};