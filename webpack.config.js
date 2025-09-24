const path = require('path');

module.exports = {
  entry: {
    dashboard: './assets/js/dashboard.js',
    profile: './assets/js/profile.js',
    jonny: './assets/js/jonny.js',
    qna: './assets/js/qna.js',
    leaderboard: './assets/js/leaderboard.js',
    gallery: './assets/js/gallery.js',
    'signup-page': './assets/js/signup-page.js',
    'login-page': './assets/js/login-page.js',
    sponsorship: './assets/js/sponsorship.js',
    main: './assets/js/main.js',
    navigation: './assets/js/navigation.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};