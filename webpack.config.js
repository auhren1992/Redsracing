const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    main: './assets/js/main.js',
    dashboard: './assets/js/dashboard.js',
    feedback: './assets/js/feedback.js',
    gallery: './assets/js/gallery.js',
    jonny: './assets/js/jonny.js',
    leaderboard: './assets/js/leaderboard.js',
    'login-page': './assets/js/login-page.js',
    profile: './assets/js/profile.js',
    qna: './assets/js/qna.js',
    schedule: './assets/js/schedule.js',
    signup: './assets/js/signup-page.js',
    sponsorship: './assets/js/sponsorship.js',
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
};
