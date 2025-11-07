/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./assets/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        "neon-yellow": "#f7ff00",
        "title-blue": "#00c6ff",
      },
      fontFamily: {
        racing: ["Racing Sans One", "sans-serif"],
      },
    },
  },
  plugins: [],
};
