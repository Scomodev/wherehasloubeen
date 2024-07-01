const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
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
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html', // Path to your index.html file
      filename: 'index.html'       // Output filename in dist directory
    }),
    new Dotenv({
        path: './.env',  // Path to your .env file (if needed)
        safe: true,      // Load only variables that are defined
        systemvars: true  // Load system environment variables
      })
  ]
};
