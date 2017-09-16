const path = require('path');
module.exports = {
    context: __dirname + '/src',
    entry: {
        'entry': './entry'
    },
    output: {
        path: __dirname + '/public',
        filename: 'bundle.js',
        library: 'emscripten_example'
    },
    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
            query: {
                presets: ['es2015', 'react']
            }
        },
        {
            test: /\.wasm/,
            loader: 'wasm-loader'
        },
        {
            test: /\.css$/,
            loader: 'style-loader!css-loader'
        }]
    },
    devServer: {
        contentBase: path.resolve(__dirname, 'public'),
        port: 8081,
    },
    node: {
        fs: "empty"
    }
};
